import { ipcMain } from 'electron'
import { mkdir, readFile, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import { getSettings } from './settings-service'
import { getLLMProvider } from './rag/provider-factory'
import { vaultNameFromPath } from '../core/vault/name'
import { llmContentToString, type LLMMessage } from '../core/rag/types'
import log from './logger'

const ICON_DIR_NAME = '.axonize'
const ICON_FILE_NAME = 'icon.svg'
const TEMP_SUFFIX = '.tmp'

// The SVG returned by the LLM has to be small enough to render inline in a
// menu thumbnail and not blow up the menu's DOM size. ~12 KB comfortably fits
// a hand-authored multi-path icon while rejecting accidental data-url blobs.
const MAX_ICON_BYTES = 12_000

const ICON_GENERATION_MODEL = 'claude-haiku-4-5-20251001'
const ICON_GENERATION_MAX_TOKENS = 2_000
const ICON_GENERATION_TEMPERATURE = 0.7

const ICON_SYSTEM_PROMPT =
  'You generate small SVG icons for a desktop note-taking app. Rules:\n' +
  '- Output ONLY the raw <svg>...</svg> markup. No prose, no markdown fences, no XML declaration.\n' +
  '- The root <svg> must have viewBox="0 0 64 64" and width/height attributes omitted.\n' +
  '- Use flat geometric shapes, 2–6 colors, no external assets, no <image>, no <foreignObject>, no <script>.\n' +
  '- Keep the file under 8 KB. Optimize: combine paths, use short hex colors when possible.\n' +
  '- Design must read clearly at 32×32 pixels (the menu thumbnail size).'

function iconFilePath(vaultPath: string): string {
  return join(vaultPath, ICON_DIR_NAME, ICON_FILE_NAME)
}

// Reject anything that doesn't look like a sanitary SVG before we save it.
// LLMs occasionally wrap the answer in markdown fences or include explanation
// text — we strip the fences and bail on anything else suspicious.
function sanitizeGeneratedSvg(raw: string): string {
  let s = raw.trim()
  // Strip ```svg ... ``` or ``` ... ``` wrappers.
  if (s.startsWith('```')) {
    s = s.replace(/^```[a-zA-Z]*\n?/, '').replace(/```\s*$/, '').trim()
  }
  const start = s.indexOf('<svg')
  const end = s.lastIndexOf('</svg>')
  if (start < 0 || end < 0 || end < start) {
    throw new Error('Model did not return a valid SVG')
  }
  s = s.slice(start, end + '</svg>'.length)
  if (Buffer.byteLength(s, 'utf-8') > MAX_ICON_BYTES) {
    throw new Error('Generated SVG is too large')
  }
  // Defense in depth: scripts and external content should never appear.
  if (/<script|<foreignObject|<image\s|xlink:href\s*=\s*["']https?:/i.test(s)) {
    throw new Error('Generated SVG contains disallowed elements')
  }
  return s
}

async function saveIcon(vaultPath: string, svg: string): Promise<void> {
  const dir = join(vaultPath, ICON_DIR_NAME)
  await mkdir(dir, { recursive: true })
  const target = iconFilePath(vaultPath)
  const temp = `${target}${TEMP_SUFFIX}`
  await writeFile(temp, svg, 'utf-8')
  await rename(temp, target)
}

function buildIconMessages(vaultName: string, userPrompt: string): LLMMessage[] {
  return [
    { role: 'system', content: ICON_SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        `Vault name: ${vaultName}\n` +
        `Style request: ${userPrompt.trim() || 'a simple, friendly icon that hints at the vault name'}\n\n` +
        'Return the SVG now.'
    }
  ]
}

export function registerVaultIconIpcHandlers(): void {
  ipcMain.handle('vault:readIcon', async (_event, vaultPath: string): Promise<string | null> => {
    try {
      return await readFile(iconFilePath(vaultPath), 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('vault:writeIcon', async (_event, vaultPath: string, svg: string) => {
    const clean = sanitizeGeneratedSvg(svg)
    await saveIcon(vaultPath, clean)
  })

  ipcMain.handle(
    'vault:generateIcon',
    async (_event, vaultPath: string, userPrompt: string): Promise<string> => {
      const settings = await getSettings()
      const llm = getLLMProvider({
        ...settings.llm,
        model: ICON_GENERATION_MODEL,
        maxTokens: ICON_GENERATION_MAX_TOKENS,
        temperature: ICON_GENERATION_TEMPERATURE
      })
      try {
        const response = await llm.complete(buildIconMessages(vaultNameFromPath(vaultPath), userPrompt))
        const svg = sanitizeGeneratedSvg(llmContentToString(response.content))
        await saveIcon(vaultPath, svg)
        return svg
      } catch (e) {
        log.error('vault:generateIcon failed:', e)
        throw e
      }
    }
  )
}
