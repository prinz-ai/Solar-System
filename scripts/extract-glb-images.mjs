import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'

const [inputArgument, outputArgument] = process.argv.slice(2)
if (!inputArgument || !outputArgument) {
  throw new Error(
    'Usage: node scripts/extract-glb-images.mjs input.glb output-prefix',
  )
}

const input = resolve(inputArgument)
const outputPrefix = resolve(outputArgument)
const file = await readFile(input)
if (file.toString('ascii', 0, 4) !== 'glTF') {
  throw new Error(`${input} is not a binary glTF file`)
}

let offset = 12
let document
let binary
while (offset < file.length) {
  const length = file.readUInt32LE(offset)
  const type = file.toString('ascii', offset + 4, offset + 8)
  const data = file.subarray(offset + 8, offset + 8 + length)
  if (type === 'JSON') {
    document = JSON.parse(data.toString('utf8').replace(/\0+$/, ''))
  } else if (type === 'BIN\0') {
    binary = data
  }
  offset += 8 + length
}

if (!document || !binary) throw new Error(`${input} has no embedded GLB data`)
await mkdir(dirname(outputPrefix), { recursive: true })

for (const [index, image] of (document.images ?? []).entries()) {
  if (image.bufferView === undefined) continue
  const view = document.bufferViews[image.bufferView]
  const start = view.byteOffset ?? 0
  const bytes = binary.subarray(start, start + view.byteLength)
  const extension =
    image.mimeType === 'image/webp'
      ? '.webp'
      : image.mimeType === 'image/png'
        ? '.png'
        : image.mimeType === 'image/jpeg'
          ? '.jpg'
          : extname(image.name ?? '') || '.bin'
  const output = `${outputPrefix}-${index}${extension}`
  await writeFile(output, bytes)
  console.log(`${output}: ${bytes.length} bytes`)
}
