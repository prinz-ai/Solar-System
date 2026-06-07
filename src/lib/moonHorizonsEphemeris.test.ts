import { describe, expect, it } from 'vitest'
import {
  interpolateMoonPosition,
  type MoonDataset,
} from './moonHorizonsEphemeris'

const start = new Date('2000-01-01T00:00:00Z')
const startJd = start.getTime() / 86_400_000 + 2_440_587.5
const dataset: MoonDataset = {
  index: {
    coverage: ['2000-01-01', '2000-01-03'],
    stride: 6,
    targets: {
      test: {
        segments: [
          {
            startJd,
            stepDays: 2,
            offset: 0,
            count: 2,
          },
        ],
      },
    },
  },
  values: new Float32Array([0, 0, 0, 1, 2, 3, 2, 4, 6, 1, 2, 3]),
}

describe('moon Horizons interpolation', () => {
  it('interpolates parent-relative state vectors', () => {
    expect(
      interpolateMoonPosition(
        dataset,
        'test',
        new Date('2000-01-02T00:00:00Z'),
      ),
    ).toEqual([1, 2, 3])
  })

  it('returns no vector for untracked moons', () => {
    expect(interpolateMoonPosition(dataset, 'unknown', start)).toBeUndefined()
  })
})
