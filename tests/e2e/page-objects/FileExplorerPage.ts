import type { Page } from '@playwright/test'

export class FileExplorerPage {
  constructor(readonly page: Page) {}

  get explorer() { return this.page.getByTestId('file-explorer') }
  get fileTree() { return this.page.getByTestId('file-tree') }
  get nodes() { return this.page.getByTestId('file-tree-node') }

  nodeByPath(relativePath: string) {
    return this.page.locator(`[data-testid="file-tree-node"][data-path="${relativePath}"]`)
  }

  nodeLabelByPath(relativePath: string) {
    return this.nodeByPath(relativePath).locator('> .file-tree-node').getByTestId('file-tree-node-label')
  }

  async clickFile(relativePath: string) {
    await this.nodeLabelByPath(relativePath).click()
  }
}
