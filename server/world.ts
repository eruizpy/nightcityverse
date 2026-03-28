// ── Types ─────────────────────────────────────────────────────────────────────

export type TileType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
// 0=floor 1=wall 2=desk 3=plant 4=window 5=coffee 6=accent 7=whiteboard

export type AgentAnimState = 'idle' | 'working' | 'thinking' | 'sleeping' | 'error' | 'offline'

export interface Agent {
  id: string
  name: string
  state: AgentAnimState
  task?: string
  energy?: number
  position: { col: number; row: number }
  speechBubble?: { text: string; expiresAt: number }
  color: string
}

export interface WorldSnapshot {
  tilemap: TileType[][]
  agents: Record<string, Agent>
  updatedAt: number
}

export interface WorldPatch {
  message?: string
  tilePatch?: Array<{ col: number; row: number; tile: TileType }>
  agentPatch?: Partial<Record<string, Partial<Agent>>>
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const COLS = 20
export const ROWS = 14

export const VALID_AGENT_STATES = ['idle', 'working', 'thinking', 'sleeping', 'error', 'offline'] as const

type ValidAgentState = (typeof VALID_AGENT_STATES)[number]

const AGENT_COLORS: Record<string, string> = {
  frontend: '#FFD600',
  backend:  '#FF6B35',
  devops:   '#7B68EE',
  pm:       '#2ECC71',
}

function ensureValidState(state: string): AgentAnimState {
  if (VALID_AGENT_STATES.includes(state as ValidAgentState)) {
    return state as AgentAnimState
  }
  return 'idle'
}

// ── Default tilemap ────────────────────────────────────────────────────────────

function makeDefaultTilemap(): TileType[][] {
  const m: TileType[][] = Array.from({ length: ROWS }, () =>
    Array<TileType>(COLS).fill(0),
  )

  // Perimeter walls
  for (let c = 0; c < COLS; c++) { m[0][c] = 1; m[ROWS-1][c] = 1 }
  for (let r = 0; r < ROWS; r++) { m[r][0] = 1; m[r][COLS-1] = 1 }

  // Windows on top wall
  m[0][4] = 4; m[0][5] = 4; m[0][14] = 4; m[0][15] = 4

  // Accent floor divider
  for (let c = 1; c < COLS-1; c++) m[7][c] = 6

  // Desks (each is 2 tiles wide)
  m[2][3] = 2; m[2][4] = 2   // Frontend (top-left)
  m[2][15] = 2; m[2][16] = 2  // Backend  (top-right)
  m[10][3] = 2; m[10][4] = 2  // DevOps   (bottom-left)
  m[5][9]  = 2; m[5][10] = 2  // PM       (center)

  // Plants
  m[1][1] = 3; m[1][18] = 3
  m[12][1] = 3; m[12][18] = 3
  m[4][10] = 3; m[11][17] = 3

  // Coffee machine
  m[6][18] = 5

  // Whiteboard
  m[1][7] = 7; m[1][8] = 7

  return m
}

// ── World state manager ───────────────────────────────────────────────────────

export class World {
  private tilemap: TileType[][] = makeDefaultTilemap()
  private agents: Record<string, Agent> = {
    frontend: { id: 'frontend', name: 'Frontend Agent', state: 'idle', position: { col: 3, row: 3 }, color: AGENT_COLORS.frontend },
    backend:  { id: 'backend',  name: 'Backend Agent',  state: 'idle', position: { col: 16, row: 3 }, color: AGENT_COLORS.backend  },
    devops:   { id: 'devops',   name: 'DevOps Agent',   state: 'idle', position: { col: 3, row: 11 }, color: AGENT_COLORS.devops   },
    pm:       { id: 'pm',       name: 'PM Agent',       state: 'idle', position: { col: 10, row: 6 }, color: AGENT_COLORS.pm       },
  }

  snapshot(): WorldSnapshot {
    // Prune expired speech bubbles before snapshotting
    const now = Date.now()
    for (const agent of Object.values(this.agents)) {
      if (agent.speechBubble && agent.speechBubble.expiresAt < now) {
        delete agent.speechBubble
      }
    }
    return {
      tilemap: this.tilemap.map(r => [...r]),
      agents:  JSON.parse(JSON.stringify(this.agents)),
      updatedAt: now,
    }
  }

  updateAgent(opts: {
    agent: string
    name?: string
    state: AgentAnimState
    task?: string
    energy?: number
  }): void {
    const { agent: id, name, state, task, energy } = opts
    const safeState = ensureValidState(state)

    const existing = this.agents[id]
    if (!existing) {
      // Auto-create unknown agents
      this.agents[id] = {
        id,
        name: name ?? id,
        state: safeState,
        position: { col: 10, row: 7 },
        color: AGENT_COLORS[id] ?? '#AAAAAA',
        ...(task ? { task } : {}),
        ...(energy !== undefined ? { energy } : {}),
      }
    } else {
      existing.state = safeState
      if (name) existing.name = name
      if (task !== undefined) existing.task = task
      if (energy !== undefined) existing.energy = energy
    }
  }

  processAction(opts: {
    agent: string
    action: { type: string; message?: string; state?: string }
  }): void {
    const { agent: id, action } = opts
    const a = this.agents[id]
    if (!a) return
    if (action.type === 'speak' && action.message) {
      a.speechBubble = {
        text: action.message,
        expiresAt: Date.now() + 7_000,
      }
    }
  }

  applyPatch(patch: WorldPatch): void {
    if (patch.tilePatch) {
      for (const { col, row, tile } of patch.tilePatch) {
        if (!Number.isInteger(col) || !Number.isInteger(row) || !Number.isInteger(tile)) continue
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS && tile >= 0 && tile <= 7) {
          this.tilemap[row][col] = tile
        }
      }
    }
    if (patch.agentPatch) {
      for (const [id, delta] of Object.entries(patch.agentPatch)) {
        const existingAgent = this.agents[id]
        if (!existingAgent || !delta) continue

        if (delta.state) {
          // Normalize malformed states to idle
          const safeState = ensureValidState(String(delta.state))
          existingAgent.state = safeState
          delete delta.state
        }

        Object.assign(existingAgent, delta)
      }
    }
  }
}
