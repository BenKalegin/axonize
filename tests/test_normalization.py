from __future__ import annotations

import unittest

from axonize.normalization import normalize_for_content_hash, normalize_for_signature


class NormalizationTests(unittest.TestCase):
    def test_signature_ignores_formatting_only_changes(self) -> None:
        first = "**Payment** _engine_ coordinates retries."
        second = "*Payment* engine coordinates retries."
        self.assertEqual(normalize_for_signature(first), normalize_for_signature(second))

    def test_content_hash_normalizes_whitespace(self) -> None:
        first = "Line one  \r\n\r\nLine two\t\t"
        second = "Line one\n\nLine two"
        self.assertEqual(normalize_for_content_hash(first), normalize_for_content_hash(second))


if __name__ == "__main__":
    unittest.main()
