import type { Root } from 'mdast'
import type { LintIssue } from '../types'

export interface VaultLintIssue extends LintIssue {
  // Vault-relative path of the file the issue belongs to.
  relativePath: string
}

export interface VaultDocument {
  relativePath: string
  content: string
  tree: Root
}

export interface VaultLintContext {
  vaultPath: string
  // All vault file relative paths with original extensions (markdown and assets).
  vaultFiles: Set<string>
  // All parsed markdown documents keyed by relative path.
  documents: Map<string, VaultDocument>
}

export interface VaultLintRule {
  id: string
  label: string
  check: (ctx: VaultLintContext) => VaultLintIssue[]
}
