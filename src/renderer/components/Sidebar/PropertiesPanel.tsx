import { TEST_IDS } from '../../lib/testids'
import { useGraphStore } from '../../store/graph-store'

export function PropertiesPanel() {
  const { nodes, edges, selectedNodeId } = useGraphStore()
  const selectedNode = nodes.find(n => n.id === selectedNodeId)

  const connectedEdges = selectedNode
    ? edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
    : []

  return (
    <div className="properties-panel" data-testid={TEST_IDS.PROPERTIES_PANEL}>
      <div className="sidebar-header">Properties</div>
      {selectedNode ? (
        <div className="properties-content">
          <div className="property-row">
            <span className="property-label">Title</span>
            <span data-testid={TEST_IDS.PROPERTY_TITLE}>{selectedNode.label}</span>
          </div>
          <div className="property-row">
            <span className="property-label">Type</span>
            <span data-testid={TEST_IDS.PROPERTY_TYPE}>{selectedNode.type}</span>
          </div>
          {selectedNode.filePath && (
            <div className="property-row">
              <span className="property-label">Path</span>
              <span data-testid={TEST_IDS.PROPERTY_PATH}>{selectedNode.filePath}</span>
            </div>
          )}
          <div className="property-row">
            <span className="property-label">Edges</span>
            <span data-testid={TEST_IDS.PROPERTY_EDGES}>{connectedEdges.length}</span>
          </div>
          {connectedEdges.length > 0 && (
            <div className="property-edges-list">
              {connectedEdges.map(e => (
                <div key={e.id} className="property-edge-item">
                  <span className={`edge-type edge-type-${e.type}`}>{e.type}</span>
                  <span className="edge-target">
                    {e.source === selectedNode.id
                      ? nodes.find(n => n.id === e.target)?.label ?? e.target
                      : nodes.find(n => n.id === e.source)?.label ?? e.source}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="properties-empty">No selection</div>
      )}
    </div>
  )
}
