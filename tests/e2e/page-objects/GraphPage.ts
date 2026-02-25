import type { Page } from '@playwright/test'

export class GraphPage {
  constructor(readonly page: Page) {}

  get graphView() { return this.page.getByTestId('graph-view') }
  get forceGraph() { return this.page.getByTestId('force-graph') }
  get graphControls() { return this.page.getByTestId('graph-controls') }
  get nodeCount() { return this.page.getByTestId('node-count') }
  get edgeCount() { return this.page.getByTestId('edge-count') }

  zoomButton(level: string) {
    return this.page.getByTestId(`zoom-btn-${level}`)
  }
}
