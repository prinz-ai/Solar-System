import { describe, expect, it } from 'vitest'
import { advanceSimulationDate } from './simulationClock'

describe('simulation clock', () => {
  const start = new Date('2026-06-07T12:00:00Z')

  it('fast-forwards using the selected speed', () => {
    const next = advanceSimulationDate(start, 1_000, 86_400, 1)

    expect(next.toISOString()).toBe('2026-06-08T12:00:00.000Z')
  })

  it('rewinds using the selected speed', () => {
    const next = advanceSimulationDate(start, 1_000, 3_600, -1)

    expect(next.toISOString()).toBe('2026-06-07T11:00:00.000Z')
  })
})
