import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'path'

type ElectronFixtures = {
  electronApp: ElectronApplication
  page: Page
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const appPath = resolve(__dirname, '../../../out/main/index.js')
    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test'
      }
    })
    await use(electronApp)
    await electronApp.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await use(page)
  }
})

export { expect } from '@playwright/test'
