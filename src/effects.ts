// Effects: speech bubbles, floating task labels, pulse rings
// These are drawn on top of the NPC layer

import { TILE_SIZE } from './tilemap.js'

// ── Speech bubble ─────────────────────────────────────────────────────────────

interface BubbleEntry {
  agentId: string
  text: string
  x: number
  y: number
  expiresAt: number
  color: string
}

const activeBubbles: BubbleEntry[] = []

export function showSpeechBubble(opts: {
  agentId: string
  text: string
  col: number
  row: number
  color: string
  expiresAt: number
}): void {
  // Replace existing bubble for same agent
  const idx = activeBubbles.findIndex(b => b.agentId === opts.agentId)
  if (idx >= 0) activeBubbles.splice(idx, 1)

  activeBubbles.push({
    agentId:   opts.agentId,
    text:      opts.text,
    x:         opts.col * TILE_SIZE + TILE_SIZE / 2,
    y:         opts.row * TILE_SIZE,
    expiresAt: opts.expiresAt,
    color:     opts.color,
  })
}

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  entry: BubbleEntry,
  now: number,
): void {
  const remaining = entry.expiresAt - now
  const alpha     = Math.min(1, remaining / 800)  // fade out last 800ms
  if (alpha <= 0) return

  const maxW  = 180
  const pad   = 8
  const fs    = 11
  ctx.font    = `${fs}px 'Courier New'`

  // Word-wrap
  const words   = entry.text.split(' ')
  const lines: string[] = []
  let current   = ''
  for (const w of words) {
    const test = current ? `${current} ${w}` : w
    if (ctx.measureText(test).width > maxW - pad * 2) {
      if (current) lines.push(current)
      current = w
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  const bh = lines.length * (fs + 3) + pad * 2
  const bw = Math.min(
    maxW,
    Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2,
  )

  const bx = entry.x - bw / 2
  const by = entry.y - bh - 24

  ctx.save()
  ctx.globalAlpha = alpha

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(bx + 2, by + 2, bw, bh)

  // Bubble background
  ctx.fillStyle = 'rgba(15,15,30,0.92)'
  ctx.strokeStyle = entry.color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 6)
  ctx.fill()
  ctx.stroke()

  // Pointer / tail
  ctx.fillStyle = 'rgba(15,15,30,0.92)'
  ctx.beginPath()
  ctx.moveTo(entry.x - 5, by + bh)
  ctx.lineTo(entry.x + 5, by + bh)
  ctx.lineTo(entry.x, by + bh + 10)
  ctx.fill()
  ctx.strokeStyle = entry.color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(entry.x - 5, by + bh)
  ctx.lineTo(entry.x, by + bh + 10)
  ctx.lineTo(entry.x + 5, by + bh)
  ctx.stroke()

  // Text
  ctx.fillStyle = '#ffffff'
  ctx.font = `${fs}px 'Courier New'`
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], bx + pad, by + pad + fs + i * (fs + 3))
  }

  ctx.restore()
}

// ── Task label (floating above working/thinking NPCs) ─────────────────────────

export function drawTaskLabel(
  ctx: CanvasRenderingContext2D,
  task: string,
  col: number,
  row: number,
  color: string,
  state: string,
): void {
  if (state !== 'working' && state !== 'thinking') return
  if (!task) return

  const cx = col * TILE_SIZE + TILE_SIZE / 2
  const ty = row * TILE_SIZE - 58  // above NPC

  const maxLen = 28
  const label  = task.length > maxLen ? task.slice(0, maxLen - 1) + '…' : task

  ctx.font = `10px 'Courier New'`
  const tw = ctx.measureText(label).width

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(cx - tw / 2 - 5, ty, tw + 10, 14)

  ctx.fillStyle = color
  ctx.fillText(label, cx - tw / 2, ty + 11)
}

// ── Pulse ring (for state transitions) ────────────────────────────────────────

interface PulseRing {
  x: number
  y: number
  color: string
  radius: number
  maxRadius: number
  alpha: number
  startedAt: number
}

const pulseRings: PulseRing[] = []

export function triggerPulse(col: number, row: number, color: string): void {
  pulseRings.push({
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
    color,
    radius: 10,
    maxRadius: 40,
    alpha: 0.8,
    startedAt: performance.now(),
  })
}

// ── Main render pass ──────────────────────────────────────────────────────────

export function renderEffects(ctx: CanvasRenderingContext2D, now: number): void {
  // Pulse rings
  for (let i = pulseRings.length - 1; i >= 0; i--) {
    const r = pulseRings[i]
    const elapsed = now - r.startedAt
    const progress = elapsed / 600  // 600ms duration
    if (progress >= 1) { pulseRings.splice(i, 1); continue }
    r.radius = 10 + (r.maxRadius - 10) * progress
    r.alpha  = 0.8 * (1 - progress)

    ctx.save()
    ctx.strokeStyle = r.color
    ctx.globalAlpha = r.alpha
    ctx.lineWidth   = 2
    ctx.beginPath()
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  // Speech bubbles
  for (let i = activeBubbles.length - 1; i >= 0; i--) {
    const b = activeBubbles[i]
    if (b.expiresAt < now) { activeBubbles.splice(i, 1); continue }
    drawSpeechBubble(ctx, b, now)
  }
}

// ── Sync bubble state from world ──────────────────────────────────────────────

export function syncBubbles(agents: Array<{
  id: string
  speechBubble?: { text: string; expiresAt: number }
  position: { col: number; row: number }
  color: string
}>): void {
  for (const agent of agents) {
    if (!agent.speechBubble) continue
    const existing = activeBubbles.find(b => b.agentId === agent.id)
    if (existing && existing.text === agent.speechBubble.text) continue
    showSpeechBubble({
      agentId:   agent.id,
      text:      agent.speechBubble.text,
      col:       agent.position.col,
      row:       agent.position.row,
      color:     agent.color,
      expiresAt: agent.speechBubble.expiresAt,
    })
  }
}
