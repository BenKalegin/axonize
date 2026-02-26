import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { TEST_IDS } from '../../lib/testids'
import { useGraphStore } from '../../store/graph-store'
import { drawCard, drawRelationEdge } from './CardRenderer'

interface GraphNode {
  id: string
  x?: number
  y?: number
  fx?: number
  fy?: number
  _card: {
    title: string
    summary: string
    scale: number
    opacity: number
  }
}

interface GraphLink {
  source: string
  target: string
  type: string
  opacity: number
}

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 800, height: 500 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

export function ForceGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { positionedCards, relations, setFocus } = useGraphStore()
  const { width, height } = useContainerSize(containerRef)

  console.log('[ForceGraph] render', { positionedCards: positionedCards.length, relations: relations.length, width, height })

  const graphData = useMemo(() => {
    const cardIdSet = new Set(positionedCards.map((pc) => pc.card.id))

    const nodes: GraphNode[] = positionedCards.map((pc) => ({
      id: pc.card.id,
      fx: pc.x,
      fy: pc.y,
      _card: {
        title: pc.card.title,
        summary: pc.card.summary,
        scale: pc.scale,
        opacity: pc.opacity
      }
    }))

    const links: GraphLink[] = relations
      .filter((r) => cardIdSet.has(r.sourceId) && cardIdSet.has(r.targetId))
      .map((r) => {
        const srcPc = positionedCards.find((pc) => pc.card.id === r.sourceId)
        const tgtPc = positionedCards.find((pc) => pc.card.id === r.targetId)
        const opacity = Math.min(srcPc?.opacity ?? 0, tgtPc?.opacity ?? 0)
        return { source: r.sourceId, target: r.targetId, type: r.type, opacity }
      })

    console.log('[ForceGraph] graphData', { nodes: nodes.length, links: links.length, sample: nodes[0] })
    return { nodes, links }
  }, [positionedCards, relations])

  const drawCountRef = useRef(0)
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      if (drawCountRef.current < 5) {
        console.log('[ForceGraph] nodeCanvasObject', { id: node.id, x: node.x, y: node.y, fx: node.fx, fy: node.fy, _card: node._card })
        drawCountRef.current++
      }
      const x = node.x ?? 0
      const y = node.y ?? 0
      const { title, summary, scale, opacity } = node._card
      drawCard(ctx, title, summary, x, y, scale, opacity)
    },
    []
  )

  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      const src = link.source as unknown as GraphNode
      const tgt = link.target as unknown as GraphNode
      if (src?.x == null || tgt?.x == null) return
      drawRelationEdge(ctx, src.x, src.y ?? 0, tgt.x, tgt.y ?? 0, link.type, link.opacity)
    },
    []
  )

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setFocus(node.id)
    },
    [setFocus]
  )

  return (
    <div ref={containerRef} className="force-graph-container" data-testid={TEST_IDS.FORCE_GRAPH}>
      <ForceGraph2D
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        nodeId="id"
        onNodeClick={handleNodeClick}
        width={width}
        height={height}
        backgroundColor="#1e1e2e"
        cooldownTicks={100}
        d3AlphaDecay={1}
        d3VelocityDecay={1}
        enableNodeDrag={false}
      />
    </div>
  )
}
