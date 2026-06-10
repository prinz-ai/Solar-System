import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CONSTELLATIONS,
  getConstellationDirection,
  getConstellationFigure,
  getConstellationFigures,
  searchConstellations,
} from './constellations'
import type { ConstellationFigureData } from './gaiaSky'

const figures = JSON.parse(
  readFileSync(
    new URL(
      '../../public/sky/constellation-figures.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as ConstellationFigureData

function angularDistanceDegrees(
  first: { raDeg: number; decDeg: number },
  second: { raDeg: number; decDeg: number },
) {
  const radians = Math.PI / 180
  const cosine =
    Math.sin(first.decDeg * radians) *
      Math.sin(second.decDeg * radians) +
    Math.cos(first.decDeg * radians) *
      Math.cos(second.decDeg * radians) *
      Math.cos((first.raDeg - second.raDeg) * radians)
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / radians
}

describe('constellation catalog', () => {
  it('contains each of the 88 modern IAU constellations exactly once', () => {
    const catalogIds = CONSTELLATIONS.map(({ id }) => id).sort()
    const figureIds = figures.constellations.map(({ id }) => id).sort()

    expect(CONSTELLATIONS).toHaveLength(88)
    expect(new Set(catalogIds).size).toBe(88)
    expect(figures.constellations).toHaveLength(88)
    expect(new Set(figureIds).size).toBe(88)
    expect(figureIds).toEqual(catalogIds)
  })

  it('searches by name and abbreviation', () => {
    expect(searchConstellations('orion').map(({ id }) => id)).toEqual(['ORI'])
    expect(searchConstellations('uma').map(({ id }) => id)).toEqual(['UMA'])
  })

  it('uses the audited Western Sky & Telescope figure set', () => {
    expect(figures.culture).toBe('Western (Sky & Telescope)')
    expect(figures.license).toBe('CC BY-SA 2.0')
    expect(
      figures.constellations.reduce(
        (count, figure) => count + figure.paths.length,
        0,
      ),
    ).toBe(209)
    expect(
      new Set(
        figures.constellations.flatMap((figure) =>
          figure.paths.flatMap((path) =>
            path.stars.map((star) => star.hip),
          ),
        ),
      ).size,
    ).toBe(746)
  })

  it('gives every figure valid stars, paths, and plausible segment lengths', () => {
    for (const constellation of CONSTELLATIONS) {
      const figure = getConstellationFigure(figures, constellation.id)
      expect(figure, constellation.name).toBeDefined()
      expect(figure?.paths.length, constellation.name).toBeGreaterThan(0)

      for (const path of figure?.paths ?? []) {
        expect(['bold', 'normal', 'thin']).toContain(path.style)
        expect(path.stars.length).toBeGreaterThanOrEqual(2)
        for (const star of path.stars) {
          expect(Number.isFinite(star.hip)).toBe(true)
          expect(Number.isFinite(star.raDeg)).toBe(true)
          expect(Number.isFinite(star.decDeg)).toBe(true)
          expect(Number.isFinite(star.magnitude)).toBe(true)
          expect(Number.isFinite(star.bv)).toBe(true)
        }
        for (let index = 1; index < path.stars.length; index += 1) {
          expect(path.stars[index].hip).not.toBe(path.stars[index - 1].hip)
          expect(
            angularDistanceDegrees(
              path.stars[index - 1],
              path.stars[index],
            ),
            `${constellation.name} segment ${index}`,
          ).toBeLessThan(30)
        }
      }
    }
  })

  it('uses the familiar Big Dipper as the bold Ursa Major backbone', () => {
    const boldPath = getConstellationFigure(figures, 'UMA')?.paths.find(
      ({ style }) => style === 'bold',
    )
    expect(boldPath?.stars.map(({ hip }) => hip)).toEqual([
      59774, 54061, 53910, 58001, 59774, 62956, 65378, 67301,
    ])
  })

  it('returns multiple independently selected figures', () => {
    expect(
      getConstellationFigures(figures, ['ORI', 'UMA', 'CAS']).map(
        ({ id }) => id,
      ),
    ).toEqual(['CAS', 'ORI', 'UMA'])
  })

  it('computes a normalized direction for camera focus', () => {
    const direction = getConstellationDirection(figures, 'ORI')
    expect(direction).toBeDefined()
    expect(Math.hypot(...(direction ?? [0, 0, 0]))).toBeCloseTo(1)
    expect(getConstellationDirection(figures, 'INVALID')).toBeUndefined()
  })
})
