import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'

const schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'sub',
    'sup',
    'mark',
    'u',
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msup',
    'msub',
    'mfrac',
    'mtext',
    'annotation'
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    div: [...(defaultSchema.attributes?.div ?? []), 'className'],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'className',
      'style',
      'ariaHidden'
    ],
    math: ['xmlns', 'display'],
    semantics: [],
    mrow: [],
    mi: ['mathvariant'],
    mo: ['stretchy', 'minsize', 'maxsize'],
    mn: [],
    msup: [],
    msub: [],
    mfrac: ['linethickness'],
    mtext: [],
    annotation: ['encoding']
  }
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, schema)
  .use(rehypeKatex)
  .use(rehypeSlug)
  .use(rehypeHighlight, { detect: true })
  .use(rehypeStringify)

export async function renderMarkdown(markdown: string): Promise<string> {
  const result = await processor.process(markdown)
  return String(result)
}
