import { describe, it, expect } from 'vitest'
import { extractPatch } from '../llm.js'

describe('LLM extractPatch', () => {
  it('parses valid JSON patch with extra prose around it', () => {
    const raw = 'Here is the update:\n{ "message": "update", "tilePatch": [{ "col": 2, "row": 2, "tile": 5 }] }\nDone.'
    const patch = extractPatch(raw)
    expect(patch).not.toBeNull()
    expect(patch?.message).toBe('update')
    expect(patch?.tilePatch?.[0]).toEqual({ col: 2, row: 2, tile: 5 })
  })

  it('ignores invalid tilePatch entries', () => {
    const raw = '{ "tilePatch": [{ "col": -1, "row": 0, "tile": 3 }, { "col": 0, "row": 0, "tile": 9 }] }'
    const patch = extractPatch(raw)
    expect(patch?.tilePatch).toEqual([])
  })

  it('returns null for non-JSON text', () => {
    expect(extractPatch('No json here')).toBeNull()
  })
})