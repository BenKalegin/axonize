import { test, expect } from './fixtures/electron-app'
import { TEST_IDS } from '../../src/renderer/lib/testids'

test.describe('Agent Panel', () => {
  test('should open agent panel and manage sessions', async ({ page }) => {
    const agentButton = page.locator('.activity-bar .activity-bar-btn[title="Agent Sessions"]')
    await expect(agentButton).toBeVisible()
    await agentButton.click()

    const panel = page.getByTestId(TEST_IDS.AGENT_PANEL)
    await expect(panel).toBeVisible()

    const sessions = page.getByTestId(TEST_IDS.AGENT_SESSION_ITEM)
    const initialCount = await sessions.count()
    await expect(initialCount).toBeGreaterThan(0)

    const newSessionBtn = page.getByTestId(TEST_IDS.AGENT_NEW_SESSION_BTN)
    await newSessionBtn.click()
    await expect(sessions).toHaveCount(initialCount + 1)

    const contextInput = page.getByTestId(TEST_IDS.AGENT_CONTEXT_INPUT)
    await expect(contextInput).toBeVisible()
    await contextInput.fill('# Billing Agent Session\nPlan migration tasks')

    await expect(sessions.first().locator('.agent-session-name')).toHaveText(/Billing Agent Session/)

    await sessions.first().locator(`[data-testid="${TEST_IDS.AGENT_DELETE_SESSION_BTN}"]`).click()
    await expect(sessions).toHaveCount(initialCount)
  })
})
