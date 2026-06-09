import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const ELEMENTS_URL = 'https://ssd.jpl.nasa.gov/sats/elem/'
const PHYSICAL_URL = 'https://ssd.jpl.nasa.gov/sats/phys_par/'
const OUTPUT_PATH = resolve(
  process.cwd(),
  'src/data/generatedMoonCatalog.json',
)

const parentIds = {
  Earth: 'earth',
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturn: 'saturn',
  Uranus: 'uranus',
  Neptune: 'neptune',
  Pluto: 'pluto',
}

const parentColors = {
  earth: '#d7d3ca',
  mars: '#8f7a67',
  jupiter: '#9a8e7d',
  saturn: '#bbb4a7',
  uranus: '#aebbc2',
  neptune: '#99a8ba',
  pluto: '#9e9b99',
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&omega;/g, 'omega')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripHtml(value) {
  return decodeHtml(value.replace(/<[^>]*>/g, ''))
}

function parseRows(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]
  if (!tbody) throw new Error('JPL page has no table body')
  return [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
      stripHtml(cell[1]),
    ),
  )
}

function toNumber(value) {
  const normalized = value.replace(/,/g, '')
  if (normalized === '-' || normalized === '') return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function epochToJd(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})\.(\d)$/)
  if (!match) return 2_451_545
  const [, year, month, day, fraction] = match
  const time = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(`0.${fraction}`) * 24,
  )
  return time / 86_400_000 + 2_440_587.5
}

function normalizeId(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\//g, '-')
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function fetchPage(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return response.text()
}

const [elementsHtml, physicalHtml] = await Promise.all([
  fetchPage(ELEMENTS_URL),
  fetchPage(PHYSICAL_URL),
])

const physicalRows = parseRows(physicalHtml)
const physicalRadiusByCode = new Map(
  physicalRows.map((row) => [row[2], toNumber(row[4].split(' ')[0])]),
)
const physicalRadiusByName = new Map(
  physicalRows.map((row) => [
    `${parentIds[row[0]]}:${row[1].toLowerCase()}`,
    toNumber(row[4].split(' ')[0]),
  ]),
)

const elementRows = parseRows(elementsHtml)
if (elementRows.length < 450) {
  throw new Error(`JPL returned only ${elementRows.length} satellite rows`)
}

const rowsById = new Map()
for (const moon of elementRows
  .map((row) => {
    const parentId = parentIds[row[1]]
    if (!parentId) return undefined
    const radiusKm =
      physicalRadiusByCode.get(row[3]) ??
      physicalRadiusByName.get(`${parentId}:${row[2].toLowerCase()}`)
    const inclinationDeg = toNumber(row[11]) ?? 0
    const periodDays = toNumber(row[13]) ?? 1
    return {
      id: normalizeId(row[2]),
      name: row[2],
      parentId,
      ...(radiusKm === undefined ? {} : { radiusKm }),
      orbitalRadiusKm: toNumber(row[7]) ?? 1,
      orbitalPeriodDays: periodDays,
      phaseDegJ2000: 0,
      meanAnomalyDeg: toNumber(row[10]) ?? 0,
      inclinationDeg,
      eccentricity: toNumber(row[8]) ?? 0,
      argumentPeriapsisDeg: toNumber(row[9]) ?? 0,
      ascendingNodeDeg: toNumber(row[12]) ?? 0,
      orbitFrame: row[5].toLowerCase(),
      retrograde: inclinationDeg > 90,
      epochJd: epochToJd(row[6]),
      jplCode: row[3],
      ephemeris: row[4],
      color: parentColors[parentId],
      showLabel: false,
    }
  })
  .filter(Boolean)) {
  const existing = rowsById.get(moon.id)
  if (!existing || moon.epochJd >= existing.epochJd) {
    rowsById.set(moon.id, moon)
  }
}
const moons = [...rowsById.values()]

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, JSON.stringify(moons, null, 2) + '\n')
console.log(`Wrote ${OUTPUT_PATH} (${moons.length} moons)`)
