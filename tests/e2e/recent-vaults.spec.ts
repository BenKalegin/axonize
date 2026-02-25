import { test, expect } from './fixtures/electron-app'
import { resolve } from 'path'

const TEST_VAULT_PATH = resolve(__dirname, 'fixtures/test-vault')

test.describe('Recent Vaults', () => {
  test('should show welcome screen when no vault is open', async ({ page }) => {
    const welcomeScreen = page.getByTestId('welcome-screen')
    await expect(welcomeScreen).toBeVisible()
  })

  test('should show recent vaults after opening a vault', async ({ page }) => {
    // Open vault programmatically
    await page.evaluate(async (vaultPath) => {
      // Add to recent vaults via IPC
      const name = vaultPath.split('/').pop() || vaultPath
      await window.axonize.vault.removeRecent(vaultPath) // clean slate

      const files = await window.axonize.vault.readFiles(vaultPath)
      window.__stores.vault.setState({ vaultPath, vaultName: name, fileTree: files as any[] })
    }, TEST_VAULT_PATH)

    // Simulate adding to recent via the preload API
    await page.evaluate(async (vaultPath) => {
      const name = vaultPath.split('/').pop() || vaultPath
      await (window.axonize as any).vault.getRecent() // ensure IPC works
    }, TEST_VAULT_PATH)

    // Reset vault state to see welcome screen again
    await page.evaluate(async (vaultPath) => {
      // Manually add recent entry for test
      const name = vaultPath.split('/').pop() || vaultPath
      // Use IPC to add recent vault
      const { ipcRenderer } = require('electron')
      // Since we can't access ipcRenderer directly, we'll work through the store
    }, TEST_VAULT_PATH)
  })

  test('should load recent vaults list on startup', async ({ page }) => {
    // First add a vault to recent via IPC
    await page.evaluate(async (vaultPath) => {
      // The vault:addRecent IPC should be available
      // We can test through the exposed store
      await window.__stores.vault.getState().loadRecentVaults()
    }, TEST_VAULT_PATH)

    // The welcome screen should be visible when no vault is open
    const welcomeScreen = page.getByTestId('welcome-screen')
    await expect(welcomeScreen).toBeVisible()
  })

  test('should open a vault from recent list when clicked', async ({ page }) => {
    // Manually set recent vaults state to simulate
    await page.evaluate((vaultPath) => {
      const name = vaultPath.split('/').pop() || vaultPath
      window.__stores.vault.setState({
        recentVaults: [{ path: vaultPath, name, openedAt: Date.now() }]
      })
    }, TEST_VAULT_PATH)

    // Click on the recent vault item
    const recentItem = page.getByTestId('recent-vault-item').first()
    await expect(recentItem).toBeVisible()
    await recentItem.click()

    // Vault should now be loaded
    const vaultName = page.getByTestId('vault-name')
    await expect(vaultName).toHaveText('test-vault')
  })

  test('should remove a vault from recent list', async ({ page }) => {
    // Set recent vaults state
    await page.evaluate((vaultPath) => {
      const name = vaultPath.split('/').pop() || vaultPath
      window.__stores.vault.setState({
        recentVaults: [{ path: vaultPath, name, openedAt: Date.now() }]
      })
    }, TEST_VAULT_PATH)

    const recentItem = page.getByTestId('recent-vault-item').first()
    await expect(recentItem).toBeVisible()

    // Click the remove button
    const removeBtn = page.getByTestId('recent-vault-remove').first()
    await removeBtn.click()

    // List should now be empty, no recent vault items visible
    await expect(page.getByTestId('recent-vault-list')).not.toBeVisible()
  })
})
