from __future__ import annotations

import difflib
from dataclasses import dataclass
from pathlib import Path

from axonize.markdown_ast import parse_markdown
from axonize.models import Block


SUPPORTED_COMMANDS = {"rewrite"}
SUPPORTED_SCOPES = {"block", "section"}


@dataclass(slots=True)
class SemanticCommand:
    command: str
    target: str
    instruction: str
    scope: str = "block"

    @classmethod
    def from_payload(cls, payload: dict) -> "SemanticCommand":
        command = str(payload.get("command", "")).strip().lower()
        target = str(payload.get("target", "")).strip()
        instruction = str(payload.get("instruction", "")).strip()
        scope = str(payload.get("scope", "block")).strip().lower()

        if command not in SUPPORTED_COMMANDS:
            raise ValueError(f"unsupported_command:{command}")
        if not target:
            raise ValueError("missing_target")
        if not instruction:
            raise ValueError("missing_instruction")
        if scope not in SUPPORTED_SCOPES:
            raise ValueError(f"unsupported_scope:{scope}")
        return cls(command=command, target=target, instruction=instruction, scope=scope)


@dataclass(slots=True)
class CommandResult:
    command: str
    target: str
    file: str
    applied: bool
    diff: str
    warnings: list[str]

    def to_dict(self) -> dict:
        return {
            "command": self.command,
            "target": self.target,
            "file": self.file,
            "applied": self.applied,
            "diff": self.diff,
            "warnings": self.warnings,
        }


def _find_target_block(repo_root: Path, target_id: str) -> tuple[str, str, list[Block], Block]:
    docs_root = repo_root / "docs"
    for file_path in sorted(docs_root.rglob("*.md")):
        relative = file_path.relative_to(repo_root).as_posix()
        content = file_path.read_text(encoding="utf-8")
        blocks = parse_markdown(relative, content)
        for block in blocks:
            if block.id == target_id:
                return relative, content, blocks, block
    raise ValueError("target_block_not_found")


def _rewrite_text(original: str, instruction: str) -> str:
    lowered = instruction.lower()
    if "concise" in lowered or "short" in lowered:
        sentence_end = original.find(".")
        if sentence_end > 0:
            condensed = original[: sentence_end + 1].strip()
            if condensed:
                return condensed
        words = original.split()
        return " ".join(words[: max(1, min(20, len(words)))])

    if "bullet" in lowered:
        words = original.replace("\n", " ").split()
        chunks = [" ".join(words[idx : idx + 8]) for idx in range(0, len(words), 8)]
        return "\n".join(f"- {chunk}" for chunk in chunks if chunk)

    return original


def _scope_range(blocks: list[Block], target_block: Block, scope: str) -> tuple[int, int]:
    if scope == "block":
        return target_block.start_line, target_block.end_line

    related = [
        block
        for block in blocks
        if block.file == target_block.file and block.heading_path[: len(target_block.heading_path)] == target_block.heading_path
    ]
    if not related:
        return target_block.start_line, target_block.end_line
    start = min(block.start_line for block in related)
    end = max(block.end_line for block in related)
    return start, end


def execute_command(repo_root: Path, payload: dict, apply: bool = False) -> CommandResult:
    command = SemanticCommand.from_payload(payload)

    if command.command != "rewrite":
        raise ValueError(f"unsupported_command:{command.command}")

    relative_path, original_content, blocks, target_block = _find_target_block(repo_root, command.target)
    start_line, end_line = _scope_range(blocks, target_block, command.scope)
    replacement = _rewrite_text(target_block.content, command.instruction)
    replacement_lines = replacement.splitlines() or [""]

    original_lines = original_content.splitlines()
    new_lines = original_lines[: start_line - 1] + replacement_lines + original_lines[end_line:]
    new_content = "\n".join(new_lines)
    if original_content.endswith("\n"):
        new_content += "\n"

    diff = "".join(
        difflib.unified_diff(
            original_content.splitlines(keepends=True),
            new_content.splitlines(keepends=True),
            fromfile=relative_path,
            tofile=relative_path,
        )
    )

    if apply:
        (repo_root / relative_path).write_text(new_content, encoding="utf-8")

    warnings: list[str] = []
    if replacement == target_block.content:
        warnings.append("rewrite_noop:instruction_produced_identical_text")

    return CommandResult(
        command=command.command,
        target=command.target,
        file=relative_path,
        applied=apply,
        diff=diff,
        warnings=warnings,
    )
