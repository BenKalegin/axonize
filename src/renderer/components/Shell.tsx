import { TEST_IDS } from '../lib/testids'
import { Toolbar } from './Toolbar'
import { ActivityBar } from './Sidebar/ActivityBar'
import { SidePanel } from './Sidebar/SidePanel'
import { PropertiesPanel } from './Sidebar/PropertiesPanel'
import { ContentView } from './Content/ContentView'
import { CommandPalette } from './Command/CommandPalette'
import { useLayoutStore, ACTIVITY_BAR_WIDTH } from '../store/layout-store'

export function Shell() {
  const { activePanelId, sidePanelWidth } = useLayoutStore()

  return (
    <div
      className="shell"
      data-testid={TEST_IDS.SHELL}
      style={{
        '--activity-bar-w': `${ACTIVITY_BAR_WIDTH}px`,
        '--side-panel-w': activePanelId ? `${sidePanelWidth}px` : '0px'
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
      <aside className="right-sidebar" data-testid={TEST_IDS.RIGHT_SIDEBAR}>
        <PropertiesPanel />
      </aside>
      <footer className="command-bar" data-testid={TEST_IDS.COMMAND_BAR}>
        <CommandPalette />
      </footer>
    </div>
  )
}
