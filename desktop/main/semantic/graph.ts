import path from "node:path";
import { Block, BlockType, Edge, Node, RelationType } from "./models";
import { normalizeHeading, slugifyHeading } from "./normalization";

function normalizeDocPath(value: string): string {
  return value.split(path.sep).join("/");
}

function resolveRelativePath(currentFile: string, candidate: string): string {
  const base = path.posix.dirname(currentFile);
  return normalizeDocPath(path.posix.normalize(path.posix.join(base, candidate)));
}

export function buildNodes(blocks: readonly Block[]): Node[] {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    file: block.file,
    title: block.title,
    content_hash: block.contentHash,
    structure_hash: block.structureHash
  }));
}

export function buildReferenceIndex(blocks: readonly Block[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const block of blocks) {
    const fileKey = normalizeDocPath(block.file);
    index.set(block.id, block.id);

    if (block.type === "document") {
      index.set(fileKey, block.id);
      if (fileKey.endsWith(".md")) {
        index.set(fileKey.slice(0, -3), block.id);
      }
    }

    if (block.type === "section" && block.headingPath.length > 0) {
      const leaf = slugifyHeading(block.headingPath[block.headingPath.length - 1]);
      const full = block.headingPath.map((segment) => slugifyHeading(segment)).filter(Boolean).join("-");
      index.set(`${fileKey}#${leaf}`, block.id);
      index.set(`${fileKey}#${full}`, block.id);
      if (fileKey.endsWith(".md")) {
        const short = fileKey.slice(0, -3);
        index.set(`${short}#${leaf}`, block.id);
        index.set(`${short}#${full}`, block.id);
      }
    }
  }

  return index;
}

function normalizeTarget(rawTarget: string, sourceFile: string): { path: string | null; anchor: string | null } {
  const target = rawTarget.trim();
  if (target.length === 0) {
    return { path: null, anchor: null };
  }

  if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:")) {
    return { path: null, anchor: null };
  }

  if (target.startsWith("#")) {
    return { path: normalizeDocPath(sourceFile), anchor: target.slice(1) };
  }

  if (target.includes("#")) {
    const [pathPartRaw, anchor] = target.split("#", 2);
    let pathPart = pathPartRaw;
    if (!pathPart) {
      pathPart = sourceFile;
    } else if (pathPart.startsWith("/")) {
      pathPart = pathPart.replace(/^\/+/, "");
    } else if (pathPart.startsWith("docs/")) {
      pathPart = pathPart;
    } else {
      pathPart = resolveRelativePath(sourceFile, pathPart);
    }
    return { path: normalizeDocPath(pathPart), anchor };
  }

  let pathPart = target;
  if (pathPart.startsWith("/")) {
    pathPart = pathPart.replace(/^\/+/, "");
  } else if (pathPart.startsWith("docs/")) {
    pathPart = pathPart;
  } else {
    pathPart = resolveRelativePath(sourceFile, pathPart);
  }
  return { path: normalizeDocPath(pathPart), anchor: null };
}

export function resolveTarget(rawTarget: string, sourceFile: string, referenceIndex: Map<string, string>): string | null {
  if (referenceIndex.has(rawTarget)) {
    return referenceIndex.get(rawTarget) ?? null;
  }

  const normalized = normalizeTarget(rawTarget, sourceFile);
  if (!normalized.path) {
    return null;
  }

  const candidates = [normalized.path];
  if (!normalized.path.endsWith(".md")) {
    candidates.push(`${normalized.path}.md`);
  }
  if (normalized.path.endsWith(".md")) {
    candidates.push(normalized.path.slice(0, -3));
  }

  if (!normalized.anchor) {
    for (const candidate of candidates) {
      if (referenceIndex.has(candidate)) {
        return referenceIndex.get(candidate) ?? null;
      }
    }
    return null;
  }

  const anchorText = normalizeHeading(normalized.anchor);
  const anchorSlug = slugifyHeading(anchorText);
  for (const candidate of candidates) {
    for (const key of [`${candidate}#${anchorText}`, `${candidate}#${anchorText.toLowerCase()}`, `${candidate}#${anchorSlug}`]) {
      if (referenceIndex.has(key)) {
        return referenceIndex.get(key) ?? null;
      }
    }
  }

  return null;
}

function dedupeEdges(edges: readonly Edge[]): Edge[] {
  const unique = new Map<string, Edge>();
  for (const edge of edges) {
    const key = `${edge.source}::${edge.target}::${edge.type}::${edge.origin}`;
    const existing = unique.get(key);
    if (!existing || edge.weight > existing.weight || edge.confidence > existing.confidence) {
      unique.set(key, edge);
    }
  }
  return [...unique.values()].sort((a, b) => {
    const aKey = `${a.source}|${a.type}|${a.target}|${a.origin}`;
    const bKey = `${b.source}|${b.type}|${b.target}|${b.origin}`;
    return aKey.localeCompare(bKey);
  });
}

export function buildDeterministicEdges(blocks: readonly Block[]): Edge[] {
  const referenceIndex = buildReferenceIndex(blocks);
  const sectionByPath = new Map<string, string>();
  const documentByFile = new Map<string, string>();

  for (const block of blocks) {
    if (block.type === "section") {
      sectionByPath.set(`${block.file}::${block.headingPath.join(" / ")}`, block.id);
    } else if (block.type === "document") {
      documentByFile.set(block.file, block.id);
    }
  }

  const edges: Edge[] = [];
  for (const block of blocks) {
    if (block.type === "section" && block.headingPath.length > 1) {
      const parentPath = block.headingPath.slice(0, -1);
      const parent = sectionByPath.get(`${block.file}::${parentPath.join(" / ")}`);
      if (parent) {
        edges.push({
          source: block.id,
          target: parent,
          type: "extends",
          weight: 1.0,
          confidence: 1.0,
          origin: "deterministic"
        });
      }
    }

    if (block.type !== "document" && block.type !== "section") {
      let owner: string | undefined;
      if (block.headingPath.length > 0) {
        owner = sectionByPath.get(`${block.file}::${block.headingPath.join(" / ")}`);
      }
      if (!owner) {
        owner = documentByFile.get(block.file);
      }
      if (owner) {
        edges.push({
          source: owner,
          target: block.id,
          type: "defines",
          weight: 1.0,
          confidence: 1.0,
          origin: "deterministic"
        });
      }
    }

    for (const targetRef of block.linkTargets) {
      const targetId = resolveTarget(targetRef, block.file, referenceIndex);
      if (!targetId) {
        continue;
      }
      edges.push({
        source: block.id,
        target: targetId,
        type: "depends_on",
        weight: 1.0,
        confidence: 1.0,
        origin: "deterministic"
      });
    }

    for (const annotation of block.annotations) {
      const targetId = resolveTarget(annotation.rawTarget, block.file, referenceIndex);
      if (!targetId) {
        continue;
      }
      edges.push({
        source: block.id,
        target: targetId,
        type: annotation.relation as RelationType,
        weight: 1.0,
        confidence: 1.0,
        origin: "deterministic"
      });
    }
  }

  return dedupeEdges(edges);
}
