from __future__ import annotations

from pathlib import PurePosixPath

from axonize.models import Block, BlockType, Edge, EdgeOrigin, Node, RelationType
from axonize.normalization import normalize_heading, slugify_heading


def build_nodes(blocks: list[Block]) -> list[Node]:
    return [
        Node(
            id=block.id,
            type=block.type,
            file=block.file,
            title=block.title,
            content_hash=block.content_hash,
            structure_hash=block.structure_hash,
        )
        for block in blocks
    ]


def _normalize_doc_path(path: str) -> str:
    return PurePosixPath(path).as_posix()


def _resolve_relative_path(current_file: str, candidate: str) -> str:
    base = PurePosixPath(current_file).parent
    resolved = (base / candidate).as_posix()
    return _normalize_doc_path(resolved)


def build_reference_index(blocks: list[Block]) -> dict[str, str]:
    index: dict[str, str] = {}

    section_index: dict[tuple[str, tuple[str, ...]], str] = {}
    for block in blocks:
        index[block.id] = block.id
        file_key = _normalize_doc_path(block.file)

        if block.type is BlockType.DOCUMENT:
            index[file_key] = block.id
            if file_key.endswith(".md"):
                index[file_key[:-3]] = block.id

        if block.type is BlockType.SECTION:
            section_index[(file_key, block.heading_path)] = block.id
            leaf = slugify_heading(block.heading_path[-1])
            full = "-".join(slugify_heading(part) for part in block.heading_path if part)

            index[f"{file_key}#{leaf}"] = block.id
            index[f"{file_key}#{full}"] = block.id
            index[f"{file_key[:-3]}#{leaf}"] = block.id
            index[f"{file_key[:-3]}#{full}"] = block.id

    return index


def _normalize_target(raw_target: str, source_file: str) -> tuple[str | None, str | None]:
    target = raw_target.strip()
    if not target:
        return None, None

    if target.startswith(("http://", "https://", "mailto:")):
        return None, None

    if target.startswith("#"):
        return _normalize_doc_path(source_file), target[1:]

    if "#" in target:
        path_part, anchor = target.split("#", 1)
        if not path_part:
            path_part = source_file
        elif path_part.startswith("/"):
            path_part = path_part.lstrip("/")
        else:
            path_part = _resolve_relative_path(source_file, path_part)
        return _normalize_doc_path(path_part), anchor

    path_part = target
    if path_part.startswith("/"):
        path_part = path_part.lstrip("/")
    else:
        path_part = _resolve_relative_path(source_file, path_part)
    return _normalize_doc_path(path_part), None


def resolve_target(raw_target: str, source_file: str, reference_index: dict[str, str]) -> str | None:
    if raw_target in reference_index:
        return reference_index[raw_target]

    path, anchor = _normalize_target(raw_target, source_file)
    if not path:
        return None

    candidates: list[str] = [path]
    if not path.endswith(".md"):
        candidates.append(f"{path}.md")
    if path.endswith(".md"):
        candidates.append(path[:-3])

    if anchor is None:
        for candidate in candidates:
            if candidate in reference_index:
                return reference_index[candidate]
        return None

    anchor_text = normalize_heading(anchor)
    anchor_slug = slugify_heading(anchor_text)
    for candidate in candidates:
        joined = [
            f"{candidate}#{anchor_text}",
            f"{candidate}#{anchor_text.lower()}",
            f"{candidate}#{anchor_slug}",
        ]
        for key in joined:
            if key in reference_index:
                return reference_index[key]
    return None


def _dedupe_edges(edges: list[Edge]) -> list[Edge]:
    unique: dict[tuple[str, str, str, str], Edge] = {}
    for edge in edges:
        key = (edge.source, edge.target, edge.type.value, edge.origin.value)
        existing = unique.get(key)
        if existing is None:
            unique[key] = edge
            continue
        if edge.weight > existing.weight or edge.confidence > existing.confidence:
            unique[key] = edge

    ordered = list(unique.values())
    ordered.sort(key=lambda edge: (edge.source, edge.type.value, edge.target, edge.origin.value))
    return ordered


def build_deterministic_edges(blocks: list[Block], source_files: set[str] | None = None) -> list[Edge]:
    reference_index = build_reference_index(blocks)
    block_by_file: dict[str, list[Block]] = {}
    section_by_path: dict[tuple[str, tuple[str, ...]], str] = {}
    document_by_file: dict[str, str] = {}

    for block in blocks:
        block_by_file.setdefault(block.file, []).append(block)
        if block.type is BlockType.SECTION:
            section_by_path[(block.file, block.heading_path)] = block.id
        elif block.type is BlockType.DOCUMENT:
            document_by_file[block.file] = block.id

    def includes(block: Block) -> bool:
        if source_files is None:
            return True
        return block.file in source_files

    edges: list[Edge] = []

    for block in blocks:
        if not includes(block):
            continue

        if block.type is BlockType.SECTION and len(block.heading_path) > 1:
            parent_key = (block.file, block.heading_path[:-1])
            parent = section_by_path.get(parent_key)
            if parent:
                edges.append(
                    Edge(
                        source=block.id,
                        target=parent,
                        type=RelationType.EXTENDS,
                        weight=1.0,
                        confidence=1.0,
                        origin=EdgeOrigin.DETERMINISTIC,
                    )
                )

        if block.type not in (BlockType.DOCUMENT, BlockType.SECTION):
            owner = section_by_path.get((block.file, block.heading_path))
            if owner is None:
                owner = document_by_file.get(block.file)
            if owner:
                edges.append(
                    Edge(
                        source=owner,
                        target=block.id,
                        type=RelationType.DEFINES,
                        weight=1.0,
                        confidence=1.0,
                        origin=EdgeOrigin.DETERMINISTIC,
                    )
                )

        for target_ref in block.link_targets:
            target_id = resolve_target(target_ref, block.file, reference_index)
            if not target_id:
                continue
            edges.append(
                Edge(
                    source=block.id,
                    target=target_id,
                    type=RelationType.DEPENDS_ON,
                    weight=1.0,
                    confidence=1.0,
                    origin=EdgeOrigin.DETERMINISTIC,
                )
            )

        for annotation in block.annotations:
            target_id = resolve_target(annotation.raw_target, block.file, reference_index)
            if not target_id:
                continue
            edges.append(
                Edge(
                    source=block.id,
                    target=target_id,
                    type=annotation.relation,
                    weight=1.0,
                    confidence=1.0,
                    origin=EdgeOrigin.DETERMINISTIC,
                )
            )

    return _dedupe_edges(edges)
