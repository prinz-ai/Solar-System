import { writeFile } from 'node:fs/promises'
import path from 'node:path'

const SKY_CULTURE_URL =
  'https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master/western_SnT/index.json'
const STAR_CATALOG_URL =
  'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.14.json'
const OUTPUT_PATH = path.resolve(
  'public/sky/constellation-figures.json',
)

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`)
  }
  return response.json()
}

function parsePath(rawPath, starsByHip) {
  const styled = typeof rawPath[0] === 'string'
  const style = styled ? rawPath[0] : 'normal'
  const sourceStarIds = styled ? rawPath.slice(1) : rawPath
  const starIds = sourceStarIds.filter(
    (hip, index) => index === 0 || hip !== sourceStarIds[index - 1],
  )
  if (!['bold', 'normal', 'thin'].includes(style)) {
    throw new Error(`Unsupported constellation path style: ${style}`)
  }
  if (starIds.length < 2) {
    throw new Error('Constellation paths must contain at least two stars')
  }

  return {
    style,
    stars: starIds.map((hip) => {
      const star = starsByHip.get(Number(hip))
      if (!star) throw new Error(`Missing HIP ${hip} from star catalog`)
      return {
        hip: Number(hip),
        raDeg: star.geometry.coordinates[0],
        decDeg: star.geometry.coordinates[1],
        magnitude: Number(star.properties.mag),
        bv: Number(star.properties.bv),
      }
    }),
  }
}

async function main() {
  const [skyCulture, starCatalog] = await Promise.all([
    fetchJson(SKY_CULTURE_URL),
    fetchJson(STAR_CATALOG_URL),
  ])
  const starsByHip = new Map(
    starCatalog.features.map((star) => [Number(star.id), star]),
  )
  const constellations = skyCulture.constellations.map((constellation) => ({
    id: constellation.iau.toUpperCase(),
    paths: constellation.lines.map((line) =>
      parsePath(line, starsByHip),
    ),
  }))

  if (constellations.length !== 88) {
    throw new Error(
      `Expected 88 constellations, received ${constellations.length}`,
    )
  }

  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify({
      frame: 'ICRS J2000',
      culture: 'Western (Sky & Telescope)',
      source: SKY_CULTURE_URL,
      license: 'CC BY-SA 2.0',
      starSource: STAR_CATALOG_URL,
      constellations,
    })}\n`,
  )
  console.log(`Wrote ${constellations.length} figures to ${OUTPUT_PATH}`)
}

await main()
