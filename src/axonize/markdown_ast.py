from __future__ import annotations

import os
import re
import time
from collections import defaultdict

from axonize.models import Block, BlockType, RelationAnnotation, RelationType
from axonize.normalization import (
    INLINE_LINK_RE,
    WIKI_LINK_RE,
    normalize_for_content_hash,
    normalize_for_signature,
    normalize_heading,
    normalize_heading_path,
    sha256_hex,
)


HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*$")
FENCE_RE = re.compile(r"^\s{0,3}(```|~~~)")
LIST_RE = re.compile(r"^\s{0,3}(?:[-*+]|\d+\.)\s+")
TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*(?:\s*:?-{3,}:?\s*)?\|?\s*$")
CALLOUT_START_RE = re.compile(r"^\s*>\s*\[![A-Za-z0-9_-]+\]")
QUOTE_RE = re.compile(r"^\s*>")
ANNOTATION_RE = re.compile(
    r"@(?P<relation>depends_on|defines|implements|extends|example_of|uses|alternative_to|related_to)"
    r"\((?P<target>[^)]+)\)",
    flags=re.IGNORECASE,
)


def _extract_links(content: str) -> list[str]:
    links: list[str] = []
    seen: set[str] = set()

    for match in INLINE_LINK_RE.finditer(content):
        target = match.group(2).strip()
        if target and target not in seen:
            links.append(target)
            seen.add(target)

    for match in WIKI_LINK_RE.finditer(content):
        target = match.group(1).strip()
        if target and target not in seen:
            links.append(target)
            seen.add(target)

    return links


def _extract_annotations(content: str) -> list[RelationAnnotation]:
    annotations: list[RelationAnnotation] = []
    for match in ANNOTATION_RE.finditer(content):
        relation_value = match.group("relation").lower()
        target = match.group("target").strip()
        if not target:
            continue
        annotations.append(RelationAnnotation(relation=RelationType(relation_value), raw_target=target))
    return annotations


def _parse_frontmatter(lines: list[str]) -> tuple[int, list[RelationAnnotation]]:
    if not lines or lines[0].strip() != "---":
        return 0, []

    end = -1
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end = idx
            break

    if end == -1:
        return 0, []

    annotations: list[RelationAnnotation] = []
    for row in lines[1:end]:
        if ":" not in row:
            continue
        key, raw_value = row.split(":", 1)
        relation_key = key.strip().lower().replace("-", "_")
        if not RelationType.has_value(relation_key):
            continue

        value = raw_value.strip()
        if value.startswith("[") and value.endswith("]"):
            value = value[1:-1]
        targets = [part.strip() for part in value.split(",") if part.strip()]
        for target in targets:
            annotations.append(RelationAnnotation(RelationType(relation_key), target))

    return end + 1, annotations


def _make_block(
    *,
    file_path: str,
    block_type: BlockType,
    heading_path: tuple[str, ...],
    title: str,
    content: str,
    start_line: int,
    end_line: int,
    timestamp: int,
    id_counter: dict[str, int],
    extra_annotations: list[RelationAnnotation] | None = None,
) -> Block:
    path_signature = normalize_heading_path(heading_path)
    signature = normalize_for_signature(content)
    base_id = sha256_hex(f"{file_path}\n{path_signature}\n{signature}")

    id_counter[base_id] += 1
    block_id = base_id if id_counter[base_id] == 1 else f"{base_id}~{id_counter[base_id]}"

    annotations = _extract_annotations(content)
    if extra_annotations:
        annotations.extend(extra_annotations)

    return Block(
        id=block_id,
        type=block_type,
        file=file_path,
        heading_path=heading_path,
        title=title,
        content=content,
        content_hash=sha256_hex(normalize_for_content_hash(content)),
        structure_hash=sha256_hex(path_signature),
        last_seen_timestamp=timestamp,
        start_line=start_line,
        end_line=end_line,
        link_targets=_extract_links(content),
        annotations=annotations,
    )


def parse_markdown(file_path: str, content: str, timestamp: int | None = None) -> list[Block]:
    file_path = file_path.replace(os.sep, "/")
    now = int(time.time()) if timestamp is None else timestamp

    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    id_counter: dict[str, int] = defaultdict(int)
    blocks: list[Block] = []

    frontmatter_start, frontmatter_annotations = _parse_frontmatter(lines)

    blocks.append(
        _make_block(
            file_path=file_path,
            block_type=BlockType.DOCUMENT,
            heading_path=tuple(),
            title=os.path.basename(file_path),
            content=normalized,
            start_line=1,
            end_line=max(1, len(lines)),
            timestamp=now,
            id_counter=id_counter,
            extra_annotations=frontmatter_annotations,
        )
    )

    heading_stack: list[tuple[int, str]] = []
    idx = frontmatter_start

    while idx < len(lines):
        line = lines[idx]

        if not line.strip():
            idx += 1
            continue

        heading_match = HEADING_RE.match(line)
        if heading_match:
            level = len(heading_match.group(1))
            heading_title = normalize_heading(heading_match.group(2))

            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_stack.append((level, heading_title))

            path = tuple(item[1] for item in heading_stack)
            blocks.append(
                _make_block(
                    file_path=file_path,
                    block_type=BlockType.SECTION,
                    heading_path=path,
                    title=heading_title,
                    content=heading_title,
                    start_line=idx + 1,
                    end_line=idx + 1,
                    timestamp=now,
                    id_counter=id_counter,
                )
            )
            idx += 1
            continue

        if FENCE_RE.match(line):
            start = idx
            fence = line.strip()[:3]
            idx += 1
            while idx < len(lines) and not lines[idx].strip().startswith(fence):
                idx += 1
            if idx < len(lines):
                idx += 1
            end = idx
            content_slice = "\n".join(lines[start:end]).strip("\n")
            blocks.append(
                _make_block(
                    file_path=file_path,
                    block_type=BlockType.CODE,
                    heading_path=tuple(item[1] for item in heading_stack),
                    title="code",
                    content=content_slice,
                    start_line=start + 1,
                    end_line=end,
                    timestamp=now,
                    id_counter=id_counter,
                )
            )
            continue

        if CALLOUT_START_RE.match(line):
            start = idx
            idx += 1
            while idx < len(lines):
                candidate = lines[idx]
                if QUOTE_RE.match(candidate) or not candidate.strip():
                    idx += 1
                    continue
                break
            end = idx
            content_slice = "\n".join(lines[start:end]).strip("\n")
            blocks.append(
                _make_block(
                    file_path=file_path,
                    block_type=BlockType.CALLOUT,
                    heading_path=tuple(item[1] for item in heading_stack),
                    title="callout",
                    content=content_slice,
                    start_line=start + 1,
                    end_line=end,
                    timestamp=now,
                    id_counter=id_counter,
                )
            )
            continue

        if LIST_RE.match(line):
            start = idx
            idx += 1
            while idx < len(lines):
                candidate = lines[idx]
                if LIST_RE.match(candidate) or candidate.startswith(("  ", "\t")):
                    idx += 1
                    continue
                if not candidate.strip() and idx + 1 < len(lines) and LIST_RE.match(lines[idx + 1]):
                    idx += 1
                    continue
                break
            end = idx
            content_slice = "\n".join(lines[start:end]).strip("\n")
            blocks.append(
                _make_block(
                    file_path=file_path,
                    block_type=BlockType.LIST,
                    heading_path=tuple(item[1] for item in heading_stack),
                    title="list",
                    content=content_slice,
                    start_line=start + 1,
                    end_line=end,
                    timestamp=now,
                    id_counter=id_counter,
                )
            )
            continue

        if "|" in line and idx + 1 < len(lines) and TABLE_SEPARATOR_RE.match(lines[idx + 1]):
            start = idx
            idx += 2
            while idx < len(lines) and "|" in lines[idx]:
                idx += 1
            end = idx
            content_slice = "\n".join(lines[start:end]).strip("\n")
            blocks.append(
                _make_block(
                    file_path=file_path,
                    block_type=BlockType.TABLE,
                    heading_path=tuple(item[1] for item in heading_stack),
                    title="table",
                    content=content_slice,
                    start_line=start + 1,
                    end_line=end,
                    timestamp=now,
                    id_counter=id_counter,
                )
            )
            continue

        start = idx
        idx += 1
        while idx < len(lines):
            candidate = lines[idx]
            if not candidate.strip():
                break
            if (
                HEADING_RE.match(candidate)
                or FENCE_RE.match(candidate)
                or CALLOUT_START_RE.match(candidate)
                or LIST_RE.match(candidate)
                or ("|" in candidate and idx + 1 < len(lines) and TABLE_SEPARATOR_RE.match(lines[idx + 1]))
            ):
                break
            idx += 1
        end = idx
        content_slice = "\n".join(lines[start:end]).strip("\n")
        blocks.append(
            _make_block(
                file_path=file_path,
                block_type=BlockType.PARAGRAPH,
                heading_path=tuple(item[1] for item in heading_stack),
                title="paragraph",
                content=content_slice,
                start_line=start + 1,
                end_line=end,
                timestamp=now,
                id_counter=id_counter,
            )
        )

    return blocks
