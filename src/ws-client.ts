// WebSocket client — connects to NightCityVerse server and syncs world state

import type { AgentData, AnimState } from './npc.js'
import { triggerPulse, syncBubbles } from './effects.js'

export interface WorldState {
  tilemap: number[][]
  agents:  Record<string, AgentData>
  updatedAt: number
}

interface ProviderEventDetail {
  active: 'anthropic' | 'openai' | 'ollama'
}

type WorldUpdateCallback = (world: WorldState) => void

let ws:         WebSocket | null = null
let onUpdate:   WorldUpdateCallback = () => {}
let world:      WorldState | null   = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function getWorld(): WorldState | null { return world }

export function onWorldUpdate(cb: WorldUpdateCallback): void {
  onUpdate = cb
}

function setStatus(connected: boolean, error = false): void {
  const dot   = document.getElementById('ws-dot')
  const label = document.getElementById('ws-label')
  if (!dot || !label) return
  dot.className   = connected ? 'connected' : error ? 'error' : ''
  label.textContent = connected ? 'connected' : error ? 'reconnecting…' : 'connecting…'
}

function connect(): void {
  setStatus(false)
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${protocol}://${location.host}/ws`

  ws = new WebSocket(url)

  ws.addEventListener('open', () => {
    setStatus(true)
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  })

  ws.addEventListener('message', (evt) => {
    try {
      const msg = JSON.parse(evt.data as string) as {
        type: string
        world?: WorldState
        provider?: ProviderEventDetail['active']
        active?: ProviderEventDetail['active']
        agent?: string
        name?: string
        state?: AnimState
        task?: string
        energy?: number
        action?: { type: string; message?: string }
      }

      switch (msg.type) {
        case 'state':
          if (msg.world) {
            world = msg.world
            onUpdate(world)
          }
          if (msg.provider) {
            window.dispatchEvent(new CustomEvent<ProviderEventDetail>('nightcityverse:provider', {
              detail: { active: msg.provider },
            }))
          }
          break

        case 'provider':
          if (msg.active) {
            window.dispatchEvent(new CustomEvent<ProviderEventDetail>('nightcityverse:provider', {
              detail: { active: msg.active },
            }))
          }
          break

        case 'heartbeat':
          if (world && msg.agent) {
            const prev = world.agents[msg.agent]
            const stateChanged = prev && prev.state !== msg.state

            if (!world.agents[msg.agent]) {
              // New agent — create placeholder
              world.agents[msg.agent] = {
                id:       msg.agent,
                name:     msg.name ?? msg.agent,
                state:    msg.state ?? 'idle',
                position: { col: 10, row: 7 },
                color:    '#AAAAAA',
              }
            } else {
              const a = world.agents[msg.agent]
              if (msg.state) a.state = msg.state
              if (msg.name)  a.name  = msg.name
              if (msg.task !== undefined) a.task = msg.task
              if (msg.energy !== undefined) a.energy = msg.energy
            }

            // Pulse on state change
            if (stateChanged && msg.state) {
              const a = world.agents[msg.agent]
              triggerPulse(a.position.col, a.position.row, a.color)
            }

            onUpdate(world)
          }
          break

        case 'act':
          if (world && msg.agent && msg.action?.type === 'speak' && msg.action.message) {
            const a = world.agents[msg.agent]
            if (a) {
              a.speechBubble = {
                text:      msg.action.message,
                expiresAt: Date.now() + 7_000,
              }
              syncBubbles(Object.values(world.agents))
              onUpdate(world)

              // Push to speech log in HUD
              addSpeechLog(a.name, msg.action.message, a.color)
            }
          }
          break
      }
    } catch (e) {
      console.error('[ws] parse error', e)
    }
  })

  ws.addEventListener('close', () => {
    setStatus(false, true)
    scheduleReconnect()
  })

  ws.addEventListener('error', () => {
    setStatus(false, true)
  })
}

function scheduleReconnect(): void {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, 2500)
}

// ── Speech log UI ─────────────────────────────────────────────────────────────

function addSpeechLog(agentName: string, text: string, color: string): void {
  const log = document.getElementById('speech-log')
  if (!log) return

  const item = document.createElement('div')
  item.className = 'speech-item'
  item.innerHTML = `
    <div class="speech-agent" style="color:${color}">${agentName}</div>
    <div class="speech-msg">${escapeHtml(text)}</div>
  `
  log.prepend(item)

  // Keep max 8 items
  while (log.children.length > 8) log.lastElementChild?.remove()

  // Auto-remove after 30s
  setTimeout(() => item.remove(), 30_000)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Status bar ────────────────────────────────────────────────────────────────

export function updateStatusBar(agents: Record<string, AgentData>): void {
  const bar = document.getElementById('status-bar')
  if (!bar) return

  const stateColors: Record<string, string> = {
    idle:     '#2ECC71',
    working:  '#3498DB',
    thinking: '#F39C12',
    error:    '#E74C3C',
    sleeping: '#8E44AD',
    offline:  '#7F8C8D',
  }
  const stateLabel: Record<string, string> = {
    idle:     'idle',
    working:  'working',
    thinking: 'thinking…',
    error:    'blocked',
    sleeping: 'sleeping',
    offline:  'offline',
  }

  bar.innerHTML = Object.values(agents).map(a => `
    <div class="agent-card" style="border-left-color:${a.color}">
      <div class="agent-name" style="color:${a.color}">${a.name}</div>
      <div class="agent-state-label" style="color:${stateColors[a.state] ?? '#aaa'}">
        ● ${stateLabel[a.state] ?? a.state}
      </div>
      ${a.task ? `<div class="agent-task">${escapeHtml(a.task)}</div>` : ''}
    </div>
  `).join('')
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initWs(): void {
  connect()
}
