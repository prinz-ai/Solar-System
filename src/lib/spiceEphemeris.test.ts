import { describe, expect, it } from 'vitest'
import {
  eclipticStateToSceneAu,
  isSpiceDateSupported,
} from './spiceEphemeris'

const AU_KM = 149_597_870.7

describe('SPICE ephemeris coordinates', () => {
  it('maps the ECLIPJ2000 axes into the scene coordinate system', () => {
    expect(
      eclipticStateToSceneAu([
        AU_KM,
        AU_KM * 2,
        AU_KM * 3,
        0,
        0,
        0,
      ]),
    ).toEqual([1, 3, -2])
  })

  it('enforces the compact DE442 kernel coverage', () => {
    expect(isSpiceDateSupported(new Date('1550-01-01T00:00:00Z'))).toBe(true)
    expect(isSpiceDateSupported(new Date('2026-06-07T12:00:00Z'))).toBe(true)
    expect(isSpiceDateSupported(new Date('2650-01-01T00:00:00Z'))).toBe(true)
    expect(isSpiceDateSupported(new Date('1549-12-31T23:59:59Z'))).toBe(false)
    expect(isSpiceDateSupported(new Date('2650-01-01T00:00:01Z'))).toBe(false)
  })
})
