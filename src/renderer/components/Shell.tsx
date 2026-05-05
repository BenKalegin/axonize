import { TEST_IDS } from '@/lib/testids'
import { Toolbar } from './Toolbar'
import { ActivityBar } from './Sidebar/ActivityBar'
import { RightActivityBar } from './Sidebar/RightActivityBar'
import { SidePanel } from './Sidebar/SidePanel'
import { PropertiesPanel } from './Sidebar/PropertiesPanel'
import { RelatedDocsPanel } from './Sidebar/RelatedDocsPanel'
import { ContentView } from './Content/ContentView'
import { CommandPalette } from './Command/CommandPalette'
import { useLayoutStore, ACTIVITY_BAR_WIDTH, RightPanelId } from '@/store/layout-store'
import { useVaultStore } from '@/store/vault-store'
import { useAgentBootstrap } from '@/store/agent-store'

export function Shell() {
  const { activePanelId, activeRightPanelId, sidePanelWidth, rightPanelWidth } = useLayoutStore()
  const vaultPath = useVaultStore((s) => s.vaultPath)
  useAgentBootstrap(vaultPath)

  const rightPanelW = activeRightPanelId ? `${rightPanelWidth}px` : '0px'

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
      {activeRightPanelId && (
        <aside className="right-sidebar" data-testid={TEST_IDS.RIGHT_SIDEBAR}>
          {activeRightPanelId === RightPanelId.Properties && <PropertiesPanel />}
          {activeRightPanelId === RightPanelId.Related && <RelatedDocsPanel />}
        </aside>
      )}
      <RightActivityBar />
      <footer className="command-bar" data-testid={TEST_IDS.COMMAND_BAR}>
        <CommandPalette />
      </footer>
    </div>
  )
}
