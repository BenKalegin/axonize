import path from "node:path";
import { Block, BlockType, RelationAnnotation, RelationType, RELATION_TYPES } from "./models";
import {
  INLINE_LINK_RE,
  WIKI_LINK_RE,
  normalizeForContentHash,
  normalizeForSignature,
  normalizeHeading,
  normalizeHeadingPath,
  normalizeLineEndings,
  sha256Hex
} from "./normalization";

const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/;
const FENCE_RE = /^\s{0,3}(```|~~~)/;
const LIST_RE = /^\s{0,3}(?:[-*+]|\d+\.)\s+/;
const TABLE_SEPARATOR_RE = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*(?:\s*:?-{3,}:?\s*)?\|?\s*$/;
const CALLOUT_START_RE = /^\s*>\s*\[![A-Za-z0-9_-]+\]/;
const QUOTE_RE = /^\s*>/;
const ANNOTATION_RE =
  /@(?<relation>depends_on|defines|implements|extends|example_of|uses|alternative_to|related_to)\((?<target>[^)]+)\)/gi;

function extractLinks(content: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  INLINE_LINK_RE.lastIndex = 0;
  WIKI_LINK_RE.lastIndex = 0;

  for (const match of content.matchAll(INLINE_LINK_RE)) {
    const target = (match[2] ?? "").trim();
    if (target.length > 0 && !seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }

  for (const match of content.matchAll(WIKI_LINK_RE)) {
    const target = (match[1] ?? "").trim();
    if (target.length > 0 && !seen.has(target)) {
      seen.add(target);
      links.push(target);
    }
  }

  return links;
}

function extractAnnotations(content: string): RelationAnnotation[] {
  const annotations: RelationAnnotation[] = [];
  ANNOTATION_RE.lastIndex = 0;

  for (const match of content.matchAll(ANNOTATION_RE)) {
    const relation = (match.groups?.relation ?? "").toLowerCase();
    const target = (match.groups?.target ?? "").trim();
    if (target.length === 0) {
      continue;
    }
    if ((RELATION_TYPES as readonly string[]).includes(relation)) {
      annotations.push({ relation: relation as RelationType, rawTarget: target });
    }
  }
  return annotations;
}

function parseFrontmatter(lines: readonly string[]): { startIndex: number; annotations: RelationAnnotation[] } {
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { startIndex: 0, annotations: [] };
  }

  let end = -1;
  for (let idx = 1; idx < lines.length; idx += 1) {
    if (lines[idx].trim() === "---") {
      end = idx;
      break;
    }
  }
  if (end === -1) {
    return { startIndex: 0, annotations: [] };
  }

  const annotations: RelationAnnotation[] = [];
  for (let idx = 1; idx < end; idx += 1) {
    const row = lines[idx];
    const separator = row.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = row.slice(0, separator).trim().toLowerCase().replace(/-/g, "_");
    if (!(RELATION_TYPES as readonly string[]).includes(key)) {
      continue;
    }

    let value = row.slice(separator + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1);
    }
    for (const target of value.split(",").map((item) => item.trim()).filter(Boolean)) {
      annotations.push({ relation: key as RelationType, rawTarget: target });
    }
  }

  return { startIndex: end + 1, annotations };
}

function createBlock(args: {
  filePath: string;
  type: BlockType;
  headingPath: string[];
  title: string;
  content: string;
  startLine: number;
  endLine: number;
  timestamp: number;
  idCounter: Map<string, number>;
  extraAnnotations?: RelationAnnotation[];
}): Block {
  const pathSignature = normalizeHeadingPath(args.headingPath);
  const signature = normalizeForSignature(args.content);
  const baseId = sha256Hex(`${args.filePath}\n${pathSignature}\n${signature}`);
  const count = (args.idCounter.get(baseId) ?? 0) + 1;
  args.idCounter.set(baseId, count);
  const blockId = count === 1 ? baseId : `${baseId}~${count}`;

  const annotations = [...extractAnnotations(args.content)];
  if (args.extraAnnotations && args.extraAnnotations.length > 0) {
    annotations.push(...args.extraAnnotations);
  }

  return {
    id: blockId,
    type: args.type,
    file: args.filePath,
    headingPath: [...args.headingPath],
    title: args.title,
    content: args.content,
    contentHash: sha256Hex(normalizeForContentHash(args.content)),
    structureHash: sha256Hex(pathSignature),
    lastSeenTimestamp: args.timestamp,
    startLine: args.startLine,
    endLine: args.endLine,
    linkTargets: extractLinks(args.content),
    annotations
  };
}

export function parseMarkdown(filePath: string, content: string, timestamp: number = Date.now()): Block[] {
  const normalizedPath = filePath.split(path.sep).join("/");
  const normalizedContent = normalizeLineEndings(content);
  const lines = normalizedContent.split("\n");
  const blocks: Block[] = [];
  const idCounter = new Map<string, number>();
  const headingStack: Array<{ level: number; title: string }> = [];

  const frontmatter = parseFrontmatter(lines);

  blocks.push(
    createBlock({
      filePath: normalizedPath,
      type: "document",
      headingPath: [],
      title: path.posix.basename(normalizedPath),
      content: normalizedContent,
      startLine: 1,
      endLine: Math.max(lines.length, 1),
      timestamp,
      idCounter,
      extraAnnotations: frontmatter.annotations
    })
  );

  let idx = frontmatter.startIndex;

  while (idx < lines.length) {
    const line = lines[idx];
    if (!line.trim()) {
      idx += 1;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const headingTitle = normalizeHeading(heading[2]);
      while (headingStack.length > 0 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, title: headingTitle });

      blocks.push(
        createBlock({
          filePath: normalizedPath,
          type: "section",
          headingPath: headingStack.map((item) => item.title),
          title: headingTitle,
          content: headingTitle,
          startLine: idx + 1,
          endLine: idx + 1,
          timestamp,
          idCounter
        })
      );
      idx += 1;
      continue;
    }

    if (FENCE_RE.test(line)) {
      const start = idx;
      const fence = line.trim().slice(0, 3);
      idx += 1;
      while (idx < lines.length && !lines[idx].trim().startsWith(fence)) {
        idx += 1;
      }
      if (idx < lines.length) {
        idx += 1;
      }
      const end = idx;
      const contentSlice = lines.slice(start, end).join("\n").replace(/^\n+|\n+$/g, "");
      blocks.push(
        createBlock({
          filePath: normalizedPath,
          type: "code",
          headingPath: headingStack.map((item) => item.title),
          title: "code",
          content: contentSlice,
          startLine: start + 1,
          endLine: end,
          timestamp,
          idCounter
        })
      );
      continue;
    }

    if (CALLOUT_START_RE.test(line)) {
      const start = idx;
      idx += 1;
      while (idx < lines.length) {
        const candidate = lines[idx];
        if (QUOTE_RE.test(candidate) || !candidate.trim()) {
          idx += 1;
          continue;
        }
        break;
      }
      const end = idx;
      const contentSlice = lines.slice(start, end).join("\n").replace(/^\n+|\n+$/g, "");
      blocks.push(
        createBlock({
          filePath: normalizedPath,
          type: "callout",
          headingPath: headingStack.map((item) => item.title),
          title: "callout",
          content: contentSlice,
          startLine: start + 1,
          endLine: end,
          timestamp,
          idCounter
        })
      );
      continue;
    }

    if (LIST_RE.test(line)) {
      const start = idx;
      idx += 1;
      while (idx < lines.length) {
        const candidate = lines[idx];
        if (LIST_RE.test(candidate) || candidate.startsWith("  ") || candidate.startsWith("\t")) {
          idx += 1;
          continue;
        }
        if (!candidate.trim() && idx + 1 < lines.length && LIST_RE.test(lines[idx + 1])) {
          idx += 1;
          continue;
        }
        break;
      }
      const end = idx;
      const contentSlice = lines.slice(start, end).join("\n").replace(/^\n+|\n+$/g, "");
      blocks.push(
        createBlock({
          filePath: normalizedPath,
          type: "list",
          headingPath: headingStack.map((item) => item.title),
          title: "list",
          content: contentSlice,
          startLine: start + 1,
          endLine: end,
          timestamp,
          idCounter
        })
      );
      continue;
    }

    if (line.includes("|") && idx + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[idx + 1])) {
      const start = idx;
      idx += 2;
      while (idx < lines.length && lines[idx].includes("|")) {
        idx += 1;
      }
      const end = idx;
      const contentSlice = lines.slice(start, end).join("\n").replace(/^\n+|\n+$/g, "");
      blocks.push(
        createBlock({
          filePath: normalizedPath,
          type: "table",
          headingPath: headingStack.map((item) => item.title),
          title: "table",
          content: contentSlice,
          startLine: start + 1,
          endLine: end,
          timestamp,
          idCounter
        })
      );
      continue;
    }

    const start = idx;
    idx += 1;
    while (idx < lines.length) {
      const candidate = lines[idx];
      const isStartOfOtherBlock =
        HEADING_RE.test(candidate) ||
        FENCE_RE.test(candidate) ||
        CALLOUT_START_RE.test(candidate) ||
        LIST_RE.test(candidate) ||
        (candidate.includes("|") && idx + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[idx + 1]));
      if (!candidate.trim() || isStartOfOtherBlock) {
        break;
      }
      idx += 1;
    }
    const end = idx;
    const contentSlice = lines.slice(start, end).join("\n").replace(/^\n+|\n+$/g, "");
    blocks.push(
      createBlock({
        filePath: normalizedPath,
        type: "paragraph",
        headingPath: headingStack.map((item) => item.title),
        title: "paragraph",
        content: contentSlice,
        startLine: start + 1,
        endLine: end,
        timestamp,
        idCounter
      })
    );
  }

  return blocks;
}
