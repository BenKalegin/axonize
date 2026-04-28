import { useCallback, useMemo, useState } from 'react'
import {
  CloudDiagramCanvas,
  createCloudDiagramDocument,
  importMermaidDiagram,
  PersistenceMode,
  UndoRedoControls,
  type CloudDiagramDocument
} from 'clouddiagram-editor'
import { TEST_IDS } from '@/lib/testids'
import {
  MermaidVisualNode,
  parseMermaidVisualModel,
  updateMermaidLayout
} from '@/lib/mermaid-visual-layout'
import { extractMermaidCodeFence } from '@/lib/mermaid-render-source'

interface DiagramVisualEditorModalProps {
  markdown: string
  onApply: (markdown: string) => void
  onClose: () => void
}

const ELEMENT_TYPE_CLASS_DIAGRAM = 2

function createBaseCloudDiagram(): Record<string, unknown> {
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

export function DiagramVisualEditorModal({
  markdown,
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
    const imported = importMermaidDiagram(createBaseCloudDiagram() as Parameters<typeof importMermaidDiagram>[0], source)
    const embeddedElements = (imported as { elements?: Record<string, Record<string, unknown>> }).elements ?? {}
    return createCloudDiagramDocument(imported as Parameters<typeof createCloudDiagramDocument>[0], (id) => embeddedElements[id] as Parameters<Parameters<typeof createCloudDiagramDocument>[1] extends ((...args: never) => infer R) ? never : never>[0])
  }, [markdown])

  const [currentDoc, setCurrentDoc] = useState<CloudDiagramDocument>(initialDoc)

  const handleApply = useCallback(() => {
    const nodes = extractMermaidVisualNodesFromCloudDoc(currentDoc, fallbackNodeLookup)
    if (nodes.length === 0) {
      onApply(markdown)
      return
    }
    onApply(updateMermaidLayout(markdown, nodes))
  }, [currentDoc, fallbackNodeLookup, markdown, onApply])

  const header = (
    <div className="visual-editor-header">
      <div className="visual-editor-title">Visual edit (CloudDiagram)</div>
      <div className="visual-editor-actions">
        <UndoRedoControls/>
        <button className="toolbar-btn" onClick={onClose}>Cancel</button>
        <button className="toolbar-btn active" onClick={handleApply}>Apply layout</button>
      </div>
    </div>
  )

  return (
    <div className="visual-editor-backdrop" data-testid={TEST_IDS.MERMAID_VISUAL_EDITOR}>
      <div className="visual-editor-modal visual-editor-modal--cloud" role="dialog" aria-modal="true" aria-label="CloudDiagram editor">
        <CloudDiagramCanvas
          header={header}
          value={initialDoc}
          valueVersion={markdown.length}
          onChange={setCurrentDoc}
          persistenceMode={PersistenceMode.Host}
          recoverOnMount={false}
          showPropertiesPane={true}
          height="100%"
        />
      </div>
    </div>
  )
}

function normalizeNodeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
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
    const width = Number(bounds.width ?? 170)
    const height = Number(bounds.height ?? 76)
    const x = Number(bounds.x ?? 80)
    const y = Number(bounds.y ?? 100)
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

function isMermaidSafeIdentifier(value: string): boolean {
  return /^[A-Za-z_][\w-]*$/.test(value)
}
