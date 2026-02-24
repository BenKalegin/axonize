import { createHash } from "node:crypto";

export const INLINE_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
export const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stripTrailingSpaces(text: string): string {
  return normalizeLineEndings(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

export function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n");
}

export function normalizeWhitespaceRuns(text: string): string {
  return text.replace(/[ \t]+/g, " ");
}

export function normalizeForContentHash(text: string): string {
  let normalized = stripTrailingSpaces(text);
  normalized = collapseBlankLines(normalized);
  normalized = normalizeWhitespaceRuns(normalized);
  return normalized.trim();
}

function stripMarkdownFormatting(text: string): string {
  let value = text.replace(INLINE_LINK_RE, (_, label, target) => `${String(label)} ${String(target)}`);
  value = value.replace(WIKI_LINK_RE, (_, target) => String(target));
  value = value.replace(/`{1,3}/g, "");
  value = value.replace(/[*_~]/g, "");
  value = value.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  value = value.replace(/^\s{0,3}>\s?/gm, "");
  value = value.replace(/^\s*[-*+]\s+/gm, "");
  value = value.replace(/^\s*\d+\.\s+/gm, "");
  return value;
}

export function normalizeForSignature(text: string): string {
  let normalized = normalizeForContentHash(text);
  normalized = stripMarkdownFormatting(normalized);
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(/\s+/g, " ");
  return normalized.trim();
}

export function normalizeHeading(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeHeadingPath(path: readonly string[]): string {
  if (path.length === 0) {
    return "/";
  }
  return path.map((part) => normalizeHeading(part).toLowerCase()).join(" / ");
}

export function slugifyHeading(text: string): string {
  let value = normalizeHeading(text).toLowerCase();
  value = value.replace(/[^\w\s-]/g, "");
  value = value.replace(/\s+/g, "-");
  value = value.replace(/-{2,}/g, "-");
  return value.replace(/^-+|-+$/g, "");
}
