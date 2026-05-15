import {
  type Diagram,
  ElementType,
  defaultDiagramDisplay,
  importMermaidFlowchartWithLayout,
  renderSvg,
  type ThemeTokens,
  defaultLightTheme,
  defaultDarkTheme,
} from '@benkalegin/doodles-api'

const FLOWCHART_LIKE = /^\s*(?:---\s*\n[\s\S]*?\n---\s*\n)?(?:flowchart|graph|classDiagram|c4context|c4container|c4component|c4dynamic|c4deployment)\b/i

/**
 * True for Mermaid sources doodles 0.3.0 knows how to parse + render
 * end-to-end (flowchart / graph / classDiagram / C4 variants). Other kinds
 * (sequence, gantt, er, pie, state, mindmap, …) still go through the
 * `mermaid` library for now.
 */
export function canRenderWithDoodles(source: string): boolean {
  return FLOWCHART_LIKE.test(source)
}

/**
 * Parse + layout + render a flowchart-shaped Mermaid source as SVG via
 * `@benkalegin/doodles-api`. Returns the SVG string. Throws if the source
 * is malformed or doodles' importer rejects it.
 */
export async function renderMermaidWithDoodles(
  source: string,
  options: { dark?: boolean } = {}
): Promise<string> {
  const base: Diagram = {
    id: 'ax-doodle',
    type: ElementType.FlowchartDiagram,
    display: defaultDiagramDisplay,
  }
  const diagram = await importMermaidFlowchartWithLayout(base, source)
  const theme: ThemeTokens = options.dark ? defaultDarkTheme : defaultLightTheme
  return renderSvg(diagram as never, { theme })
}
