import { describe, it, expect } from 'vitest'
import { World } from '../world.js'

describe('World', () => {
  it('creates unknown agent with safe defaults', () => {
    const world = new World()
    world.updateAgent({ agent: 'newbie', state: 'working', task: 'onboarding', energy: 45 })

    const snapshot = world.snapshot()
    expect(snapshot.agents.newbie).toBeDefined()
    expect(snapshot.agents.newbie.state).toBe('working')
    expect(snapshot.agents.newbie.energy).toBe(45)
  })

  it('normalizes invalid state to idle', () => {
    const world = new World()
    world.updateAgent({ agent: 'frontend', state: 'glitch' as any })

    const snapshot = world.snapshot()
    expect(snapshot.agents.frontend.state).toBe('idle')
  })

  it('applies tilePatch only with valid coordinates', () => {
    const world = new World()
    world.applyPatch({ tilePatch: [{ col: 1, row: 1, tile: 3 }, { col: 99, row: 99, tile: 2 }] })
    const snapshot = world.snapshot()

    expect(snapshot.tilemap[1][1]).toBe(3)
    expect(snapshot.tilemap[1][2]).not.toBe(2) // no-op out-of-range
  })
})