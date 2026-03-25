export const GitStatus = {
  Modified: 'Modified',
  Added: 'Added',
  Deleted: 'Deleted',
  Renamed: 'Renamed',
  Copied: 'Copied',
  Untracked: 'Untracked',
} as const
export type GitStatus = (typeof GitStatus)[keyof typeof GitStatus]

export interface GitFileStatus {
  path: string
  status: GitStatus
  staged: boolean
}
