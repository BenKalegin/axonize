from __future__ import annotations

import unittest

from axonize.markdown_ast import parse_markdown
from axonize.models import BlockType


SAMPLE_DOC = """---
depends_on: docs/other.md#context
---

# Title

Paragraph with [link](docs/other.md#context).

## Child

- One
- Two

> [!NOTE]
> Something to remember.

```txt
code sample
```

| A | B |
|---|---|
| 1 | 2 |
"""


class ParserTests(unittest.TestCase):
    def test_extracts_required_block_types(self) -> None:
        blocks = parse_markdown("docs/sample.md", SAMPLE_DOC, timestamp=1)
        kinds = {block.type for block in blocks}
        self.assertIn(BlockType.DOCUMENT, kinds)
        self.assertIn(BlockType.SECTION, kinds)
        self.assertIn(BlockType.PARAGRAPH, kinds)
        self.assertIn(BlockType.LIST, kinds)
        self.assertIn(BlockType.CALLOUT, kinds)
        self.assertIn(BlockType.CODE, kinds)
        self.assertIn(BlockType.TABLE, kinds)

    def test_block_id_stable_for_formatting_change(self) -> None:
        first = parse_markdown("docs/sample.md", "# A\n\n**Hello** world.", timestamp=1)
        second = parse_markdown("docs/sample.md", "# A\n\n*Hello* world.", timestamp=1)

        first_paragraph = next(block for block in first if block.type is BlockType.PARAGRAPH)
        second_paragraph = next(block for block in second if block.type is BlockType.PARAGRAPH)
        self.assertEqual(first_paragraph.id, second_paragraph.id)

    def test_frontmatter_annotations_become_relations(self) -> None:
        blocks = parse_markdown("docs/sample.md", SAMPLE_DOC, timestamp=1)
        document = next(block for block in blocks if block.type is BlockType.DOCUMENT)
        relations = {(item.relation.value, item.raw_target) for item in document.annotations}
        self.assertIn(("depends_on", "docs/other.md#context"), relations)


if __name__ == "__main__":
    unittest.main()
