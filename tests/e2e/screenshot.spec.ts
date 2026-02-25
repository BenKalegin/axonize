import { test } from './fixtures/electron-app'
import { resolve } from 'path'

const TEST_VAULT_PATH = resolve(__dirname, 'fixtures/test-vault')

test('screenshot: empty state', async ({ page }) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(__dirname, '../../screenshot-empty.png') })
})

test('screenshot: graph view', async ({ page }) => {
  await page.getByTestId('view-graph-btn').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(__dirname, '../../screenshot-graph.png') })
})

test('screenshot: vault with files', async ({ page }) => {
  await page.evaluate(async (vaultPath: string) => {
    const files = await window.axonize.vault.readFiles(vaultPath)
    const name = vaultPath.split('/').pop() || vaultPath
    window.__stores.vault.setState({ vaultPath, vaultName: name, fileTree: files as any[] })
  }, TEST_VAULT_PATH)
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(__dirname, '../../screenshot-vault.png') })
})

test('screenshot: markdown rendered', async ({ page }) => {
  await page.evaluate(async (vaultPath: string) => {
    const files = await window.axonize.vault.readFiles(vaultPath)
    const name = vaultPath.split('/').pop() || vaultPath
    window.__stores.vault.setState({ vaultPath, vaultName: name, fileTree: files as any[] })
  }, TEST_VAULT_PATH)
  await page.waitForTimeout(300)

  const welcomeNode = page.locator('[data-testid="file-tree-node"][data-path="welcome.md"]')
  await welcomeNode.getByTestId('file-tree-node-label').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: resolve(__dirname, '../../screenshot-markdown.png') })
})
