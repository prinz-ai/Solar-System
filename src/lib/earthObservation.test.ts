import { describe, expect, it } from 'vitest'
import {
  EARTH_OBSERVATION,
  isEarthObservationCurrent,
} from './earthObservation'

describe('dated Earth observation', () => {
  it('is used only near its acquisition date', () => {
    expect(
      isEarthObservationCurrent(
        new Date(`${EARTH_OBSERVATION.date}T12:00:00Z`),
      ),
    ).toBe(true)
    expect(isEarthObservationCurrent(new Date('2025-01-01T00:00:00Z'))).toBe(
      false,
    )
  })
})
