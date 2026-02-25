import { test, expect } from './fixtures/electron-app'
import { FileExplorerPage } from './page-objects/FileExplorerPage'
import { resolve } from 'path'

const TEST_VAULT_PATH = resolve(__dirname, 'fixtures/test-vault')

test.describe('File Tree', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(async (vaultPath) => {
      const files = await window.axonize.vault.readFiles(vaultPath)
      const name = vaultPath.split('/').pop() || vaultPath
      window.__stores.vault.setState({ vaultPath, vaultName: name, fileTree: files as any[] })
    }, TEST_VAULT_PATH)
  })

  test('should display file explorer', async ({ page }) => {
    const explorer = new FileExplorerPage(page)
    await expect(explorer.explorer).toBeVisible()
    await expect(explorer.fileTree).toBeVisible()
  })

  test('should show markdown files', async ({ page }) => {
    const explorer = new FileExplorerPage(page)
    await expect(explorer.nodeLabelByPath('welcome.md')).toBeVisible()
    await expect(explorer.nodeLabelByPath('architecture.md')).toBeVisible()
  })

  test('should show directories', async ({ page }) => {
    const explorer = new FileExplorerPage(page)
    await expect(explorer.nodeLabelByPath('notes')).toBeVisible()
  })

  test('should show nested files', async ({ page }) => {
    const explorer = new FileExplorerPage(page)
    await expect(explorer.nodeLabelByPath('notes/daily.md')).toBeVisible()
    await expect(explorer.nodeLabelByPath('notes/ideas.md')).toBeVisible()
  })
})
