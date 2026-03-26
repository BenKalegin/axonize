export const PROVIDER_MODELS: Record<string, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4-20250414', label: 'Claude Haiku 4' },
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  ollama: [
    { id: 'llama3', label: 'Llama 3' },
    { id: 'mistral', label: 'Mistral' },
    { id: 'phi3', label: 'Phi-3' },
  ],
  'claude-code': [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  codex: [
    { id: '', label: 'Codex default' },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
    { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex' },
    { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
    { id: 'gpt-5-codex', label: 'GPT-5 Codex' },
  ]
}

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  ollama: 'llama3',
  'claude-code': 'claude-sonnet-4-6',
  codex: ''
}
