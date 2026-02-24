from __future__ import annotations

from axonize.models import Edge, Node, RelationType


def validate_graph(nodes: list[Node], edges: list[Edge]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()
    node_ids: set[str] = set()

    for node in nodes:
        if node.id in seen:
            errors.append(f"duplicate_node_id:{node.id}")
        seen.add(node.id)
        node_ids.add(node.id)

    for edge in edges:
        if edge.source not in node_ids:
            errors.append(f"orphan_edge_source:{edge.source}")
        if edge.target not in node_ids:
            errors.append(f"orphan_edge_target:{edge.target}")
        if not RelationType.has_value(edge.type.value):
            errors.append(f"invalid_relation_type:{edge.type.value}")

    return errors


def repair_graph(nodes: list[Node], edges: list[Edge]) -> tuple[list[Node], list[Edge], list[str]]:
    warnings: list[str] = []

    unique_nodes: dict[str, Node] = {}
    for node in nodes:
        if node.id in unique_nodes:
            warnings.append(f"repair:removed_duplicate_node:{node.id}")
            continue
        unique_nodes[node.id] = node

    node_ids = set(unique_nodes)

    unique_edges: dict[tuple[str, str, str, str], Edge] = {}
    for edge in edges:
        if edge.source not in node_ids or edge.target not in node_ids:
            warnings.append(f"repair:removed_orphan_edge:{edge.source}->{edge.target}")
            continue
        if not RelationType.has_value(edge.type.value):
            warnings.append(f"repair:removed_invalid_relation:{edge.type.value}")
            continue
        key = (edge.source, edge.target, edge.type.value, edge.origin.value)
        existing = unique_edges.get(key)
        if existing is None or edge.weight > existing.weight or edge.confidence > existing.confidence:
            unique_edges[key] = edge

    repaired_nodes = list(unique_nodes.values())
    repaired_nodes.sort(key=lambda node: (node.file, node.id))
    repaired_edges = list(unique_edges.values())
    repaired_edges.sort(key=lambda edge: (edge.source, edge.type.value, edge.target, edge.origin.value))
    return repaired_nodes, repaired_edges, warnings
