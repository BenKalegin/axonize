import { test, expect } from './fixtures/electron-app'
import { AppPage } from './page-objects/AppPage'

test.describe('App Launch', () => {
  test('should display the shell with all panels', async ({ page }) => {
    const app = new AppPage(page)

    await expect(app.shell).toBeVisible()
    await expect(app.toolbar).toBeVisible()
    await expect(app.leftSidebar).toBeVisible()
    await expect(app.rightSidebar).toBeVisible()
    await expect(app.contentArea).toBeVisible()
    await expect(app.commandBar).toBeVisible()
  })

  test('should show Open Vault button in toolbar', async ({ page }) => {
    const app = new AppPage(page)
    await expect(app.openVaultBtn).toBeVisible()
    await expect(app.openVaultBtn).toHaveText('Open Vault')
  })

  test('should show view mode buttons', async ({ page }) => {
    const app = new AppPage(page)
    await expect(app.viewMarkdownBtn).toBeVisible()
    await expect(app.viewGraphBtn).toBeVisible()
  })

  test('should show empty state when no file selected', async ({ page }) => {
    const emptyState = page.getByTestId('empty-state')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toHaveText('Select a file to view')
  })
})
