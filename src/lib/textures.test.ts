import { describe, expect, it } from 'vitest'
import {
  getCloudLayerDefinition,
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
})

describe('mapped moons', () => {
  it('includes the requested global moon mosaics', () => {
    for (const id of [
      'io',
      'europa',
      'ganymede',
      'callisto',
      'phobos',
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
})
