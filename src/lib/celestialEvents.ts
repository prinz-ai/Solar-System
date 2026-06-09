import {
  Body,
  GeoVector,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  SearchRelativeLongitude,
  SearchTransit,
} from 'astronomy-engine'
import { FEATURED_MOONS, PLANETS, SUN } from '../data/bodies'
import type { Vec3 } from '../types'
import {
  getMoonRelativePositionsAu,
  getPlanetSnapshots,
} from './ephemeris'
import {
  calculateShadowEvent,
  type EclipseBody,
  type EclipseEvent,
} from './eclipses'

export type CelestialEventKind =
  | 'solar-eclipse'
  | 'lunar-eclipse'
  | 'conjunction'
  | 'opposition'
  | 'planetary-transit'
  | 'moon-transit'

export interface CelestialEventGuide {
  id: string
  kind: CelestialEventKind
  title: string
  subtitle: string
  date: Date
  focusId: string
  targetIds: string[]
  closeView: boolean
  accent: string
}

const DAY_MS = 86_400_000
const PLANET_BODIES = new Map<string, Body>([
  ['mercury', Body.Mercury],
  ['venus', Body.Venus],
  ['mars', Body.Mars],
  ['jupiter', Body.Jupiter],
  ['saturn', Body.Saturn],
  ['uranus', Body.Uranus],
  ['neptune', Body.Neptune],
])
const CONJUNCTION_PAIRS = [
  ['mercury', 'venus'],
  ['venus', 'mars'],
  ['mars', 'jupiter'],
  ['jupiter', 'saturn'],
  ['saturn', 'uranus'],
] as const
const GALILEAN_MOON_IDS = new Set(['io', 'europa', 'ganymede', 'callisto'])

function vectorAngleDegrees(a: Vec3, b: Vec3) {
  const denominator = Math.hypot(...a) * Math.hypot(...b)
  if (denominator === 0) return 180
  const cosine = Math.min(
    1,
    Math.max(
      -1,
      (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / denominator,
    ),
  )
  return (Math.acos(cosine) * 180) / Math.PI
}

function geocentricVector(id: string, date: Date): Vec3 {
  const body = PLANET_BODIES.get(id)
  if (!body) return [0, 0, 0]
  const vector = GeoVector(body, date, true)
  return [vector.x, vector.y, vector.z]
}

function separationAt(firstId: string, secondId: string, date: Date) {
  return vectorAngleDegrees(
    geocentricVector(firstId, date),
    geocentricVector(secondId, date),
  )
}

function refineMinimum(
  firstId: string,
  secondId: string,
  centerTime: number,
) {
  let lower = centerTime - DAY_MS
  let upper = centerTime + DAY_MS
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const first = lower + (upper - lower) / 3
    const second = upper - (upper - lower) / 3
    if (
      separationAt(firstId, secondId, new Date(first)) <
      separationAt(firstId, secondId, new Date(second))
    ) {
      upper = second
    } else {
      lower = first
    }
  }
  const time = (lower + upper) / 2
  return {
    date: new Date(time),
    separation: separationAt(firstId, secondId, new Date(time)),
  }
}

function findConjunctions(start: Date) {
  const events: CelestialEventGuide[] = []
  const startTime = start.getTime()
  const endTime = startTime + 4 * 365.256 * DAY_MS

  for (const [firstId, secondId] of CONJUNCTION_PAIRS) {
    let previous = separationAt(
      firstId,
      secondId,
      new Date(startTime),
    )
    let current = separationAt(
      firstId,
      secondId,
      new Date(startTime + DAY_MS),
    )
    for (
      let time = startTime + 2 * DAY_MS;
      time <= endTime;
      time += DAY_MS
    ) {
      const next = separationAt(firstId, secondId, new Date(time))
      if (current < previous && current <= next && current < 8) {
        const refined = refineMinimum(firstId, secondId, time - DAY_MS)
        const first = PLANETS.find((planet) => planet.id === firstId)!
        const second = PLANETS.find((planet) => planet.id === secondId)!
        events.push({
          id: `conjunction:${firstId}:${secondId}:${refined.date.toISOString()}`,
          kind: 'conjunction',
          title: `${first.name}–${second.name} conjunction`,
          subtitle: `${refined.separation.toFixed(2)}° apparent separation from Earth`,
          date: refined.date,
          focusId: firstId,
          targetIds: [firstId, secondId],
          closeView: false,
          accent: '#9ddfff',
        })
        break
      }
      previous = current
      current = next
    }
  }

  return events
}

function eclipseBodyAt(
  id: string,
  name: string,
  radiusKm: number,
  positionAu: Vec3,
  kind: EclipseBody['kind'],
  parentId?: string,
): EclipseBody {
  return { id, name, radiusKm, positionAu, kind, parentId }
}

function galileanTransitAt(date: Date): EclipseEvent | undefined {
  const planets = getPlanetSnapshots(date, 'true')
  const jupiter = PLANETS.find((planet) => planet.id === 'jupiter')!
  const sun = eclipseBodyAt(
    'sun',
    SUN.name,
    SUN.radiusKm,
    [0, 0, 0],
    'sun',
  )
  const target = eclipseBodyAt(
    'jupiter',
    jupiter.name,
    jupiter.radiusKm,
    planets.jupiter.positionAu,
    'planet',
  )
  const moons = FEATURED_MOONS.filter((moon) =>
    GALILEAN_MOON_IDS.has(moon.id),
  )
  const relative = getMoonRelativePositionsAu(date, {}, moons)

  for (const moon of moons) {
    if (!moon.radiusKm) continue
    const offset = relative[moon.id]
    const event = calculateShadowEvent(
      sun,
      eclipseBodyAt(
        moon.id,
        moon.name,
        moon.radiusKm,
        [
          target.positionAu[0] + offset[0],
          target.positionAu[1] + offset[1],
          target.positionAu[2] + offset[2],
        ],
        'moon',
        'jupiter',
      ),
      target,
      'moon-transit',
    )
    if (event) return event
  }
  return undefined
}

function findGalileanTransit(start: Date) {
  const stepMs = 20 * 60_000
  const endTime = start.getTime() + 16 * DAY_MS
  let firstEvent: EclipseEvent | undefined
  let firstTime = 0
  for (
    let time = start.getTime();
    time <= endTime;
    time += stepMs
  ) {
    const event = galileanTransitAt(new Date(time))
    if (!event) continue
    firstEvent = event
    firstTime = time
    break
  }
  if (!firstEvent) return undefined

  let peakEvent = firstEvent
  let peakTime = firstTime
  for (
    let time = firstTime;
    time <= firstTime + 5 * 3_600_000;
    time += 5 * 60_000
  ) {
    const event = galileanTransitAt(new Date(time))
    if (
      event?.occluderId === firstEvent.occluderId &&
      event.centerObscuration > peakEvent.centerObscuration
    ) {
      peakEvent = event
      peakTime = time
    }
  }

  return {
    id: `moon-transit:${peakEvent.occluderId}:${new Date(peakTime).toISOString()}`,
    kind: 'moon-transit',
    title: `${peakEvent.occluderName} transit of Jupiter`,
    subtitle: 'Galilean moon and shadow cross Jupiter’s disk',
    date: new Date(peakTime),
    focusId: 'jupiter',
    targetIds: ['jupiter', peakEvent.occluderId],
    closeView: true,
    accent: '#ffd08b',
  } satisfies CelestialEventGuide
}

function oppositionEvent(id: 'mars' | 'jupiter' | 'saturn', start: Date) {
  const body = PLANET_BODIES.get(id)!
  const date = SearchRelativeLongitude(body, 0, start).date
  const planet = PLANETS.find((candidate) => candidate.id === id)!
  return {
    id: `opposition:${id}:${date.toISOString()}`,
    kind: 'opposition',
    title: `${planet.name} at opposition`,
    subtitle: `${planet.name} and the Sun lie opposite each other in Earth’s sky`,
    date,
    focusId: id,
    targetIds: [id, 'earth'],
    closeView: false,
    accent: planet.accent,
  } satisfies CelestialEventGuide
}

export function findUpcomingCelestialEvents(start: Date) {
  const solar = SearchGlobalSolarEclipse(start)
  const lunar = SearchLunarEclipse(start)
  const mercuryTransit = SearchTransit(Body.Mercury, start)
  const events: CelestialEventGuide[] = [
    {
      id: `solar-eclipse:${solar.peak.date.toISOString()}`,
      kind: 'solar-eclipse',
      title: `${solar.kind.toUpperCase()} SOLAR ECLIPSE`,
      subtitle:
        solar.latitude !== undefined && solar.longitude !== undefined
          ? `Shadow center near ${Math.abs(solar.latitude).toFixed(1)}°${solar.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(solar.longitude).toFixed(1)}°${solar.longitude >= 0 ? 'E' : 'W'}`
          : 'The Moon’s shadow crosses Earth',
      date: solar.peak.date,
      focusId: 'earth',
      targetIds: ['earth', 'moon'],
      closeView: true,
      accent: '#fff0a6',
    },
    {
      id: `lunar-eclipse:${lunar.peak.date.toISOString()}`,
      kind: 'lunar-eclipse',
      title: `${lunar.kind.toUpperCase()} LUNAR ECLIPSE`,
      subtitle: `${(lunar.obscuration * 100).toFixed(1)}% umbral obscuration at peak`,
      date: lunar.peak.date,
      focusId: 'moon',
      targetIds: ['earth', 'moon'],
      closeView: true,
      accent: '#ff8f6b',
    },
    {
      id: `planetary-transit:mercury:${mercuryTransit.peak.date.toISOString()}`,
      kind: 'planetary-transit',
      title: 'Mercury transit of the Sun',
      subtitle: `${mercuryTransit.separation.toFixed(1)} arcminutes from the solar center`,
      date: mercuryTransit.peak.date,
      focusId: 'sun',
      targetIds: ['sun', 'mercury'],
      closeView: false,
      accent: '#ffd278',
    },
    oppositionEvent('mars', start),
    oppositionEvent('jupiter', start),
    ...findConjunctions(start),
  ]
  const galilean = findGalileanTransit(start)
  if (galilean) events.push(galilean)

  return events
    .filter((event) => event.date.getTime() >= start.getTime())
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(0, 8)
}
