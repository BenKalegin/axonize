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
  ]
}

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  ollama: 'llama3'
}
