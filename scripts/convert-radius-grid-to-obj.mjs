import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

const [, , inputPath, outputPath] = process.argv

if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node scripts/convert-radius-grid-to-obj.mjs input.tab output.obj',
  )
}

const rows = (await readFile(inputPath, 'utf8'))
  .trim()
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/).map(Number))

const byLongitude = new Map()
for (const [longitude, latitude, radius] of rows) {
  if (longitude === 360) continue
  const column = byLongitude.get(longitude) ?? []
  column.push({ latitude, radius })
  byLongitude.set(longitude, column)
}

const longitudes = [...byLongitude.keys()].sort((a, b) => a - b)
const latitudeCount = byLongitude.get(longitudes[0])?.length ?? 0
const output = [
  `# Generated from ${basename(inputPath)}`,
  '# Longitude/latitude radius grid archived by the NASA Planetary Data System.',
]

for (const longitude of longitudes) {
  const longitudeRadians = (longitude * Math.PI) / 180
  const column = byLongitude.get(longitude)
  column.sort((a, b) => a.latitude - b.latitude)

  for (const { latitude, radius } of column) {
    const latitudeRadians = (latitude * Math.PI) / 180
    const horizontalRadius = radius * Math.cos(latitudeRadians)
    const x = horizontalRadius * Math.cos(longitudeRadians)
    const y = radius * Math.sin(latitudeRadians)
    const z = horizontalRadius * Math.sin(longitudeRadians)
    output.push(`v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`)
  }
}

const vertexIndex = (longitudeIndex, latitudeIndex) =>
  longitudeIndex * latitudeCount + latitudeIndex + 1

for (
  let longitudeIndex = 0;
  longitudeIndex < longitudes.length;
  longitudeIndex += 1
) {
  const nextLongitudeIndex = (longitudeIndex + 1) % longitudes.length
  for (let latitudeIndex = 0; latitudeIndex < latitudeCount - 1; latitudeIndex += 1) {
    const lowerLeft = vertexIndex(longitudeIndex, latitudeIndex)
    const upperLeft = vertexIndex(longitudeIndex, latitudeIndex + 1)
    const lowerRight = vertexIndex(nextLongitudeIndex, latitudeIndex)
    const upperRight = vertexIndex(nextLongitudeIndex, latitudeIndex + 1)
    output.push(`f ${lowerLeft} ${upperRight} ${lowerRight}`)
    output.push(`f ${lowerLeft} ${upperLeft} ${upperRight}`)
  }
}

await writeFile(outputPath, `${output.join('\n')}\n`)
