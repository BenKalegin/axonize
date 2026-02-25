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
  RAG_SOURCE_LINK: 'rag-source-link'
} as const

export type TestId = (typeof TEST_IDS)[keyof typeof TEST_IDS]
