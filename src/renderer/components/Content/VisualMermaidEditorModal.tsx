import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  MermaidVisualNode,
  parseMermaidVisualModel,
  updateMermaidLayout
} from '@/lib/mermaid-visual-layout'
import { TEST_IDS } from '@/lib/testids'

interface VisualMermaidEditorModalProps {
  markdown: string
  onApply: (markdown: string) => void
  onClose: () => void
}

interface DragState {
  id: string
  dx: number
  dy: number
}

export function VisualMermaidEditorModal({
  markdown,
  onApply,
  onClose
}: VisualMermaidEditorModalProps) {
  const model = useMemo(() => parseMermaidVisualModel(markdown), [markdown])
  const [nodes, setNodes] = useState<MermaidVisualNode[]>(model.nodes)
  const dragRef = useRef<DragState | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent, node: MermaidVisualNode) => {
    if (node.locked) return
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return

    dragRef.current = {
      id: node.id,
      dx: e.clientX - bounds.left - node.x,
      dy: e.clientY - bounds.top - node.y
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!drag || !bounds) return

    const x = Math.max(24, e.clientX - bounds.left - drag.dx)
    const y = Math.max(24, e.clientY - bounds.top - drag.dy)
    setNodes((current) =>
      current.map((node) =>
        node.id === drag.id ? { ...node, x, y } : node
      )
    )
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }, [])

  const toggleLock = useCallback((id: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? { ...node, locked: !node.locked } : node
      )
    )
  }, [])

  const handleApply = useCallback(() => {
    onApply(updateMermaidLayout(markdown, nodes))
  }, [markdown, nodes, onApply])

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])

  return (
    <div className="visual-editor-backdrop" data-testid={TEST_IDS.MERMAID_VISUAL_EDITOR}>
      <div className="visual-editor-modal" role="dialog" aria-modal="true" aria-label="Visual Mermaid editor">
        <div className="visual-editor-header">
          <div className="visual-editor-title">Visual edit</div>
          <div className="visual-editor-actions">
            <button className="toolbar-btn" onClick={onClose}>Cancel</button>
            <button
              className="toolbar-btn active"
              onClick={handleApply}
              disabled={!model.supported}
            >
              Apply layout
            </button>
          </div>
        </div>

        {model.supported ? (
          <div
            ref={canvasRef}
            className="visual-editor-canvas"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <svg className="visual-editor-links" aria-hidden="true">
              {model.edges.map((edge, index) => {
                const from = nodesById.get(edge.from)
                const to = nodesById.get(edge.to)
                if (!from || !to) return null

                const x1 = from.x + from.width
                const y1 = from.y + from.height / 2
                const x2 = to.x
                const y2 = to.y + to.height / 2
                const midX = (x1 + x2) / 2

                return (
                  <g key={`${edge.from}-${edge.to}-${index}`}>
                    <path
                      className="visual-editor-link"
                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    />
                    {edge.label && (
                      <text
                        className="visual-editor-link-label"
                        x={midX}
                        y={(y1 + y2) / 2 - 8}
                        textAnchor="middle"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {nodes.map((node) => (
              <div
                key={node.id}
                className={`visual-editor-node${node.locked ? ' visual-editor-node--locked' : ''}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height
                }}
                onPointerDown={(e) => handlePointerDown(e, node)}
              >
                <button
                  className="visual-editor-node-lock"
                  title={node.locked ? 'Unlock node' : 'Lock node'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLock(node.id)
                  }}
                >
                  {node.locked ? 'L' : 'U'}
                </button>
                <div className="visual-editor-node-title">{node.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="visual-editor-unsupported">
            <div className="visual-editor-unsupported-title">Visual layout editing is ready for Mermaid class diagrams.</div>
            <pre>{model.source}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
