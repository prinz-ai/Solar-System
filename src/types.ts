export type Vec3 = [number, number, number]

export type ScaleMode = 'explore' | 'true'

export type SkyObserverId = string

export type PrecisionLevel = 'ephemeris' | 'analytical' | 'statistical'

export type SunViewMode =
  | 'photosphere'
  | 'visible'
  | '171'
  | '193'
  | '304'
  | 'magnetogram'

export interface PlanetDefinition {
  id: string
  name: string
  subtitle: string
  astronomyBody: string
  radiusKm: number
  displayRadius: number
  color: string
  accent: string
  orbitalPeriodDays: number
  rotationHours: number
  axialTiltDeg: number
  facts: string[]
  precision: PrecisionLevel
  hasRings?: boolean
}

export interface MoonDefinition {
  id: string
  name: string
  parentId: string
  radiusKm?: number
  orbitalRadiusKm: number
  orbitalPeriodDays: number
  phaseDegJ2000: number
  inclinationDeg: number
  color: string
  epochJd?: number
  meanAnomalyDeg?: number
  eccentricity?: number
  argumentPeriapsisDeg?: number
  ascendingNodeDeg?: number
  orbitFrame?: 'ecliptic' | 'laplace' | 'equatorial'
  retrograde?: boolean
  jplCode?: string
  ephemeris?: string
  showLabel?: boolean
  exactModel?: 'earth-moon' | 'jupiter-io' | 'jupiter-europa' | 'jupiter-ganymede' | 'jupiter-callisto'
}

export interface OrbitalElements {
  id: string
  name: string
  kind:
    | 'dwarf'
    | 'dwarf-candidate'
    | 'asteroid'
    | 'comet'
    | 'interstellar'
  epochJd: number
  semiMajorAxisAu: number
  eccentricity: number
  inclinationDeg: number
  ascendingNodeDeg: number
  argumentPeriapsisDeg: number
  meanAnomalyDeg: number
  color: string
  radius: number
  physicalRadiusKm?: number
  rotationHours?: number
  scale?: Vec3
  hasRings?: boolean
  hasComa?: boolean
  fact: string
}

export interface SpacecraftDefinition {
  id: string
  name: string
  launchIso: string
  speedAuPerYear: number
  direction: Vec3
  color: string
  fact: string
}

export interface BodySnapshot {
  id: string
  positionAu: Vec3
  scenePosition: Vec3
  distanceAu: number
}

export interface LayerSettings {
  stars: boolean
  milkyWay: boolean
  constellations: boolean
  labels: boolean
  orbits: boolean
  moons: boolean
  asteroidBelt: boolean
  kuiperBelt: boolean
  oortCloud: boolean
  comets: boolean
  spacecraft: boolean
}

export interface CinematicFocus {
  id: string
  targetIds: string[]
}
