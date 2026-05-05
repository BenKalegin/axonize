import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  isMermaidRenderSource,
  stripMermaidFrontmatter
} from '../../../src/renderer/lib/mermaid-render-source'

const GALLERY_PATHS = [
  'doc/diagram-gallery.md',
  'tests/fixtures/diagram-gallery.md',
  'tests/e2e/fixtures/test-vault/diagram-gallery.md'
] as const

const EXPECTED_MERMAID_BLOCKS = 15
const MERMAID_FENCE_RE = /```mermaid[^\n]*\n([\s\S]*?)\n```/gi
const ER_DIAGRAM_RE = /^\s*erDiagram\b/i
const ER_ENTITY_OPEN_RE = /^\s+[A-Z_]+\s+\{\s*$/gm
const ER_ENTITY_CLOSE_RE = /^\s*}\s*$/gm
const REQUIRED_MERMAID_STARTS = [
  'classDiagram',
  'flowchart',
  'sequenceDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'gantt',
  'pie',
  'journey',
  'gitGraph',
  'mindmap',
  'timeline',
  'quadrantChart',
  'requirementDiagram',
  'block-beta',
  'xychart-beta'
] as const

describe('diagram gallery fixtures', () => {
  it('keeps every Mermaid gallery block renderable by the Mermaid renderer', () => {
    for (const galleryPath of GALLERY_PATHS) {
      const markdown = readGallery(galleryPath)
      const blocks = extractMermaidBlocks(markdown)

      expect(blocks, galleryPath).toHaveLength(EXPECTED_MERMAID_BLOCKS)
      expect(blocks.every((block) => isMermaidRenderSource(block)), galleryPath).toBe(true)
      expect(blocks.map(firstLine), galleryPath).toEqual(REQUIRED_MERMAID_STARTS)
      expect(blocks.filter(hasBalancedErEntityBlocks), galleryPath).toEqual(blocks)
    }
  })
})

function readGallery(galleryPath: string): string {
  return readFileSync(join(process.cwd(), galleryPath), 'utf8')
}

function extractMermaidBlocks(markdown: string): string[] {
  return Array.from(markdown.matchAll(MERMAID_FENCE_RE), (match) => match[1])
}

function firstLine(source: string): string {
  return stripMermaidFrontmatter(source).split('\n')[0].split(' ')[0]
}

function hasBalancedErEntityBlocks(source: string): boolean {
  if (!ER_DIAGRAM_RE.test(source)) return true
  return countMatches(source, ER_ENTITY_OPEN_RE) === countMatches(source, ER_ENTITY_CLOSE_RE)
}

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length
}
