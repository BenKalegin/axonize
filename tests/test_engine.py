from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from axonize.engine import SemanticEngine


DOC_A = """# Alpha

Alpha references [Beta](./b.md#beta).
"""

DOC_B = """# Beta

Beta provides shared context.
"""


class EngineTests(unittest.TestCase):
    def test_rebuild_and_incremental_change_detection(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "docs").mkdir()
            (root / "docs" / "a.md").write_text(DOC_A, encoding="utf-8")
            (root / "docs" / "b.md").write_text(DOC_B, encoding="utf-8")

            engine = SemanticEngine(root)
            first = engine.rebuild(full=True)
            self.assertEqual(first.processed_files, 2)
            self.assertEqual(sorted(first.changed_files), ["docs/a.md", "docs/b.md"])
            self.assertTrue((root / ".semantic" / "state.json").exists())
            self.assertTrue((root / ".semantic" / "nodes.json").exists())
            self.assertTrue((root / ".semantic" / "edges.json").exists())

            second = engine.rebuild(full=False)
            self.assertEqual(second.changed_files, [])

            (root / "docs" / "a.md").write_text(DOC_A + "\nAdditional paragraph.\n", encoding="utf-8")
            third = engine.rebuild(full=False)
            self.assertEqual(third.changed_files, ["docs/a.md"])

    def test_deleted_file_detection(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "docs").mkdir()
            (root / "docs" / "a.md").write_text(DOC_A, encoding="utf-8")
            (root / "docs" / "b.md").write_text(DOC_B, encoding="utf-8")

            engine = SemanticEngine(root)
            engine.rebuild(full=True)

            (root / "docs" / "b.md").unlink()
            report = engine.rebuild(full=False)
            self.assertEqual(report.deleted_files, ["docs/b.md"])


if __name__ == "__main__":
    unittest.main()
