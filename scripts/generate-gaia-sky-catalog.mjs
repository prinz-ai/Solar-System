import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const TAP_URL = 'https://gea.esac.esa.int/tap-server/tap/sync'
const IAU_CONSTELLATIONS_URL =
  'https://www.iau.org/Iau/Iau/Science/What-we-do/The-Constellations.aspx'
const OUTPUT_DIRECTORY = path.resolve('public/sky')
const RECORD_FLOATS = 7
const BRIGHT_LIMIT = 50_000
const DENSITY_RANDOM_INDEX_LIMIT = 150_000

const STAR_COLUMNS = [
  'source_id',
  'ra',
  'dec',
  'parallax',
  'pmra',
  'pmdec',
  'phot_g_mean_mag',
  'bp_rp',
]

const brightQuery = `
SELECT TOP ${BRIGHT_LIMIT}
  ${STAR_COLUMNS.join(', ')}
FROM gaiadr3.gaia_source
WHERE ra IS NOT NULL
  AND dec IS NOT NULL
  AND phot_g_mean_mag IS NOT NULL
ORDER BY phot_g_mean_mag ASC
`.trim()

const densityQuery = `
SELECT
  ${STAR_COLUMNS.join(', ')}
FROM gaiadr3.gaia_source
WHERE random_index < ${DENSITY_RANDOM_INDEX_LIMIT}
  AND ra IS NOT NULL
  AND dec IS NOT NULL
  AND phot_g_mean_mag IS NOT NULL
`.trim()

async function fetchText(url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`)
  }
  return response.text()
}

async function runTapQuery(query) {
  const body = new URLSearchParams({
    REQUEST: 'doQuery',
    LANG: 'ADQL',
    FORMAT: 'csv',
    QUERY: query,
  })
  return fetchText(TAP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
}

function parseCsv(csv) {
  const lines = csv.trim().split(/\r?\n/)
  const headers = lines.shift().split(',')
  return lines.map((line) => {
    const values = line.split(',')
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']),
    )
  })
}

function finiteNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeStar(row) {
  return {
    sourceId: row.source_id,
    raRad: (finiteNumber(row.ra) * Math.PI) / 180,
    decRad: (finiteNumber(row.dec) * Math.PI) / 180,
    parallaxMas: finiteNumber(row.parallax),
    pmRaMasYr: finiteNumber(row.pmra),
    pmDecMasYr: finiteNumber(row.pmdec),
    gMag: finiteNumber(row.phot_g_mean_mag, 21),
    bpRp: finiteNumber(row.bp_rp, 0.82),
  }
}

function writeStar(target, index, star) {
  const offset = index * RECORD_FLOATS
  target[offset] = star.raRad
  target[offset + 1] = star.decRad
  target[offset + 2] = star.parallaxMas
  target[offset + 3] = star.pmRaMasYr
  target[offset + 4] = star.pmDecMasYr
  target[offset + 5] = star.gMag
  target[offset + 6] = star.bpRp
}

function parseConstellationPage(html) {
  return [
    ...new Set(
      html.match(
        /https:\/\/iauarchive\.eso\.org\/static\/public\/constellations\/txt\/[a-z0-9]+\.txt/g,
      ) ?? [],
    ),
  ]
}

function parseConstellationBoundary(text, sourceUrl) {
  const points = text
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const [rightAscension, declination, id] = line.split('|')
      const [hours, minutes, seconds] = rightAscension.trim().split(/\s+/)
      const raDeg =
        (finiteNumber(hours) +
          finiteNumber(minutes) / 60 +
          finiteNumber(seconds) / 3600) *
        15
      return [
        (raDeg * Math.PI) / 180,
        (finiteNumber(declination) * Math.PI) / 180,
        id.trim(),
      ]
    })
  return {
    id: points[0][2],
    part: path.basename(sourceUrl, '.txt'),
    points: points.map(([raRad, decRad]) => [raRad, decRad]),
  }
}

async function generateConstellationBoundaries() {
  const page = await fetchText(IAU_CONSTELLATIONS_URL)
  const urls = parseConstellationPage(page)
  const boundaries = []
  for (let index = 0; index < urls.length; index += 8) {
    const chunk = urls.slice(index, index + 8)
    const results = await Promise.all(
      chunk.map(async (url) =>
        parseConstellationBoundary(await fetchText(url), url),
      ),
    )
    boundaries.push(...results)
  }
  return boundaries
}

async function main() {
  console.log('Downloading Gaia DR3 bright-star sample...')
  const brightRows = parseCsv(await runTapQuery(brightQuery))
  console.log('Downloading Gaia DR3 all-sky density sample...')
  const densityRows = parseCsv(await runTapQuery(densityQuery))
  console.log('Downloading official IAU constellation boundaries...')
  const constellations = await generateConstellationBoundaries()

  const sourceIds = new Set()
  const brightStars = []
  for (const row of brightRows) {
    if (sourceIds.has(row.source_id)) continue
    sourceIds.add(row.source_id)
    brightStars.push(normalizeStar(row))
  }

  const densityStars = []
  for (const row of densityRows) {
    if (sourceIds.has(row.source_id)) continue
    sourceIds.add(row.source_id)
    densityStars.push(normalizeStar(row))
  }

  const stars = [...brightStars, ...densityStars]
  const binary = new Float32Array(stars.length * RECORD_FLOATS)
  stars.forEach((star, index) => writeStar(binary, index, star))

  await mkdir(OUTPUT_DIRECTORY, { recursive: true })
  await writeFile(
    path.join(OUTPUT_DIRECTORY, 'gaia-dr3-stars.bin'),
    Buffer.from(binary.buffer),
  )
  await writeFile(
    path.join(OUTPUT_DIRECTORY, 'gaia-dr3-stars.json'),
    `${JSON.stringify(
      {
        catalog: 'Gaia DR3',
        referenceEpoch: 2016,
        frame: 'ICRS',
        recordFloats: RECORD_FLOATS,
        recordLayout: [
          'ra_rad',
          'dec_rad',
          'parallax_mas',
          'pmra_mas_per_year',
          'pmdec_mas_per_year',
          'phot_g_mean_mag',
          'bp_rp',
        ],
        brightCount: brightStars.length,
        densityCount: densityStars.length,
        totalCount: stars.length,
        generatedAt: new Date().toISOString(),
        tapUrl: TAP_URL,
        queries: {
          bright: brightQuery,
          density: densityQuery,
        },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    path.join(OUTPUT_DIRECTORY, 'constellation-boundaries.json'),
    `${JSON.stringify(
      {
        frame: 'ICRS J2000',
        source: IAU_CONSTELLATIONS_URL,
        constellationCount: new Set(
          constellations.map((constellation) => constellation.id),
        ).size,
        boundaryCount: constellations.length,
        boundaries: constellations,
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(
    path.join(OUTPUT_DIRECTORY, 'README.md'),
    `# Real-sky data

The star catalog is generated from the official ESA Gaia DR3 TAP service:
${TAP_URL}

The binary contains the ${brightStars.length.toLocaleString('en-US')} brightest
returned Gaia DR3 sources followed by a deduplicated random-index sample of
${densityStars.length.toLocaleString('en-US')} sources used to show the
large-scale Milky Way density. Exact ADQL queries and the binary record layout
are stored in \`gaia-dr3-stars.json\`.

Constellation overlays use the official IAU J2000 boundary text files linked
from:
${IAU_CONSTELLATIONS_URL}

Regenerate all assets from the repository root with:

\`\`\`bash
npm run generate:sky
\`\`\`
`,
  )

  console.log(
    `Wrote ${stars.length.toLocaleString('en-US')} stars and ${constellations.length} boundary polygons to ${OUTPUT_DIRECTORY}`,
  )
}

await main()
