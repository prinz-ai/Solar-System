import type { Vec3 } from '../types'

const AU_KM = 149_597_870.7
const EPSILON = 1e-12

export type EclipseEventType =
  | 'solar-eclipse'
  | 'lunar-eclipse'
  | 'moon-transit'
  | 'mutual-eclipse'
  | 'mutual-occultation'

export type EclipsePhase =
  | 'penumbral'
  | 'partial'
  | 'total'
  | 'annular'

export interface EclipseBody {
  id: string
  name: string
  radiusKm: number
  positionAu: Vec3
  parentId?: string
  kind: 'sun' | 'planet' | 'moon'
}

export interface EclipseEvent {
  id: string
  type: EclipseEventType
  phase: EclipsePhase
  occluderId: string
  occluderName: string
  targetId: string
  targetName: string
  parentId?: string
  coverage: number
  centerObscuration: number
  shadowDirection: Vec3
  penumbraAngularRadius: number
  umbraAngularRadius: number
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scale(vector: Vec3, factor: number): Vec3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor]
}

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function length(vector: Vec3) {
  return Math.hypot(...vector)
}

function normalize(vector: Vec3): Vec3 {
  const magnitude = length(vector)
  if (magnitude <= EPSILON) return [0, 0, 0]
  return scale(vector, 1 / magnitude)
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function angularSeparation(a: Vec3, b: Vec3) {
  return Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1))
}

function circleOverlapArea(radiusA: number, radiusB: number, distance: number) {
  if (radiusA <= 0 || radiusB <= 0) return 0
  if (distance >= radiusA + radiusB) return 0
  if (distance <= Math.abs(radiusA - radiusB)) {
    const smaller = Math.min(radiusA, radiusB)
    return Math.PI * smaller * smaller
  }

  const angleA = Math.acos(
    clamp(
      (distance * distance + radiusA * radiusA - radiusB * radiusB) /
        (2 * distance * radiusA),
      -1,
      1,
    ),
  )
  const angleB = Math.acos(
    clamp(
      (distance * distance + radiusB * radiusB - radiusA * radiusA) /
        (2 * distance * radiusB),
      -1,
      1,
    ),
  )
  const triangle = 0.5 * Math.sqrt(
    Math.max(
      0,
      (-distance + radiusA + radiusB) *
        (distance + radiusA - radiusB) *
        (distance - radiusA + radiusB) *
        (distance + radiusA + radiusB),
    ),
  )
  return radiusA * radiusA * angleA + radiusB * radiusB * angleB - triangle
}

function circleCoverage(
  targetRadius: number,
  shadowRadius: number,
  offset: number,
) {
  return clamp(
    circleOverlapArea(targetRadius, shadowRadius, offset) /
      (Math.PI * targetRadius * targetRadius),
    0,
    1,
  )
}

function apparentObscuration(
  sun: EclipseBody,
  occluder: EclipseBody,
  target: EclipseBody,
) {
  const toSun = subtract(sun.positionAu, target.positionAu)
  const toOccluder = subtract(occluder.positionAu, target.positionAu)
  const sunDistanceKm = length(toSun) * AU_KM
  const occluderDistanceKm = length(toOccluder) * AU_KM
  if (sunDistanceKm <= sun.radiusKm || occluderDistanceKm <= occluder.radiusKm) {
    return 0
  }
  const sunRadius = Math.asin(sun.radiusKm / sunDistanceKm)
  const occluderRadius = Math.asin(occluder.radiusKm / occluderDistanceKm)
  const separation = angularSeparation(toSun, toOccluder)
  return clamp(
    circleOverlapArea(sunRadius, occluderRadius, separation) /
      (Math.PI * sunRadius * sunRadius),
    0,
    1,
  )
}

function angularFootprint(radiusKm: number, targetRadiusKm: number) {
  if (radiusKm <= 0) return 0
  return Math.asin(clamp(radiusKm / targetRadiusKm, 0, 1))
}

export function calculateShadowEvent(
  sun: EclipseBody,
  occluder: EclipseBody,
  target: EclipseBody,
  type: Exclude<EclipseEventType, 'mutual-occultation'>,
): EclipseEvent | undefined {
  const sunToOccluderKm = scale(
    subtract(occluder.positionAu, sun.positionAu),
    AU_KM,
  )
  const sunOccluderDistance = length(sunToOccluderKm)
  if (sunOccluderDistance <= sun.radiusKm + occluder.radiusKm) return undefined

  const axis = normalize(sunToOccluderKm)
  const occluderToTargetKm = scale(
    subtract(target.positionAu, occluder.positionAu),
    AU_KM,
  )
  const axialDistance = dot(occluderToTargetKm, axis)
  if (axialDistance <= 0) return undefined

  const perpendicular = subtract(
    occluderToTargetKm,
    scale(axis, axialDistance),
  )
  const axisOffset = length(perpendicular)
  const penumbraRadius =
    occluder.radiusKm +
    (axialDistance * (sun.radiusKm + occluder.radiusKm)) /
      sunOccluderDistance
  const signedUmbraRadius =
    occluder.radiusKm -
    (axialDistance * (sun.radiusKm - occluder.radiusKm)) /
      sunOccluderDistance
  if (axisOffset > penumbraRadius + target.radiusKm) return undefined

  const umbraRadius = Math.max(0, signedUmbraRadius)
  const antumbraRadius = Math.max(0, -signedUmbraRadius)
  const coverage = circleCoverage(
    target.radiusKm,
    penumbraRadius,
    axisOffset,
  )
  const umbraCoverage = circleCoverage(
    target.radiusKm,
    umbraRadius,
    axisOffset,
  )
  const antumbraCoverage = circleCoverage(
    target.radiusKm,
    antumbraRadius,
    axisOffset,
  )
  const targetMustFitInsideUmbra =
    type === 'lunar-eclipse' || type === 'mutual-eclipse'
  let phase: EclipsePhase
  if (targetMustFitInsideUmbra) {
    phase =
      axisOffset + target.radiusKm <= umbraRadius
        ? 'total'
        : umbraCoverage > 0
          ? 'partial'
          : antumbraCoverage > 0
            ? 'annular'
            : 'penumbral'
  } else {
    phase =
      umbraCoverage > 0
        ? 'total'
        : antumbraCoverage > 0
          ? 'annular'
          : 'partial'
  }

  let shadowDirection: Vec3
  if (axisOffset < target.radiusKm) {
    const frontDistance = Math.sqrt(
      Math.max(0, target.radiusKm ** 2 - axisOffset ** 2),
    )
    shadowDirection = normalize(
      add(scale(perpendicular, -1), scale(axis, -frontDistance)),
    )
  } else {
    shadowDirection = normalize(scale(perpendicular, -1))
  }

  return {
    id: `${type}:${occluder.id}:${target.id}`,
    type,
    phase,
    occluderId: occluder.id,
    occluderName: occluder.name,
    targetId: target.id,
    targetName: target.name,
    parentId: target.parentId ?? occluder.parentId,
    coverage,
    centerObscuration: apparentObscuration(sun, occluder, target),
    shadowDirection,
    penumbraAngularRadius:
      targetMustFitInsideUmbra && phase === 'total'
        ? Math.PI
        : angularFootprint(penumbraRadius, target.radiusKm),
    umbraAngularRadius:
      targetMustFitInsideUmbra && phase === 'total'
        ? Math.PI
        : angularFootprint(
            Math.max(umbraRadius, antumbraRadius),
            target.radiusKm,
          ),
  }
}

function calculateMutualOccultation(
  observer: EclipseBody,
  bodyA: EclipseBody,
  bodyB: EclipseBody,
): EclipseEvent | undefined {
  const toA = subtract(bodyA.positionAu, observer.positionAu)
  const toB = subtract(bodyB.positionAu, observer.positionAu)
  const distanceA = length(toA) * AU_KM
  const distanceB = length(toB) * AU_KM
  const radiusA = Math.asin(clamp(bodyA.radiusKm / distanceA, 0, 1))
  const radiusB = Math.asin(clamp(bodyB.radiusKm / distanceB, 0, 1))
  const separation = angularSeparation(toA, toB)
  if (separation >= radiusA + radiusB) return undefined

  const [occluder, target, occluderRadius, targetRadius] =
    distanceA <= distanceB
      ? [bodyA, bodyB, radiusA, radiusB]
      : [bodyB, bodyA, radiusB, radiusA]
  const coverage = clamp(
    circleOverlapArea(targetRadius, occluderRadius, separation) /
      (Math.PI * targetRadius * targetRadius),
    0,
    1,
  )

  return {
    id: `mutual-occultation:${occluder.id}:${target.id}`,
    type: 'mutual-occultation',
    phase: coverage >= 0.999 ? 'total' : 'partial',
    occluderId: occluder.id,
    occluderName: occluder.name,
    targetId: target.id,
    targetName: target.name,
    parentId: observer.id,
    coverage,
    centerObscuration: coverage,
    shadowDirection: normalize(
      subtract(occluder.positionAu, target.positionAu),
    ),
    penumbraAngularRadius: 0,
    umbraAngularRadius: 0,
  }
}

export function computeEclipseEvents(bodies: EclipseBody[]) {
  const bodyById = new Map(bodies.map((body) => [body.id, body]))
  const sun = bodies.find((body) => body.kind === 'sun')
  if (!sun) return []

  const events: EclipseEvent[] = []
  const moonsByParent = new Map<string, EclipseBody[]>()
  for (const moon of bodies.filter((body) => body.kind === 'moon')) {
    if (!moon.parentId) continue
    const siblings = moonsByParent.get(moon.parentId) ?? []
    siblings.push(moon)
    moonsByParent.set(moon.parentId, siblings)

    const parent = bodyById.get(moon.parentId)
    if (!parent) continue
    const moonShadow = calculateShadowEvent(
      sun,
      moon,
      parent,
      parent.id === 'earth' ? 'solar-eclipse' : 'moon-transit',
    )
    if (moonShadow) events.push(moonShadow)

    const parentShadow = calculateShadowEvent(
      sun,
      parent,
      moon,
      'lunar-eclipse',
    )
    if (parentShadow) events.push(parentShadow)
  }

  for (const [parentId, moons] of moonsByParent) {
    const parent = bodyById.get(parentId)
    if (!parent) continue
    for (let first = 0; first < moons.length; first += 1) {
      for (let second = first + 1; second < moons.length; second += 1) {
        const moonA = moons[first]
        const moonB = moons[second]
        const shadowA = calculateShadowEvent(
          sun,
          moonA,
          moonB,
          'mutual-eclipse',
        )
        if (shadowA) events.push(shadowA)
        const shadowB = calculateShadowEvent(
          sun,
          moonB,
          moonA,
          'mutual-eclipse',
        )
        if (shadowB) events.push(shadowB)
        const occultation = calculateMutualOccultation(parent, moonA, moonB)
        if (occultation) events.push(occultation)
      }
    }
  }

  return events
}

export function eclipseEventsForBody(
  events: EclipseEvent[],
  bodyId: string,
) {
  return events.filter(
    (event) => event.targetId === bodyId || event.occluderId === bodyId,
  )
}
