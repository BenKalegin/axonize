import { describe, expect, it } from 'vitest'
import {
  parseMermaidVisualModel,
  updateMermaidLayout
} from '../../../src/renderer/lib/mermaid-visual-layout'

describe('mermaid visual layout', () => {
  it('parses class diagram nodes, relationships, and Axonize layout', () => {
    const markdown = `\`\`\`mermaid
---
config:
  theme: base
x-axonize:
  version: 1
  editor: clouddiagram
  layout:
    nodes:
      User: { x: 80, y: 120, width: 160, height: 80, locked: true }
      Order:
        x: 360
        y: 120
---
classDiagram
direction LR
class User
class Order
User --> Order : places
\`\`\``

    const model = parseMermaidVisualModel(markdown)

    expect(model.supported).toBe(true)
    expect(model.nodes).toHaveLength(2)
    expect(model.nodes.find((node) => node.id === 'User')).toMatchObject({
      x: 80,
      y: 120,
      width: 160,
      height: 80,
      locked: true
    })
    expect(model.nodes.find((node) => node.id === 'Order')).toMatchObject({
      x: 360,
      y: 120
    })
    expect(model.edges).toEqual([{ from: 'User', to: 'Order', label: 'places' }])
  })

  it('writes moved nodes back into x-axonize frontmatter', () => {
    const markdown = `\`\`\`mermaid
classDiagram
class User
class Order
User --> Order : places
\`\`\``

    const model = parseMermaidVisualModel(markdown)
    const updated = updateMermaidLayout(markdown, model.nodes.map((node) =>
      node.id === 'User' ? { ...node, x: 240, y: 160 } : node
    ))

    expect(updated).toContain('x-axonize:')
    expect(updated).toContain('User: { x: 240, y: 160')
    expect(updated).toContain('classDiagram')
    expect(updated).toContain('User --> Order : places')
  })

  it('preserves non-layout Axonize metadata when updating nodes', () => {
    const markdown = `\`\`\`mermaid
---
config:
  theme: base
x-axonize:
  version: 1
  editor: clouddiagram
  layout:
    nodes:
      User: { x: 80, y: 120, width: 160, height: 80 }
    spacing:
      User-Order: 260
  presentation:
    steps:
      - highlight: [User]
---
classDiagram
class User
class Order
User --> Order : places
\`\`\``

    const model = parseMermaidVisualModel(markdown)
    const updated = updateMermaidLayout(markdown, model.nodes.map((node) =>
      node.id === 'Order' ? { ...node, x: 640, y: 200 } : node
    ))

    expect(updated).toContain('config:')
    expect(updated).toContain('theme: base')
    expect(updated).toContain('spacing:')
    expect(updated).toContain('User-Order: 260')
    expect(updated).toContain('presentation:')
    expect(updated).toContain('highlight: [User]')
    expect(updated).toContain('Order: { x: 640, y: 200')
  })
})
