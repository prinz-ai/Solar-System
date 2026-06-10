import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SOURCE_PATH = path.resolve(
  'public/sky/constellation-figures.json',
)
const OUTPUT_DIRECTORY = path.resolve(
  process.argv[2] ?? '/tmp/constellation-audit',
)
const COLUMNS = 4
const ROWS = 6
const TILE_WIDTH = 390
const TILE_HEIGHT = 285
const PAGE_SIZE = 22

function vector(star) {
  const ra = (star.raDeg * Math.PI) / 180
  const dec = (star.decDeg * Math.PI) / 180
  const cosDec = Math.cos(dec)
  return [
    cosDec * Math.cos(ra),
    cosDec * Math.sin(ra),
    Math.sin(dec),
  ]
}

function normalize(value) {
  const length = Math.hypot(...value)
  return value.map((component) => component / length)
}

function cross(first, second) {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ]
}

function dot(first, second) {
  return (
    first[0] * second[0] +
    first[1] * second[1] +
    first[2] * second[2]
  )
}

function projectFigure(figure) {
  const uniqueStars = new Map()
  for (const path of figure.paths) {
    for (const star of path.stars) uniqueStars.set(star.hip, star)
  }
  const center = normalize(
    [...uniqueStars.values()]
      .map(vector)
      .reduce(
        (sum, point) => sum.map((value, index) => value + point[index]),
        [0, 0, 0],
      ),
  )
  let east = cross([0, 0, 1], center)
  if (Math.hypot(...east) < 0.01) east = cross([1, 0, 0], center)
  east = normalize(east)
  const north = normalize(cross(center, east))

  const projected = new Map()
  for (const star of uniqueStars.values()) {
    const point = vector(star)
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(center, point))))
    const sine = Math.sin(angle)
    const scale = sine > 0.000001 ? angle / sine : 1
    projected.set(star.hip, {
      x: dot(point, east) * scale,
      y: -dot(point, north) * scale,
      magnitude: star.magnitude,
    })
  }
  return projected
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderTile(figure, index, names) {
  const column = index % COLUMNS
  const row = Math.floor(index / COLUMNS)
  const originX = column * TILE_WIDTH
  const originY = row * TILE_HEIGHT
  const projected = projectFigure(figure)
  const points = [...projected.values()]
  const minX = Math.min(...points.map(({ x }) => x))
  const maxX = Math.max(...points.map(({ x }) => x))
  const minY = Math.min(...points.map(({ y }) => y))
  const maxY = Math.max(...points.map(({ y }) => y))
  const scale = Math.min(
    315 / Math.max(0.04, maxX - minX),
    205 / Math.max(0.04, maxY - minY),
  )
  const centerX = originX + TILE_WIDTH / 2
  const centerY = originY + 155
  const mapPoint = ({ x, y }) => [
    centerX + (x - (minX + maxX) / 2) * scale,
    centerY + (y - (minY + maxY) / 2) * scale,
  ]

  const lines = figure.paths
    .map((path) => {
      const coordinates = path.stars
        .map((star) => mapPoint(projected.get(star.hip)))
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' ')
      return `<polyline class="${path.style}" points="${coordinates}"/>`
    })
    .join('')
  const stars = [...projected.entries()]
    .map(([hip, point]) => {
      const [x, y] = mapPoint(point)
      const radius = Math.max(1.8, Math.min(5.2, 5.4 - point.magnitude * 0.65))
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}"><title>HIP ${hip}</title></circle>`
    })
    .join('')

  return `
    <g>
      <rect class="tile" x="${originX + 6}" y="${originY + 6}" width="${TILE_WIDTH - 12}" height="${TILE_HEIGHT - 12}" rx="10"/>
      <text class="id" x="${originX + 20}" y="${originY + 30}">${figure.id}</text>
      <text class="name" x="${originX + 64}" y="${originY + 30}">${escapeXml(names.get(figure.id) ?? figure.id)}</text>
      ${lines}
      ${stars}
    </g>`
}

async function main() {
  const data = JSON.parse(await readFile(SOURCE_PATH, 'utf8'))
  const catalogSource = await readFile(
    path.resolve('src/lib/constellations.ts'),
    'utf8',
  )
  const names = new Map(
    [...catalogSource.matchAll(/\{ id: '([^']+)', name: '([^']+)'/g)].map(
      ([, id, name]) => [id, name],
    ),
  )
  await mkdir(OUTPUT_DIRECTORY, { recursive: true })

  for (
    let pageIndex = 0;
    pageIndex * PAGE_SIZE < data.constellations.length;
    pageIndex += 1
  ) {
    const figures = data.constellations.slice(
      pageIndex * PAGE_SIZE,
      (pageIndex + 1) * PAGE_SIZE,
    )
    const tiles = figures
      .map((figure, index) => renderTile(figure, index, names))
      .join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLUMNS * TILE_WIDTH}" height="${ROWS * TILE_HEIGHT}" viewBox="0 0 ${COLUMNS * TILE_WIDTH} ${ROWS * TILE_HEIGHT}">
      <rect width="100%" height="100%" fill="#020713"/>
      <style>
        .tile { fill: #07111f; stroke: #17334a; stroke-width: 1; }
        .id { fill: #55c9eb; font-family: Arial, sans-serif; font-size: 17px; font-weight: 700; letter-spacing: 2px; }
        .name { fill: #dff7ff; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; }
        polyline { fill: none; stroke: #8bdff4; stroke-linecap: round; stroke-linejoin: round; }
        polyline.bold { stroke-width: 3; opacity: .84; }
        polyline.normal { stroke-width: 2; opacity: .6; }
        polyline.thin { stroke-width: 1.3; opacity: .38; }
        circle { fill: #fff; stroke: #70d9f8; stroke-width: 1; }
      </style>
      ${tiles}
    </svg>`
    await writeFile(
      path.join(
        OUTPUT_DIRECTORY,
        `constellation-audit-${pageIndex + 1}.svg`,
      ),
      svg,
    )
  }

  console.log(
    `Wrote ${Math.ceil(data.constellations.length / PAGE_SIZE)} audit sheets to ${OUTPUT_DIRECTORY}`,
  )
}

await main()
