import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { test, expect } from './fixtures/electron-app'

test.describe('Outline Panel', () => {
  test('refreshes headings when the selected file changes on disk', async ({ page }) => {
    const vaultPath = await mkdtemp(join(tmpdir(), 'axonize-outline-'))
    const filePath = join(vaultPath, 'document.md')

    try {
      await writeFile(filePath, '# Existing section\n\nBody\n')

      await page.evaluate(async ({ vaultPath, filePath }) => {
        const files = await window.axonize.vault.readFiles(vaultPath)
        window.__stores.vault.setState({ vaultPath, vaultName: 'outline-test', fileTree: files as any[] })
        window.__stores.editor.getState().selectFile(filePath)
        window.__stores.layout.setState({ activePanelId: 'outline' })
        await window.axonize.vault.startWatch(vaultPath)
      }, { vaultPath, filePath })

      const headings = page.getByTestId('outline-heading')
      await expect(headings).toHaveCount(1)
      await expect(headings.first()).toContainText('Existing section')

      await writeFile(filePath, '# Existing section\n\nBody\n\n## Added externally\n\nNew body\n')

      await expect(headings).toHaveCount(2, { timeout: 5_000 })
      await expect(headings.nth(1)).toContainText('Added externally')
    } finally {
      await page.evaluate(() => window.axonize.vault.stopWatch()).catch(() => {})
      await rm(vaultPath, { recursive: true, force: true })
    }
  })
})
