import React, { useState, useCallback } from 'react'

const MAX_HEADING_LEVEL = 3

interface SectionInsertProps {
  afterLine: number
  contextDepth?: number
  onInsert: (afterLine: number, headingLevel: number) => void
}

export const SectionInsert = React.memo(function SectionInsert({
  afterLine,
  contextDepth = 0,
  onInsert
}: SectionInsertProps) {
  const [expanded, setExpanded] = useState(false)

  const handleClick = useCallback(
    (level: number) => {
      onInsert(afterLine, level)
      setExpanded(false)
    },
    [afterLine, onInsert]
  )

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const minLevel = Math.max(1, contextDepth)

  return (
    <div className="section-insert">
      <div className="section-insert-line">
        <button
          className="section-insert-btn"
          onClick={handleToggle}
          title="Add section"
        >
          +
        </button>
      </div>
      {expanded && (
        <div className="section-insert-options">
          {Array.from({ length: MAX_HEADING_LEVEL - minLevel + 1 }, (_, i) => {
            const level = minLevel + i
            return (
              <button
                key={level}
                className="section-insert-option"
                onClick={() => handleClick(level)}
              >
                H{level}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})
