import {
  CanvasTexture,
  Color,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three'

const textureCache = new Map<string, Texture>()

export interface CloudLayerDefinition {
  color: string
  opacity: number
  scale: number
  rotationHours: number
  opaque?: boolean
}

const CLOUD_LAYERS: Record<string, CloudLayerDefinition> = {
  venus: {
    color: '#fff4c9',
    opacity: 1,
    scale: 1.012,
    rotationHours: -96,
    opaque: true,
  },
  earth: {
    color: '#ffffff',
    opacity: 0.48,
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
    color: '#d9ffff',
    opacity: 0.18,
    scale: 1.008,
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
  { url: string; longitudeDirection: 'east' | 'west' }
> = {
  mercury: {
    url: '/textures/mercury-messenger.jpg',
    longitudeDirection: 'east',
  },
  venus: {
    url: '/textures/venus-magellan.jpg',
    longitudeDirection: 'east',
  },
  earth: {
    url: '/textures/earth-blue-marble-bathymetry.jpg',
    longitudeDirection: 'east',
  },
  moon: {
    url: '/textures/moon-lro.jpg',
    longitudeDirection: 'east',
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
    url: '/textures/io-galileo.jpg',
    longitudeDirection: 'west',
  },
  europa: {
    url: '/textures/europa-voyager.jpg',
    longitudeDirection: 'west',
  },
  ganymede: {
    url: '/textures/ganymede-galileo.jpg',
    longitudeDirection: 'west',
  },
  callisto: {
    url: '/textures/callisto-voyager.jpg',
    longitudeDirection: 'west',
  },
  titan: {
    url: '/textures/titan-cassini.jpg',
    longitudeDirection: 'west',
  },
}

export function hasBodyTexture(id: string) {
  return id in IMAGE_TEXTURES
}

export function usesWestLongitudeTexture(id: string) {
  return IMAGE_TEXTURES[id]?.longitudeDirection === 'west'
}

export function getCloudLayerDefinition(id: string) {
  return CLOUD_LAYERS[id]
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
      const bands = Math.sin(latitude * 20) * 0.11
      const polarHaze = Math.pow(Math.abs(Math.sin(latitude)), 3) * 0.22
      density = 0.38 + bands + polarHaze + noise * 0.48
      brightness = 0.67 + bands * 0.45 + polarHaze * 0.25
      dark = '#86c9cf'
      light = '#e7ffff'
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
  const width = id === 'venus' || id === 'earth' ? 1024 : 768
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
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.anisotropy = 8
  return texture
}

export function createPlanetTexture(id: string) {
  const cached = textureCache.get(id)
  if (cached) return cached

  if (id.endsWith('-clouds')) {
    const bodyId = id.slice(0, -'-clouds'.length)
    const texture = createCloudTexture(bodyId)
    textureCache.set(id, texture)
    return texture
  }

  const imageTexture = IMAGE_TEXTURES[id]
  if (imageTexture) {
    const texture = new TextureLoader().load(imageTexture.url)
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.anisotropy = 16
    textureCache.set(id, texture)
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
  texture.anisotropy = 8
  textureCache.set(id, texture)
  return texture
}
