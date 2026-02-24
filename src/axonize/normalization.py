from __future__ import annotations

import hashlib
import re


INLINE_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
WIKI_LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_line_endings(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def strip_trailing_spaces(text: str) -> str:
    return "\n".join(line.rstrip() for line in normalize_line_endings(text).split("\n"))


def collapse_blank_lines(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text)


def normalize_whitespace_runs(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text)


def normalize_for_content_hash(text: str) -> str:
    normalized = strip_trailing_spaces(text)
    normalized = collapse_blank_lines(normalized)
    normalized = normalize_whitespace_runs(normalized)
    return normalized.strip()


def _strip_markdown_formatting(text: str) -> str:
    text = INLINE_LINK_RE.sub(lambda match: f"{match.group(1)} {match.group(2)}", text)
    text = WIKI_LINK_RE.sub(lambda match: match.group(1), text)
    text = re.sub(r"`{1,3}", "", text)
    text = re.sub(r"[*_~]", "", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s{0,3}>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    return text


def normalize_for_signature(text: str) -> str:
    normalized = normalize_for_content_hash(text)
    normalized = _strip_markdown_formatting(normalized)
    normalized = normalized.lower()
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def normalize_heading(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def normalize_heading_path(path: tuple[str, ...]) -> str:
    if not path:
        return "/"
    return " / ".join(normalize_heading(part).lower() for part in path)


def slugify_heading(text: str) -> str:
    text = normalize_heading(text).lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text
