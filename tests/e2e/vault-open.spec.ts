import { test, expect } from './fixtures/electron-app'
import { AppPage } from './page-objects/AppPage'
import { resolve } from 'path'

const TEST_VAULT_PATH = resolve(__dirname, 'fixtures/test-vault')

test.describe('Vault Opening', () => {
  test('should display vault name after opening via IPC', async ({ page }) => {
    const app = new AppPage(page)

    await page.evaluate(async (vaultPath) => {
      const files = await window.axonize.vault.readFiles(vaultPath)
      const name = vaultPath.split('/').pop() || vaultPath
      window.__stores.vault.setState({ vaultPath, vaultName: name, fileTree: files as any[] })
    }, TEST_VAULT_PATH)

    await expect(app.vaultName).toBeVisible()
    await expect(app.vaultName).toHaveText('test-vault')
  })
})
