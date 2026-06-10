import {
  CanvasTexture,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'

const textureCache = new Map<string, Texture>()

type TextureReadyCallback = () => void

function notifyTextureReady(texture: Texture) {
  texture.userData.ready = true
  const callbacks = texture.userData.readyCallbacks as
    | Set<TextureReadyCallback>
    | undefined
  callbacks?.forEach((callback) => callback())
  callbacks?.clear()
}

function onTextureReady(
  texture: Texture,
  callback: TextureReadyCallback | undefined,
) {
  if (!callback) return
  if (texture.userData.ready) {
    queueMicrotask(callback)
    return
  }

  const callbacks =
    (texture.userData.readyCallbacks as
      | Set<TextureReadyCallback>
      | undefined) ?? new Set<TextureReadyCallback>()
  callbacks.add(callback)
  texture.userData.readyCallbacks = callbacks
}

export interface CloudLayerDefinition {
  color: string
  opacity: number
  scale: number
  rotationHours: number
  opaque?: boolean
}

const CLOUD_LAYERS: Record<string, CloudLayerDefinition> = {
  venus: {
    color: '#fffaf0',
    opacity: 1,
    scale: 1.012,
    rotationHours: -96,
    opaque: true,
  },
  earth: {
    color: '#ffffff',
    opacity: 1,
    scale: 1.012,
    rotationHours: 20,
  },
  mars: {
    color: '#f4d1b4',
    opacity: 0.25,
    scale: 1.01,
    rotationHours: 24.35,
  },
  jupiter: {
    color: '#fff0d1',
    opacity: 0.18,
    scale: 1.006,
    rotationHours: 9.84,
  },
  saturn: {
    color: '#fff0c7',
    opacity: 0.28,
    scale: 1.007,
    rotationHours: 10.5,
  },
  uranus: {
    color: '#ffffff',
    opacity: 0.72,
    scale: 1.006,
    rotationHours: -16.6,
  },
  neptune: {
    color: '#dce9ff',
    opacity: 0.42,
    scale: 1.008,
    rotationHours: 15.8,
  },
}

const IMAGE_TEXTURES: Record<
  string,
  {
    url: string
    longitudeDirection: 'east' | 'west'
    highDetail?: boolean
    dataTexture?: boolean
  }
> = {
  mercury: {
    url: '/textures/mercury-messenger.jpg',
    longitudeDirection: 'east',
  },
  venus: {
    url: '/textures/venus-magellan.jpg',
    longitudeDirection: 'east',
  },
  'venus-clouds': {
    url: '/textures/venus-mariner-clouds.jpg',
    longitudeDirection: 'east',
  },
  earth: {
    url: '/textures/earth-blue-marble-bathymetry.jpg',
    longitudeDirection: 'east',
    highDetail: true,
  },
  'earth-observation': {
    url: '/earth/viirs-latest.jpg',
    longitudeDirection: 'east',
    highDetail: true,
  },
  'earth-clouds': {
    url: '/earth/clouds-representative.webp',
    longitudeDirection: 'east',
    highDetail: true,
  },
  'earth-roughness': {
    url: '/textures/earth-roughness.jpg',
    longitudeDirection: 'east',
    highDetail: true,
    dataTexture: true,
  },
  moon: {
    url: '/textures/moon-lro-4k.webp',
    longitudeDirection: 'east',
    highDetail: true,
  },
  'moon-relief': {
    url: '/textures/relief/moon.webp',
    longitudeDirection: 'east',
    highDetail: true,
    dataTexture: true,
  },
  mars: {
    url: '/textures/mars-viking.jpg',
    longitudeDirection: 'east',
  },
  phobos: {
    url: '/textures/phobos-mars-express.jpg',
    longitudeDirection: 'east',
  },
  deimos: {
    url: '/textures/deimos-viking.jpg',
    longitudeDirection: 'west',
  },
  jupiter: {
    url: '/textures/jupiter-voyager-red-spot.jpg',
    longitudeDirection: 'west',
  },
  io: {
    url: '/textures/io-galileo-4k.webp',
    longitudeDirection: 'west',
    highDetail: true,
  },
  'io-context': {
    url: '/textures/io-galileo.jpg',
    longitudeDirection: 'west',
  },
  europa: {
    url: '/textures/europa-voyager.jpg',
    longitudeDirection: 'west',
    highDetail: true,
  },
  ganymede: {
    url: '/textures/ganymede-galileo-4k.webp',
    longitudeDirection: 'west',
    highDetail: true,
  },
  'ganymede-context': {
    url: '/textures/ganymede-galileo.jpg',
    longitudeDirection: 'west',
  },
  callisto: {
    url: '/textures/callisto-voyager-4k.webp',
    longitudeDirection: 'west',
    highDetail: true,
  },
  'callisto-context': {
    url: '/textures/callisto-voyager.jpg',
    longitudeDirection: 'west',
  },
  titan: {
    url: '/textures/titan-cassini-radar.jpg',
    longitudeDirection: 'west',
    highDetail: true,
  },
  'io-relief': {
    url: '/textures/relief/io.webp',
    longitudeDirection: 'west',
    highDetail: true,
    dataTexture: true,
  },
  'europa-relief': {
    url: '/textures/relief/europa.webp',
    longitudeDirection: 'west',
    highDetail: true,
    dataTexture: true,
  },
  'ganymede-relief': {
    url: '/textures/relief/ganymede.webp',
    longitudeDirection: 'west',
    highDetail: true,
    dataTexture: true,
  },
  'callisto-relief': {
    url: '/textures/relief/callisto.webp',
    longitudeDirection: 'west',
    highDetail: true,
    dataTexture: true,
  },
  'titan-relief': {
    url: '/textures/relief/titan.webp',
    longitudeDirection: 'west',
    highDetail: true,
    dataTexture: true,
  },
}

const SURFACE_RELIEF: Record<string, { textureId: string; bumpScale: number }> = {
  moon: { textureId: 'moon-relief', bumpScale: 0.026 },
  io: { textureId: 'io-relief', bumpScale: 0.012 },
  europa: { textureId: 'europa-relief', bumpScale: 0.016 },
  ganymede: { textureId: 'ganymede-relief', bumpScale: 0.02 },
  callisto: { textureId: 'callisto-relief', bumpScale: 0.024 },
  titan: { textureId: 'titan-relief', bumpScale: 0.012 },
}

const CONTEXT_SURFACE_TEXTURES: Record<string, string> = {
  moon: 'moon',
  io: 'io-context',
  europa: 'europa',
  ganymede: 'ganymede-context',
  callisto: 'callisto-context',
  titan: 'titan',
}

export function hasBodyTexture(id: string) {
  return id in IMAGE_TEXTURES
}

export function getContextSurfaceTextureId(id: string) {
  return CONTEXT_SURFACE_TEXTURES[id]
}

export function usesWestLongitudeTexture(id: string) {
  return IMAGE_TEXTURES[id]?.longitudeDirection === 'west'
}

export function getCloudLayerDefinition(id: string) {
  return CLOUD_LAYERS[id]
}

export function getSurfaceReliefDefinition(id: string) {
  return SURFACE_RELIEF[id]
}

function hash(x: number, y: number, seed: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.17) * 43_758.5453
  return value - Math.floor(value)
}

function smoothNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const xBlend = (x - x0) ** 2 * (3 - 2 * (x - x0))
  const yBlend = (y - y0) ** 2 * (3 - 2 * (y - y0))
  const top =
    hash(x0, y0, seed) * (1 - xBlend) +
    hash(x0 + 1, y0, seed) * xBlend
  const bottom =
    hash(x0, y0 + 1, seed) * (1 - xBlend) +
    hash(x0 + 1, y0 + 1, seed) * xBlend

  return top * (1 - yBlend) + bottom * yBlend
}

function layeredNoise(x: number, y: number, seed: number) {
  let value = 0
  let amplitude = 0.55
  let frequency = 0.014
  for (let octave = 0; octave < 5; octave += 1) {
    value +=
      (smoothNoise(
        x * frequency,
        y * frequency,
        seed + octave,
      ) -
        0.5) *
      amplitude
    amplitude *= 0.52
    frequency *= 2.08
  }
  return value
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const amount = Math.max(
    0,
    Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)),
  )
  return amount * amount * (3 - 2 * amount)
}

function ovalMask(
  longitude: number,
  latitude: number,
  centerLongitude: number,
  centerLatitude: number,
  longitudeRadius: number,
  latitudeRadius: number,
) {
  const rawLongitudeDistance = Math.abs(longitude - centerLongitude)
  const longitudeDistance = Math.min(
    rawLongitudeDistance,
    Math.PI * 2 - rawLongitudeDistance,
  )
  const normalizedDistance =
    (longitudeDistance / longitudeRadius) ** 2 +
    ((latitude - centerLatitude) / latitudeRadius) ** 2
  const amount = Math.max(0, 1 - normalizedDistance)
  return amount * amount
}

function mixColor(base: string, light: string, amount: number) {
  const a = new Color(base)
  const b = new Color(light)
  a.lerp(b, Math.max(0, Math.min(1, amount)))
  return [
    Math.round(a.r * 255),
    Math.round(a.g * 255),
    Math.round(a.b * 255),
  ]
}

function paletteForPlanet(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const latitude = y / height
  const longitude = x / width
  const noise = layeredNoise(x, y, id.length * 19)

  switch (id) {
    case 'sun': {
      const fire = 0.5 + noise * 0.6 + Math.sin(y * 0.22) * 0.08
      return mixColor('#e95b0c', '#ffe465', fire)
    }
    case 'mercury': {
      return mixColor('#625e59', '#c9c2b7', 0.48 + noise * 0.5)
    }
    case 'venus': {
      const swirl =
        Math.sin(y * 0.13 + Math.sin(x * 0.018) * 4.5) * 0.16 + noise * 0.3
      return mixColor('#925729', '#f2d287', 0.55 + swirl)
    }
    case 'earth': {
      const continents =
        Math.sin(longitude * 17 + Math.sin(latitude * 9) * 2.2) +
        Math.sin(longitude * 31 - latitude * 13) * 0.52 +
        noise * 3.2
      const polar = Math.abs(latitude - 0.5) * 2
      if (polar > 0.86 + noise * 0.1) {
        return mixColor('#b9d8e2', '#ffffff', polar)
      }
      if (continents > 0.7) {
        const dry = Math.max(0, Math.sin(longitude * 11 + latitude * 5))
        return mixColor('#326a39', '#b59a55', 0.28 + dry * 0.46 + noise * 0.2)
      }
      return mixColor('#083b75', '#2b8cc4', 0.5 + noise * 0.24)
    }
    case 'mars': {
      const dark = Math.sin(x * 0.035 + Math.sin(y * 0.06) * 2) * 0.16
      return mixColor('#6f291a', '#df7443', 0.52 + noise * 0.46 + dark)
    }
    case 'jupiter': {
      const bands =
        Math.sin(y * 0.11) * 0.17 +
        Math.sin(y * 0.031 + Math.sin(x * 0.018) * 1.4) * 0.22
      return mixColor('#74412f', '#e6c994', 0.63 + bands + noise * 0.16)
    }
    case 'saturn': {
      const bands = Math.sin(y * 0.095) * 0.11 + Math.sin(y * 0.021) * 0.12
      return mixColor('#9d7748', '#ead9a5', 0.63 + bands + noise * 0.08)
    }
    case 'uranus': {
      const band = Math.sin(y * 0.045) * 0.035 + noise * 0.035
      return mixColor('#5fb8bd', '#b9eef0', 0.58 + band)
    }
    case 'neptune': {
      const clouds =
        Math.sin(y * 0.08 + Math.sin(x * 0.022) * 2) * 0.09 + noise * 0.16
      return mixColor('#173c9c', '#5d8ff0', 0.48 + clouds)
    }
    case 'pluto': {
      const patch =
        Math.sin(x * 0.028) * Math.cos(y * 0.041) * 0.22 + noise * 0.4
      return mixColor('#6d5c50', '#d9c8ae', 0.52 + patch)
    }
    default:
      return mixColor('#777777', '#dddddd', 0.5 + noise * 0.3)
  }
}

function addFeatures(
  context: CanvasRenderingContext2D,
  id: string,
  width: number,
  height: number,
) {
  if (id === 'jupiter') {
    const gradient = context.createRadialGradient(
      width * 0.68,
      height * 0.67,
      4,
      width * 0.68,
      height * 0.67,
      width * 0.075,
    )
    gradient.addColorStop(0, 'rgba(210,102,62,.95)')
    gradient.addColorStop(0.65, 'rgba(155,66,43,.7)')
    gradient.addColorStop(1, 'rgba(100,35,25,0)')
    context.fillStyle = gradient
    context.beginPath()
    context.ellipse(
      width * 0.68,
      height * 0.67,
      width * 0.075,
      height * 0.052,
      -0.08,
      0,
      Math.PI * 2,
    )
    context.fill()
  }

  if (id === 'mercury' || id === 'mars' || id === 'pluto') {
    const count = id === 'mercury' ? 85 : 34
    context.globalCompositeOperation = 'multiply'
    for (let index = 0; index < count; index += 1) {
      const x = hash(index, 11, id.length) * width
      const y = hash(index, 29, id.length) * height
      const radius = 1 + hash(index, 47, id.length) * (id === 'mercury' ? 9 : 5)
      context.strokeStyle = `rgba(40,25,20,${0.08 + hash(index, 7, 3) * 0.15})`
      context.lineWidth = Math.max(1, radius * 0.22)
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.stroke()
    }
    context.globalCompositeOperation = 'source-over'
  }

  if (id === 'earth') {
    context.globalCompositeOperation = 'screen'
    context.strokeStyle = 'rgba(255,255,255,.34)'
    context.lineWidth = 2.4
    for (let line = 0; line < 24; line += 1) {
      const y = hash(line, 1, 8) * height
      context.beginPath()
      for (let x = 0; x <= width; x += 16) {
        const wave = y + Math.sin(x * 0.025 + line) * 9
        if (x === 0) context.moveTo(x, wave)
        else context.lineTo(x, wave)
      }
      context.stroke()
    }
    context.globalCompositeOperation = 'source-over'
  }
}

function cloudPixel(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const latitude = (y / height - 0.5) * Math.PI
  const longitude = (x / width) * Math.PI * 2
  const noise = layeredNoise(x * 1.25, y * 1.25, id.length * 37 + 9)
  let brightness = 0.65
  let density = 0.5
  let dark = '#b9c9d3'
  let light = '#ffffff'

  switch (id) {
    case 'venus': {
      const chevron =
        Math.sin(longitude * 5 + Math.sin(latitude * 3.2) * 3.5) * 0.16
      const bands =
        Math.sin(latitude * 28 + Math.sin(longitude * 2) * 2) * 0.1
      brightness = 0.58 + chevron + bands + noise * 0.42
      density = 1
      dark = '#b86f25'
      light = '#fff0b0'
      break
    }
    case 'earth': {
      const fronts =
        Math.sin(longitude * 4.5 + Math.sin(latitude * 5) * 2.8) * 0.18 +
        Math.sin(longitude * 9 - latitude * 17) * 0.09
      density = Math.max(0, 0.12 + noise * 2.1 + fronts) * 1.35
      brightness = 0.72 + noise * 0.42 + fronts * 0.45
      dark = '#a9c9da'
      break
    }
    case 'mars': {
      const dustBands =
        Math.sin(latitude * 16 + Math.sin(longitude * 3) * 1.7) * 0.12
      const polarClouds = Math.pow(Math.abs(Math.sin(latitude)), 9) * 0.65
      density = 0.04 + noise * 1.25 + dustBands + polarClouds
      brightness = 0.64 + noise * 0.42 + polarClouds * 0.35
      dark = '#c6926f'
      light = '#fff1dd'
      break
    }
    case 'jupiter': {
      const belts =
        Math.sin(latitude * 34 + Math.sin(longitude * 3) * 1.4) * 0.2 +
        Math.sin(latitude * 71 - longitude * 2) * 0.06
      density = 0.4 + belts + noise * 1.15
      brightness = 0.59 + belts * 0.55 + noise * 0.35
      dark = '#a67950'
      light = '#fff1cf'
      break
    }
    case 'saturn': {
      const ribbons =
        Math.sin(latitude * 43 + Math.sin(longitude * 2) * 0.8) * 0.16 +
        Math.sin(latitude * 89) * 0.045
      density = 0.43 + ribbons + noise * 0.82
      brightness = 0.66 + ribbons * 0.62 + noise * 0.28
      dark = '#b58f5b'
      light = '#fff2c9'
      break
    }
    case 'uranus': {
      const northPolarCap = smoothStep(0.28, 1.2, latitude)
      const capBoundary =
        1 - smoothStep(0.035, 0.13, Math.abs(latitude - 0.34))
      const broadBands =
        Math.sin(latitude * 19 + Math.sin(longitude * 2) * 0.45) * 0.04
      const fineBands = Math.sin(latitude * 47 - longitude * 1.7) * 0.014
      const latitudeTextureWeight = Math.cos(latitude) ** 2
      const cloudCells =
        (Math.sin(longitude * 8 + latitude * 11 + noise * 5) * 0.075 +
          Math.sin(longitude * 17 - latitude * 7) * 0.028 +
          noise * 0.22) *
        latitudeTextureWeight
      const capEdgeStorm =
        ovalMask(longitude, latitude, -1.05, 0.42, 0.48, 0.13) * 0.95
      const midLatitudeStorm =
        ovalMask(longitude, latitude, 1.82, 0.18, 0.38, 0.11) * 0.82
      const faintStorm =
        ovalMask(longitude, latitude, 0.45, 0.52, 0.5, 0.13) * 0.42
      const farStorm =
        ovalMask(longitude, latitude, -2.58, 0.23, 0.4, 0.11) * 0.7
      const trailingStorm =
        ovalMask(longitude, latitude, 2.76, 0.48, 0.45, 0.12) * 0.55
      const smallStorm =
        ovalMask(longitude, latitude, -0.08, 0.27, 0.3, 0.09) * 0.48
      const storms =
        capEdgeStorm +
        midLatitudeStorm +
        faintStorm +
        farStorm +
        trailingStorm +
        smallStorm

      density =
        0.17 +
        northPolarCap * 0.72 +
        capBoundary * 0.62 +
        Math.max(0, broadBands + fineBands) * 0.55 +
        Math.max(0, cloudCells) * 1.1 +
        storms * 0.96 +
        Math.max(0, noise) * 0.05
      brightness =
        0.32 +
        northPolarCap * 0.48 -
        capBoundary * 0.6 +
        broadBands * 0.42 +
        fineBands * 0.25 +
        cloudCells * 1.5 +
        storms * 1.32 +
        noise * 0.06
      dark = '#155b69'
      light = '#ffffff'
      break
    }
    case 'neptune': {
      const streaks =
        Math.sin(latitude * 31 + Math.sin(longitude * 4.5) * 2.4) * 0.17
      const methaneClouds =
        Math.max(0, noise + Math.sin(longitude * 7 - latitude * 13) * 0.12)
      density = 0.14 + streaks * 0.5 + methaneClouds * 2.8
      brightness = 0.67 + streaks * 0.42 + methaneClouds * 0.75
      dark = '#5c8dd8'
      light = '#ffffff'
      break
    }
  }

  const [red, green, blue] = mixColor(dark, light, brightness)
  const alpha =
    id === 'venus'
      ? 255
      : Math.round(Math.max(0, Math.min(1, density)) * 255)

  return [red, green, blue, alpha]
}

function createCloudTexture(id: string) {
  const width =
    id === 'venus' || id === 'earth'
      ? 1024
      : id === 'jupiter' ||
          id === 'saturn' ||
          id === 'uranus' ||
          id === 'neptune'
        ? 1536
        : 1024
  const height = width / 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const image = context.createImageData(width, height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha] = cloudPixel(
        id,
        x,
        y,
        width,
        height,
      )
      const offset = (y * width + x) * 4
      image.data[offset] = red
      image.data[offset + 1] = green
      image.data[offset + 2] = blue
      image.data[offset + 3] = alpha
    }
  }

  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 12
  return texture
}

function createSunGlowTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, 'rgba(255,244,190,1)')
  gradient.addColorStop(0.18, 'rgba(255,174,48,.8)')
  gradient.addColorStop(0.48, 'rgba(255,92,10,.3)')
  gradient.addColorStop(1, 'rgba(255,70,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  return texture
}

function createSunCoronaTexture() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const center = size / 2

  context.translate(center, center)
  for (let index = 0; index < 180; index += 1) {
    const angle = (index / 180) * Math.PI * 2
    const wave =
      Math.sin(index * 12.9898) * 0.5 + Math.sin(index * 4.371) * 0.5
    const length = size * (0.2 + Math.abs(wave) * 0.25)
    const inner = size * 0.155
    const gradient = context.createLinearGradient(
      Math.cos(angle) * inner,
      Math.sin(angle) * inner,
      Math.cos(angle) * (inner + length),
      Math.sin(angle) * (inner + length),
    )
    gradient.addColorStop(0, 'rgba(255,238,174,.24)')
    gradient.addColorStop(0.22, 'rgba(255,153,54,.12)')
    gradient.addColorStop(1, 'rgba(255,93,20,0)')
    context.strokeStyle = gradient
    context.lineWidth = index % 11 === 0 ? 2.2 : 0.8
    context.beginPath()
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    context.quadraticCurveTo(
      Math.cos(angle + wave * 0.035) * (inner + length * 0.5),
      Math.sin(angle + wave * 0.035) * (inner + length * 0.5),
      Math.cos(angle + wave * 0.08) * (inner + length),
      Math.sin(angle + wave * 0.08) * (inner + length),
    )
    context.stroke()
  }

  const halo = context.createRadialGradient(0, 0, size * 0.13, 0, 0, size * 0.48)
  halo.addColorStop(0, 'rgba(255,244,202,.42)')
  halo.addColorStop(0.34, 'rgba(255,168,67,.16)')
  halo.addColorStop(1, 'rgba(255,89,16,0)')
  context.fillStyle = halo
  context.fillRect(-center, -center, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  return texture
}

export function createPlanetTexture(
  id: string,
  readyCallback?: TextureReadyCallback,
) {
  const cached = textureCache.get(id)
  if (cached) {
    onTextureReady(cached, readyCallback)
    return cached
  }

  if (id.endsWith('-clouds')) {
    const imageTexture = IMAGE_TEXTURES[id]
    if (imageTexture) {
      const texture = new TextureLoader().load(imageTexture.url, () => {
        notifyTextureReady(texture)
      })
      texture.colorSpace = SRGBColorSpace
      texture.wrapS = RepeatWrapping
      texture.minFilter = imageTexture.highDetail
        ? LinearMipmapLinearFilter
        : LinearFilter
      texture.magFilter = LinearFilter
      texture.generateMipmaps = Boolean(imageTexture.highDetail)
      texture.anisotropy = imageTexture.highDetail ? 16 : 8
      textureCache.set(id, texture)
      onTextureReady(texture, readyCallback)
      return texture
    }
    const bodyId = id.slice(0, -'-clouds'.length)
    const texture = createCloudTexture(bodyId)
    notifyTextureReady(texture)
    textureCache.set(id, texture)
    onTextureReady(texture, readyCallback)
    return texture
  }

  if (id === 'sun-glow') {
    const texture = createSunGlowTexture()
    notifyTextureReady(texture)
    textureCache.set(id, texture)
    onTextureReady(texture, readyCallback)
    return texture
  }

  if (id === 'sun-corona') {
    const texture = createSunCoronaTexture()
    notifyTextureReady(texture)
    textureCache.set(id, texture)
    onTextureReady(texture, readyCallback)
    return texture
  }

  const imageTexture = IMAGE_TEXTURES[id]
  if (imageTexture) {
    const texture = new TextureLoader().load(imageTexture.url, () => {
      notifyTextureReady(texture)
    })
    texture.colorSpace = imageTexture.dataTexture
      ? NoColorSpace
      : SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.minFilter = imageTexture.highDetail
      ? LinearMipmapLinearFilter
      : LinearFilter
    texture.magFilter = LinearFilter
    texture.generateMipmaps = Boolean(imageTexture.highDetail)
    texture.anisotropy = imageTexture.highDetail ? 16 : 8
    textureCache.set(id, texture)
    onTextureReady(texture, readyCallback)
    return texture
  }

  const width = 768
  const height = 384
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const image = context.createImageData(width, height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue] = paletteForPlanet(id, x, y, width, height)
      const offset = (y * width + x) * 4
      image.data[offset] = red
      image.data[offset + 1] = green
      image.data[offset + 2] = blue
      image.data[offset + 3] = 255
    }
  }

  context.putImageData(image, 0, 0)
  addFeatures(context, id, width, height)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.anisotropy = 4
  notifyTextureReady(texture)
  textureCache.set(id, texture)
  onTextureReady(texture, readyCallback)
  return texture
}

export function releasePlanetTexture(id: string, texture: Texture) {
  if (textureCache.get(id) !== texture) return
  textureCache.delete(id)
  const callbacks = texture.userData.readyCallbacks as
    | Set<TextureReadyCallback>
    | undefined
  callbacks?.clear()
  texture.dispose()
}

export function getLoadedTextureIds() {
  return [...textureCache.keys()].sort()
}
