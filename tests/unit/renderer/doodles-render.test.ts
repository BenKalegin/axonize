import { describe, expect, it } from 'vitest'
import { canRenderWithDoodles, renderMermaidWithDoodles } from '../../../src/renderer/lib/doodles-render'

describe('doodles render', () => {
  it('claims sequence diagrams for the doodles path', () => {
    expect(canRenderWithDoodles('sequenceDiagram\nAlice->>Bob: Hi')).toBe(true)
  })

  it('renders a sequence diagram with lifelines and a message arrow', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Alice->>Bob: Hello Bob
Bob-->>Alice: Hi back
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Alice')
    expect(svg).toContain('Bob')
    expect(svg).toContain('Hello Bob')
    expect(svg).toContain('Hi back')
    // Dashed return-message line is rendered with the dash array.
    expect(svg).toContain('stroke-dasharray="5 4"')
  })

  it('numbers messages when autonumber is enabled', async () => {
    const source = `
sequenceDiagram
autonumber
Alice->>Bob: First
Bob->>Alice: Second
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('>1<')
    expect(svg).toContain('>2<')
    expect(svg).toContain('<circle')
  })

  it('honors autonumber start and step', async () => {
    const source = `
sequenceDiagram
autonumber 10 5
Alice->>Bob: First
Bob->>Alice: Second
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('>10<')
    expect(svg).toContain('>15<')
  })

  it('stops numbering after autonumber off', async () => {
    const source = `
sequenceDiagram
autonumber
Alice->>Bob: Numbered
autonumber off
Bob->>Alice: Unnumbered
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('>1<')
    expect(svg).not.toContain('>2<')
  })

  it('renders notes over a participant', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Note over Alice: Watch this
Alice->>Bob: After the note
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('Watch this')
    expect(svg).toContain('After the note')
    // Note rect uses the doodles-note CSS variable for its fill.
    expect(svg).toContain('--doodles-note-fill')
  })

  it('renders notes spanning two participants', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Note over Alice,Bob: Shared note
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('Shared note')
  })

  it('renders left-of and right-of notes', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
Note left of Alice: To the left
Note right of Bob: To the right
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('To the left')
    expect(svg).toContain('To the right')
  })

  it('renders an alt frame with else section', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
alt happy path
    Alice->>Bob: ok
else error
    Alice->>Bob: oops
end
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('alt')
    expect(svg).toContain('happy path')
    expect(svg).toContain('error')
    expect(svg).toContain('ok')
    expect(svg).toContain('oops')
    // Section divider for `else` uses the dashed pattern.
    expect(svg).toContain('stroke-dasharray="6 4"')
  })

  it('renders a loop frame', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
loop every minute
    Alice->>Bob: poll
end
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('loop')
    expect(svg).toContain('every minute')
    expect(svg).toContain('poll')
  })

  it('renders nested frames', async () => {
    const source = `
sequenceDiagram
participant Alice
participant Bob
loop outer
    opt inner
        Alice->>Bob: hi
    end
end
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('loop')
    expect(svg).toContain('opt')
    expect(svg).toContain('outer')
    expect(svg).toContain('inner')
    expect(svg).toContain('hi')
  })

  it('renders class diagram members in doodles mode', async () => {
    const source = `
classDiagram
direction LR
class User {
  +string id
  +placeOrder()
}
class Order {
  +string id
  +decimal total
  +submit()
}
User --> Order : places
`.trim()

    const svg = await renderMermaidWithDoodles(source)

    expect(svg).toContain('User')
    expect(svg).toContain('+string id')
    expect(svg).toContain('+placeOrder()')
    expect(svg).toContain('+decimal total')
    expect(svg).toContain('+submit()')
    expect(svg).toContain('marker-end="url(#doodles-arrow)"')
  })
})
