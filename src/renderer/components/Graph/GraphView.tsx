import { TEST_IDS } from '../../lib/testids'
import { ForceGraph } from './ForceGraph'
import { GraphControls } from './GraphControls'
import { useGraphStore } from '../../store/graph-store'

export function GraphView() {
  const { nodes, edges } = useGraphStore()

  return (
    <div className="graph-view" data-testid={TEST_IDS.GRAPH_VIEW}>
      <GraphControls />
      <div className="graph-stats">
        <span data-testid={TEST_IDS.NODE_COUNT}>{nodes.length} nodes</span>
        <span data-testid={TEST_IDS.EDGE_COUNT}>{edges.length} edges</span>
      </div>
      <ForceGraph />
    </div>
  )
}
