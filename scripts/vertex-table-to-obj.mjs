import { createReadStream, createWriteStream } from 'node:fs'
import { createInterface } from 'node:readline'

const [, , inputPath, outputPath] = process.argv

if (!inputPath || !outputPath) {
  throw new Error(
    'Usage: node scripts/vertex-table-to-obj.mjs input.tab output.obj',
  )
}

const input = createInterface({
  input: createReadStream(inputPath),
  crlfDelay: Infinity,
})
const output = createWriteStream(outputPath)
let vertexCount = 0
let facetCount = 0
let lineIndex = 0

for await (const line of input) {
  const values = line.trim().split(/\s+/)
  if (lineIndex === 0) {
    vertexCount = Number(values[0])
    facetCount = Number(values[1])
    output.write(`# Generated from ${inputPath}\n`)
    output.write(
      '# Vertex/facet shape model archived by the NASA Planetary Data System.\n',
    )
  } else if (lineIndex <= vertexCount) {
    output.write(`v ${values[1]} ${values[2]} ${values[3]}\n`)
  } else if (lineIndex <= vertexCount + facetCount) {
    output.write(`f ${values[1]} ${values[2]} ${values[3]}\n`)
  }
  lineIndex += 1
}

await new Promise((resolve, reject) => {
  output.end(resolve)
  output.on('error', reject)
})

console.log(`${outputPath}: ${vertexCount} vertices, ${facetCount} triangles`)
