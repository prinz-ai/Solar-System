import { describe, expect, it } from 'vitest'
import { interpolateHorizonsPosition } from './horizonsEphemeris'

type Dataset = Parameters<typeof interpolateHorizonsPosition>[0]

const start = new Date('2000-01-01T00:00:00Z')
const startJd = start.getTime() / 86_400_000 + 2_440_587.5
const dataset = {
  coverage: ['2000-01-01', '2000-01-03'],
  targets: {
    test: {
      startJd,
      stepDays: 2,
      values: [0, 0, 0, 1, 2, 3, 2, 4, 6, 1, 2, 3],
    },
  },
} as Dataset

describe('Horizons trajectory interpolation', () => {
  it('uses state-vector velocities for smooth intermediate positions', () => {
    expect(
      interpolateHorizonsPosition(
        dataset,
        'test',
        new Date('2000-01-02T00:00:00Z'),
      ),
    ).toEqual([1, 2, 3])
  })

  it('falls back outside the cached date range', () => {
    expect(
      interpolateHorizonsPosition(
        dataset,
        'test',
        new Date('1999-12-31T00:00:00Z'),
      ),
    ).toBeUndefined()
  })
})
