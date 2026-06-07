import { describe, expect, it } from 'vitest'
import { getCloudLayerDefinition } from './textures'

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
