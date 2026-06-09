import type { Vec3 } from '../types'

export const GAIA_RECORD_FLOATS = 7
export const GAIA_REFERENCE_EPOCH = 2016
export const GAIA_SKY_RADIUS = 190

const MAS_TO_RAD = Math.PI / (180 * 3_600_000)
const AU_PER_PARALLAX_MAS = 206_264_806.24709636
const OBLIQUITY_J2000 = (23.439291111 * Math.PI) / 180

export interface GaiaSkyMetadata {
  catalog: string
  referenceEpoch: number
  frame: string
  recordFloats: number
  recordLayout: string[]
  brightCount: number
  densityCount: number
  totalCount: number
  generatedAt: string
  tapUrl: string
  queries: {
    bright: string
    density: string
  }
}

export interface ConstellationBoundary {
  id: string
  part: string
  points: [number, number][]
}

export interface ConstellationBoundaryData {
  frame: string
  source: string
  constellationCount: number
  boundaryCount: number
  boundaries: ConstellationBoundary[]
}

export interface GaiaSkyData {
  metadata: GaiaSkyMetadata
  records: Float32Array
  constellations: ConstellationBoundaryData
}

const COLOR_STOPS = [
  { value: -0.6, color: [0.53, 0.68, 1] },
  { value: 0, color: [0.72, 0.81, 1] },
  { value: 0.55, color: [1, 0.96, 0.88] },
  { value: 1.15, color: [1, 0.75, 0.48] },
  { value: 2.1, color: [1, 0.42, 0.2] },
  { value: 4, color: [0.82, 0.18, 0.08] },
] as const

function srgbToLinear(value: number) {
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4)
}

export function gaiaColorFromBpRp(bpRp: number): Vec3 {
  const value = Number.isFinite(bpRp) ? bpRp : 0.82
  const last = COLOR_STOPS[COLOR_STOPS.length - 1]
  if (value <= COLOR_STOPS[0].value) {
    return COLOR_STOPS[0].color.map(srgbToLinear) as Vec3
  }
  if (value >= last.value) return last.color.map(srgbToLinear) as Vec3

  for (let index = 1; index < COLOR_STOPS.length; index += 1) {
    const right = COLOR_STOPS[index]
    if (value > right.value) continue
    const left = COLOR_STOPS[index - 1]
    const amount = (value - left.value) / (right.value - left.value)
    return left.color.map((channel, channelIndex) =>
      srgbToLinear(
        channel +
          (right.color[channelIndex] - channel) * amount,
      ),
    ) as Vec3
  }

  return [1, 1, 1]
}

export function yearsSinceGaiaEpoch(date: Date) {
  const julianDate = date.getTime() / 86_400_000 + 2_440_587.5
  return (julianDate - 2_457_388.5) / 365.25
}

export function equatorialSkyDirection(ra: number, dec: number): Vec3 {
  const cosDec = Math.cos(dec)
  const equatorial = [
    cosDec * Math.cos(ra),
    cosDec * Math.sin(ra),
    Math.sin(dec),
  ]
  const cosObliquity = Math.cos(OBLIQUITY_J2000)
  const sinObliquity = Math.sin(OBLIQUITY_J2000)
  const eclipticY =
    equatorial[1] * cosObliquity + equatorial[2] * sinObliquity
  const eclipticZ =
    -equatorial[1] * sinObliquity + equatorial[2] * cosObliquity
  return [equatorial[0], eclipticZ, -eclipticY]
}

export function apparentGaiaDirection(
  record: ArrayLike<number>,
  recordOffset: number,
  date: Date,
  observerPositionAu: Vec3,
): Vec3 {
  const years = yearsSinceGaiaEpoch(date)
  const dec0 = record[recordOffset + 1]
  const cosDec0 = Math.max(0.0001, Math.abs(Math.cos(dec0)))
  const ra =
    record[recordOffset] +
    (record[recordOffset + 3] * years * MAS_TO_RAD) / cosDec0
  const dec =
    dec0 + record[recordOffset + 4] * years * MAS_TO_RAD
  const skyDirection = equatorialSkyDirection(ra, dec)
  const inverseDistance =
    Math.max(0, record[recordOffset + 2]) / AU_PER_PARALLAX_MAS
  const direction = [
    skyDirection[0] - observerPositionAu[0] * inverseDistance,
    skyDirection[1] - observerPositionAu[1] * inverseDistance,
    skyDirection[2] - observerPositionAu[2] * inverseDistance,
  ] as Vec3
  const length = Math.hypot(...direction)
  return direction.map((value) => value / length) as Vec3
}

let skyDataPromise: Promise<GaiaSkyData> | undefined

async function fetchGaiaSkyData(): Promise<GaiaSkyData> {
  const [metadataResponse, recordsResponse, constellationsResponse] =
    await Promise.all([
      fetch('/sky/gaia-dr3-stars.json'),
      fetch('/sky/gaia-dr3-stars.bin'),
      fetch('/sky/constellation-boundaries.json'),
    ])
  for (const response of [
    metadataResponse,
    recordsResponse,
    constellationsResponse,
  ]) {
    if (!response.ok) {
      throw new Error(
        `Real-sky data request failed: ${response.status} ${response.statusText}`,
      )
    }
  }

  const [metadata, buffer, constellations] = await Promise.all([
    metadataResponse.json() as Promise<GaiaSkyMetadata>,
    recordsResponse.arrayBuffer(),
    constellationsResponse.json() as Promise<ConstellationBoundaryData>,
  ])
  if (metadata.recordFloats !== GAIA_RECORD_FLOATS) {
    throw new Error(
      `Unsupported Gaia record layout: ${metadata.recordFloats} floats`,
    )
  }
  const records = new Float32Array(buffer)
  if (records.length !== metadata.totalCount * metadata.recordFloats) {
    throw new Error('Gaia binary length does not match its metadata')
  }

  return { metadata, records, constellations }
}

export function loadGaiaSkyData(): Promise<GaiaSkyData> {
  skyDataPromise ??= fetchGaiaSkyData().catch((error) => {
    skyDataPromise = undefined
    throw error
  })
  return skyDataPromise
}
