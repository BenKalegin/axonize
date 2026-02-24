from __future__ import annotations

import json
from pathlib import Path

from axonize import ENGINE_VERSION, SCHEMA_VERSION
from axonize.graph import build_deterministic_edges, build_nodes
from axonize.integrity import repair_graph, validate_graph
from axonize.markdown_ast import parse_markdown
from axonize.models import Block, BlockType, RebuildReport, RelationAnnotation, RelationType
from axonize.storage import (
    build_files_state,
    discover_markdown_files,
    ensure_sidecar,
    load_edges,
    load_nodes,
    load_state,
    save_edges,
    save_nodes,
    save_state,
)


def _cache_key(file_path: str, file_hash: str) -> str:
    safe = file_path.replace("/", "__").replace(".", "_")
    return f"{safe}.{file_hash}.json"


def _serialize_block(block: Block) -> dict:
    return {
        "id": block.id,
        "type": block.type.value,
        "file": block.file,
        "heading_path": list(block.heading_path),
        "title": block.title,
        "content": block.content,
        "content_hash": block.content_hash,
        "structure_hash": block.structure_hash,
        "last_seen_timestamp": block.last_seen_timestamp,
        "start_line": block.start_line,
        "end_line": block.end_line,
        "link_targets": block.link_targets,
        "annotations": [{"relation": item.relation.value, "raw_target": item.raw_target} for item in block.annotations],
    }


def _deserialize_block(payload: dict) -> Block | None:
    try:
        annotations = [
            RelationAnnotation(RelationType(item["relation"]), str(item["raw_target"]))
            for item in payload.get("annotations", [])
        ]
        return Block(
            id=str(payload["id"]),
            type=BlockType(str(payload["type"])),
            file=str(payload["file"]),
            heading_path=tuple(str(part) for part in payload.get("heading_path", [])),
            title=str(payload.get("title", "")),
            content=str(payload.get("content", "")),
            content_hash=str(payload.get("content_hash", "")),
            structure_hash=str(payload.get("structure_hash", "")),
            last_seen_timestamp=int(payload.get("last_seen_timestamp", 0)),
            start_line=int(payload.get("start_line", 1)),
            end_line=int(payload.get("end_line", 1)),
            link_targets=[str(item) for item in payload.get("link_targets", [])],
            annotations=annotations,
        )
    except (KeyError, TypeError, ValueError):
        return None


class SemanticEngine:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self.sidecar = ensure_sidecar(repo_root)

    def _cache_file_path(self, file_path: str, file_hash: str) -> Path:
        return self.sidecar / "cache" / _cache_key(file_path, file_hash)

    def _load_cached_blocks(self, file_path: str, file_hash: str) -> list[Block] | None:
        cache_path = self._cache_file_path(file_path, file_hash)
        if not cache_path.exists():
            return None
        try:
            payload = json.loads(cache_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        if not isinstance(payload, list):
            return None

        blocks: list[Block] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            block = _deserialize_block(item)
            if block is None:
                continue
            blocks.append(block)
        return blocks or None

    def _save_cached_blocks(self, file_path: str, file_hash: str, blocks: list[Block]) -> None:
        cache_path = self._cache_file_path(file_path, file_hash)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(
            json.dumps([_serialize_block(block) for block in blocks], ensure_ascii=True, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

        safe_prefix = file_path.replace("/", "__").replace(".", "_")
        for stale in cache_path.parent.glob(f"{safe_prefix}.*.json"):
            if stale.name != cache_path.name:
                stale.unlink(missing_ok=True)

    def rebuild(self, full: bool = False) -> RebuildReport:
        warnings: list[str] = []
        previous_state = load_state(self.sidecar)

        if previous_state is None:
            full = True
            warnings.append("state_missing_or_invalid:forcing_full_rebuild")
            previous_state = {}

        prev_schema = previous_state.get("schema_version")
        prev_engine = previous_state.get("engine_version")
        if prev_schema and prev_schema != SCHEMA_VERSION:
            full = True
            warnings.append("schema_version_mismatch:forcing_full_rebuild")
        if prev_engine and prev_engine != ENGINE_VERSION:
            full = True
            warnings.append("engine_version_mismatch:forcing_full_rebuild")

        files = discover_markdown_files(self.repo_root)
        files_state = build_files_state(self.repo_root, files)

        prev_files_state = previous_state.get("files", {})
        if not isinstance(prev_files_state, dict):
            prev_files_state = {}

        deleted_files = sorted(set(prev_files_state.keys()) - set(files))
        changed_files: list[str] = []
        for file_path in files:
            if full:
                changed_files.append(file_path)
                continue
            current = files_state[file_path]
            previous = prev_files_state.get(file_path)
            if not isinstance(previous, dict):
                changed_files.append(file_path)
                continue
            if previous.get("file_hash") != current.file_hash:
                changed_files.append(file_path)

        all_blocks: list[Block] = []
        for file_path in files:
            file_integrity = files_state[file_path]
            if not full and file_path not in changed_files:
                cached = self._load_cached_blocks(file_path, file_integrity.file_hash)
                if cached is not None:
                    all_blocks.extend(cached)
                    continue
                changed_files.append(file_path)
                warnings.append(f"cache_miss:{file_path}:reparsed")

            content = (self.repo_root / file_path).read_text(encoding="utf-8")
            blocks = parse_markdown(file_path, content)
            all_blocks.extend(blocks)
            self._save_cached_blocks(file_path, file_integrity.file_hash, blocks)

        nodes = build_nodes(all_blocks)
        edges = build_deterministic_edges(all_blocks)

        errors = validate_graph(nodes, edges)
        if errors:
            warnings.extend([f"invariant_violation:{item}" for item in errors])
            nodes, edges, repair_warnings = repair_graph(nodes, edges)
            warnings.extend(repair_warnings)

        save_nodes(self.sidecar, nodes)
        save_edges(self.sidecar, edges)

        state_payload = {
            "schema_version": SCHEMA_VERSION,
            "engine_version": ENGINE_VERSION,
            "files": {file: state.to_dict() for file, state in files_state.items()},
        }
        save_state(self.sidecar, state_payload)

        return RebuildReport(
            processed_files=len(files),
            changed_files=sorted(changed_files),
            deleted_files=deleted_files,
            nodes_written=len(nodes),
            edges_written=len(edges),
            warnings=warnings,
        )

    def check(self) -> list[str]:
        nodes = load_nodes(self.sidecar)
        edges = load_edges(self.sidecar)
        if not (self.sidecar / "nodes.json").exists():
            return ["missing_nodes_json"]

        return validate_graph(nodes, edges)
