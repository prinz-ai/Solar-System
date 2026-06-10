import { describe, expect, it } from 'vitest'
import { searchObjects, type SearchableObject } from './objectSearch'

const objects: SearchableObject[] = [
  { id: 'earth', name: 'Earth', kind: 'planet' },
  { id: 'moon', name: 'Moon', kind: 'moon', parentName: 'Earth' },
  { id: 's2025-s-1', name: 'S2025_S_1', kind: 'moon', parentName: 'Saturn' },
  { id: 'voyager-1', name: 'Voyager 1', kind: 'probe' },
]

describe('object search', () => {
  it('prioritizes exact and prefix name matches', () => {
    expect(searchObjects(objects, 'moon').map((object) => object.id)).toEqual([
      'moon',
    ])
  })

  it('finds provisional moon designations through punctuation changes', () => {
    expect(searchObjects(objects, 's 2025 s 1').map((object) => object.id)).toEqual([
      's2025-s-1',
    ])
  })

  it('finds objects by parent name', () => {
    expect(searchObjects(objects, 'saturn').map((object) => object.id)).toEqual([
      's2025-s-1',
    ])
  })

  it('matches terms across an object name and its parent', () => {
    expect(
      searchObjects(objects, 'saturn 2025').map((object) => object.id),
    ).toEqual(['s2025-s-1'])
  })

  it('enforces the result limit', () => {
    expect(searchObjects(objects, 'a', 1)).toHaveLength(1)
  })
})
