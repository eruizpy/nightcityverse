// Main canvas renderer — 60fps game loop

import { renderTilemap } from './tilemap.js'
import { renderNPCs }    from './npc.js'
import { renderEffects, drawTaskLabel, syncBubbles } from './effects.js'
import type { WorldState }  from './ws-client.js'

let canvas: HTMLCanvasElement
let ctx:    CanvasRenderingContext2D
let world:  WorldState | null = null
let animId: number | null     = null

export function setWorld(w: WorldState): void {
  world = w
  // Sync speech bubbles from server state
  syncBubbles(Object.values(w.agents))
}

function render(now: number): void {
  animId = requestAnimationFrame(render)

  if (!world) {
    // Loading screen
    ctx.fillStyle = '#0d0d1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#00d4ff'
    ctx.font      = 'bold 14px Courier New'
    ctx.textAlign = 'center'
    ctx.fillText('⚡ Connecting to NightCityVerse…', canvas.width / 2, canvas.height / 2)
    return
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Layer 1: Tilemap
  renderTilemap(ctx, world.tilemap)

  // Layer 2: Task labels (before NPCs so they appear behind them slightly)
  for (const agent of Object.values(world.agents)) {
    if (agent.task) {
      drawTaskLabel(
        ctx,
        agent.task,
        agent.position.col,
        agent.position.row,
        agent.color,
        agent.state,
      )
    }
  }

  // Layer 3: NPCs
  renderNPCs(ctx, Object.values(world.agents), now)

  // Layer 4: Effects (speech bubbles, pulse rings)
  renderEffects(ctx, now)
}

export function initRenderer(): void {
  canvas = document.getElementById('world-canvas') as HTMLCanvasElement
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D not supported')
  ctx = context

  ctx.imageSmoothingEnabled = false

  if (animId !== null) cancelAnimationFrame(animId)
  animId = requestAnimationFrame(render)
}
