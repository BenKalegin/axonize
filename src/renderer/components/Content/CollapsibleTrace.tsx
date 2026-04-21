import { useState } from 'react'

interface CollapsibleTraceProps {
  lines: string[]
}

export function CollapsibleTrace({ lines }: CollapsibleTraceProps) {
  const [open, setOpen] = useState(false)
  if (lines.length === 0) return null
  return (
    <div className={`agent-tool-trace${open ? ' open' : ''}`}>
      <button className="agent-tool-trace-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? '▾' : '▸'} {lines.length} tool call{lines.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div className="agent-tool-trace-body">
          {lines.map((line, idx) => (
            <div key={idx} className="agent-tool-trace-line">{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
