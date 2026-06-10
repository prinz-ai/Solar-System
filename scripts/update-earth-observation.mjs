import { execFile } from 'node:child_process'
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const requestedDate = process.argv[2]
const date =
  requestedDate ??
  new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString().slice(0, 10)
const outputDirectory = join(root, 'public', 'earth')
const texturePath = join(outputDirectory, 'viirs-latest.jpg')
const representativeCloudPath = join(
  outputDirectory,
  'clouds-representative.webp',
)
const cloudMaskPath = join(outputDirectory, 'cloud-mask-temporary.png')
const rawSnppPath = join(outputDirectory, 'viirs-snpp-raw.jpg')
const rawNoaa20Path = join(outputDirectory, 'viirs-noaa20-raw.jpg')
const baseTexturePath = join(
  root,
  'public',
  'textures',
  'earth-blue-marble-bathymetry.jpg',
)
const metadataPath = join(
  root,
  'src',
  'data',
  'generatedEarthObservation.json',
)
function gibsUrl(layer) {
  const url = new URL(
    'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
  )
  url.search = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/jpeg',
    TRANSPARENT: 'FALSE',
    HEIGHT: '4096',
    WIDTH: '8192',
    CRS: 'EPSG:4326',
    BBOX: '-90,-180,90,180',
    TIME: date,
  }).toString()
  return url.toString()
}

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  execute('curl', [
    '-fL',
    '--retry',
    '3',
    '-o',
    rawSnppPath,
    gibsUrl('VIIRS_SNPP_CorrectedReflectance_TrueColor'),
  ]),
  execute('curl', [
    '-fL',
    '--retry',
    '3',
    '-o',
    rawNoaa20Path,
    gibsUrl('VIIRS_NOAA20_CorrectedReflectance_TrueColor'),
  ]),
])
try {
  await execute('magick', [
    baseTexturePath,
    '(',
    rawNoaa20Path,
    '-alpha',
    'on',
    '-fuzz',
    '2%',
    '-transparent',
    'black',
    '-channel',
    'A',
    '-blur',
    '0x4',
    '+channel',
    ')',
    '-compose',
    'over',
    '-composite',
    '(',
    rawSnppPath,
    '-alpha',
    'on',
    '-fuzz',
    '2%',
    '-transparent',
    'black',
    '-channel',
    'A',
    '-blur',
    '0x4',
    '+channel',
    ')',
    '-compose',
    'over',
    '-composite',
    '-unsharp',
    '0x0.45+0.45+0.004',
    '-sampling-factor',
    '4:2:0',
    '-interlace',
    'Plane',
    '-quality',
    '90',
    texturePath,
  ])
} catch {
  await copyFile(rawSnppPath, texturePath)
}
try {
  await execute('magick', [
    texturePath,
    baseTexturePath,
    '-fx',
    'max(0,(((u.r+u.g+u.b)-(v.r+v.g+v.b))/3)*3.2)',
    '-colorspace',
    'Gray',
    '-resize',
    '4096x2048!',
    cloudMaskPath,
  ])
  await execute('magick', [
    texturePath,
    '-resize',
    '4096x2048!',
    cloudMaskPath,
    '-alpha',
    'off',
    '-compose',
    'CopyOpacity',
    '-composite',
    '-define',
    'webp:method=6',
    '-quality',
    '90',
    representativeCloudPath,
  ])
} catch {
  console.warn(
    'ImageMagick could not refresh the representative Earth cloud layer.',
  )
} finally {
  await rm(cloudMaskPath, { force: true })
}
await Promise.all([
  rm(rawSnppPath, { force: true }),
  rm(rawNoaa20Path, { force: true }),
])
await writeFile(
  metadataPath,
  `${JSON.stringify(
    {
      date,
      texturePath: '/earth/viirs-latest.jpg',
      sourceUrl: 'https://gibs.earthdata.nasa.gov/',
      sourceName:
        'NASA GIBS Suomi-NPP and NOAA-20 VIIRS corrected reflectance true color',
    },
    null,
    2,
  )}\n`,
)
console.log(`${texturePath}: NASA VIIRS observation for ${date}`)
console.log(`${representativeCloudPath}: persistent cloud layer`)
