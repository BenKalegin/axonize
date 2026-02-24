from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class BlockType(str, Enum):
    DOCUMENT = "document"
    SECTION = "section"
    PARAGRAPH = "paragraph"
    LIST = "list"
    CODE = "code"
    TABLE = "table"
    CALLOUT = "callout"


class RelationType(str, Enum):
    DEPENDS_ON = "depends_on"
    DEFINES = "defines"
    IMPLEMENTS = "implements"
    EXTENDS = "extends"
    EXAMPLE_OF = "example_of"
    USES = "uses"
    ALTERNATIVE_TO = "alternative_to"
    RELATED_TO = "related_to"

    @classmethod
    def has_value(cls, value: str) -> bool:
        return value in {item.value for item in cls}


class EdgeOrigin(str, Enum):
    DETERMINISTIC = "deterministic"
    INFERRED = "inferred"


@dataclass(slots=True)
class RelationAnnotation:
    relation: RelationType
    raw_target: str


@dataclass(slots=True)
class Block:
    id: str
    type: BlockType
    file: str
    heading_path: tuple[str, ...]
    title: str
    content: str
    content_hash: str
    structure_hash: str
    last_seen_timestamp: int
    start_line: int
    end_line: int
    link_targets: list[str] = field(default_factory=list)
    annotations: list[RelationAnnotation] = field(default_factory=list)


@dataclass(slots=True)
class Node:
    id: str
    type: BlockType
    file: str
    title: str
    content_hash: str
    structure_hash: str

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "type": self.type.value,
            "file": self.file,
            "title": self.title,
            "content_hash": self.content_hash,
            "structure_hash": self.structure_hash,
        }


@dataclass(slots=True)
class Edge:
    source: str
    target: str
    type: RelationType
    weight: float
    confidence: float
    origin: EdgeOrigin

    def to_dict(self) -> dict[str, str | float]:
        return {
            "source": self.source,
            "target": self.target,
            "type": self.type.value,
            "weight": round(self.weight, 4),
            "confidence": round(self.confidence, 4),
            "origin": self.origin.value,
        }


@dataclass(slots=True)
class FileIntegrityState:
    file_hash: str
    structure_hash: str

    def to_dict(self) -> dict[str, str]:
        return {
            "file_hash": self.file_hash,
            "structure_hash": self.structure_hash,
        }


@dataclass(slots=True)
class RebuildReport:
    processed_files: int
    changed_files: list[str]
    deleted_files: list[str]
    nodes_written: int
    edges_written: int
    warnings: list[str] = field(default_factory=list)
