import { describe, expect, it } from 'vitest'
import {
  ALL_MAJOR_BODIES,
  MOONS,
  SMALL_BODIES,
  SPACECRAFT,
} from './bodies'
import { JPL_MOONS } from './moonCatalog'

describe('expanded moon catalog', () => {
  it('keeps every moon ID unique', () => {
    expect(new Set(MOONS.map((moon) => moon.id)).size).toBe(MOONS.length)
  })

  it('keeps IDs unique across every searchable object category', () => {
    const ids = [
      ...ALL_MAJOR_BODIES,
      ...MOONS,
      ...SMALL_BODIES,
      ...SPACECRAFT,
    ].map((body) => body.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes the JPL satellite catalog alongside dwarf-planet moons', () => {
    expect(JPL_MOONS.length).toBeGreaterThanOrEqual(459)
    expect(MOONS.length).toBeGreaterThanOrEqual(464)
    expect(MOONS.some((moon) => moon.id === 'amalthea')).toBe(true)
    expect(MOONS.some((moon) => moon.id === 's2025-u-1')).toBe(true)
    expect(MOONS.some((moon) => moon.id === 'dysnomia')).toBe(true)
  })

  it('preserves unknown physical radii instead of inventing values', () => {
    const provisionalMoon = MOONS.find((moon) => moon.id === 's2025-u-1')

    expect(provisionalMoon?.radiusKm).toBeUndefined()
    expect(MOONS.some((moon) => moon.radiusKm === undefined)).toBe(true)
  })

  it('keeps generated periods positive and exposes JPL solution metadata', () => {
    for (const moon of JPL_MOONS) {
      expect(moon.orbitalPeriodDays, moon.id).toBeGreaterThan(0)
      expect(moon.jplCode, moon.id).toBeTruthy()
      expect(moon.ephemeris, moon.id).toBeTruthy()
    }
  })

  it('only assigns moons to tracked parent bodies', () => {
    const parents = new Set([
      ...ALL_MAJOR_BODIES.map((body) => body.id),
      ...SMALL_BODIES.map((body) => body.id),
    ])

    for (const moon of MOONS) {
      expect(parents.has(moon.parentId), moon.id).toBe(true)
    }
  })

  it('includes the new binary and interstellar targets', () => {
    for (const id of ['didymos', 'patroclus', 'oumuamua', 'borisov']) {
      expect(SMALL_BODIES.some((body) => body.id === id), id).toBe(true)
    }
    for (const id of ['dimorphos', 'menoetius']) {
      expect(MOONS.some((moon) => moon.id === id), id).toBe(true)
    }
  })
})
