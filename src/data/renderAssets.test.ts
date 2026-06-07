import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOONS, PLANETS, SMALL_BODIES, SPACECRAFT } from './bodies'
import { BODY_RENDER_ASSETS } from './renderAssets'

const knownIds = new Set([
  ...PLANETS.map((body) => body.id),
  ...MOONS.map((body) => body.id),
  ...SMALL_BODIES.map((body) => body.id),
  ...SPACECRAFT.map((body) => body.id),
])

describe('detailed render assets', () => {
  it('maps only tracked objects to files that exist', () => {
    for (const [id, asset] of Object.entries(BODY_RENDER_ASSETS)) {
      expect(knownIds.has(id), `${id} is not in the tracked catalog`).toBe(true)
      expect(
        existsSync(
          join(process.cwd(), 'public', asset.path.replace(/^\//, '')),
        ),
        `${asset.path} is missing`,
      ).toBe(true)
      if (asset.texturePath) {
        expect(
          existsSync(
            join(
              process.cwd(),
              'public',
              asset.texturePath.replace(/^\//, ''),
            ),
          ),
          `${asset.texturePath} is missing`,
        ).toBe(true)
      }
    }
  })

  it('uses the upgraded terrain and dense shape assets', () => {
    for (const id of [
      'moon',
      'mercury',
      'enceladus',
      'ceres',
      'vesta',
      'bennu',
      'ryugu',
      'eros',
    ]) {
      expect(BODY_RENDER_ASSETS[id]).toBeDefined()
    }
    for (const id of ['mercury', 'enceladus', 'ceres', 'vesta']) {
      expect(BODY_RENDER_ASSETS[id]?.texturePath).toBeDefined()
    }
  })

  it('includes the added spacecraft flyby targets', () => {
    for (const id of [
      'itokawa',
      'arrokoth',
      'lutetia',
      'steins',
      'gaspra',
      'ida',
    ]) {
      expect(SMALL_BODIES.some((body) => body.id === id)).toBe(true)
      expect(BODY_RENDER_ASSETS[id]).toBeDefined()
    }
  })

  it('uses mission geometry for the mapped comets and probes', () => {
    for (const id of [
      '67p',
      'tempel-1',
      'wild-2',
      'voyager-1',
      'voyager-2',
      'new-horizons',
    ]) {
      expect(BODY_RENDER_ASSETS[id]).toBeDefined()
    }
  })

  it('uses NASA atmospheric models for both ice giants', () => {
    for (const id of ['uranus', 'neptune']) {
      expect(BODY_RENDER_ASSETS[id]?.coverage).toBe(
        'NASA atmospheric composite',
      )
    }
    expect(PLANETS.find((body) => body.id === 'neptune')?.hasRings).toBe(true)
  })

  it('identifies both Pioneer probes as reference reconstructions', async () => {
    const { getRenderCoverage } = await import('./renderAssets')
    expect(getRenderCoverage('pioneer-10')).toBe(
      'NASA-reference reconstruction',
    )
    expect(getRenderCoverage('pioneer-11')).toBe(
      'NASA-reference reconstruction',
    )
  })
})
