import { describe, expect, it } from 'vitest'
import {
  ALL_MAJOR_BODIES,
  MOONS,
  SMALL_BODIES,
  SPACECRAFT,
} from './bodies'
import { getObjectDataSource, OBJECT_DATA_SOURCES } from './dataSources'

const trackedIds = [
  ...ALL_MAJOR_BODIES,
  ...MOONS,
  ...SMALL_BODIES,
  ...SPACECRAFT,
].map((body) => body.id)

describe('object data sources', () => {
  it('provides an official source link for every selectable object', () => {
    for (const id of trackedIds) {
      const source = getObjectDataSource(id)
      expect(source, `${id} is missing source attribution`).toBeDefined()
      expect(source?.title.length).toBeGreaterThan(4)
      expect(source?.organization.length).toBeGreaterThan(4)
      expect(source?.url).toMatch(/^https:\/\//)
    }
  })

  it('does not contain entries for objects outside the tracked catalog', () => {
    const tracked = new Set(trackedIds)
    for (const id of Object.keys(OBJECT_DATA_SOURCES)) {
      expect(tracked.has(id), `${id} is not selectable`).toBe(true)
    }
  })

  it('links upgraded terrain and shape models to their primary archives', () => {
    expect(getObjectDataSource('mercury')?.organization).toContain('USGS')
    expect(getObjectDataSource('bennu')?.url).toContain('sbnarchive.psi.edu')
    expect(getObjectDataSource('ryugu')?.organization).toContain('JAXA')
    expect(getObjectDataSource('67p')?.organization).toContain(
      'European Space Agency',
    )
  })
})
