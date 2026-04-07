export const TEST_IDS = {
  // Shell layout
  SHELL: 'shell',
  TOOLBAR: 'toolbar',
  LEFT_SIDEBAR: 'left-sidebar',
  RIGHT_SIDEBAR: 'right-sidebar',
  CONTENT_AREA: 'content-area',
  COMMAND_BAR: 'command-bar',

  // Toolbar
  VIEW_MARKDOWN_BTN: 'view-markdown-btn',
  VIEW_GRAPH_BTN: 'view-graph-btn',
  OPEN_VAULT_BTN: 'open-vault-btn',
  VAULT_NAME: 'vault-name',

  // File Explorer
  FILE_EXPLORER: 'file-explorer',
  FILE_TREE: 'file-tree',
  FILE_TREE_NODE: 'file-tree-node',
  FILE_TREE_NODE_LABEL: 'file-tree-node-label',
  FILE_TREE_NODE_TOGGLE: 'file-tree-node-toggle',

  // Content views
  CONTENT_VIEW: 'content-view',
  MARKDOWN_VIEW: 'markdown-view',
  GRAPH_VIEW: 'graph-view',
  EMPTY_STATE: 'empty-state',

  // Graph
  FORCE_GRAPH: 'force-graph',
  GRAPH_CONTROLS: 'graph-controls',
  ZOOM_BUTTON: 'zoom-btn',
  NODE_COUNT: 'node-count',
  EDGE_COUNT: 'edge-count',

  // Properties Panel
  PROPERTIES_PANEL: 'properties-panel',
  PROPERTY_TITLE: 'property-title',
  PROPERTY_TYPE: 'property-type',
  PROPERTY_PATH: 'property-path',
  PROPERTY_EDGES: 'property-edges',

  // Welcome Screen
  WELCOME_SCREEN: 'welcome-screen',
  RECENT_VAULT_LIST: 'recent-vault-list',
  RECENT_VAULT_ITEM: 'recent-vault-item',
  RECENT_VAULT_REMOVE: 'recent-vault-remove',

  // Vault Dropdown
  VAULT_DROPDOWN: 'vault-dropdown',
  VAULT_DROPDOWN_ITEM: 'vault-dropdown-item',

  // Command Palette
  COMMAND_PALETTE: 'command-palette',
  COMMAND_INPUT: 'command-input',

  // Settings
  SETTINGS_BTN: 'settings-btn',
  SETTINGS_DIALOG: 'settings-dialog',
  SETTINGS_SAVE_BTN: 'settings-save-btn',
  SETTINGS_CANCEL_BTN: 'settings-cancel-btn',

  // RAG
  REINDEX_FILE_BTN: 'reindex-file-btn',
  REINDEX_VAULT_BTN: 'reindex-vault-btn',
  INDEX_STATUS: 'index-status',
  RAG_ANSWER_VIEW: 'rag-answer-view',
  RAG_SOURCE_LINK: 'rag-source-link',

  // Layout
  ACTIVITY_BAR: 'activity-bar',
  SIDE_PANEL: 'side-panel',
  RESIZE_HANDLE: 'resize-handle',

  // LLM Log
  LLM_LOG_PANEL: 'llm-log-panel',
  LLM_LOG_ENTRY: 'llm-log-entry',
  LLM_LOG_CLEAR_BTN: 'llm-log-clear-btn',

  // Agent
  AGENT_PANEL: 'agent-panel',
  AGENT_NEW_SESSION_BTN: 'agent-new-session-btn',
  AGENT_SESSION_ITEM: 'agent-session-item',
  AGENT_DELETE_SESSION_BTN: 'agent-delete-session-btn',
  AGENT_CONTEXT_INPUT: 'agent-context-input',
  AGENT_PROMPT_INPUT: 'agent-prompt-input',
  AGENT_SEND_PROMPT_BTN: 'agent-send-prompt-btn',
  AGENT_MESSAGE: 'agent-message',

  // Zoom Controls
  ZOOM_CONTROLS: 'zoom-controls',
  ZOOM_IN_BTN: 'zoom-in-btn',
  ZOOM_OUT_BTN: 'zoom-out-btn',
  ZOOM_LEVEL: 'zoom-level',

  // Folder Actions
  CONTEXT_MENU: 'context-menu',
  FOLDER_ACTIONS_BTN: 'folder-actions-btn',
  FOLDER_ACTIONS_MENU: 'folder-actions-menu',
  NEW_DOC_BTN: 'new-doc-btn',
  NEW_DOC_INPUT: 'new-doc-input',
  FILE_ACTIONS_BTN: 'file-actions-btn',
  FILE_ACTIONS_MENU: 'file-actions-menu',
  RENAME_FILE_BTN: 'rename-file-btn',
  RENAME_FILE_INPUT: 'rename-file-input',
  DELETE_FILE_BTN: 'delete-file-btn',
  EXCLUDE_FOLDER_BTN: 'exclude-folder-btn',
  INCLUDE_FOLDER_BTN: 'include-folder-btn',
  HIDDEN_FOLDERS_HEADER: 'hidden-folders-header',

  // Generated Documents
  GENERATED_DOCS_HEADER: 'generated-docs-header',
  GENERATED_DOC_NODE: 'generated-doc-node',
  GENERATED_DOC_HEADER: 'generated-doc-content-header',
  GENERATED_DOC_RENAME_BTN: 'generated-doc-rename-btn',
  GENERATED_DOC_RENAME_INPUT: 'generated-doc-rename-input',
  GENERATED_DOC_PERMANENT_BTN: 'generated-doc-permanent-btn',
  GENERATED_DOC_DELETE_BTN: 'generated-doc-delete-btn',
  MAKE_PERMANENT_DIALOG: 'make-permanent-dialog',
  GENERATED_DOCS_RETENTION_INPUT: 'generated-docs-retention-input',

  // File Search
  FILE_SEARCH_BTN: 'file-search-btn',
  FILE_SEARCH_INPUT: 'file-search-input',

  // Refresh Vault
  REFRESH_VAULT_BTN: 'refresh-vault-btn',

  // Vault Dropdown Remove
  VAULT_DROPDOWN_REMOVE: 'vault-dropdown-remove',

  // Semantic Errors Panel
  SEMANTIC_ERRORS_PANEL: 'semantic-errors-panel',
  SEMANTIC_ERROR_ENTRY: 'semantic-error-entry',
  SEMANTIC_ERRORS_CLEAR_BTN: 'semantic-errors-clear-btn',

  // Section Editor
  SECTION_BLOCK: 'section-block',
  SECTION_EDIT_BTN: 'section-edit-btn',
  SECTION_EDITOR: 'section-editor',
  SECTION_SAVE_BTN: 'section-save-btn',
  SECTION_CANCEL_BTN: 'section-cancel-btn',
  SECTION_AI_BTN: 'section-ai-btn',
  SECTION_LLM_INPUT: 'section-llm-input',
  CONFLICT_DIALOG: 'conflict-dialog',
  CONFLICT_OVERRIDE_BTN: 'conflict-override-btn',
  CONFLICT_RELOAD_BTN: 'conflict-reload-btn',

  // Outline Panel
  OUTLINE_PANEL: 'outline-panel',
  OUTLINE_HEADING: 'outline-heading',

  // Git Panel
  GIT_PANEL: 'git-panel',
  GIT_FILE_ROW: 'git-file-row',
  GIT_COMMIT_INPUT: 'git-commit-input',
  GIT_COMMIT_BTN: 'git-commit-btn',
  GIT_SUGGEST_BTN: 'git-suggest-btn',

  // Related Docs Panel
  RELATED_DOCS_PANEL: 'related-docs-panel',
  RELATED_DOC_CARD: 'related-doc-card',
  RIGHT_DRAWER_COLLAPSED: 'right-drawer-collapsed'
} as const

export type TestId = (typeof TEST_IDS)[keyof typeof TEST_IDS]
