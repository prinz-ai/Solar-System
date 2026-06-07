import {
  AstroTime,
  Body,
  GeoMoon,
  HelioVector,
  JupiterMoons,
  Observer,
  ObserverVector,
  RotationAxis,
  type StateVector,
  type Vector,
} from 'astronomy-engine'
import { ALL_MAJOR_BODIES, MOONS, PLANETS, SMALL_BODIES } from '../data/bodies'
import type {
  BodySnapshot,
  MoonDefinition,
  OrbitalElements,
  ScaleMode,
  SpacecraftDefinition,
  Vec3,
} from '../types'

const J2000_JD = 2_451_545
const AU_KM = 149_597_870.7
const OBLIQUITY_J2000 = (23.439291111 * Math.PI) / 180

const bodyLookup: Record<string, Body> = {
  Sun: Body.Sun,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Earth: Body.Earth,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
  Uranus: Body.Uranus,
  Neptune: Body.Neptune,
  Pluto: Body.Pluto,
}

const rotationBodyLookup: Record<string, Body> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  moon: Body.Moon,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
}

export function equatorialToEcliptic(vector: {
  x: number
  y: number
  z: number
}): Vec3 {
  const cos = Math.cos(OBLIQUITY_J2000)
  const sin = Math.sin(OBLIQUITY_J2000)
  const eclipticY = vector.y * cos + vector.z * sin
  const eclipticZ = -vector.y * sin + vector.z * cos
  return [vector.x, eclipticZ, -eclipticY]
}

export function magnitude([x, y, z]: Vec3): number {
  return Math.hypot(x, y, z)
}

export function scaleDistance(distanceAu: number, mode: ScaleMode): number {
  if (mode === 'true') return distanceAu * 1.65
  return Math.log1p(distanceAu * 2.4) * 7.2
}

export function mapAuToScene(positionAu: Vec3, mode: ScaleMode): Vec3 {
  const distance = magnitude(positionAu)
  if (distance === 0) return [0, 0, 0]
  const scaled = scaleDistance(distance, mode)
  const factor = scaled / distance
  return [
    positionAu[0] * factor,
    positionAu[1] * factor,
    positionAu[2] * factor,
  ]
}

export function getPlanetSnapshots(
  date: Date,
  mode: ScaleMode,
): Record<string, BodySnapshot> {
  const snapshots: Record<string, BodySnapshot> = {
    sun: {
      id: 'sun',
      positionAu: [0, 0, 0],
      scenePosition: [0, 0, 0],
      distanceAu: 0,
    },
  }

  for (const definition of PLANETS) {
    const vector = HelioVector(bodyLookup[definition.astronomyBody], date)
    const positionAu = equatorialToEcliptic(vector)
    snapshots[definition.id] = {
      id: definition.id,
      positionAu,
      scenePosition: mapAuToScene(positionAu, mode),
      distanceAu: magnitude(positionAu),
    }
  }

  return snapshots
}

function scaleMoonOffset(
  vectorAu: Vec3,
  moon: MoonDefinition,
  mode: ScaleMode,
): Vec3 {
  if (mode === 'true') {
    return vectorAu.map((value) => value * 1.65) as Vec3
  }

  const majorParent = ALL_MAJOR_BODIES.find(
    (body) => body.id === moon.parentId,
  )
  const smallParent = SMALL_BODIES.find((body) => body.id === moon.parentId)
  const parentRadiusKm =
    majorParent?.radiusKm ?? smallParent?.physicalRadiusKm ?? 500
  const parentDisplayRadius =
    majorParent?.displayRadius ?? smallParent?.radius ?? 0.14
  const ratio = moon.orbitalRadiusKm / parentRadiusKm
  let visualDistance =
    parentDisplayRadius + 0.24 + Math.log1p(ratio) * 0.34
  const ringClearance = {
    saturn: parentDisplayRadius * 2.26 + 0.2,
    uranus: parentDisplayRadius * 4.16 + 0.2,
    neptune: parentDisplayRadius * 2.55 + 0.2,
  }[moon.parentId]
  if (ringClearance) visualDistance = Math.max(visualDistance, ringClearance)
  const realDistance = magnitude(vectorAu)
  const factor = realDistance > 0 ? visualDistance / realDistance : 0
  return vectorAu.map((value) => value * factor) as Vec3
}

function approximateMoonVector(
  moon: MoonDefinition,
  date: Date,
): Vec3 {
  const daysSinceJ2000 = date.getTime() / 86_400_000 + 2_440_587.5 - J2000_JD
  const phase =
    ((moon.phaseDegJ2000 + (360 * daysSinceJ2000) / moon.orbitalPeriodDays) *
      Math.PI) /
    180
  const inclination = (moon.inclinationDeg * Math.PI) / 180
  const distanceAu = moon.orbitalRadiusKm / AU_KM
  return [
    Math.cos(phase) * distanceAu,
    Math.sin(phase) * Math.sin(inclination) * distanceAu,
    Math.sin(phase) * Math.cos(inclination) * distanceAu,
  ]
}

function stateToVec3(state: StateVector): Vec3 {
  return equatorialToEcliptic(state)
}

function vectorToVec3(vector: Vector): Vec3 {
  return equatorialToEcliptic(vector)
}

export function getMoonScenePositions(
  date: Date,
  mode: ScaleMode,
  planets: Record<string, BodySnapshot>,
  precisionVectors: Record<string, Vec3> = {},
): Record<string, Vec3> {
  const exactJupiter = JupiterMoons(date)
  const positions: Record<string, Vec3> = {}

  for (const moon of MOONS) {
    let vectorAu = precisionVectors[moon.id]
    if (!vectorAu) {
      switch (moon.exactModel) {
        case 'earth-moon':
          vectorAu = vectorToVec3(GeoMoon(date))
          break
        case 'jupiter-io':
          vectorAu = stateToVec3(exactJupiter.io)
          break
        case 'jupiter-europa':
          vectorAu = stateToVec3(exactJupiter.europa)
          break
        case 'jupiter-ganymede':
          vectorAu = stateToVec3(exactJupiter.ganymede)
          break
        case 'jupiter-callisto':
          vectorAu = stateToVec3(exactJupiter.callisto)
          break
        default:
          vectorAu = approximateMoonVector(moon, date)
      }
    }

    const offset = scaleMoonOffset(vectorAu, moon, mode)
    const parent = planets[moon.parentId]?.scenePosition
    if (!parent) continue
    positions[moon.id] = [
      parent[0] + offset[0],
      parent[1] + offset[1],
      parent[2] + offset[2],
    ]
  }

  return positions
}

export function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5
}

export function earthSurfaceDirection(
  date: Date,
  latitudeDeg: number,
  longitudeDeg: number,
): Vec3 {
  const vector = equatorialToEcliptic(
    ObserverVector(
      date,
      new Observer(latitudeDeg, longitudeDeg, 0),
      false,
    ),
  )
  const length = magnitude(vector)
  return vector.map((value) => value / length) as Vec3
}

export function earthOrientationBasis(date: Date): [Vec3, Vec3, Vec3] {
  return bodyOrientationBasis('earth', date)
}

export function bodyOrientationBasis(
  bodyId: string,
  date: Date,
): [Vec3, Vec3, Vec3] {
  const body = rotationBodyLookup[bodyId]
  if (!body) {
    throw new Error(`No IAU rotation model is available for ${bodyId}.`)
  }

  const axis = RotationAxis(body, date)
  const alpha = (axis.ra * Math.PI) / 12
  const delta = (axis.dec * Math.PI) / 180
  const spin = (axis.spin * Math.PI) / 180
  const sinAlpha = Math.sin(alpha)
  const cosAlpha = Math.cos(alpha)
  const sinDelta = Math.sin(delta)
  const cosDelta = Math.cos(delta)
  const sinSpin = Math.sin(spin)
  const cosSpin = Math.cos(spin)

  const primeMeridianEqj = {
    x: -sinAlpha * cosSpin - cosAlpha * sinDelta * sinSpin,
    y: cosAlpha * cosSpin - sinAlpha * sinDelta * sinSpin,
    z: cosDelta * sinSpin,
  }
  const eastEqj = {
    x: sinAlpha * sinSpin - cosAlpha * sinDelta * cosSpin,
    y: -cosAlpha * sinSpin - sinAlpha * sinDelta * cosSpin,
    z: cosDelta * cosSpin,
  }
  const primeMeridian = equatorialToEcliptic(primeMeridianEqj)
  const north = equatorialToEcliptic(axis.north)
  const east = equatorialToEcliptic(eastEqj)

  return [
    primeMeridian,
    north,
    east.map((value) => -value) as Vec3,
  ]
}

export function synchronousOrientationBasis(
  bodyPosition: Vec3,
  parentPosition: Vec3,
  parentId: string,
  date: Date,
): [Vec3, Vec3, Vec3] {
  const towardParent = [
    parentPosition[0] - bodyPosition[0],
    parentPosition[1] - bodyPosition[1],
    parentPosition[2] - bodyPosition[2],
  ] as Vec3
  const distance = magnitude(towardParent)
  const primeMeridian = towardParent.map(
    (value) => value / distance,
  ) as Vec3
  const parentNorth = rotationBodyLookup[parentId]
    ? bodyOrientationBasis(parentId, date)[1]
    : ([0, 1, 0] as Vec3)
  const alongPrime =
    primeMeridian[0] * parentNorth[0] +
    primeMeridian[1] * parentNorth[1] +
    primeMeridian[2] * parentNorth[2]
  const northCandidate = [
    parentNorth[0] - primeMeridian[0] * alongPrime,
    parentNorth[1] - primeMeridian[1] * alongPrime,
    parentNorth[2] - primeMeridian[2] * alongPrime,
  ] as Vec3
  const northLength = magnitude(northCandidate)
  const north = northCandidate.map(
    (value) => value / northLength,
  ) as Vec3
  const west: Vec3 = [
    primeMeridian[1] * north[2] - primeMeridian[2] * north[1],
    primeMeridian[2] * north[0] - primeMeridian[0] * north[2],
    primeMeridian[0] * north[1] - primeMeridian[1] * north[0],
  ]

  return [primeMeridian, north, west]
}

export function bodyRotationAngle(
  rotationHours: number,
  date: Date,
): number {
  const elapsedHours =
    (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 3_600_000
  return (-elapsedHours * Math.PI * 2) / rotationHours
}

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number) {
  let eccentricAnomaly = eccentricity > 0.8 ? Math.PI : meanAnomaly
  for (let index = 0; index < 12; index += 1) {
    eccentricAnomaly -=
      (eccentricAnomaly -
        eccentricity * Math.sin(eccentricAnomaly) -
        meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly))
  }
  return eccentricAnomaly
}

export function orbitalPositionAu(
  elements: OrbitalElements,
  date: Date,
): Vec3 {
  const days = julianDate(date) - elements.epochJd
  const periodDays = 365.2568983 * Math.pow(elements.semiMajorAxisAu, 1.5)
  const meanAnomaly =
    (((elements.meanAnomalyDeg * Math.PI) / 180 +
      (2 * Math.PI * days) / periodDays) %
      (2 * Math.PI) +
      2 * Math.PI) %
    (2 * Math.PI)
  const eccentricAnomaly = solveEccentricAnomaly(
    meanAnomaly,
    elements.eccentricity,
  )
  const xOrbital =
    elements.semiMajorAxisAu *
    (Math.cos(eccentricAnomaly) - elements.eccentricity)
  const yOrbital =
    elements.semiMajorAxisAu *
    Math.sqrt(1 - elements.eccentricity ** 2) *
    Math.sin(eccentricAnomaly)

  const ascendingNode = (elements.ascendingNodeDeg * Math.PI) / 180
  const inclination = (elements.inclinationDeg * Math.PI) / 180
  const argumentPeriapsis =
    (elements.argumentPeriapsisDeg * Math.PI) / 180
  const cosO = Math.cos(ascendingNode)
  const sinO = Math.sin(ascendingNode)
  const cosI = Math.cos(inclination)
  const sinI = Math.sin(inclination)
  const cosW = Math.cos(argumentPeriapsis)
  const sinW = Math.sin(argumentPeriapsis)

  const x =
    (cosO * cosW - sinO * sinW * cosI) * xOrbital +
    (-cosO * sinW - sinO * cosW * cosI) * yOrbital
  const y =
    sinW * sinI * xOrbital + cosW * sinI * yOrbital
  const z =
    (sinO * cosW + cosO * sinW * cosI) * xOrbital +
    (-sinO * sinW + cosO * cosW * cosI) * yOrbital

  return [x, y, z]
}

export function spacecraftPositionAu(
  craft: SpacecraftDefinition,
  date: Date,
): Vec3 {
  const launch = new Date(craft.launchIso)
  const years =
    (date.getTime() - launch.getTime()) / (365.256 * 86_400_000)
  const distanceAu = Math.max(0, years * craft.speedAuPerYear)
  const directionLength = magnitude(craft.direction)
  return craft.direction.map(
    (value) => (value / directionLength) * distanceAu,
  ) as Vec3
}

export function generateOrbitPath(
  bodyId: string,
  mode: ScaleMode,
  samples = 180,
): Vec3[] {
  const body = PLANETS.find((planet) => planet.id === bodyId)
  if (!body) return []
  const center = new AstroTime(new Date('2026-01-01T00:00:00Z')).date
  const points: Vec3[] = []
  for (let index = 0; index <= samples; index += 1) {
    const offset =
      (index / samples - 0.5) * body.orbitalPeriodDays * 86_400_000
    const date = new Date(center.getTime() + offset)
    const vector = HelioVector(bodyLookup[body.astronomyBody], date)
    points.push(mapAuToScene(equatorialToEcliptic(vector), mode))
  }
  return points
}
