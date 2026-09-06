import { useEffect, useState } from 'react'
import { defaultVaultIcon } from '@/lib/vault-icon'

interface VaultIconProps {
  vaultPath: string | null
  vaultName: string
  size: number
  // Force a fresh icon read after generation, so the menu thumbnail updates without
  // remounting. Caller bumps this counter; we re-fetch when it changes.
  refreshToken?: number
}

export function VaultIcon({ vaultPath, vaultName, size, refreshToken = 0 }: VaultIconProps) {
  const [customSvg, setCustomSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!vaultPath) {
      setCustomSvg(null)
      return
    }
    window.axonize.vault.readIcon(vaultPath).then((svg) => {
      if (!cancelled) setCustomSvg(svg)
    }).catch(() => {
      if (!cancelled) setCustomSvg(null)
    })
    return () => { cancelled = true }
  }, [vaultPath, refreshToken])

  if (customSvg) {
    return (
      <span
        className="vault-icon vault-icon--custom"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: customSvg }}
      />
    )
  }

  const { initials, background, foreground } = defaultVaultIcon(vaultName)
  // Initials need a slightly larger font ratio than 0.5 to stay legible at
  // 16–20 px; below that they vanish into a colored blob.
  const fontSize = Math.max(9, Math.round(size * 0.5))
  return (
    <span
      className="vault-icon vault-icon--default"
      style={{ width: size, height: size, background, color: foreground, fontSize }}
    >
      {initials}
    </span>
  )
}
