import { promises as fs } from "node:fs";
import path from "node:path";
import { Block, CommandPayload, CommandResult } from "./models";
import { parseMarkdown } from "./markdown";

const SUPPORTED_COMMANDS = new Set(["rewrite"]);
const SUPPORTED_SCOPES = new Set(["block", "section"]);

function validatePayload(payload: CommandPayload): Required<CommandPayload> {
  const command = String(payload.command ?? "").trim().toLowerCase();
  const target = String(payload.target ?? "").trim();
  const instruction = String(payload.instruction ?? "").trim();
  const scope = String(payload.scope ?? "block").trim().toLowerCase();

  if (!SUPPORTED_COMMANDS.has(command)) {
    throw new Error(`unsupported_command:${command}`);
  }
  if (!target) {
    throw new Error("missing_target");
  }
  if (!instruction) {
    throw new Error("missing_instruction");
  }
  if (!SUPPORTED_SCOPES.has(scope)) {
    throw new Error(`unsupported_scope:${scope}`);
  }

  return { command: "rewrite", target, instruction, scope: scope as "block" | "section" };
}

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  let entries: Array<import("node:fs").Dirent>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  files.sort();
  return files;
}

async function findTargetBlock(repoRoot: string, targetId: string): Promise<{ file: string; content: string; blocks: Block[]; target: Block }> {
  const docsRoot = path.join(repoRoot, "docs");
  const files = await collectMarkdownFiles(docsRoot);
  for (const filePath of files) {
    const relative = path.relative(repoRoot, filePath).split(path.sep).join("/");
    const content = await fs.readFile(filePath, "utf8");
    const blocks = parseMarkdown(relative, content, Date.now());
    const target = blocks.find((block) => block.id === targetId);
    if (target) {
      return { file: relative, content, blocks, target };
    }
  }
  throw new Error("target_block_not_found");
}

function rewriteText(original: string, instruction: string): string {
  const lowered = instruction.toLowerCase();
  if (lowered.includes("concise") || lowered.includes("short")) {
    const sentenceEnd = original.indexOf(".");
    if (sentenceEnd > 0) {
      const concise = original.slice(0, sentenceEnd + 1).trim();
      if (concise) {
        return concise;
      }
    }
    const words = original.trim().split(/\s+/);
    return words.slice(0, Math.max(1, Math.min(20, words.length))).join(" ");
  }

  if (lowered.includes("bullet")) {
    const words = original.replace(/\n/g, " ").trim().split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let idx = 0; idx < words.length; idx += 8) {
      chunks.push(words.slice(idx, idx + 8).join(" "));
    }
    return chunks.map((chunk) => `- ${chunk}`).join("\n");
  }

  return original;
}

function scopeRange(blocks: readonly Block[], target: Block, scope: "block" | "section"): { startLine: number; endLine: number } {
  if (scope === "block") {
    return { startLine: target.startLine, endLine: target.endLine };
  }

  const related = blocks.filter(
    (block) =>
      block.file === target.file &&
      block.headingPath.length >= target.headingPath.length &&
      target.headingPath.every((segment, index) => block.headingPath[index] === segment)
  );
  if (related.length === 0) {
    return { startLine: target.startLine, endLine: target.endLine };
  }
  return {
    startLine: Math.min(...related.map((block) => block.startLine)),
    endLine: Math.max(...related.map((block) => block.endLine))
  };
}

function simpleUnifiedDiff(filePath: string, original: string, updated: string): string {
  if (original === updated) {
    return "";
  }
  const before = original.split("\n");
  const after = updated.split("\n");
  const lines: string[] = [`--- ${filePath}`, `+++ ${filePath}`];
  const max = Math.max(before.length, after.length);
  for (let idx = 0; idx < max; idx += 1) {
    const left = before[idx];
    const right = after[idx];
    if (left === right) {
      continue;
    }
    if (typeof left === "string") {
      lines.push(`-${left}`);
    }
    if (typeof right === "string") {
      lines.push(`+${right}`);
    }
  }
  return lines.join("\n");
}

export async function executeCommand(repoRoot: string, payload: CommandPayload, apply = false): Promise<CommandResult> {
  const command = validatePayload(payload);
  const located = await findTargetBlock(repoRoot, command.target);
  const range = scopeRange(located.blocks, located.target, command.scope);
  const replacement = rewriteText(located.target.content, command.instruction);

  const originalLines = located.content.split("\n");
  const replacementLines = replacement.split("\n");
  const nextLines = [...originalLines.slice(0, range.startLine - 1), ...replacementLines, ...originalLines.slice(range.endLine)];
  let updatedContent = nextLines.join("\n");
  if (located.content.endsWith("\n")) {
    updatedContent += "\n";
  }

  if (apply) {
    await fs.writeFile(path.join(repoRoot, located.file), updatedContent, "utf8");
  }

  const warnings: string[] = [];
  if (replacement === located.target.content) {
    warnings.push("rewrite_noop:instruction_produced_identical_text");
  }

  return {
    command: command.command,
    target: command.target,
    file: located.file,
    applied: apply,
    diff: simpleUnifiedDiff(located.file, located.content, updatedContent),
    warnings
  };
}
