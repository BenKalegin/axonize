import { test, expect } from './fixtures/electron-app'
import { AppPage } from './page-objects/AppPage'
import { GraphPage } from './page-objects/GraphPage'

test.describe('Graph View', () => {
  test('should switch to graph view', async ({ page }) => {
    const app = new AppPage(page)
    const graph = new GraphPage(page)

    await app.viewGraphBtn.click()
    await expect(graph.graphView).toBeVisible()
    await expect(graph.forceGraph).toBeVisible()
  })

  test('should display graph controls', async ({ page }) => {
    const app = new AppPage(page)
    const graph = new GraphPage(page)

    await app.viewGraphBtn.click()
    await expect(graph.graphControls).toBeVisible()
  })

  test('should display node and edge counts', async ({ page }) => {
    const app = new AppPage(page)
    const graph = new GraphPage(page)

    await app.viewGraphBtn.click()
    await expect(graph.nodeCount).toBeVisible()
    await expect(graph.edgeCount).toBeVisible()
  })

  test('should switch back to markdown view', async ({ page }) => {
    const app = new AppPage(page)
    const graph = new GraphPage(page)

    await app.viewGraphBtn.click()
    await expect(graph.graphView).toBeVisible()

    await app.viewMarkdownBtn.click()
    const emptyState = page.getByTestId('empty-state')
    await expect(emptyState).toBeVisible()
  })
})
