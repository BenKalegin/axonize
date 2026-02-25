import { test, expect } from './fixtures/electron-app'
import { AppPage } from './page-objects/AppPage'
import { GraphPage } from './page-objects/GraphPage'

test.describe('Zoom Levels', () => {
  test.beforeEach(async ({ page }) => {
    const app = new AppPage(page)
    await app.viewGraphBtn.click()
  })

  test('should display zoom level buttons Z0-Z4', async ({ page }) => {
    const graph = new GraphPage(page)

    for (const z of ['Z0', 'Z1', 'Z2', 'Z3', 'Z4']) {
      await expect(graph.zoomButton(z)).toBeVisible()
    }
  })

  test('should have Z1 as default zoom level', async ({ page }) => {
    const graph = new GraphPage(page)
    await expect(graph.zoomButton('Z1')).toHaveClass(/active/)
  })

  test('should change active zoom level on click', async ({ page }) => {
    const graph = new GraphPage(page)

    await graph.zoomButton('Z3').click()
    await expect(graph.zoomButton('Z3')).toHaveClass(/active/)
    await expect(graph.zoomButton('Z1')).not.toHaveClass(/active/)
  })
})
