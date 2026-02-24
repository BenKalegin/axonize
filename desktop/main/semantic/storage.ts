import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { BlockType, Edge, EdgeOrigin, FileIntegrityState, Node, RelationType, isBlockType, isRelationType } from "./models";

const HEADING_ONLY_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/gm;

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

export async function ensureSidecar(repoRoot: string): Promise<string> {
  const sidecar = path.join(repoRoot, ".semantic");
  await fs.mkdir(path.join(sidecar, "cache"), { recursive: true });
  return sidecar;
}

export async function discoverMarkdownFiles(repoRoot: string): Promise<string[]> {
  const docsRoot = path.join(repoRoot, "docs");
  async function walk(dir: string): Promise<string[]> {
    let entries: Array<import("node:fs").Dirent>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await walk(fullPath)));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(path.relative(repoRoot, fullPath).split(path.sep).join("/"));
      }
    }
    return files;
  }

  const files = await walk(docsRoot);
  files.sort();
  return files;
}

export async function sha256File(filePath: string): Promise<string> {
  const digest = createHash("sha256");
  const content = await fs.readFile(filePath);
  digest.update(content);
  return digest.digest("hex");
}

export function headingStructureHash(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const headings: string[] = [];
  HEADING_ONLY_RE.lastIndex = 0;
  for (const match of normalized.matchAll(HEADING_ONLY_RE)) {
    const level = (match[1] ?? "").length;
    const title = (match[2] ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    headings.push(`${level}:${title}`);
  }
  return createHash("sha256").update(headings.join("\n"), "utf8").digest("hex");
}

export async function buildFilesState(repoRoot: string, files: readonly string[]): Promise<Record<string, FileIntegrityState>> {
  const state: Record<string, FileIntegrityState> = {};
  for (const filePath of files) {
    const fullPath = path.join(repoRoot, filePath);
    const content = await fs.readFile(fullPath, "utf8");
    state[filePath] = {
      file_hash: await sha256File(fullPath),
      structure_hash: headingStructureHash(content)
    };
  }
  return state;
}

export async function loadState(sidecar: string): Promise<Record<string, unknown> | null> {
  const payload = await readJson<Record<string, unknown>>(path.join(sidecar, "state.json"));
  if (payload && typeof payload === "object") {
    return payload;
  }
  return null;
}

export async function saveState(sidecar: string, payload: Record<string, unknown>): Promise<void> {
  await writeJson(path.join(sidecar, "state.json"), payload);
}

export async function loadNodes(sidecar: string): Promise<Node[]> {
  const payload = await readJson<Array<Record<string, unknown>>>(path.join(sidecar, "nodes.json"));
  if (!Array.isArray(payload)) {
    return [];
  }

  const nodes: Node[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const type = String(item.type ?? "");
    if (!isBlockType(type)) {
      continue;
    }
    nodes.push({
      id: String(item.id ?? ""),
      type: type as BlockType,
      file: String(item.file ?? ""),
      title: String(item.title ?? ""),
      content_hash: String(item.content_hash ?? ""),
      structure_hash: String(item.structure_hash ?? "")
    });
  }
  return nodes.filter((node) => node.id.length > 0 && node.file.length > 0);
}

export async function saveNodes(sidecar: string, nodes: readonly Node[]): Promise<void> {
  const sorted = [...nodes].sort((a, b) => `${a.file}|${a.id}`.localeCompare(`${b.file}|${b.id}`));
  await writeJson(path.join(sidecar, "nodes.json"), sorted);
}

export async function loadEdges(sidecar: string): Promise<Edge[]> {
  const payload = await readJson<Array<Record<string, unknown>>>(path.join(sidecar, "edges.json"));
  if (!Array.isArray(payload)) {
    return [];
  }

  const edges: Edge[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const type = String(item.type ?? "");
    if (!isRelationType(type)) {
      continue;
    }
    const origin = String(item.origin ?? "deterministic");
    const safeOrigin: EdgeOrigin = origin === "inferred" ? "inferred" : "deterministic";
    edges.push({
      source: String(item.source ?? ""),
      target: String(item.target ?? ""),
      type: type as RelationType,
      weight: Number(item.weight ?? 1),
      confidence: Number(item.confidence ?? 1),
      origin: safeOrigin
    });
  }
  return edges.filter((edge) => edge.source.length > 0 && edge.target.length > 0);
}

export async function saveEdges(sidecar: string, edges: readonly Edge[]): Promise<void> {
  const sorted = [...edges].sort((a, b) =>
    `${a.source}|${a.type}|${a.target}|${a.origin}`.localeCompare(`${b.source}|${b.type}|${b.target}|${b.origin}`)
  );
  await writeJson(path.join(sidecar, "edges.json"), sorted);
}
