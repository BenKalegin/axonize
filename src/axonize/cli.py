from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from axonize.commands import execute_command
from axonize.engine import SemanticEngine


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Axonize semantic document operating system")
    parser.add_argument("--repo", default=".", help="Repository root path")

    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    rebuild = subparsers.add_parser("rebuild", help="Rebuild semantic sidecar from Markdown docs")
    rebuild.add_argument("--full", action="store_true", help="Force full rebuild")

    subparsers.add_parser("check", help="Validate graph invariants in sidecar")

    command = subparsers.add_parser("command", help="Execute semantic command payload")
    command.add_argument("--payload", required=True, help="JSON file with command payload")
    command.add_argument("--apply", action="store_true", help="Apply generated patch")

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    repo_root = Path(args.repo).resolve()
    engine = SemanticEngine(repo_root)

    if args.subcommand == "rebuild":
        report = engine.rebuild(full=bool(args.full))
        print(
            json.dumps(
                {
                    "processed_files": report.processed_files,
                    "changed_files": report.changed_files,
                    "deleted_files": report.deleted_files,
                    "nodes_written": report.nodes_written,
                    "edges_written": report.edges_written,
                    "warnings": report.warnings,
                },
                ensure_ascii=True,
                indent=2,
                sort_keys=True,
            )
        )
        return 0

    if args.subcommand == "check":
        errors = engine.check()
        print(json.dumps({"errors": errors}, ensure_ascii=True, indent=2, sort_keys=True))
        return 0 if not errors else 1

    if args.subcommand == "command":
        payload_path = Path(args.payload)
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
        result = execute_command(repo_root, payload, apply=bool(args.apply))
        if args.apply:
            engine.rebuild(full=False)
        print(json.dumps(result.to_dict(), ensure_ascii=True, indent=2, sort_keys=True))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
