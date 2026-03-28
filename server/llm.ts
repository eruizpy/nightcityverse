/**
 * NightCityVerse — LLM provider abstraction
 *
 * Supported providers:
 *   anthropic -> Anthropic Messages API (ANTHROPIC_API_KEY + ANTHROPIC_MODEL)
 *   openai    -> OpenAI Chat Completions API (OPENAI_API_KEY + OPENAI_MODEL)
 *   ollama    -> Local Ollama via OpenAI-compatible API (OLLAMA_BASE_URL + OLLAMA_MODEL)
 *
 * Selection: LLM_PROVIDER env var, or via POST /api/providers/select at runtime.
 */

import type { WorldSnapshot, WorldPatch, TileType } from './world.js'

// ── Provider types ─────────────────────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'openai' | 'ollama'

interface ProviderStatus {
  id: LLMProvider
  label: string
  available: boolean
  reason?: string
}

// ── Runtime state (can be changed via API) ────────────────────────────────────

let runtimeProvider: LLMProvider | null = null

export function getActiveProvider(): LLMProvider {
  return runtimeProvider ?? normalizeLLMProvider(process.env.LLM_PROVIDER)
}

export function setActiveProvider(p: LLMProvider): void {
  runtimeProvider = p
  console.log(`[llm] Provider switched to: ${p}`)
}

function normalizeLLMProvider(raw: string | undefined): LLMProvider {
  if (raw === 'anthropic' || raw === 'openai' || raw === 'ollama') return raw
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'ollama'
}

// ── Provider availability detection ──────────────────────────────────────────

export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const statuses: ProviderStatus[] = []

  // anthropic: requires ANTHROPIC_API_KEY
  {
    const key = process.env.ANTHROPIC_API_KEY
    statuses.push({
      id: 'anthropic',
      label: `Anthropic (${getAnthropicModel()})`,
      available: !!key,
      reason: key ? undefined : 'ANTHROPIC_API_KEY not set',
    })
  }

  // openai: requires OPENAI_API_KEY
  {
    const key = process.env.OPENAI_API_KEY
    statuses.push({
      id: 'openai',
      label: `OpenAI (${process.env.OPENAI_MODEL ?? 'gpt-4o-mini'})`,
      available: !!key,
      reason: key ? undefined : 'OPENAI_API_KEY not set',
    })
  }

  // ollama: ping local server
  {
    const base = getOllamaBase()
    let available = false
    let reason: string | undefined
    try {
      const res = await fetch(`${base.replace('/v1', '')}/api/version`, {
        signal: AbortSignal.timeout(3000),
      })
      available = res.ok
      if (!res.ok) reason = `Ollama returned ${res.status}`
    } catch {
      reason = `Cannot reach ${base} — is ollama running?`
    }
    statuses.push({
      id: 'ollama',
      label: `Ollama (${process.env.OLLAMA_MODEL ?? 'llama3.2'})`,
      available,
      reason,
    })
  }

  return statuses
}

// ── Config helpers ─────────────────────────────────────────────────────────────

function getOllamaBase(): string {
  return (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1').replace(/\/+$/, '')
}

function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL ?? 'llama3.2'
}

function getOpenAIBase(): string {
  return (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
}

function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
}

function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
}

// ── Shared prompt builder ──────────────────────────────────────────────────────

const TILE_NAMES: Record<number, string> = {
  0: 'floor', 1: 'wall', 2: 'desk', 3: 'plant',
  4: 'window', 5: 'coffee_machine', 6: 'accent_floor', 7: 'whiteboard',
}

const TILE_IDS: Record<string, TileType> = {
  floor: 0, wall: 1, desk: 2, plant: 3,
  window: 4, coffee_machine: 5, accent_floor: 6, whiteboard: 7,
}

function tileMapToText(tilemap: TileType[][]): string {
  return tilemap.map(row =>
    row.map(t => (t === 0 ? '.' : TILE_NAMES[t]?.[0] ?? '?')).join(''),
  ).join('\n')
}

function buildSystemPrompt(): string {
  return `You are the world editor for NightCityVerse — a pixel-art virtual office for AI agents.

WORLD GRID: 20 columns (0–19) × 14 rows (0–13). Tile IDs:
  0=floor  1=wall  2=desk  3=plant  4=window  5=coffee_machine  6=accent_floor  7=whiteboard

Tile map legend (compact): . = floor, W = wall, d = desk, p = plant, w = window, c = coffee, a = accent, b = whiteboard

RULES:
- Perimeter (row 0, row 13, col 0, col 19) must stay wall (tile 1)
- Do not overwrite agent home desk tiles
- Make minimal, sensible changes (1–6 tiles typically)
- Tile IDs outside 0–7 are invalid

You MUST respond with ONLY a valid JSON object — no markdown fences, no comments, no prose outside JSON:
{
  "message": "Brief description of what changed",
  "tilePatch": [{"col": <0-19>, "row": <0-13>, "tile": <0-7>}],
  "agentPatch": {}
}`
}

function buildUserPrompt(snapshot: WorldSnapshot, userRequest: string): string {
  const agentSummary = Object.values(snapshot.agents)
    .map(a => `  ${a.id}: pos(col=${a.position.col}, row=${a.position.row}), state=${a.state}${a.task ? `, task="${a.task}"` : ''}`)
    .join('\n')
  return `CURRENT MAP (row 0 = top):\n${tileMapToText(snapshot.tilemap)}\n\nAGENTS:\n${agentSummary}\n\nUSER REQUEST: "${userRequest}"`
}

// ── Provider implementations ──────────────────────────────────────────────────

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: getAnthropicModel(),
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic returned ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as {
    content?: Array<{ type: string; text?: string }>
  }
  return (data.content ?? [])
    .filter((block) => block.type === 'text' && !!block.text)
    .map((block) => block.text)
    .join('\n')
}

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${baseUrl} returned ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

// ── JSON extractor ────────────────────────────────────────────────────────────

function extractPatch(rawText: string): WorldPatch | null {
  if (!rawText) return null

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('[llm] No JSON found in response:', rawText.slice(0, 300))
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      message?: string
      tilePatch?: Array<{ col: number; row: number; tile: number | string }>
      agentPatch?: Record<string, unknown>
    }

    const tilePatch = (parsed.tilePatch ?? []).map(tp => ({
      col:  Number(tp.col),
      row:  Number(tp.row),
      tile: (typeof tp.tile === 'string' ? (TILE_IDS[tp.tile] ?? 0) : Number(tp.tile)) as TileType,
    }))

    return {
      message:    parsed.message,
      tilePatch,
      agentPatch: (parsed.agentPatch ?? {}) as WorldPatch['agentPatch'],
    }
  } catch (err) {
    console.error('[llm] JSON parse error:', err)
    return null
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function editWorldWithLLM(
  snapshot: WorldSnapshot,
  userRequest: string,
): Promise<WorldPatch | null> {
  const provider = getActiveProvider()
  const system   = buildSystemPrompt()
  const user     = buildUserPrompt(snapshot, userRequest)

  console.log(`[llm] Editing world with provider: ${provider}`)

  try {
    let rawText = ''

    if (provider === 'anthropic') {
      rawText = await callAnthropic(system, user)

    } else if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY
      if (!key) throw new Error('OPENAI_API_KEY not set')
      rawText = await callOpenAICompat(getOpenAIBase(), key, getOpenAIModel(), system, user)

    } else if (provider === 'ollama') {
      rawText = await callOpenAICompat(
        getOllamaBase(),
        'ollama',          // Ollama accepts any string as key
        getOllamaModel(),
        system,
        user,
      )
    }

    return extractPatch(rawText)
  } catch (err) {
    console.error(`[llm:${provider}] Error:`, err)
    return null
  }
}
