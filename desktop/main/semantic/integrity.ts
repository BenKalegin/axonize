import { Edge, Node, isRelationType } from "./models";

export function validateGraph(nodes: readonly Node[], edges: readonly Edge[]): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();

  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`duplicate_node_id:${node.id}`);
    }
    nodeIds.add(node.id);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`orphan_edge_source:${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`orphan_edge_target:${edge.target}`);
    }
    if (!isRelationType(edge.type)) {
      errors.push(`invalid_relation_type:${edge.type}`);
    }
  }

  return errors;
}

export function repairGraph(nodes: readonly Node[], edges: readonly Edge[]): { nodes: Node[]; edges: Edge[]; warnings: string[] } {
  const warnings: string[] = [];
  const uniqueNodes = new Map<string, Node>();

  for (const node of nodes) {
    if (uniqueNodes.has(node.id)) {
      warnings.push(`repair:removed_duplicate_node:${node.id}`);
      continue;
    }
    uniqueNodes.set(node.id, node);
  }

  const nodeIds = new Set(uniqueNodes.keys());
  const uniqueEdges = new Map<string, Edge>();

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      warnings.push(`repair:removed_orphan_edge:${edge.source}->${edge.target}`);
      continue;
    }
    if (!isRelationType(edge.type)) {
      warnings.push(`repair:removed_invalid_relation:${edge.type}`);
      continue;
    }
    const key = `${edge.source}::${edge.target}::${edge.type}::${edge.origin}`;
    const existing = uniqueEdges.get(key);
    if (!existing || edge.weight > existing.weight || edge.confidence > existing.confidence) {
      uniqueEdges.set(key, edge);
    }
  }

  const repairedNodes = [...uniqueNodes.values()].sort((a, b) => `${a.file}|${a.id}`.localeCompare(`${b.file}|${b.id}`));
  const repairedEdges = [...uniqueEdges.values()].sort((a, b) =>
    `${a.source}|${a.type}|${a.target}|${a.origin}`.localeCompare(`${b.source}|${b.type}|${b.target}|${b.origin}`)
  );
  return { nodes: repairedNodes, edges: repairedEdges, warnings };
}
