export const SCHEMA_VERSION = "1.0";
export const ENGINE_VERSION = "0.1";

export const BLOCK_TYPES = [
  "document",
  "section",
  "paragraph",
  "list",
  "code",
  "table",
  "callout"
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const RELATION_TYPES = [
  "depends_on",
  "defines",
  "implements",
  "extends",
  "example_of",
  "uses",
  "alternative_to",
  "related_to"
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const EDGE_ORIGINS = ["deterministic", "inferred"] as const;
export type EdgeOrigin = (typeof EDGE_ORIGINS)[number];

export interface RelationAnnotation {
  relation: RelationType;
  rawTarget: string;
}

export interface Block {
  id: string;
  type: BlockType;
  file: string;
  headingPath: string[];
  title: string;
  content: string;
  contentHash: string;
  structureHash: string;
  lastSeenTimestamp: number;
  startLine: number;
  endLine: number;
  linkTargets: string[];
  annotations: RelationAnnotation[];
}

export interface Node {
  id: string;
  type: BlockType;
  file: string;
  title: string;
  content_hash: string;
  structure_hash: string;
}

export interface Edge {
  source: string;
  target: string;
  type: RelationType;
  weight: number;
  confidence: number;
  origin: EdgeOrigin;
}

export interface FileIntegrityState {
  file_hash: string;
  structure_hash: string;
}

export interface RebuildReport {
  processed_files: number;
  changed_files: string[];
  deleted_files: string[];
  nodes_written: number;
  edges_written: number;
  warnings: string[];
}

export interface CommandPayload {
  command: "rewrite";
  target: string;
  instruction: string;
  scope?: "block" | "section";
}

export interface CommandResult {
  command: string;
  target: string;
  file: string;
  applied: boolean;
  diff: string;
  warnings: string[];
}

export function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value);
}

export function isBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}
