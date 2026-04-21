import { test, expect } from './fixtures/electron-app'
import { TEST_IDS } from '../../src/renderer/lib/testids'

test.describe('Agent sidebar panel', () => {
  test('opens from activity bar and exposes accordion + composer', async ({ page }) => {
    const agentButton = page.locator('.activity-bar .activity-bar-btn[title="Agent Sessions"]')
    await expect(agentButton).toBeVisible()
    await agentButton.click()

    const panel = page.getByTestId(TEST_IDS.AGENT_PANEL)
    await expect(panel).toBeVisible()

    await expect(page.getByTestId(TEST_IDS.AGENT_ACCORDION)).toBeVisible()
    await expect(page.getByTestId(TEST_IDS.AGENT_PROMPT_INPUT)).toBeVisible()
  })

  test('creating and deleting sessions updates accordion', async ({ page }) => {
    await page.locator('.activity-bar .activity-bar-btn[title="Agent Sessions"]').click()

    const sessions = page.getByTestId(TEST_IDS.AGENT_SESSION_ITEM)
    const initialCount = await sessions.count()
    expect(initialCount).toBeGreaterThan(0)

    await page.getByTestId(TEST_IDS.AGENT_NEW_SESSION_BTN).click()
    await expect(sessions).toHaveCount(initialCount + 1)

    await sessions
      .first()
      .getByTestId(TEST_IDS.AGENT_DELETE_SESSION_BTN)
      .click()
    await expect(sessions).toHaveCount(initialCount)
  })
})
