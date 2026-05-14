import { useCallback, useMemo, useState } from 'react'
import {
  CloudDiagramCanvas,
  createCloudDiagramDocument,
  defaultAppLayout,
  importMermaidDiagram,
  PersistenceMode,
  UndoRedoControls,
  type CloudDiagramDocument,
  type DiagramTheme
} from '@benkalegin/clouddiagram-editor'
import { ThemeGroup } from '@core/themes'
import { getActiveTheme } from '@/lib/theme-applier'
import { TEST_IDS } from '@/lib/testids'
import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  GRID_START_X,
  GRID_START_Y,
  isMermaidSafeIdentifier,
  MermaidVisualNode,
  parseMermaidVisualModel,
  updateMermaidLayout
} from '@/lib/mermaid-visual-layout'
import { extractMermaidCodeFence } from '@/lib/mermaid-render-source'
import { MermaidNodePosition } from '@/lib/mermaid-svg-layout'

interface DiagramVisualEditorModalProps {
  markdown: string
  renderedSvg?: string
  onApply: (markdown: string) => void
  onClose: () => void
}

const DISPLAY_PADDING = 80
const DISPLAY_MIN_WIDTH = 800
const DISPLAY_MIN_HEIGHT = 600

const ELEMENT_TYPE_CLASS_DIAGRAM = 2

// Kept loosely typed so we don't bind to private clouddiagram-editor types.
type ImportedDiagram = Record<string, unknown> & {
  elements?: Record<string, Record<string, unknown>>
}

function createBaseCloudDiagram(): ImportedDiagram {
  return {
    id: 'axonize-mermaid',
    type: ELEMENT_TYPE_CLASS_DIAGRAM,
    title: 'Axonize Mermaid',
    selectedElements: [],
    notes: {},
    display: {
      width: 2000,
      height: 2000,
      scale: 1,
      offset: { x: 0, y: 0 }
    }
  }
}

function buildDiagramTheme(): DiagramTheme {
  const { colors, group } = getActiveTheme()
  return {
    darkMode: group === ThemeGroup.Dark,
    canvasBackground: colors.bgBase,
    panelBackground: colors.bgSurface,
    defaultColorSchema: {
      strokeColor: colors.accent,
      fillColor: colors.bgOverlay,
      textColor: colors.textPrimary,
    },
  }
}

export function DiagramVisualEditorModal({
  markdown,
  renderedSvg,
  onApply,
  onClose
}: DiagramVisualEditorModalProps) {
  const mermaidModel = useMemo(() => parseMermaidVisualModel(markdown), [markdown])
  const fallbackNodeLookup = useMemo(() => {
    const lookup = new Map<string, string>()
    for (const node of mermaidModel.nodes) {
      lookup.set(normalizeNodeKey(node.id), node.id)
      lookup.set(normalizeNodeKey(node.label), node.id)
    }
    return lookup
  }, [mermaidModel.nodes])

  const initialDoc = useMemo<CloudDiagramDocument>(() => {
    const source = extractMermaidCodeFence(markdown) ?? markdown
    const baseDiagram = createBaseCloudDiagram() as unknown as Parameters<typeof importMermaidDiagram>[0]
    const imported = importMermaidDiagram(baseDiagram, source) as unknown as ImportedDiagram
    const positions = renderedSvg ? extractPositionsInline(renderedSvg) : new Map<string, MermaidNodePosition>()
    if (positions.size > 0) {
      applyMermaidLayoutToImported(imported, positions)
    }
    const embeddedElements = imported.elements ?? {}
    type ElementData = ReturnType<NonNullable<Parameters<typeof createCloudDiagramDocument>[1]>>
    return createCloudDiagramDocument(
      imported as unknown as Parameters<typeof createCloudDiagramDocument>[0],
      (id) => embeddedElements[id] as unknown as ElementData
    )
  }, [markdown, renderedSvg])

  const [currentDoc, setCurrentDoc] = useState<CloudDiagramDocument>(initialDoc)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const diagramTheme = useMemo(() => buildDiagramTheme(), [])
  const initialLayout = useMemo(() => ({ ...defaultAppLayout, propsPaneOpen: false }), [])

  // Layout persistence (x-axonize frontmatter overlay) is intentionally disabled.
  // The next iteration moves to a hint-based persistence model — see
  // docs/todo/doodles/p2-axonize-integration.md.
  const handleApply = useCallback(() => {
    onApply(markdown)
  }, [markdown, onApply])

  const header = (
    <div className="visual-editor-header">
      <div className="visual-editor-title">Visual edit (CloudDiagram)</div>
      <div className="visual-editor-actions">
        <UndoRedoControls/>
        <button
          className="toolbar-btn"
          onClick={() => setIsFullscreen(prev => !prev)}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? "Restore" : "Full screen"}
        </button>
        <button className="toolbar-btn" onClick={onClose}>Cancel</button>
        <button className="toolbar-btn active" onClick={handleApply}>Apply layout</button>
      </div>
    </div>
  )

  const backdropClassName = `visual-editor-backdrop${isFullscreen ? ' visual-editor-backdrop--fullscreen' : ''}`
  const modalClassName = `visual-editor-modal visual-editor-modal--cloud${isFullscreen ? ' visual-editor-modal--fullscreen' : ''}`

  return (
    <div className={backdropClassName} data-testid={TEST_IDS.MERMAID_VISUAL_EDITOR}>
      <div className={modalClassName} role="dialog" aria-modal="true" aria-label="CloudDiagram editor">
        <CloudDiagramCanvas
          header={header}
          theme={diagramTheme}
          value={initialDoc}
          valueVersion={markdown.length}
          onChange={setCurrentDoc}
          persistenceMode={PersistenceMode.Host}
          recoverOnMount={false}
          showPropertiesPane={true}
          initialLayout={initialLayout}
          height="100%"
        />
      </div>
    </div>
  )
}

function normalizeNodeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const MERMAID_FLOWCHART_ID_RE = /^(?:flowchart|class)-(.+?)-\d+$/
const MERMAID_FALLBACK_NODE_WIDTH = 140
const MERMAID_FALLBACK_NODE_HEIGHT = 60

const TRANSLATE_RE = /translate\(\s*([-\d.]+)[\s,]+([-\d.]+)\s*\)/

function readAncestorTranslate(node: Element): { x: number; y: number } {
  let x = 0, y = 0
  let current: Element | null = node.parentElement
  while (current) {
    const t = current.getAttribute('transform')
    if (t) {
      const match = t.match(TRANSLATE_RE)
      if (match) {
        const dx = Number(match[1])
        const dy = Number(match[2])
        if (Number.isFinite(dx) && Number.isFinite(dy)) { x += dx; y += dy }
      }
    }
    current = current.parentElement
  }
  return { x, y }
}

function extractPositionsInline(svg: string): Map<string, MermaidNodePosition> {
  const positions = new Map<string, MermaidNodePosition>()
  if (!svg) return positions
  const doc = new DOMParser().parseFromString(`<div>${svg}</div>`, 'text/html')
  for (const node of Array.from(doc.querySelectorAll('g.node'))) {
    const dataId = node.getAttribute('data-id')
    const idAttr = node.getAttribute('id') ?? ''
    const idMatch = idAttr.match(MERMAID_FLOWCHART_ID_RE)
    const id = dataId || (idMatch ? idMatch[1] : null)
    if (!id || positions.has(id)) continue
    const transform = node.getAttribute('transform') ?? ''
    const tMatch = transform.match(TRANSLATE_RE)
    if (!tMatch) continue
    const localX = Number(tMatch[1])
    const localY = Number(tMatch[2])
    if (!Number.isFinite(localX) || !Number.isFinite(localY)) continue
    const ancestor = readAncestorTranslate(node)
    const cx = localX + ancestor.x
    const cy = localY + ancestor.y
    let width = MERMAID_FALLBACK_NODE_WIDTH
    let height = MERMAID_FALLBACK_NODE_HEIGHT
    const rect = node.querySelector('rect')
    if (rect) {
      const w = Number(rect.getAttribute('width'))
      const h = Number(rect.getAttribute('height'))
      if (Number.isFinite(w) && w > 0) width = w
      if (Number.isFinite(h) && h > 0) height = h
    }
    const label = node.querySelector('g.label')?.textContent?.trim() || undefined
    positions.set(id, {
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      label
    })
  }
  return positions
}

type NodeBoundsRecord = Record<string, { bounds?: { x?: number; y?: number; width?: number; height?: number } }>

function applyMermaidLayoutToImported(
  imported: ImportedDiagram,
  positionsByUserId: Map<string, MermaidNodePosition>
): void {
  const elements = imported.elements ?? {}
  const nodes = (imported as { nodes?: NodeBoundsRecord }).nodes
  if (!nodes) return

  const labelToPosition = new Map<string, MermaidNodePosition>()
  for (const position of positionsByUserId.values()) {
    if (position.label) labelToPosition.set(normalizeNodeKey(position.label), position)
  }

  for (const [cdId, nodeData] of Object.entries(nodes)) {
    const element = elements[cdId]
    const text = typeof element?.text === 'string' ? element.text : undefined
    if (!text) continue

    const position =
      positionsByUserId.get(text) ??
      labelToPosition.get(normalizeNodeKey(text))
    if (!position) continue

    nodeData.bounds = {
      x: position.x,
      y: position.y,
      width: position.width,
      height: position.height
    }
  }

  // Mermaid often emits coordinates that extend left/above origin (negative x/y).
  // Konva clips at (0,0), so shift every node so the bounding box starts at
  // (DISPLAY_PADDING, DISPLAY_PADDING) and size `display` to the full extent —
  // otherwise fit-to-screen undershoots and nodes only appear once the user scrolls.
  let minX = Infinity, minY = Infinity, maxRight = -Infinity, maxBottom = -Infinity
  for (const node of Object.values(nodes)) {
    const b = node.bounds
    if (!b || b.x === undefined || b.y === undefined || b.width === undefined || b.height === undefined) continue
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxRight = Math.max(maxRight, b.x + b.width)
    maxBottom = Math.max(maxBottom, b.y + b.height)
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return

  const shiftX = DISPLAY_PADDING - minX
  const shiftY = DISPLAY_PADDING - minY
  if (shiftX !== 0 || shiftY !== 0) {
    for (const node of Object.values(nodes)) {
      const b = node.bounds
      if (!b || b.x === undefined || b.y === undefined) continue
      b.x += shiftX
      b.y += shiftY
    }
  }

  const display = (imported as { display?: { width?: number; height?: number; offset?: { x: number; y: number } } }).display
  if (display) {
    const contentWidth = maxRight - minX
    const contentHeight = maxBottom - minY
    display.width = Math.max(DISPLAY_MIN_WIDTH, contentWidth + 2 * DISPLAY_PADDING)
    display.height = Math.max(DISPLAY_MIN_HEIGHT, contentHeight + 2 * DISPLAY_PADDING)
  }
}

function extractMermaidVisualNodesFromCloudDoc(
  document: CloudDiagramDocument,
  fallbackNodeLookup: Map<string, string>
): MermaidVisualNode[] {
  const diagramNodes = (document.diagram?.nodes ?? {}) as Record<string, { bounds?: {
    x?: number
    y?: number
    width?: number
    height?: number
  } }>
  const nodes: MermaidVisualNode[] = []
  const usedIds = new Set<string>()

  for (const [nodeId, nodeData] of Object.entries(diagramNodes)) {
    const element = document.elements?.[nodeId] ?? {}
    const rawLabel = typeof element.text === 'string' ? element.text : nodeId
    const label = rawLabel.trim()
    if (!label) continue

    const preferredId =
      fallbackNodeLookup.get(normalizeNodeKey(label)) ??
      fallbackNodeLookup.get(normalizeNodeKey(nodeId)) ??
      (isMermaidSafeIdentifier(label) ? label : null)
    if (!preferredId || usedIds.has(preferredId)) {
      continue
    }

    const bounds = nodeData?.bounds ?? {}
    const width = Number(bounds.width ?? DEFAULT_NODE_WIDTH)
    const height = Number(bounds.height ?? DEFAULT_NODE_HEIGHT)
    const x = Number(bounds.x ?? GRID_START_X)
    const y = Number(bounds.y ?? GRID_START_Y)
    if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue
    }

    usedIds.add(preferredId)
    nodes.push({
      id: preferredId,
      label,
      x,
      y,
      width,
      height
    })
  }

  return nodes
}
