import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { TEST_IDS } from '@/lib/testids'
import { useGraphStore, visibleCards, visibleRelations } from '@/store/graph-store'
import type { VisibleDepth } from '@/store/graph-store'
import {
  drawCard,
  drawRelationEdge,
  drawHubNode,
  drawClusterCard,
  drawFacetBadges,
  clusterCardHeight,
  CARD_WIDTH,
  CARD_HEIGHT,
  HUB_RADIUS,
  CLUSTER_WIDTH
} from './CardRenderer'
import { useEditorStore } from '@/store/editor-store'
import { useVaultStore } from '@/store/vault-store'
import { forceCollide } from 'd3-force'
import { computeInitialPositions, getForceConfig, linkDistanceByType } from '@core/semantic/force-layout'
import { createLensForce } from '@core/semantic/lens-force'
import { CardKind } from '@core/semantic/types'
import type { CardKind as CardKindType, Facet } from '@core/semantic/types'

interface GraphNode {
  id: string
  x?: number
  y?: number
  _card: {
    title: string
    summary: string
    level: number
    kind?: CardKindType
    hubCategory?: string
    facets?: Facet
    clusterDocTitles?: string[]
  }
}

interface GraphLink {
  source: string
  target: string
  type: string
}

const SCALE_BY_LEVEL: Record<number, number> = { 0: 1.0, 1: 0.8, 2: 0.6, 3: 0.45 }
const DEFAULT_SCALE = 0.6
const EDGE_DIM_OPACITY = 0.08
const CLUSTER_FOCUS_VISIBLE_COUNT = 10
const CLUSTER_FOCUS_MIN_OPACITY = 0.08
const CLUSTER_FOCUS_OPACITY_RANGE = 0.4
const HUB_HIT_PADDING = 4
const COLLISION_PAD = 5
const COLLISION_STRENGTH = 0.8
const COLLISION_ITERATIONS = 3
const DEFAULT_COLLISION_RADIUS = 60

// zoom-to-fit
const FIT_EDGE_MARGIN = 40

// center-on-click timing
const CENTER_ANIMATION_MS = 400

// simulation tuning
const WARMUP_TICKS = 150
const COOLDOWN_TICKS = 20
const COOLDOWN_TIME_MS = 500
const DEPTH_CHANGE_TICKS = 30
const ALPHA_DECAY = 0.06
const VELOCITY_DECAY = 0.65

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(undefined)
  const { cards, relations, dimensions, visibleDepth, activeLens, hoveredNodeId, focusedDocId, clusterFocus, setHoveredNode, clearClusterFocus } = useGraphStore()
  const { width, height } = useContainerSize(containerRef)

  const shown = useMemo(() => visibleCards(cards, visibleDepth, focusedDocId), [cards, visibleDepth, focusedDocId])
  const shownIds = useMemo(() => new Set(shown.map((c) => c.id)), [shown])
  const shownRelations = useMemo(() => visibleRelations(relations, shownIds), [relations, shownIds])

  const cardTitleMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of cards) map.set(c.id, c.title)
    return map
  }, [cards])

  const graphData = useMemo(() => {
    const positions = computeInitialPositions(shown)
    const posMap = new Map(positions.map((p) => [p.id, p]))

    const nodes: GraphNode[] = shown.map((c) => {
      const pos = posMap.get(c.id)
      const clusterDocTitles = c.clusterDocIds
        ?.map((id) => cardTitleMap.get(id))
        .filter((t): t is string => !!t)
      return {
        id: c.id,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
        _card: {
          title: c.title,
          summary: c.summary,
          level: c.level,
          kind: c.kind,
          hubCategory: c.hubCategory,
          facets: c.facets,
          clusterDocTitles
        }
      }
    })

    const links: GraphLink[] = shownRelations.map((r) => ({
      source: r.sourceId,
      target: r.targetId,
      type: r.type
    }))

    return { nodes, links }
  }, [shown, shownRelations, cardTitleMap])

  // Configure d3 forces — short settle on depth change, full reheat on lens change
  const prevLensRef = useRef(activeLens)
  const prevDepthRef = useRef(visibleDepth)
  const [cooldownTicks, setCooldownTicks] = useState(COOLDOWN_TICKS)
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || shown.length === 0) return

    const config = getForceConfig(shown.length)

    const chargeForce = fg.d3Force('charge')
    if (chargeForce && typeof chargeForce.strength === 'function') {
      chargeForce.strength(config.chargeStrength)
    }

    const linkForce = fg.d3Force('link') as unknown as { distance?: (fn: (link: GraphLink) => number) => void } | undefined
    if (linkForce && typeof linkForce.distance === 'function') {
      linkForce.distance((link: GraphLink) => linkDistanceByType(link.type))
    }

    const nodeRadiusMap = new Map<string, number>()
    for (const c of shown) {
      if (c.kind === CardKind.Hub) nodeRadiusMap.set(c.id, HUB_RADIUS + COLLISION_PAD * 2)
      else if (c.kind === CardKind.Cluster) nodeRadiusMap.set(c.id, CLUSTER_WIDTH / 2)
      else nodeRadiusMap.set(c.id, (CARD_WIDTH * (SCALE_BY_LEVEL[c.level] ?? DEFAULT_SCALE)) / 2 + COLLISION_PAD)
    }
    const collision = forceCollide<GraphNode>()
      .radius((node) => nodeRadiusMap.get(node.id) ?? DEFAULT_COLLISION_RADIUS)
      .strength(COLLISION_STRENGTH)
      .iterations(COLLISION_ITERATIONS)
    fg.d3Force('collision', collision as never)

    fg.d3Force('cluster', createLensForce(shown, shownRelations, activeLens, config.clusterStrength) as never)

    const lensChanged = prevLensRef.current !== activeLens
    const depthChanged = prevDepthRef.current !== visibleDepth
    prevLensRef.current = activeLens
    prevDepthRef.current = visibleDepth

    setCooldownTicks(depthChanged && !lensChanged ? DEPTH_CHANGE_TICKS : COOLDOWN_TICKS)
    fg.d3ReheatSimulation()
  }, [graphData, shown, shownRelations, activeLens, visibleDepth])

  const fitPadding = useMemo(() => {
    const maxCardHalf = shown.reduce((max, c) => {
      if (c.kind === CardKind.Cluster) {
        return Math.max(max, clusterCardHeight(c.clusterDocIds?.length ?? 0) / 2)
      }
      const scale = SCALE_BY_LEVEL[c.level] ?? DEFAULT_SCALE
      return Math.max(max, (CARD_HEIGHT * scale) / 2)
    }, HUB_RADIUS)
    return maxCardHalf + FIT_EDGE_MARGIN
  }, [shown])

  const needsFitRef = useRef(false)

  // Mark that we need a fit whenever visible nodes change
  useEffect(() => {
    if (shown.length > 0) needsFitRef.current = true
  }, [shown.length, visibleDepth])

  const handleEngineStop = useCallback(() => {
    if (!needsFitRef.current) return
    needsFitRef.current = false
    fgRef.current?.zoomToFit(0, fitPadding)
  }, [fitPadding])

  // Reset initialization flag when cards reload
  useEffect(() => {
    if (cards.length === 0) needsFitRef.current = false
  }, [cards.length])

  const dimIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    dimensions.forEach((d, i) => map.set(d.key, i))
    return map
  }, [dimensions])

  const clusterOpacityMap = useMemo(() => {
    if (!clusterFocus) return null
    const entries = Object.entries(clusterFocus.distances)
      .sort(([, a], [, b]) => b - a)
    const map = new Map<string, number>()
    for (let i = 0; i < entries.length; i++) {
      const [id] = entries[i]
      if (i < CLUSTER_FOCUS_VISIBLE_COUNT) {
        map.set(id, 1.0 - (i / CLUSTER_FOCUS_VISIBLE_COUNT) * CLUSTER_FOCUS_OPACITY_RANGE)
      } else {
        map.set(id, CLUSTER_FOCUS_MIN_OPACITY)
      }
    }
    return map
  }, [clusterFocus])

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const { title, summary, level, kind, hubCategory, facets, clusterDocTitles } = node._card
      const isHovered = node.id === hoveredNodeId

      if (kind === CardKind.Hub) {
        const dimIdx = dimIndexMap.get(hubCategory ?? '') ?? 0
        drawHubNode(ctx, title, dimIdx, x, y, 1, isHovered)
        return
      }

      if (kind === CardKind.Cluster) {
        drawClusterCard(ctx, title, summary, x, y, 1, isHovered, clusterDocTitles)
        return
      }

      const opacity = clusterOpacityMap?.get(node.id) ?? 1
      const scale = SCALE_BY_LEVEL[level] ?? DEFAULT_SCALE
      drawCard(ctx, title, summary, x, y, scale, opacity, level, isHovered)

      if (facets && level === 0) {
        const w = CARD_WIDTH * scale
        const h = CARD_HEIGHT * scale
        drawFacetBadges(ctx, facets, x, y, w, h, scale)
      }
    },
    [hoveredNodeId, dimIndexMap, clusterOpacityMap]
  )

  const nodePointerAreaPaint = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const { level, kind } = node._card

      ctx.fillStyle = color

      if (kind === CardKind.Hub) {
        ctx.beginPath()
        ctx.arc(x, y, HUB_RADIUS + HUB_HIT_PADDING, 0, 2 * Math.PI)
        ctx.fill()
        return
      }

      if (kind === CardKind.Cluster) {
        const ch = clusterCardHeight(node._card.clusterDocTitles?.length ?? 0)
        ctx.fillRect(x - CLUSTER_WIDTH / 2, y - ch / 2, CLUSTER_WIDTH, ch)
        return
      }

      const scale = SCALE_BY_LEVEL[level] ?? DEFAULT_SCALE
      const w = CARD_WIDTH * scale
      const h = CARD_HEIGHT * scale
      ctx.fillRect(x - w / 2, y - h / 2, w, h)
    },
    []
  )

  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D, _globalScale: number) => {
      const src = link.source as unknown as GraphNode
      const tgt = link.target as unknown as GraphNode
      if (src?.x == null || tgt?.x == null) return

      const connected = hoveredNodeId != null && (src.id === hoveredNodeId || tgt.id === hoveredNodeId)
      let opacity = hoveredNodeId == null ? 1 : connected ? 1 : EDGE_DIM_OPACITY

      if (clusterOpacityMap) {
        const srcOpacity = clusterOpacityMap.get(src.id) ?? 1
        const tgtOpacity = clusterOpacityMap.get(tgt.id) ?? 1
        opacity = Math.min(opacity, srcOpacity, tgtOpacity)
      }

      drawRelationEdge(ctx, src.x, src.y ?? 0, tgt.x, tgt.y ?? 0, link.type, opacity)
    },
    [hoveredNodeId, clusterOpacityMap]
  )

  const isDraggingRef = useRef(false)

  const handleNodeDrag = useCallback(() => {
    if (!isDraggingRef.current) {
      isDraggingRef.current = true
      fgRef.current?.enableZoomPanInteraction(false)
    }
  }, [])

  const handleNodeDragEnd = useCallback(() => {
    isDraggingRef.current = false
    fgRef.current?.enableZoomPanInteraction(true)
  }, [])

  const handleBackgroundClick = useCallback(() => {
    clearClusterFocus()
  }, [clearClusterFocus])

  const handleNodeHover = useCallback(
    (node: GraphNode | null) => {
      setHoveredNode(node?.id ?? null)
    },
    [setHoveredNode]
  )

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const { visibleDepth, increaseDepth, setDepth, focusDoc, focusCluster } = useGraphStore.getState()
      const vaultPath = useVaultStore.getState().vaultPath
      const { level, kind } = node._card

      // Cluster click: focus with semantic distances
      if (kind === CardKind.Cluster) {
        if (vaultPath) {
          focusCluster(vaultPath, node.id)
        } else {
          setDepth(0)
        }
        fgRef.current?.centerAt(node.x, node.y, CENTER_ANIMATION_MS)
        return
      }

      // Hub click: just center
      if (kind === CardKind.Hub) {
        fgRef.current?.centerAt(node.x, node.y, CENTER_ANIMATION_MS)
        return
      }

      // Detail/Chunk card click: open the file
      if (level >= 2) {
        const card = cards.find((c) => c.id === node.id)
        if (card) {
          useEditorStore.getState().selectFile(card.filePath)
        }
        return
      }

      // Doc click: focus on this doc's subtree and drill in
      if (level === 0 && visibleDepth === 0) {
        focusDoc(node.id)
        increaseDepth()
        fgRef.current?.centerAt(node.x, node.y, CENTER_ANIMATION_MS)
        return
      }

      if (level >= visibleDepth && visibleDepth < 3) {
        increaseDepth()
      } else if (level < visibleDepth) {
        setDepth((level + 1) as VisibleDepth)
      }

      fgRef.current?.centerAt(node.x, node.y, CENTER_ANIMATION_MS)
    },
    [cards]
  )

  return (
    <div ref={containerRef} className="force-graph-container" data-testid={TEST_IDS.FORCE_GRAPH}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkCanvasObject={linkCanvasObject}
        nodeId="id"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        onBackgroundClick={handleBackgroundClick}
        onEngineStop={handleEngineStop}
        width={width}
        height={height}
        backgroundColor="#1e1e2e"
        warmupTicks={WARMUP_TICKS}
        cooldownTicks={cooldownTicks}
        cooldownTime={COOLDOWN_TIME_MS}
        d3AlphaDecay={ALPHA_DECAY}
        d3VelocityDecay={VELOCITY_DECAY}
        enableNodeDrag={true}
      />
    </div>
  )
}
