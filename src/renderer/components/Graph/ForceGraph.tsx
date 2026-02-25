import { useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { TEST_IDS } from '../../lib/testids'
import { useGraphStore } from '../../store/graph-store'
import { useZoomStore } from '../../store/zoom-store'
import type { ZoomLevel } from '../../store/zoom-store'

interface GraphNode {
  id: string
  label: string
  type: string
  x?: number
  y?: number
}

interface GraphLink {
  source: string
  target: string
  type: string
}

function getNodeSize(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'Z0': return 3
    case 'Z1': return 5
    case 'Z2': return 8
    case 'Z3': return 12
    case 'Z4': return 16
  }
}

export function ForceGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { nodes, edges } = useGraphStore()
  const { level } = useZoomStore()

  const graphData = {
    nodes: nodes.map(n => ({ ...n })) as GraphNode[],
    links: edges.map(e => ({
      source: e.source,
      target: e.target,
      type: e.type
    })) as GraphLink[]
  }

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = getNodeSize(level)
      const x = node.x ?? 0
      const y = node.y ?? 0

      // Draw node circle
      ctx.beginPath()
      ctx.arc(x, y, size, 0, 2 * Math.PI)
      ctx.fillStyle = node.type === 'file' ? '#89b4fa' : '#a6e3a1'
      ctx.fill()

      // Draw label for Z1+
      if (level !== 'Z0') {
        const fontSize = Math.max(10, 12 / globalScale)
        ctx.font = `${fontSize}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = '#cdd6f4'
        ctx.fillText(node.label, x, y + size + 2)
      }
    },
    [level]
  )

  return (
    <div ref={containerRef} className="force-graph-container" data-testid={TEST_IDS.FORCE_GRAPH}>
      <ForceGraph2D
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodeId="id"
        width={800}
        height={500}
        backgroundColor="#1e1e2e"
        linkColor={() => '#585b70'}
        cooldownTicks={50}
      />
    </div>
  )
}
