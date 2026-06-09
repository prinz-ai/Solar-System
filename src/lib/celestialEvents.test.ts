import { describe, expect, it } from 'vitest'
import { findUpcomingCelestialEvents } from './celestialEvents'

describe('celestial event director', () => {
  const events = findUpcomingCelestialEvents(
    new Date('2026-06-08T00:00:00Z'),
  )

  it('returns chronologically sorted cinematic targets', () => {
    expect(events.length).toBeGreaterThanOrEqual(5)
    expect(
      events.every(
        (event, index) =>
          index === 0 ||
          event.date.getTime() >= events[index - 1].date.getTime(),
      ),
    ).toBe(true)
    expect(events.every((event) => event.targetIds.length > 0)).toBe(true)
  })

  it('includes the August 2026 solar and lunar eclipses', () => {
    const solar = events.find((event) => event.kind === 'solar-eclipse')
    const lunar = events.find((event) => event.kind === 'lunar-eclipse')

    expect(solar?.date.toISOString().slice(0, 10)).toBe('2026-08-12')
    expect(lunar?.date.toISOString().slice(0, 10)).toBe('2026-08-28')
  })

  it('finds a Galilean moon transit near the selected date', () => {
    const transit = events.find((event) => event.kind === 'moon-transit')

    expect(transit).toBeDefined()
    expect(transit?.focusId).toBe('jupiter')
    expect(transit?.targetIds).toContain('jupiter')
  })
})
