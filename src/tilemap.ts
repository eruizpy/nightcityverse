// Tile renderer — draws the world grid on a Canvas 2D context
// Tile size: 40x40px, world: 20x14 = 800x560px

export const TILE_SIZE = 40
export const COLS = 20
export const ROWS = 14

// ── Tile color palette ────────────────────────────────────────────────────────

const FLOOR_BASE    = '#BFA882'
const FLOOR_GRAIN   = '#B09870'
const WALL_BASE     = '#1e1e2f'
const WALL_TRIM     = '#2d2d44'
const DESK_BASE     = '#7a5c1e'
const DESK_SURFACE  = '#8B6914'
const DESK_DARK     = '#5a3e0e'
const PLANT_POT     = '#8B4513'
const PLANT_SOIL    = '#5D3010'
const PLANT_LEAF    = '#27AE60'
const PLANT_LEAF2   = '#1e8449'
const WINDOW_FRAME  = '#2d2d44'
const WINDOW_GLASS  = '#5dade2'
const WINDOW_LIGHT  = '#AED6F1'
const COFFEE_BODY   = '#1a1a2e'
const COFFEE_PANEL  = '#e74c3c'
const COFFEE_CUP    = '#d4a017'
const ACCENT_LIGHT  = '#C8A87A'
const ACCENT_DARK   = '#A88860'
const WHITEBOARD    = '#f0f0ee'
const WB_FRAME      = '#c0b89a'

// ── Tile draw functions ───────────────────────────────────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.fillStyle = FLOOR_BASE
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  // Subtle grain lines
  ctx.fillStyle = FLOOR_GRAIN
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(px, py + 10 * i + 8, TILE_SIZE, 1)
  }
}

function drawWall(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.fillStyle = WALL_BASE
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  // Brick-like trim
  ctx.fillStyle = WALL_TRIM
  ctx.fillRect(px, py, TILE_SIZE, 3)
  ctx.fillRect(px, py + TILE_SIZE - 3, TILE_SIZE, 3)
  ctx.fillRect(px, py, 3, TILE_SIZE)
}

function drawDesk(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Desk legs & base
  ctx.fillStyle = DESK_DARK
  ctx.fillRect(px + 2, py + 26, 6, 12)
  ctx.fillRect(px + TILE_SIZE - 8, py + 26, 6, 12)
  // Desk surface
  ctx.fillStyle = DESK_SURFACE
  ctx.fillRect(px + 1, py + 14, TILE_SIZE - 2, 14)
  // Edge highlight
  ctx.fillStyle = DESK_BASE
  ctx.fillRect(px + 1, py + 14, TILE_SIZE - 2, 3)
  // Monitor (small dark rect on desk)
  ctx.fillStyle = '#111'
  ctx.fillRect(px + 12, py + 5, 16, 10)
  ctx.fillStyle = '#1a6cb5'
  ctx.fillRect(px + 13, py + 6, 14, 8)
  // Monitor stand
  ctx.fillStyle = '#333'
  ctx.fillRect(px + 18, py + 15, 4, 3)
  // Keyboard suggestion
  ctx.fillStyle = '#2a2a3a'
  ctx.fillRect(px + 8, py + 18, 24, 4)
}

function drawPlant(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Pot
  ctx.fillStyle = PLANT_SOIL
  ctx.fillRect(px + 14, py + 28, 12, 3)
  ctx.fillStyle = PLANT_POT
  ctx.fillRect(px + 12, py + 31, 16, 8)
  ctx.fillStyle = '#723510'
  ctx.fillRect(px + 11, py + 29, 18, 3)
  // Stem
  ctx.fillStyle = '#1a6b35'
  ctx.fillRect(px + 19, py + 16, 2, 14)
  // Leaves
  ctx.fillStyle = PLANT_LEAF
  ctx.beginPath()
  ctx.ellipse(px + 14, py + 16, 9, 6, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = PLANT_LEAF2
  ctx.beginPath()
  ctx.ellipse(px + 26, py + 14, 8, 5, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = PLANT_LEAF
  ctx.beginPath()
  ctx.ellipse(px + 20, py + 8, 7, 5, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawWindow(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Frame
  ctx.fillStyle = WINDOW_FRAME
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  // Glass
  ctx.fillStyle = WINDOW_GLASS
  ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6)
  // Light reflection
  ctx.fillStyle = WINDOW_LIGHT
  ctx.fillRect(px + 5, py + 5, 6, 14)
  ctx.fillRect(px + 5, py + 5, 14, 4)
  // Pane dividers
  ctx.fillStyle = WINDOW_FRAME
  ctx.fillRect(px + 18, py + 3, 4, TILE_SIZE - 6)
  ctx.fillRect(px + 3, py + 18, TILE_SIZE - 6, 4)
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Body
  ctx.fillStyle = COFFEE_BODY
  ctx.fillRect(px + 5, py + 10, 30, 26)
  // Panel
  ctx.fillStyle = '#111827'
  ctx.fillRect(px + 7, py + 12, 26, 20)
  // Red indicator light
  ctx.fillStyle = COFFEE_PANEL
  ctx.beginPath()
  ctx.arc(px + 12, py + 16, 3, 0, Math.PI * 2)
  ctx.fill()
  // Cup
  ctx.fillStyle = COFFEE_CUP
  ctx.fillRect(px + 16, py + 30, 10, 6)
  ctx.fillStyle = '#5D3010'
  ctx.fillRect(px + 17, py + 31, 8, 3)
  // Steam
  ctx.strokeStyle = 'rgba(200,200,200,0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px + 19, py + 29)
  ctx.quadraticCurveTo(px + 22, py + 24, px + 19, py + 20)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px + 24, py + 28)
  ctx.quadraticCurveTo(px + 27, py + 22, px + 24, py + 18)
  ctx.stroke()
}

function drawAccentFloor(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  ctx.fillStyle = ACCENT_LIGHT
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
  ctx.fillStyle = ACCENT_DARK
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(px, py + 10 * i + 6, TILE_SIZE, 1)
  }
  // Side border
  ctx.fillStyle = '#888060'
  ctx.fillRect(px, py, TILE_SIZE, 2)
  ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2)
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Frame
  ctx.fillStyle = WB_FRAME
  ctx.fillRect(px + 1, py + 4, TILE_SIZE - 2, TILE_SIZE - 8)
  // Board surface
  ctx.fillStyle = WHITEBOARD
  ctx.fillRect(px + 4, py + 7, TILE_SIZE - 8, TILE_SIZE - 14)
  // Marker lines (simulated content)
  ctx.strokeStyle = '#e74c3c'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(px + 7, py + 12); ctx.lineTo(px + 22, py + 12); ctx.stroke()
  ctx.strokeStyle = '#3498db'
  ctx.beginPath(); ctx.moveTo(px + 7, py + 17); ctx.lineTo(px + 18, py + 17); ctx.stroke()
  ctx.strokeStyle = '#27ae60'
  ctx.beginPath(); ctx.moveTo(px + 7, py + 22); ctx.lineTo(px + 25, py + 22); ctx.stroke()
  // Tray
  ctx.fillStyle = WB_FRAME
  ctx.fillRect(px + 4, py + TILE_SIZE - 11, TILE_SIZE - 8, 3)
}

// ── Public renderer ───────────────────────────────────────────────────────────

export function renderTilemap(
  ctx: CanvasRenderingContext2D,
  tilemap: number[][],
): void {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const px = col * TILE_SIZE
      const py = row * TILE_SIZE
      const tile = tilemap[row]?.[col] ?? 0

      switch (tile) {
        case 1: drawWall(ctx, px, py); break
        case 2: drawDesk(ctx, px, py); break
        case 3:
          drawFloor(ctx, px, py)  // floor under plant
          drawPlant(ctx, px, py)
          break
        case 4: drawWindow(ctx, px, py); break
        case 5:
          drawFloor(ctx, px, py)
          drawCoffeeMachine(ctx, px, py)
          break
        case 6: drawAccentFloor(ctx, px, py); break
        case 7:
          drawFloor(ctx, px, py)
          drawWhiteboard(ctx, px, py)
          break
        default: drawFloor(ctx, px, py)
      }
    }
  }
}
