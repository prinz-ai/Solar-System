import { describe, expect, it } from 'vitest'
import { FEATURED_MOONS, PLANETS, SUN } from '../data/bodies'
import {
  getMoonRelativePositionsAu,
  getPlanetSnapshots,
} from './ephemeris'
import {
  calculateShadowEvent,
  computeEclipseEvents,
  type EclipseBody,
} from './eclipses'

const AU_KM = 149_597_870.7

const sun: EclipseBody = {
  id: 'sun',
  name: SUN.name,
  radiusKm: SUN.radiusKm,
  positionAu: [0, 0, 0],
  kind: 'sun',
}

function eclipseEventsAt(date: Date) {
  const planets = getPlanetSnapshots(date, 'true')
  const relativeMoons = getMoonRelativePositionsAu(date, {}, FEATURED_MOONS)
  const bodies: EclipseBody[] = [
    sun,
    ...PLANETS.map((planet) => ({
      id: planet.id,
      name: planet.name,
      radiusKm: planet.radiusKm,
      positionAu: planets[planet.id].positionAu,
      kind: 'planet' as const,
    })),
  ]
  for (const moon of FEATURED_MOONS) {
    if (!moon.radiusKm) continue
    const parent = planets[moon.parentId]
    const relative = relativeMoons[moon.id]
    if (!parent || !relative) continue
    bodies.push({
      id: moon.id,
      name: moon.name,
      radiusKm: moon.radiusKm,
      positionAu: [
        parent.positionAu[0] + relative[0],
        parent.positionAu[1] + relative[1],
        parent.positionAu[2] + relative[2],
      ],
      parentId: moon.parentId,
      kind: 'moon',
    })
  }
  return computeEclipseEvents(bodies)
}

describe('eclipse geometry', () => {
  it('recognizes a total lunar eclipse inside Earth’s umbra', () => {
    const earth: EclipseBody = {
      id: 'earth',
      name: 'Earth',
      radiusKm: 6_371,
      positionAu: [1, 0, 0],
      kind: 'planet',
    }
    const moon: EclipseBody = {
      id: 'moon',
      name: 'Moon',
      radiusKm: 1_737.4,
      positionAu: [1 + 384_400 / AU_KM, 0, 0],
      parentId: 'earth',
      kind: 'moon',
    }

    const event = calculateShadowEvent(sun, earth, moon, 'lunar-eclipse')

    expect(event?.phase).toBe('total')
    expect(event?.coverage).toBeCloseTo(1, 6)
    expect(event?.centerObscuration).toBeCloseTo(1, 6)
    expect(event?.shadowDirection[0]).toBeLessThan(-0.99)
    expect(event?.umbraAngularRadius).toBe(Math.PI)
  })

  it('recognizes a central total solar-eclipse path', () => {
    const earth: EclipseBody = {
      id: 'earth',
      name: 'Earth',
      radiusKm: 6_371,
      positionAu: [1, 0, 0],
      kind: 'planet',
    }
    const moon: EclipseBody = {
      id: 'moon',
      name: 'Moon',
      radiusKm: 1_737.4,
      positionAu: [1 - 360_000 / AU_KM, 0, 0],
      parentId: 'earth',
      kind: 'moon',
    }

    const event = calculateShadowEvent(sun, moon, earth, 'solar-eclipse')

    expect(event?.phase).toBe('total')
    expect(event?.coverage).toBeGreaterThan(0.2)
    expect(event?.centerObscuration).toBeCloseTo(1, 3)
  })

  it('rejects a shadow cone that misses the target', () => {
    const earth: EclipseBody = {
      id: 'earth',
      name: 'Earth',
      radiusKm: 6_371,
      positionAu: [1, 0.02, 0],
      kind: 'planet',
    }
    const moon: EclipseBody = {
      id: 'moon',
      name: 'Moon',
      radiusKm: 1_737.4,
      positionAu: [1 - 360_000 / AU_KM, 0, 0],
      parentId: 'earth',
      kind: 'moon',
    }

    expect(
      calculateShadowEvent(sun, moon, earth, 'solar-eclipse'),
    ).toBeUndefined()
  })

  it('reports mutual moon occultations from their parent', () => {
    const jupiter: EclipseBody = {
      id: 'jupiter',
      name: 'Jupiter',
      radiusKm: 69_911,
      positionAu: [5, 0, 0],
      kind: 'planet',
    }
    const io: EclipseBody = {
      id: 'io',
      name: 'Io',
      radiusKm: 1_821.6,
      positionAu: [5, 421_800 / AU_KM, 0],
      parentId: 'jupiter',
      kind: 'moon',
    }
    const europa: EclipseBody = {
      id: 'europa',
      name: 'Europa',
      radiusKm: 1_560.8,
      positionAu: [5, 671_100 / AU_KM, 0],
      parentId: 'jupiter',
      kind: 'moon',
    }

    const events = computeEclipseEvents([sun, jupiter, io, europa])
    const occultation = events.find(
      (event) => event.type === 'mutual-occultation',
    )

    expect(occultation).toBeDefined()
    expect(occultation?.occluderId).toBe('io')
    expect(occultation?.targetId).toBe('europa')
    expect(occultation?.phase).toBe('total')
  })

  it('recognizes the April 8, 2024 solar eclipse', () => {
    const events = eclipseEventsAt(new Date('2024-04-08T18:17:00Z'))
    const eclipse = events.find(
      (event) =>
        event.type === 'solar-eclipse' &&
        event.occluderId === 'moon' &&
        event.targetId === 'earth',
    )

    expect(eclipse).toBeDefined()
    expect(eclipse?.phase).toBe('total')
    expect(eclipse?.coverage).toBeGreaterThan(0.2)
    expect(eclipse?.centerObscuration).toBeGreaterThan(0.2)
  })

  it('recognizes the March 14, 2025 total lunar eclipse', () => {
    const events = eclipseEventsAt(new Date('2025-03-14T06:59:00Z'))
    const eclipse = events.find(
      (event) =>
        event.type === 'lunar-eclipse' &&
        event.occluderId === 'earth' &&
        event.targetId === 'moon',
    )

    expect(eclipse).toBeDefined()
    expect(eclipse?.phase).toBe('total')
    expect(eclipse?.coverage).toBeCloseTo(1, 3)
  })

  it('finds Galilean moon transits from the live satellite model', () => {
    const start = Date.parse('2026-06-08T00:00:00Z')
    let transit
    for (let hour = 0; hour <= 72 && !transit; hour += 2) {
      transit = eclipseEventsAt(
        new Date(start + hour * 3_600_000),
      ).find(
        (event) =>
          event.type === 'moon-transit' &&
          event.targetId === 'jupiter' &&
          ['io', 'europa', 'ganymede', 'callisto'].includes(
            event.occluderId,
          ),
      )
    }

    expect(transit).toBeDefined()
    expect(transit?.coverage).toBeGreaterThan(0)
  })
})
