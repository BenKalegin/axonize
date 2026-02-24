import { promises as fs } from "node:fs";
import path from "node:path";
import { buildDeterministicEdges, buildNodes } from "./graph";
import { repairGraph, validateGraph } from "./integrity";
import { parseMarkdown } from "./markdown";
import { Block, ENGINE_VERSION, RebuildReport, SCHEMA_VERSION } from "./models";
import {
  buildFilesState,
  discoverMarkdownFiles,
  ensureSidecar,
  loadEdges,
  loadNodes,
  loadState,
  saveEdges,
  saveNodes,
  saveState
} from "./storage";

function cacheKey(filePath: string, fileHash: string): string {
  const safe = filePath.replace(/\//g, "__").replace(/\./g, "_");
  return `${safe}.${fileHash}.json`;
}

function serializeBlock(block: Block): Record<string, unknown> {
  return {
    id: block.id,
    type: block.type,
    file: block.file,
    heading_path: block.headingPath,
    title: block.title,
    content: block.content,
    content_hash: block.contentHash,
    structure_hash: block.structureHash,
    last_seen_timestamp: block.lastSeenTimestamp,
    start_line: block.startLine,
    end_line: block.endLine,
    link_targets: block.linkTargets,
    annotations: block.annotations.map((item) => ({ relation: item.relation, raw_target: item.rawTarget }))
  };
}

function deserializeBlock(payload: Record<string, unknown>): Block | null {
  try {
    const type = String(payload.type ?? "");
    const annotations = Array.isArray(payload.annotations)
      ? payload.annotations
          .filter((item) => item && typeof item === "object")
          .map((item) => {
            const value = item as Record<string, unknown>;
            return { relation: String(value.relation), rawTarget: String(value.raw_target) };
          })
      : [];
    return {
      id: String(payload.id ?? ""),
      type: type as Block["type"],
      file: String(payload.file ?? ""),
      headingPath: Array.isArray(payload.heading_path) ? payload.heading_path.map((part) => String(part)) : [],
      title: String(payload.title ?? ""),
      content: String(payload.content ?? ""),
      contentHash: String(payload.content_hash ?? ""),
      structureHash: String(payload.structure_hash ?? ""),
      lastSeenTimestamp: Number(payload.last_seen_timestamp ?? Date.now()),
      startLine: Number(payload.start_line ?? 1),
      endLine: Number(payload.end_line ?? 1),
      linkTargets: Array.isArray(payload.link_targets) ? payload.link_targets.map((item) => String(item)) : [],
      annotations: annotations.map((item) => ({ relation: item.relation as Block["annotations"][number]["relation"], rawTarget: item.rawTarget }))
    };
  } catch {
    return null;
  }
}

export class SemanticEngine {
  readonly repoRoot: string;
  private readonly sidecarPromise: Promise<string>;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
    this.sidecarPromise = ensureSidecar(repoRoot);
  }

  private async sidecar(): Promise<string> {
    return this.sidecarPromise;
  }

  private async cachePath(filePath: string, fileHash: string): Promise<string> {
    const sidecar = await this.sidecar();
    return path.join(sidecar, "cache", cacheKey(filePath, fileHash));
  }

  private async loadCachedBlocks(filePath: string, fileHash: string): Promise<Block[] | null> {
    const cacheFile = await this.cachePath(filePath, fileHash);
    try {
      const raw = await fs.readFile(cacheFile, "utf8");
      const payload = JSON.parse(raw) as Array<Record<string, unknown>>;
      if (!Array.isArray(payload)) {
        return null;
      }
      const blocks = payload.map((item) => deserializeBlock(item)).filter((item): item is Block => item !== null);
      return blocks.length > 0 ? blocks : null;
    } catch {
      return null;
    }
  }

  private async saveCachedBlocks(filePath: string, fileHash: string, blocks: readonly Block[]): Promise<void> {
    const cacheFile = await this.cachePath(filePath, fileHash);
    await fs.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.writeFile(cacheFile, `${JSON.stringify(blocks.map((block) => serializeBlock(block)), null, 2)}\n`, "utf8");

    const safePrefix = filePath.replace(/\//g, "__").replace(/\./g, "_");
    const cacheDir = path.dirname(cacheFile);
    for (const entry of await fs.readdir(cacheDir)) {
      if (!entry.startsWith(`${safePrefix}.`) || entry === path.basename(cacheFile)) {
        continue;
      }
      await fs.unlink(path.join(cacheDir, entry)).catch(() => {});
    }
  }

  async rebuild(options: { full?: boolean } = {}): Promise<RebuildReport> {
    let forceFull = Boolean(options.full);
    const warnings: string[] = [];
    const sidecar = await this.sidecar();

    let previousState = await loadState(sidecar);
    if (!previousState) {
      forceFull = true;
      warnings.push("state_missing_or_invalid:forcing_full_rebuild");
      previousState = {};
    }

    if (String(previousState.schema_version ?? "") && previousState.schema_version !== SCHEMA_VERSION) {
      forceFull = true;
      warnings.push("schema_version_mismatch:forcing_full_rebuild");
    }
    if (String(previousState.engine_version ?? "") && previousState.engine_version !== ENGINE_VERSION) {
      forceFull = true;
      warnings.push("engine_version_mismatch:forcing_full_rebuild");
    }

    const files = await discoverMarkdownFiles(this.repoRoot);
    if (files.length === 0) {
      warnings.push("no_docs_found:expected_markdown_under_docs");
    }
    const filesState = await buildFilesState(this.repoRoot, files);

    const previousFilesRaw = previousState.files;
    const previousFilesState =
      previousFilesRaw && typeof previousFilesRaw === "object" ? (previousFilesRaw as Record<string, { file_hash?: string }>) : {};

    const deletedFiles = Object.keys(previousFilesState)
      .filter((file) => !files.includes(file))
      .sort();

    const changedFiles: string[] = [];
    for (const filePath of files) {
      if (forceFull) {
        changedFiles.push(filePath);
        continue;
      }
      const current = filesState[filePath];
      const previous = previousFilesState[filePath];
      if (!previous || previous.file_hash !== current.file_hash) {
        changedFiles.push(filePath);
      }
    }

    const allBlocks: Block[] = [];
    for (const filePath of files) {
      const integrity = filesState[filePath];
      if (!forceFull && !changedFiles.includes(filePath)) {
        const cached = await this.loadCachedBlocks(filePath, integrity.file_hash);
        if (cached) {
          allBlocks.push(...cached);
          continue;
        }
        changedFiles.push(filePath);
        warnings.push(`cache_miss:${filePath}:reparsed`);
      }

      const content = await fs.readFile(path.join(this.repoRoot, filePath), "utf8");
      const blocks = parseMarkdown(filePath, content, Date.now());
      allBlocks.push(...blocks);
      await this.saveCachedBlocks(filePath, integrity.file_hash, blocks);
    }

    let nodes = buildNodes(allBlocks);
    let edges = buildDeterministicEdges(allBlocks);

    const errors = validateGraph(nodes, edges);
    if (errors.length > 0) {
      warnings.push(...errors.map((item) => `invariant_violation:${item}`));
      const repaired = repairGraph(nodes, edges);
      nodes = repaired.nodes;
      edges = repaired.edges;
      warnings.push(...repaired.warnings);
    }

    await saveNodes(sidecar, nodes);
    await saveEdges(sidecar, edges);
    await saveState(sidecar, {
      schema_version: SCHEMA_VERSION,
      engine_version: ENGINE_VERSION,
      files: filesState
    });

    return {
      processed_files: files.length,
      changed_files: [...new Set(changedFiles)].sort(),
      deleted_files: deletedFiles,
      nodes_written: nodes.length,
      edges_written: edges.length,
      warnings
    };
  }

  async check(): Promise<string[]> {
    const sidecar = await this.sidecar();
    const nodes = await loadNodes(sidecar);
    const edges = await loadEdges(sidecar);
    if (nodes.length === 0 && edges.length === 0) {
      return ["missing_or_empty_graph"];
    }
    return validateGraph(nodes, edges);
  }

  async loadGraph(): Promise<{
    state: Record<string, unknown> | null;
    nodes: Awaited<ReturnType<typeof loadNodes>>;
    edges: Awaited<ReturnType<typeof loadEdges>>;
  }> {
    const sidecar = await this.sidecar();
    const [state, nodes, edges] = await Promise.all([loadState(sidecar), loadNodes(sidecar), loadEdges(sidecar)]);
    return { state, nodes, edges };
  }
}
