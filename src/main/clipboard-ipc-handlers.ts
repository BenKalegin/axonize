import { clipboard, ipcMain } from 'electron'

export function registerClipboardIpcHandlers(): void {
  ipcMain.handle('clipboard:writeTextAndHtml', (_event, text: string, html: string) => {
    clipboard.write({ text, html })
  })
}
