import hljs from 'highlight.js/lib/core'
import jsonLanguage from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', jsonLanguage)

/** Highlight a JSON string into hljs-classed HTML (styled by the global github-dark theme). */
export function highlightJson(text: string): string {
  return hljs.highlight(text, { language: 'json' }).value
}
