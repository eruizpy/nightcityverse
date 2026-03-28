// NPC sprite renderer — procedural pixel-art characters with 6 animation states
// Each NPC is drawn at its tile position (center-bottom aligned)

import { TILE_SIZE } from './tilemap.js'

export type AnimState = 'idle' | 'working' | 'thinking' | 'error' | 'sleeping' | 'offline'

export interface AgentData {
  id: string
  name: string
  state: AnimState
  task?: string
  energy?: number
  position: { col: number; row: number }
  color: string
  speechBubble?: { text: string; expiresAt: number }
}

// ── Animation frame tracker ───────────────────────────────────────────────────
// Advances at ~8fps regardless of render fps

const ANIM_FPS   = 8
const ANIM_STEP  = 1000 / ANIM_FPS
const frameCounters: Record<string, number> = {}
let lastAnimTick = 0

export function tickAnimations(now: number): void {
  if (lastAnimTick === 0) lastAnimTick = now
  const delta = now - lastAnimTick
  if (delta >= ANIM_STEP) {
    const steps = Math.floor(delta / ANIM_STEP)
    for (const id of Object.keys(frameCounters)) {
      frameCounters[id] = (frameCounters[id] + steps) & 0xffff
    }
    lastAnimTick = now
  }
}

function getFrame(id: string): number {
  if (!(id in frameCounters)) frameCounters[id] = 0
  return frameCounters[id]
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function darken(hex: string, amount = 50): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, (n >> 16) - amount)
  const g = Math.max(0, ((n >> 8) & 0xff) - amount)
  const b = Math.max(0, (n & 0xff) - amount)
  return `rgb(${r},${g},${b})`
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}

// ── NPC draw ──────────────────────────────────────────────────────────────────
// NPC bounding box: 36px wide × 52px tall
// Anchor: center-x, bottom-y of tile

const W  = 36  // total character width
const H  = 52  // total character height

// Anatomical constants (px from anchor top-left of bounding box)
const HEAD_X  = (W - 18) / 2  // 9
const HEAD_W  = 18
const HEAD_H  = 16
const HEAD_Y  = 2
const BODY_X  = (W - 20) / 2  // 8
const BODY_W  = 20
const BODY_Y  = HEAD_Y + HEAD_H  // 18
const BODY_H  = 16
const LEG_W   = 7
const LEG_H   = 12
const LEG_Y   = BODY_Y + BODY_H  // 34
const LEG_LX  = BODY_X + 2
const LEG_RX  = BODY_X + BODY_W - LEG_W - 2
const FOOT_W  = 9
const FOOT_H  = 4
const FOOT_Y  = LEG_Y + LEG_H   // 46
const ARM_W   = 5
const ARM_H   = 12

function drawNPC(
  ctx: CanvasRenderingContext2D,
  bx: number,  // bounding box top-left x
  by: number,  // bounding box top-left y
  color: string,
  state: AnimState,
  frame: number,
): void {
  const f4 = frame % 4
  const f2 = frame % 2

  // Per-state animation parameters
  let bobY     = 0          // vertical body offset for breathing
  let shakeX   = 0          // horizontal shake for error state
  let armLY    = BODY_Y     // arm attach Y (raised = lower number)
  let armRY    = BODY_Y
  let armLX    = BODY_X - ARM_W  // arm X positions
  let armRX    = BODY_X + BODY_W
  let armAngle = 0          // not used currently
  let eyeOpen  = true
  let overlay  = ''

  switch (state) {
    case 'idle':
      bobY = [0, 0, -1, -1][f4]
      break
    case 'working':
      // Typing: arms forward (angled in), slight bob
      bobY = [0, -1, -1, 0][f4]
      armLY = BODY_Y + 4
      armRY = BODY_Y + 4
      armLX = BODY_X - ARM_W + 2  // slightly inward
      armRX = BODY_X + BODY_W - 2
      break
    case 'thinking':
      bobY = [0, 0, -1, 0][f4]
      // Right arm raised up
      armRY = BODY_Y - 8
      break
    case 'error':
      shakeX = f2 === 0 ? 3 : -3
      overlay = 'rgba(220,0,0,0.28)'
      break
    case 'sleeping':
      bobY = 1
      eyeOpen = false
      overlay = 'rgba(50,50,120,0.15)'
      break
    case 'offline':
      overlay = 'rgba(90,90,110,0.55)'
      break
  }

  ctx.save()
  ctx.translate(bx + shakeX, by + bobY)

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.20)'
  ctx.beginPath()
  ctx.ellipse(W / 2, H + 2, 13, 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // ── Arms ──────────────────────────────────────────────────────────
  const armColor = color
  const handColor = '#f0c080'

  // Left arm
  ctx.fillStyle = armColor
  ctx.fillRect(armLX, armLY, ARM_W, ARM_H)
  ctx.fillStyle = handColor
  ctx.fillRect(armLX, armLY + ARM_H, ARM_W, 4)

  // Right arm
  ctx.fillStyle = armColor
  ctx.fillRect(armRX, armRY, ARM_W, ARM_H)
  ctx.fillStyle = handColor
  ctx.fillRect(armRX, armRY + ARM_H, ARM_W, 4)

  // Working: keyboard on desk (just visual hint - flat rect in front)
  if (state === 'working') {
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(BODY_X - 2, BODY_Y + ARM_H + 4, BODY_W + 4, 3)
  }

  // ── Body ──────────────────────────────────────────────────────────
  ctx.fillStyle = color
  ctx.fillRect(BODY_X, BODY_Y, BODY_W, BODY_H)
  // Shirt detail line
  ctx.fillStyle = darken(color, 30)
  ctx.fillRect(BODY_X, BODY_Y, BODY_W, 3)
  // Belt
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(BODY_X, BODY_Y + BODY_H - 3, BODY_W, 3)

  // ── Legs ──────────────────────────────────────────────────────────
  const pantColor = '#2d3050'
  ctx.fillStyle = pantColor
  ctx.fillRect(LEG_LX, LEG_Y, LEG_W, LEG_H)
  ctx.fillRect(LEG_RX, LEG_Y, LEG_W, LEG_H)
  // Feet
  ctx.fillStyle = '#111'
  ctx.fillRect(LEG_LX - 1, FOOT_Y, FOOT_W, FOOT_H)
  ctx.fillRect(LEG_RX - 1, FOOT_Y, FOOT_W, FOOT_H)

  // ── Head ──────────────────────────────────────────────────────────
  const skinColor = '#f0c080'
  ctx.fillStyle = skinColor
  ctx.fillRect(HEAD_X, HEAD_Y, HEAD_W, HEAD_H)

  // Hair / hat top (agent color)
  ctx.fillStyle = darken(color, 20)
  ctx.fillRect(HEAD_X, HEAD_Y, HEAD_W, 6)
  // Hat brim
  ctx.fillRect(HEAD_X - 2, HEAD_Y + 5, HEAD_W + 4, 3)

  // Eyes
  if (eyeOpen) {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(HEAD_X + 3, HEAD_Y + 8, 3, 3)
    ctx.fillRect(HEAD_X + HEAD_W - 6, HEAD_Y + 8, 3, 3)
    // Eye shine
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(HEAD_X + 4, HEAD_Y + 8, 1, 1)
    ctx.fillRect(HEAD_X + HEAD_W - 5, HEAD_Y + 8, 1, 1)
    // State-specific mouth
    if (state === 'working' || state === 'thinking') {
      // Determined look — small dash
      ctx.fillStyle = '#c07040'
      ctx.fillRect(HEAD_X + 6, HEAD_Y + 13, 6, 1)
    } else if (state === 'error') {
      // Frown
      ctx.fillStyle = '#c07040'
      ctx.fillRect(HEAD_X + 5, HEAD_Y + 13, 8, 2)
      ctx.fillRect(HEAD_X + 4, HEAD_Y + 12, 2, 2)
      ctx.fillRect(HEAD_X + HEAD_W - 6, HEAD_Y + 12, 2, 2)
    } else {
      // Neutral smile
      ctx.fillStyle = '#c07040'
      ctx.fillRect(HEAD_X + 5, HEAD_Y + 12, 8, 2)
      ctx.fillRect(HEAD_X + 4, HEAD_Y + 11, 2, 2)
      ctx.fillRect(HEAD_X + HEAD_W - 6, HEAD_Y + 11, 2, 2)
    }
  } else {
    // Sleeping: closed eyes (lines)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(HEAD_X + 3, HEAD_Y + 10, 3, 1)
    ctx.fillRect(HEAD_X + HEAD_W - 6, HEAD_Y + 10, 3, 1)
  }

  // Thinking indicator: right-arm raised hand + thought dots
  if (state === 'thinking') {
    ctx.fillStyle = handColor
    ctx.fillRect(armRX, armRY - 6, ARM_W, 4)  // raised hand
    // Thought bubble dots
    const sizes = [3, 4, 5]
    const positions = [
      { x: W - 10, y: HEAD_Y - 4 },
      { x: W - 4,  y: HEAD_Y - 11 },
      { x: W + 2,  y: HEAD_Y - 20 },
    ]
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(positions[i].x, positions[i].y, sizes[i], 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(200,200,255,0.4)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    }
  }

  // Sleeping Z's
  if (state === 'sleeping') {
    const zPositions = [
      { x: HEAD_X + HEAD_W + 3, y: HEAD_Y + 4 - (f4 * 2) },
      { x: HEAD_X + HEAD_W + 9, y: HEAD_Y - 4 - (f4 * 2) },
      { x: HEAD_X + HEAD_W + 4, y: HEAD_Y - 13 - (f4 * 2) },
    ]
    ctx.fillStyle = 'rgba(180,200,255,0.85)'
    ctx.font = 'bold 8px monospace'
    for (const zp of zPositions) {
      if (zp.y > HEAD_Y - 20) ctx.fillText('z', zp.x, zp.y)
    }
  }

  // Error flash ring
  if (state === 'error' && f2 === 0) {
    ctx.strokeStyle = 'rgba(255,50,50,0.6)'
    ctx.lineWidth   = 2
    ctx.beginPath()
    ctx.arc(W / 2, H / 2, 20, 0, Math.PI * 2)
    ctx.stroke()
  }

  // State overlay (error / offline / sleeping tint)
  if (overlay) {
    ctx.fillStyle = overlay
    ctx.fillRect(0, 0, W, H)
  }

  // Offline: gray X
  if (state === 'offline') {
    ctx.strokeStyle = 'rgba(200,200,220,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(6, 6); ctx.lineTo(W - 6, H - 6)
    ctx.moveTo(W - 6, 6); ctx.lineTo(6, H - 6)
    ctx.stroke()
  }

  ctx.restore()
}

// ── Agent name tag ─────────────────────────────────────────────────────────────

function drawNameTag(
  ctx: CanvasRenderingContext2D,
  cx: number,  // center x
  by: number,  // bottom y of NPC
  name: string,
  color: string,
): void {
  const label    = name.replace(' Agent', '')
  const fontSize = 9
  ctx.font = `bold ${fontSize}px 'Courier New'`
  const tw = ctx.measureText(label).width
  const px = cx - tw / 2 - 4
  const py = by + 4

  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(px, py, tw + 8, fontSize + 4)
  ctx.fillStyle = color
  ctx.fillText(label, px + 4, py + fontSize + 1)
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function renderNPCs(
  ctx: CanvasRenderingContext2D,
  agents: AgentData[],
  now: number,
): void {
  tickAnimations(now)

  for (const agent of agents) {
    const frame = getFrame(agent.id)
    const state = agent.state

    // World position → canvas pixels (center of tile)
    const tileCX = agent.position.col * TILE_SIZE + TILE_SIZE / 2
    const tileBY = (agent.position.row + 1) * TILE_SIZE  // bottom of tile

    // Bounding box top-left
    const bx = tileCX - W / 2
    const by = tileBY - H

    drawNPC(ctx, bx, by, agent.color, state as AnimState, frame)
    drawNameTag(ctx, tileCX, tileBY, agent.name, agent.color)
  }
}
