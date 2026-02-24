from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

from axonize.models import BlockType, Edge, EdgeOrigin, FileIntegrityState, Node, RelationType


HEADING_ONLY_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*$", flags=re.MULTILINE)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def heading_structure_hash(content: str) -> str:
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    headings: list[str] = []
    for match in HEADING_ONLY_RE.finditer(normalized):
        level = len(match.group(1))
        title = re.sub(r"\s+", " ", match.group(2)).strip().lower()
        headings.append(f"{level}:{title}")
    digest = hashlib.sha256("\n".join(headings).encode("utf-8")).hexdigest()
    return digest


def discover_markdown_files(repo_root: Path) -> list[str]:
    docs_root = repo_root / "docs"
    if not docs_root.exists():
        return []

    files = [path for path in docs_root.rglob("*.md") if path.is_file()]
    relative = [path.relative_to(repo_root).as_posix() for path in files]
    relative.sort()
    return relative


def _read_json(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, ensure_ascii=True, indent=2, sort_keys=True)
        handle.write("\n")
        tmp_name = handle.name
    os.replace(tmp_name, path)


def ensure_sidecar(repo_root: Path) -> Path:
    sidecar = repo_root / ".semantic"
    sidecar.mkdir(parents=True, exist_ok=True)
    (sidecar / "cache").mkdir(parents=True, exist_ok=True)
    return sidecar


def load_state(sidecar: Path) -> dict | None:
    payload = _read_json(sidecar / "state.json")
    if isinstance(payload, dict):
        return payload
    return None


def save_state(sidecar: Path, payload: dict) -> None:
    _write_json(sidecar / "state.json", payload)


def load_nodes(sidecar: Path) -> list[Node]:
    payload = _read_json(sidecar / "nodes.json")
    if not isinstance(payload, list):
        return []

    nodes: list[Node] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            nodes.append(
                Node(
                    id=str(item["id"]),
                    type=BlockType(str(item["type"])),
                    file=str(item["file"]),
                    title=str(item.get("title", "")),
                    content_hash=str(item.get("content_hash", "")),
                    structure_hash=str(item.get("structure_hash", "")),
                )
            )
        except (KeyError, ValueError):
            continue
    return nodes


def save_nodes(sidecar: Path, nodes: list[Node]) -> None:
    payload = [node.to_dict() for node in sorted(nodes, key=lambda item: (item.file, item.id))]
    _write_json(sidecar / "nodes.json", payload)


def load_edges(sidecar: Path) -> list[Edge]:
    payload = _read_json(sidecar / "edges.json")
    if not isinstance(payload, list):
        return []

    edges: list[Edge] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            relation = str(item["type"])
            if not RelationType.has_value(relation):
                continue
            origin = str(item.get("origin", EdgeOrigin.DETERMINISTIC.value))
            if origin not in {EdgeOrigin.DETERMINISTIC.value, EdgeOrigin.INFERRED.value}:
                origin = EdgeOrigin.DETERMINISTIC.value
            edges.append(
                Edge(
                    source=str(item["source"]),
                    target=str(item["target"]),
                    type=RelationType(relation),
                    weight=float(item.get("weight", 1.0)),
                    confidence=float(item.get("confidence", 1.0)),
                    origin=EdgeOrigin(origin),
                )
            )
        except KeyError:
            continue
    return edges


def save_edges(sidecar: Path, edges: list[Edge]) -> None:
    payload = [
        edge.to_dict()
        for edge in sorted(edges, key=lambda item: (item.source, item.type.value, item.target, item.origin.value))
    ]
    _write_json(sidecar / "edges.json", payload)


def build_files_state(repo_root: Path, files: list[str]) -> dict[str, FileIntegrityState]:
    state: dict[str, FileIntegrityState] = {}
    for file_path in files:
        full_path = repo_root / file_path
        content = full_path.read_text(encoding="utf-8")
        state[file_path] = FileIntegrityState(
            file_hash=sha256_file(full_path),
            structure_hash=heading_structure_hash(content),
        )
    return state
