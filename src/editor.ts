// NightCityVerse world editor panel — press E to open, type natural language, hit Send

interface ProviderStatus {
  id: 'anthropic' | 'openai' | 'ollama'
  label: string
  available: boolean
  reason?: string
}

interface ProvidersResponse {
  active: ProviderStatus['id']
  providers: ProviderStatus[]
}

let isOpen = false
let activeProvider: ProviderStatus['id'] | null = null

const panel  = () => document.getElementById('editor-panel') as HTMLDivElement
const input  = () => document.getElementById('editor-input') as HTMLInputElement
const btn    = () => document.getElementById('editor-send') as HTMLButtonElement
const close  = () => document.getElementById('editor-close') as HTMLSpanElement
const think  = () => document.getElementById('editor-thinking') as HTMLSpanElement
const providerBadge = () => document.getElementById('provider-badge') as HTMLDivElement
const providerLabel = () => document.getElementById('provider-label') as HTMLSpanElement
const providerDot = () => document.getElementById('provider-dot') as HTMLDivElement
const providerDropdown = () => document.getElementById('provider-dropdown') as HTMLDivElement
const providerTag = () => document.getElementById('editor-provider-tag') as HTMLSpanElement

const PROVIDER_COLORS: Record<ProviderStatus['id'], string> = {
  anthropic: '#d97706',
  openai: '#10b981',
  ollama: '#60a5fa',
}

const PROVIDER_NAMES: Record<ProviderStatus['id'], string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  ollama: 'Ollama',
}

function open(): void {
  if (isOpen) return
  isOpen = true
  panel().classList.add('open')
  input().focus()
}

function closePanel(): void {
  if (!isOpen) return
  isOpen = false
  panel().classList.remove('open')
  input().value = ''
  input().blur()
}

async function sendEdit(): Promise<void> {
  const prompt = input().value.trim()
  if (!prompt) return

  btn().disabled   = true
  think().style.display = 'inline'

  try {
    const res = await fetch('/api/edit', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt }),
    })
    const data = await res.json() as { ok: boolean; message?: string }
    if (data.ok) {
      input().value = ''
      if (data.message) {
        showToast(`✓ ${data.message}`)
      }
    } else {
      showToast(`Edit failed with ${PROVIDER_NAMES[activeProvider ?? 'anthropic']} configuration`, true)
    }
  } catch {
    showToast('Server unreachable', true)
  } finally {
    btn().disabled        = false
    think().style.display = 'none'
  }
}

function showToast(msg: string, error = false): void {
  const t = document.createElement('div')
  t.textContent = msg
  Object.assign(t.style, {
    position: 'fixed',
    bottom:   '60px',
    left:     '50%',
    transform: 'translateX(-50%)',
    background: error ? '#c0392b' : '#27ae60',
    color:    '#fff',
    padding:  '8px 16px',
    borderRadius: '4px',
    fontFamily: 'Courier New',
    fontSize: '12px',
    zIndex:   '200',
    pointerEvents: 'none',
  })
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 3000)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function setActiveProviderUI(provider: ProviderStatus['id']): void {
  activeProvider = provider
  const color = PROVIDER_COLORS[provider]
  providerLabel().textContent = PROVIDER_NAMES[provider]
  providerDot().style.background = color
  providerTag().textContent = PROVIDER_NAMES[provider]
  providerTag().style.color = color
  providerTag().style.borderColor = color
}

async function selectProvider(provider: ProviderStatus['id']): Promise<void> {
  const res = await fetch('/api/providers/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  })
  if (!res.ok) {
    showToast(`Could not switch provider to ${PROVIDER_NAMES[provider]}`, true)
    return
  }
  setActiveProviderUI(provider)
  providerDropdown().classList.remove('open')
}

function renderProviders(data: ProvidersResponse): void {
  setActiveProviderUI(data.active)
  providerDropdown().innerHTML = data.providers.map((provider) => `
    <div
      class="provider-option ${provider.id === data.active ? 'active' : ''} ${provider.available ? '' : 'unavailable'}"
      data-provider="${provider.id}"
      data-available="${provider.available ? '1' : '0'}"
      title="${provider.reason ?? ''}"
    >
      <div class="po-dot" style="background:${PROVIDER_COLORS[provider.id]}"></div>
      <span class="po-name">${provider.label}</span>
      <span class="po-status">${provider.available ? 'ready' : escapeHtml(provider.reason ?? 'unavailable')}</span>
      ${provider.id === data.active ? '<span class="po-check">✓</span>' : ''}
    </div>
  `).join('')

  providerDropdown().querySelectorAll<HTMLElement>('.provider-option').forEach((node) => {
    node.addEventListener('click', () => {
      if (node.dataset.available !== '1') return
      const provider = node.dataset.provider as ProviderStatus['id']
      void selectProvider(provider)
    })
  })
}

async function loadProviders(): Promise<void> {
  try {
    const res = await fetch('/api/providers')
    if (!res.ok) throw new Error('providers endpoint failed')
    const data = await res.json() as ProvidersResponse
    renderProviders(data)
  } catch {
    showToast('Could not load LLM providers', true)
  }
}

export function initEditor(): void {
  void loadProviders()

  // Keyboard shortcut
  window.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') {
      if (document.activeElement?.tagName === 'INPUT') return
      e.preventDefault()
      open()
    }
    if (e.key === 'Escape') closePanel()
  })

  // Button
  btn().addEventListener('click', () => sendEdit())

  // Enter key in input
  input().addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendEdit()
  })

  // Close button
  close().addEventListener('click', closePanel)

  providerBadge().addEventListener('click', (e) => {
    e.stopPropagation()
    providerDropdown().classList.toggle('open')
  })

  window.addEventListener('click', () => providerDropdown().classList.remove('open'))
  window.addEventListener('nightcityverse:provider', ((event: Event) => {
    const detail = (event as CustomEvent<{ active: ProviderStatus['id'] }>).detail
    if (detail?.active) setActiveProviderUI(detail.active)
  }) as EventListener)
}
