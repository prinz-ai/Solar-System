import observation from '../data/generatedEarthObservation.json'

const MAX_OBSERVATION_AGE_MS = 48 * 60 * 60 * 1_000

export interface EarthObservation {
  date: string
  texturePath: string
  sourceUrl: string
  sourceName: string
}

export const EARTH_OBSERVATION = observation satisfies EarthObservation

export function isEarthObservationCurrent(date: Date) {
  const observationTime = Date.parse(`${EARTH_OBSERVATION.date}T12:00:00Z`)
  return Math.abs(date.getTime() - observationTime) <= MAX_OBSERVATION_AGE_MS
}
