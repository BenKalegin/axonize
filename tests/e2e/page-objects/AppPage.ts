import type { Page } from '@playwright/test'

export class AppPage {
  constructor(readonly page: Page) {}

  get shell() { return this.page.getByTestId('shell') }
  get toolbar() { return this.page.getByTestId('toolbar') }
  get leftSidebar() { return this.page.getByTestId('left-sidebar') }
  get rightSidebar() { return this.page.getByTestId('right-sidebar') }
  get contentArea() { return this.page.getByTestId('content-area') }
  get commandBar() { return this.page.getByTestId('command-bar') }
  get openVaultBtn() { return this.page.getByTestId('open-vault-btn') }
  get vaultName() { return this.page.getByTestId('vault-name') }
  get viewMarkdownBtn() { return this.page.getByTestId('view-markdown-btn') }
  get viewGraphBtn() { return this.page.getByTestId('view-graph-btn') }
}
