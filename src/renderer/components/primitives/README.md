# UI Primitives

Reusable UI components and hooks to eliminate code duplication across the application.

## Custom Hooks

Located in `/src/renderer/hooks/`

### `useEscapeKey(onEscape, enabled?)`

Handle Escape key press.

```tsx
import { useEscapeKey } from '@/hooks'

function MyComponent() {
  useEscapeKey(() => console.log('Escape pressed!'))
  // With conditional enable:
  useEscapeKey(() => setOpen(false), isOpen)
}
```

### `useClickOutside(ref, onClickOutside, enabled?)`

Detect clicks outside of a referenced element.

```tsx
import { useClickOutside } from '@/hooks'

function MyComponent() {
  const dropdownRef = useRef<HTMLDivElement>(null)
  useClickOutside(dropdownRef, () => setOpen(false))

  return <div ref={dropdownRef}>...</div>
}
```

### `useEnterSubmit(onSubmit, options?)`

Handle Enter key submission with configurable behavior.

```tsx
import { useEnterSubmit } from '@/hooks'

function MyComponent() {
  const handleKeyDown = useEnterSubmit(
    () => console.log('Submitted!'),
    { allowShiftEnter: true } // Shift+Enter won't submit
  )

  return <input onKeyDown={handleKeyDown} />
}
```

## Components

### `Dialog`

Reusable modal dialog with overlay, escape key, and click-outside handling.

**Before:**
```tsx
// 40+ lines of boilerplate for each dialog
function OldDialog({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="settings-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="settings-dialog">
        <div className="settings-header">
          <span>Title</span>
          <button onClick={onClose}>&times;</button>
        </div>
        <div className="settings-body">Content</div>
        <div className="settings-footer">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
```

**After:**
```tsx
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/primitives'

function NewDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader onClose={onClose}>Title</DialogHeader>
      <DialogBody>Content</DialogBody>
      <DialogFooter>
        <button onClick={onClose}>Cancel</button>
        <button onClick={handleSave}>Save</button>
      </DialogFooter>
    </Dialog>
  )
}
```

**Props:**
- `open: boolean` - Whether dialog is visible
- `onClose: () => void` - Close handler
- `closeOnClickOutside?: boolean` - Default: true
- `closeOnEscape?: boolean` - Default: true
- `className?: string` - Dialog container class
- `overlayClassName?: string` - Overlay class

### `Dropdown`

Reusable dropdown/context menu with click-outside detection.

**Before:**
```tsx
// Repeated in every component with a dropdown
const [open, setOpen] = useState(false)
const dropdownRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!open) return
  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [open])

return (
  <div ref={dropdownRef}>
    <button onClick={() => setOpen(!open)}>Menu</button>
    {open && <div className="menu">...</div>}
  </div>
)
```

**After:**
```tsx
import { Dropdown, DropdownItem } from '@/components/primitives'

function MyComponent() {
  return (
    <Dropdown trigger={<DotsIcon />}>
      <DropdownItem onClick={() => console.log('Action 1')}>
        Action 1
      </DropdownItem>
      <DropdownItem onClick={() => console.log('Action 2')}>
        Action 2
      </DropdownItem>
    </Dropdown>
  )
}
```

**Controlled usage:**
```tsx
const [open, setOpen] = useState(false)

<Dropdown
  trigger="Open Menu"
  open={open}
  onOpenChange={setOpen}
>
  {/* items */}
</Dropdown>
```

### `Collapsible`

Reusable accordion/collapsible section with toggle state management.

**Before:**
```tsx
const [open, setOpen] = useState(false)

return (
  <div>
    <button onClick={() => setOpen(!open)}>
      {open ? '▾' : '▸'} Section Title
    </button>
    {open && <div>Content</div>}
  </div>
)
```

**After:**
```tsx
import { CollapsibleWithChevron } from '@/components/primitives'

function MyComponent() {
  return (
    <CollapsibleWithChevron header="Section Title" defaultOpen={false}>
      <div>Content</div>
    </CollapsibleWithChevron>
  )
}
```

**Advanced usage with custom trigger:**
```tsx
import { Collapsible } from '@/components/primitives'

<Collapsible
  trigger={(isOpen) => (
    <div>
      <span>{isOpen ? '▾' : '▸'}</span>
      <span>Custom {isOpen ? 'Open' : 'Closed'}</span>
    </div>
  )}
>
  <div>Content</div>
</Collapsible>
```

### `TextField` & `SelectField`

Reusable form fields with labels.

**Before:**
```tsx
<div className="settings-field">
  <label>API Key</label>
  <input
    className="settings-input"
    type="password"
    value={apiKey}
    onChange={e => setApiKey(e.target.value)}
    placeholder="sk-..."
  />
</div>
```

**After:**
```tsx
import { TextField } from '@/components/primitives'

<TextField
  label="API Key"
  type="password"
  value={apiKey}
  onChange={setApiKey}
  placeholder="sk-..."
/>
```

**Select field:**
```tsx
import { SelectField } from '@/components/primitives'

<SelectField
  label="Provider"
  value={provider}
  onChange={setProvider}
  options={[
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' }
  ]}
/>
```

## Migration Guide

### Dialogs to Migrate

These components can be refactored to use the new `Dialog` primitive:

1. ✅ **EnableEditsConfirm.tsx** - Already migrated (example)
2. ⏳ **ConflictDialog.tsx**
3. ⏳ **PromoteFileDialog.tsx**
4. ⏳ **MakePermanentDialog.tsx**
5. ⏳ **DiagramVisualEditorModal.tsx**
6. ⏳ **VisualMermaidEditorModal.tsx**
7. ⏳ **SettingsDialog.tsx** (larger refactor)

### Dropdowns to Migrate

1. ⏳ **FileTreeNode.tsx** - Context menu
2. ⏳ **GeneratedDocNode.tsx** - Context menu
3. ⏳ **Toolbar.tsx** - Action dropdown
4. ⏳ **FileExplorer.tsx** - Group dropdown

### Accordions to Migrate

1. ⏳ **AgentSessionAccordion.tsx**
2. ⏳ **CollapsibleTrace.tsx**
3. ⏳ **FileExplorer.tsx** - Folder expand/collapse

## Benefits

- **~25-30% less duplicate code** across UI components
- **Consistent behavior** - all dialogs handle Escape/click-outside the same way
- **Easier maintenance** - bug fixes in one place benefit all components
- **Type safety** - TypeScript props for all primitives
- **Flexible** - Both controlled and uncontrolled modes supported
- **Familiar API** - Similar to popular UI libraries but lightweight

## Code Reduction Example

**EnableEditsConfirm.tsx:**
- Before: 39 lines
- After: 31 lines (21% reduction)
- Plus: No manual escape key handling, no click-outside logic

When fully migrated across all 6 dialogs, we'll eliminate ~200+ lines of duplicate code!
