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
import { all as allGrammars } from 'lowlight'
import rehypeStringify from 'rehype-stringify'
import { CODE_FILE_REF_CLASS, looksLikeVaultFileReference } from './doc-link'

const schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    // Allow corpus-document links (doc://...) through sanitization; clicks are
    // intercepted and resolved to vault files (see lib/doc-link.ts).
    href: [...(defaultSchema.protocols?.href ?? []), 'doc']
  },
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
  // Full grammar registry (not lowlight's `common` default) so niche but valid
  // fence tags (http, nginx, properties, …) highlight; code-fence-hygiene lint
  // validates against the same full registry.
  .use(rehypeHighlight, { detect: true, languages: allGrammars })
  .use(rehypeStringify)

function resolveAbsolutePath(dir: string, relative: string): string {
  const parts = [...dir.split('/').filter(Boolean), ...relative.split('/')]
  const stack: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return '/' + stack.join('/')
}

function resolveImageSrcs(html: string, fileDir: string): string {
  return html.replace(/(<img\b[^>]*?\bsrc=")([^"]*?)(")/g, (_match, pre, src, post) => {
    if (!src || src.startsWith('http') || src.startsWith('file://') || src.startsWith('data:') || src.startsWith('/')) {
      return `${pre}${src}${post}`
    }
    return `${pre}axonize-file://local${resolveAbsolutePath(fileDir, src)}${post}`
  })
}

/**
 * Tag path-shaped inline code (vault file citations) with a class so CSS can
 * give them link affordance; clicks are handled by handleCodeFileReferenceClick.
 * Fenced code blocks are unaffected: their <code> carries a language class.
 */
function markFileReferenceCode(html: string): string {
  return html.replace(/<code>([^<]+)<\/code>/g, (match, text: string) =>
    looksLikeVaultFileReference(text) ? `<code class="${CODE_FILE_REF_CLASS}">${text}</code>` : match
  )
}

export async function renderMarkdown(markdown: string, fileDir?: string): Promise<string> {
  const result = await processor.process(markdown)
  const html = markFileReferenceCode(String(result))
  return fileDir ? resolveImageSrcs(html, fileDir) : html
}
