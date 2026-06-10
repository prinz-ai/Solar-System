import { describe, expect, it } from 'vitest'
import {
  getCloudLayerDefinition,
  getContextSurfaceTextureId,
  getSurfaceReliefDefinition,
  hasBodyTexture,
  usesWestLongitudeTexture,
} from './textures'

describe('planetary cloud layers', () => {
  it('adds representative clouds to atmospheric planets', () => {
    for (const id of [
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
    ]) {
      expect(getCloudLayerDefinition(id)).toBeDefined()
    }
  })

  it('keeps airless planets and dwarf planets cloud-free', () => {
    for (const id of [
      'mercury',
      'pluto',
      'ceres',
      'haumea',
      'makemake',
      'eris',
    ]) {
      expect(getCloudLayerDefinition(id)).toBeUndefined()
    }
  })

  it('uses a persistent high-detail Earth cloud texture', () => {
    expect(hasBodyTexture('earth-clouds')).toBe(true)
    expect(getCloudLayerDefinition('earth')?.opacity).toBe(1)
  })

  it('gives Uranus a visible observation-inspired atmospheric layer', () => {
    expect(getCloudLayerDefinition('uranus')?.opacity).toBeGreaterThan(0.4)
  })
})

describe('mapped moons', () => {
  it('includes the requested global moon mosaics', () => {
    for (const id of [
      'io',
      'europa',
      'ganymede',
      'callisto',
      'phobos',
      'moon',
      'titan',
    ]) {
      expect(hasBodyTexture(id)).toBe(true)
    }
  })

  it('preserves the source maps longitude handedness', () => {
    expect(usesWestLongitudeTexture('phobos')).toBe(false)
    for (const id of ['io', 'europa', 'ganymede', 'callisto', 'titan']) {
      expect(usesWestLongitudeTexture(id)).toBe(true)
    }
  })

  it('adds relief-aware close views for the major mapped moons', () => {
    for (const id of [
      'moon',
      'io',
      'europa',
      'ganymede',
      'callisto',
      'titan',
    ]) {
      expect(getSurfaceReliefDefinition(id)).toBeDefined()
      expect(
        hasBodyTexture(getSurfaceReliefDefinition(id)!.textureId),
      ).toBe(true)
    }
  })

  it('provides efficient surface maps for moons shown with their parent', () => {
    expect(getContextSurfaceTextureId('moon')).toBe('moon')
    expect(getContextSurfaceTextureId('io')).toBe('io-context')
    expect(getContextSurfaceTextureId('europa')).toBe('europa')
    expect(getContextSurfaceTextureId('ganymede')).toBe('ganymede-context')
    expect(getContextSurfaceTextureId('callisto')).toBe('callisto-context')
    expect(getContextSurfaceTextureId('titan')).toBe('titan')
    expect(getContextSurfaceTextureId('mimas')).toBeUndefined()

    for (const id of [
      'moon',
      'io-context',
      'europa',
      'ganymede-context',
      'callisto-context',
      'titan',
    ]) {
      expect(hasBodyTexture(id)).toBe(true)
    }
  })
})
