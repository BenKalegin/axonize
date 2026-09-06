import React from 'react'
import { SpreadsheetEditor } from '@/spreadsheet-editor'
import '@/spreadsheet-editor/styles.css'

interface TableVisualEditorModalProps {
  markdown: string
  onApply: (markdown: string) => void
  onClose: () => void
}

// Map axonize theme tokens to the spreadsheet-editor package's CSS variables.
// Kept here (not in the package) so the package stays theme-agnostic.
const THEME_BRIDGE: React.CSSProperties = {
  '--sse-bg': 'var(--bg-base)',
  '--sse-bg-surface': 'var(--bg-surface)',
  '--sse-bg-overlay': 'var(--bg-overlay)',
  '--sse-border': 'var(--border)',
  '--sse-text': 'var(--text-primary)',
  '--sse-text-muted': 'var(--text-muted)',
  '--sse-accent': 'var(--accent)'
} as React.CSSProperties

export function TableVisualEditorModal({ markdown, onApply, onClose }: TableVisualEditorModalProps) {
  return (
    <div className="visual-editor-backdrop">
      <div
        className="visual-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Table editor"
        style={THEME_BRIDGE}
      >
        <SpreadsheetEditor
          initialMarkdown={markdown}
          onApply={onApply}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
