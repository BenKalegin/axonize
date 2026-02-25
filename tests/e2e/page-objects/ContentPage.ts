import type { Page } from '@playwright/test'

export class ContentPage {
  constructor(readonly page: Page) {}

  get contentView() { return this.page.getByTestId('content-view') }
  get markdownView() { return this.page.getByTestId('markdown-view') }
  get graphView() { return this.page.getByTestId('graph-view') }
  get emptyState() { return this.page.getByTestId('empty-state') }
}
