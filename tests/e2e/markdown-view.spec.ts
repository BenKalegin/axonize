import { test, expect } from './fixtures/electron-app'
import { FileExplorerPage } from './page-objects/FileExplorerPage'
import { ContentPage } from './page-objects/ContentPage'
import { resolve } from 'path'

const TEST_VAULT_PATH = resolve(__dirname, 'fixtures/test-vault')

test.describe('Markdown View', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(async (vaultPath) => {
      const files = await window.axonize.vault.readFiles(vaultPath)
      const name = vaultPath.split('/').pop() || vaultPath
      window.__stores.vault.setState({ vaultPath, vaultName: name, fileTree: files as any[] })
    }, TEST_VAULT_PATH)
  })

  test('should render markdown when file is selected', async ({ page }) => {
    const explorer = new FileExplorerPage(page)
    const content = new ContentPage(page)

    await explorer.clickFile('welcome.md')
    await expect(content.markdownView).toBeVisible()
    await expect(content.markdownView).toContainText('Welcome to Axonize')
  })

  test('should show headings as HTML', async ({ page }) => {
    const explorer = new FileExplorerPage(page)
    const content = new ContentPage(page)

    await explorer.clickFile('welcome.md')
    const h1 = content.markdownView.locator('h1')
    await expect(h1).toHaveText('Welcome to Axonize')
  })

  test('should render lists', async ({ page }) => {
    const explorer = new FileExplorerPage(page)
    const content = new ContentPage(page)

    await explorer.clickFile('welcome.md')
    const listItems = content.markdownView.locator('li')
    await expect(listItems).toHaveCount(3)
  })
})
