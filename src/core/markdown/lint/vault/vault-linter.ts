import { parseMarkdown } from '../../parser'
import { lintParsedMarkdown } from '../linter'
import type { VaultDocument, VaultLintContext, VaultLintIssue, VaultLintRule } from './types'
import { rule as orphanedImages } from './orphaned-images'
import { rule as orphanedDocuments } from './orphaned-documents'
import { rule as glossaryCollisions } from './glossary-collisions'

export const VAULT_RULES: VaultLintRule[] = [orphanedImages, orphanedDocuments, glossaryCollisions]

export function buildVaultLintContext(
  vaultPath: string,
  vaultFiles: Set<string>,
  contents: Map<string, string>
): VaultLintContext {
  const documents = new Map<string, VaultDocument>()
  for (const [relativePath, content] of contents) {
    documents.set(relativePath, { relativePath, content, tree: parseMarkdown(content) })
  }
  return { vaultPath, vaultFiles, documents }
}

/**
 * Run every per-file rule on every document plus the cross-document vault
 * rules. Issues are sorted by file, then line.
 */
export function lintVault(ctx: VaultLintContext): VaultLintIssue[] {
  const issues: VaultLintIssue[] = []
  for (const doc of ctx.documents.values()) {
    const fileIssues = lintParsedMarkdown({
      filePath: `${ctx.vaultPath}/${doc.relativePath}`,
      vaultPath: ctx.vaultPath,
      content: doc.content,
      tree: doc.tree,
      vaultFiles: ctx.vaultFiles,
      getFileContent: (rel) => ctx.documents.get(rel)?.content
    })
    issues.push(...fileIssues.map((i) => ({ ...i, relativePath: doc.relativePath })))
  }
  for (const rule of VAULT_RULES) {
    issues.push(...rule.check(ctx))
  }
  return issues.sort(
    (a, b) => a.relativePath.localeCompare(b.relativePath) || a.line - b.line
  )
}
