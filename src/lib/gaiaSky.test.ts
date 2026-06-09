import { describe, expect, it } from 'vitest'
import {
  apparentGaiaDirection,
  gaiaColorFromBpRp,
  yearsSinceGaiaEpoch,
} from './gaiaSky'

describe('Gaia sky projection', () => {
  it('uses the Gaia DR3 reference epoch', () => {
    expect(
      yearsSinceGaiaEpoch(new Date('2016-01-01T00:00:00Z')),
    ).toBeCloseTo(0, 4)
    expect(
      yearsSinceGaiaEpoch(
        new Date(Date.parse('2016-01-01T00:00:00Z') + 365.25 * 10 * 86_400_000),
      ),
    ).toBeCloseTo(10, 6)
  })

  it('maps Gaia BP-RP color from blue to red', () => {
    const blue = gaiaColorFromBpRp(-0.4)
    const red = gaiaColorFromBpRp(2.5)
    expect(blue[2]).toBeGreaterThan(blue[0])
    expect(red[0]).toBeGreaterThan(red[2])
  })

  it('applies proper motion and observer parallax', () => {
    const star = new Float32Array([
      0,
      0,
      1_000,
      0,
      3_600_000,
      5,
      0.8,
    ])
    const atEpoch = apparentGaiaDirection(
      star,
      0,
      new Date('2016-01-01T00:00:00Z'),
      [0, 0, 0],
    )
    const oneYearLater = apparentGaiaDirection(
      star,
      0,
      new Date('2017-01-01T00:00:00Z'),
      [0, 0, 0],
    )
    const displacedObserver = apparentGaiaDirection(
      star,
      0,
      new Date('2016-01-01T00:00:00Z'),
      [0, 100, 0],
    )

    expect(oneYearLater[1]).toBeGreaterThan(atEpoch[1])
    expect(displacedObserver[1]).toBeLessThan(atEpoch[1])
  })
})
