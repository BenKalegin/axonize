import { TEST_IDS } from '../lib/testids'
import { Toolbar } from './Toolbar'
import { FileExplorer } from './Sidebar/FileExplorer'
import { PropertiesPanel } from './Sidebar/PropertiesPanel'
import { ContentView } from './Content/ContentView'
import { CommandPalette } from './Command/CommandPalette'

export function Shell() {
  return (
    <div className="shell" data-testid={TEST_IDS.SHELL}>
      <header className="toolbar-area" data-testid={TEST_IDS.TOOLBAR}>
        <Toolbar />
      </header>
      <aside className="left-sidebar" data-testid={TEST_IDS.LEFT_SIDEBAR}>
        <FileExplorer />
      </aside>
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
