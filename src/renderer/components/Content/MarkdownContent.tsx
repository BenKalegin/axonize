import { useEffect, useState } from 'react'
import { renderMarkdown } from '@/lib/markdown-renderer'

interface MarkdownContentProps {
  markdown: string
  className?: string
}

export function MarkdownContent({ markdown, className }: MarkdownContentProps) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    let cancelled = false
    renderMarkdown(markdown).then((result) => {
      if (!cancelled) setHtml(result)
    })
    return () => { cancelled = true }
  }, [markdown])

  return (
    <div
      className={`markdown-view${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
