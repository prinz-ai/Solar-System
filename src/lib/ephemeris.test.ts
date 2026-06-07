import { describe, expect, it } from 'vitest'
import { SMALL_BODIES, SPACECRAFT } from '../data/bodies'
import {
  bodyOrientationBasis,
  bodyRotationAngle,
  earthOrientationBasis,
  earthSurfaceDirection,
  getMoonScenePositions,
  getPlanetSnapshots,
  magnitude,
  mapAuToScene,
  orbitalPositionAu,
  scaleDistance,
  spacecraftPositionAu,
  synchronousOrientationBasis,
} from './ephemeris'

describe('body rotation', () => {
  it('builds an orthonormal Earth orientation basis', () => {
    const [greenwich, north, west] = earthOrientationBasis(
      new Date('2026-06-07T14:00:00Z'),
    )
    const dot = (a: number[], b: number[]) =>
      a.reduce((sum, value, index) => sum + value * b[index], 0)

    expect(Math.hypot(...greenwich)).toBeCloseTo(1, 8)
    expect(Math.hypot(...north)).toBeCloseTo(1, 8)
    expect(Math.hypot(...west)).toBeCloseTo(1, 8)
    expect(dot(greenwich, north)).toBeCloseTo(0, 8)
    expect(dot(greenwich, west)).toBeCloseTo(0, 8)
    expect(dot(north, west)).toBeCloseTo(0, 8)

    const crossGreenwichNorth = [
      greenwich[1] * north[2] - greenwich[2] * north[1],
      greenwich[2] * north[0] - greenwich[0] * north[2],
      greenwich[0] * north[1] - greenwich[1] * north[0],
    ]
    expect(dot(crossGreenwichNorth, west)).toBeCloseTo(1, 8)
  })

  it('places opposite Earth longitudes on opposite sides', () => {
    const date = new Date('2026-06-07T14:00:00Z')
    const east = earthSurfaceDirection(date, 0, 90)
    const west = earthSurfaceDirection(date, 0, -90)
    const dot = east.reduce(
      (sum, value, index) => sum + value * west[index],
      0,
    )

    expect(dot).toBeCloseTo(-1, 8)
  })

  it('updates Jupiter prime-meridian orientation with time', () => {
    const start = bodyOrientationBasis(
      'jupiter',
      new Date('2026-06-07T14:00:00Z'),
    )[0]
    const later = bodyOrientationBasis(
      'jupiter',
      new Date('2026-06-07T15:00:00Z'),
    )[0]
    const dot = start.reduce(
      (sum, value, index) => sum + value * later[index],
      0,
    )

    expect(dot).toBeLessThan(0.9)
  })

  it('keeps a synchronous moon prime meridian pointed at its parent', () => {
    const body: [number, number, number] = [2, 1, -4]
    const parent: [number, number, number] = [1, 1, -4]
    const [primeMeridian] = synchronousOrientationBasis(
      body,
      parent,
      'jupiter',
      new Date('2026-06-07T14:00:00Z'),
    )

    expect(primeMeridian).toEqual([-1, 0, 0])
  })

  it('orients a moon whose dwarf-planet parent has no rotation model', () => {
    const basis = synchronousOrientationBasis(
      [4, 1, -2],
      [3, 1, -2],
      'eris',
      new Date('2026-06-07T15:00:00Z'),
    )

    expect(basis.flat().every(Number.isFinite)).toBe(true)
  })

  it('advances a body by one turn over its rotation period', () => {
    const start = new Date('2000-01-01T12:00:00Z')
    const end = new Date(start.getTime() + 23.934 * 3_600_000)

    expect(bodyRotationAngle(23.934, end) - bodyRotationAngle(23.934, start))
      .toBeCloseTo(-Math.PI * 2, 8)
  })
})

describe('planet ephemerides', () => {
  const date = new Date('2026-06-07T12:00:00Z')

  it('returns physically sensible heliocentric distances', () => {
    const planets = getPlanetSnapshots(date, 'true')
    expect(planets.mercury.distanceAu).toBeGreaterThan(0.3)
    expect(planets.mercury.distanceAu).toBeLessThan(0.5)
    expect(planets.earth.distanceAu).toBeGreaterThan(0.98)
    expect(planets.earth.distanceAu).toBeLessThan(1.02)
    expect(planets.neptune.distanceAu).toBeGreaterThan(29)
    expect(planets.neptune.distanceAu).toBeLessThan(31)
    expect(planets.pluto.distanceAu).toBeGreaterThan(28)
    expect(planets.pluto.distanceAu).toBeLessThan(50)
  })

  it('moves Pluto forward when simulation time changes', () => {
    const start = getPlanetSnapshots(date, 'true').pluto.positionAu
    const later = getPlanetSnapshots(
      new Date('2026-09-07T12:00:00Z'),
      'true',
    ).pluto.positionAu
    const delta = magnitude([
      later[0] - start[0],
      later[1] - start[1],
      later[2] - start[2],
    ])
    expect(delta).toBeGreaterThan(0.05)
  })
})

describe('display scale', () => {
  it('preserves direction while compressing outer distances', () => {
    const mapped = mapAuToScene([30, 0, 0], 'explore')
    expect(mapped[1]).toBe(0)
    expect(mapped[2]).toBe(0)
    expect(mapped[0]).toBe(scaleDistance(30, 'explore'))
    expect(mapped[0]).toBeLessThan(scaleDistance(30, 'true'))
  })

  it('keeps true distance scale linear', () => {
    expect(scaleDistance(2, 'true')).toBeCloseTo(
      scaleDistance(1, 'true') * 2,
    )
  })

  it('keeps ring-moon close views outside the displayed ring system', () => {
    const date = new Date('2026-06-07T12:00:00Z')
    const planets = getPlanetSnapshots(date, 'explore')
    const moons = getMoonScenePositions(date, 'explore', planets, {
      enceladus: [238_042 / 149_597_870.7, 0, 0],
    })
    const saturn = planets.saturn.scenePosition
    const offset = magnitude([
      moons.enceladus[0] - saturn[0],
      moons.enceladus[1] - saturn[1],
      moons.enceladus[2] - saturn[2],
    ])

    expect(offset).toBeGreaterThan(0.82 * 2.26)
  })
})

describe('small-body orbital elements', () => {
  it('includes all five IAU-recognized dwarf planets across the model', () => {
    const modeledDwarfs = [
      'pluto',
      ...SMALL_BODIES.filter((body) => body.kind === 'dwarf').map(
        (body) => body.id,
      ),
    ]
    expect(modeledDwarfs).toEqual([
      'pluto',
      'ceres',
      'haumea',
      'makemake',
      'eris',
    ])
  })

  it('places Halley at perihelion at its element epoch', () => {
    const halley = SMALL_BODIES.find((body) => body.id === 'halley')!
    const epochDate = new Date((halley.epochJd - 2_440_587.5) * 86_400_000)
    const position = orbitalPositionAu(halley, epochDate)
    expect(magnitude(position)).toBeCloseTo(
      halley.semiMajorAxisAu * (1 - halley.eccentricity),
      4,
    )
  })

  it('solves highly eccentric long-period comet orbits', () => {
    const neowise = SMALL_BODIES.find((body) => body.id === 'neowise')!
    const position = orbitalPositionAu(
      neowise,
      new Date('2026-06-07T00:00:00Z'),
    )
    expect(position.every(Number.isFinite)).toBe(true)
    expect(magnitude(position)).toBeGreaterThan(1)
  })

  it('keeps every tracked small-body orbit finite at the current epoch', () => {
    const date = new Date('2026-06-07T00:00:00Z')
    for (const body of SMALL_BODIES) {
      expect(
        orbitalPositionAu(body, date).every(Number.isFinite),
        body.name,
      ).toBe(true)
    }
  })
})

describe('spacecraft trajectory estimates', () => {
  it('moves Voyager 1 farther from the Sun over time', () => {
    const voyager = SPACECRAFT.find((craft) => craft.id === 'voyager-1')!
    const distance2026 = magnitude(
      spacecraftPositionAu(voyager, new Date('2026-01-01T00:00:00Z')),
    )
    const distance2036 = magnitude(
      spacecraftPositionAu(voyager, new Date('2036-01-01T00:00:00Z')),
    )
    expect(distance2036 - distance2026).toBeCloseTo(
      voyager.speedAuPerYear * 10,
      1,
    )
  })
})
