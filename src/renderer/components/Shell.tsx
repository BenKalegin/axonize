import { TEST_IDS } from '../lib/testids'
import { Toolbar } from './Toolbar'
import { ActivityBar } from './Sidebar/ActivityBar'
import { SidePanel } from './Sidebar/SidePanel'
import { PropertiesPanel } from './Sidebar/PropertiesPanel'
import { RelatedDocsPanel } from './Sidebar/RelatedDocsPanel'
import { ContentView } from './Content/ContentView'
import { CommandPalette } from './Command/CommandPalette'
import { useLayoutStore, ACTIVITY_BAR_WIDTH } from '../store/layout-store'
import { useEditorStore } from '../store/editor-store'

const COLLAPSED_DRAWER_WIDTH = 28

function CollapsedDrawerTab() {
  const toggleRightDrawer = useLayoutStore((s) => s.toggleRightDrawer)
  return (
    <button
      className="right-drawer-collapsed"
      data-testid={TEST_IDS.RIGHT_DRAWER_COLLAPSED}
      onClick={toggleRightDrawer}
      type="button"
    >
      <span className="right-drawer-collapsed-label">Related</span>
    </button>
  )
}

function computeRightPanelWidth(
  viewMode: string,
  selectedFile: string | null,
  rightDrawerOpen: boolean,
  rightPanelWidth: number
): string {
  if (viewMode === 'graph') return `${rightPanelWidth}px`
  if (viewMode === 'markdown' && selectedFile) {
    return rightDrawerOpen ? `${rightPanelWidth}px` : `${COLLAPSED_DRAWER_WIDTH}px`
  }
  return '0px'
}

export function Shell() {
  const { activePanelId, sidePanelWidth, rightPanelWidth, rightDrawerOpen } = useLayoutStore()
  const { viewMode, selectedFile } = useEditorStore()

  const rightPanelW = computeRightPanelWidth(viewMode, selectedFile, rightDrawerOpen, rightPanelWidth)
  const showGraphPanel = viewMode === 'graph'
  const showRelatedPanel = viewMode === 'markdown' && selectedFile !== null

  return (
    <div
      className="shell"
      data-testid={TEST_IDS.SHELL}
      style={{
        '--activity-bar-w': `${ACTIVITY_BAR_WIDTH}px`,
        '--side-panel-w': activePanelId ? `${sidePanelWidth}px` : '0px',
        '--right-panel-w': rightPanelW
      } as React.CSSProperties}
    >
      <header className="toolbar-area" data-testid={TEST_IDS.TOOLBAR}>
        <Toolbar />
      </header>
      <ActivityBar />
      <SidePanel />
      <main className="content-area" data-testid={TEST_IDS.CONTENT_AREA}>
        <ContentView />
      </main>
      {showGraphPanel && (
        <aside className="right-sidebar" data-testid={TEST_IDS.RIGHT_SIDEBAR}>
          <PropertiesPanel />
        </aside>
      )}
      {showRelatedPanel && (
        <aside className="right-sidebar" data-testid={TEST_IDS.RIGHT_SIDEBAR}>
          {rightDrawerOpen ? <RelatedDocsPanel /> : <CollapsedDrawerTab />}
        </aside>
      )}
      <footer className="command-bar" data-testid={TEST_IDS.COMMAND_BAR}>
        <CommandPalette />
      </footer>
    </div>
  )
}
