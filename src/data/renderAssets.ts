import type { Vec3 } from '../types'

export type RenderAssetFormat = 'glb' | 'obj'

export interface RenderAsset {
  path: string
  format: RenderAssetFormat
  coverage:
    | 'Global spacecraft mosaic'
    | 'Global DEM and spacecraft mosaic'
    | 'Global topography and mosaic'
    | 'Partial spacecraft mosaic'
    | 'Measured shape model'
    | 'Mission spacecraft model'
    | 'NASA atmospheric composite'
  color?: string
  texturePath?: string
  rotation?: Vec3
}

export const BODY_RENDER_ASSETS: Record<string, RenderAsset> = {
  mercury: {
    path: '/models/usgs/mercury-messenger-dem.obj',
    format: 'obj',
    coverage: 'Global DEM and spacecraft mosaic',
    texturePath: '/textures/mission/mercury-seamless.jpg',
  },
  moon: {
    path: '/models/nasa/moon-lro-topography.glb',
    format: 'glb',
    coverage: 'Global topography and mosaic',
  },
  pluto: {
    path: '/models/nasa/pluto.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  uranus: {
    path: '/models/nasa/uranus.glb',
    format: 'glb',
    coverage: 'NASA atmospheric composite',
  },
  neptune: {
    path: '/models/nasa/neptune.glb',
    format: 'glb',
    coverage: 'NASA atmospheric composite',
  },
  phobos: {
    path: '/models/phobos-nasa.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
    rotation: [0, Math.PI / 2, 0],
  },
  charon: {
    path: '/models/nasa/charon.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  mimas: {
    path: '/models/nasa/mimas.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  enceladus: {
    path: '/models/usgs/enceladus-dem-200m.obj',
    format: 'obj',
    coverage: 'Global DEM and spacecraft mosaic',
    texturePath: '/textures/mission/enceladus-seamless.webp',
  },
  tethys: {
    path: '/models/nasa/tethys.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  dione: {
    path: '/models/nasa/dione.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  rhea: {
    path: '/models/nasa/rhea.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  hyperion: {
    path: '/models/nasa/hyperion.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  iapetus: {
    path: '/models/nasa/iapetus.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  miranda: {
    path: '/models/nasa/miranda.glb',
    format: 'glb',
    coverage: 'Partial spacecraft mosaic',
  },
  ariel: {
    path: '/models/nasa/ariel.glb',
    format: 'glb',
    coverage: 'Partial spacecraft mosaic',
  },
  umbriel: {
    path: '/models/nasa/umbriel.glb',
    format: 'glb',
    coverage: 'Partial spacecraft mosaic',
  },
  titania: {
    path: '/models/nasa/titania.glb',
    format: 'glb',
    coverage: 'Partial spacecraft mosaic',
  },
  oberon: {
    path: '/models/nasa/oberon.glb',
    format: 'glb',
    coverage: 'Partial spacecraft mosaic',
  },
  triton: {
    path: '/models/nasa/triton.glb',
    format: 'glb',
    coverage: 'Global spacecraft mosaic',
  },
  ceres: {
    path: '/models/usgs/ceres-dawn-hamo-dem.obj',
    format: 'obj',
    coverage: 'Global DEM and spacecraft mosaic',
    texturePath: '/textures/mission/ceres-seamless.webp',
  },
  vesta: {
    path: '/models/usgs/vesta-dawn-hamo-dem.obj',
    format: 'obj',
    coverage: 'Global DEM and spacecraft mosaic',
    texturePath: '/textures/mission/vesta-seamless.webp',
  },
  bennu: {
    path: '/models/pds/bennu-spc-v42.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#393735',
    rotation: [Math.PI / 2, 0, 0],
  },
  ryugu: {
    path: '/models/jaxa/ryugu-200k.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#4e4b48',
    rotation: [Math.PI / 2, 0, 0],
  },
  eros: {
    path: '/models/pds/eros-gaskell-128.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#857263',
    rotation: [Math.PI / 2, 0, 0],
  },
  apophis: {
    path: '/models/pds/apophis.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#8f7966',
  },
  itokawa: {
    path: '/models/nasa/itokawa.glb',
    format: 'glb',
    coverage: 'Measured shape model',
  },
  arrokoth: {
    path: '/models/nasa/arrokoth.glb',
    format: 'glb',
    coverage: 'Partial spacecraft mosaic',
  },
  lutetia: {
    path: '/models/pds/lutetia.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#89796c',
  },
  steins: {
    path: '/models/pds/steins.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#a69889',
  },
  gaspra: {
    path: '/models/pds/gaspra.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#9a826c',
  },
  ida: {
    path: '/models/pds/ida.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#8f7863',
  },
  '67p': {
    path: '/models/esa/67p.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#4f4b47',
  },
  'tempel-1': {
    path: '/models/pds/tempel-1.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#5e5851',
  },
  'wild-2': {
    path: '/models/pds/wild-2.obj',
    format: 'obj',
    coverage: 'Measured shape model',
    color: '#5a5651',
  },
  'voyager-1': {
    path: '/models/nasa/voyager.glb',
    format: 'glb',
    coverage: 'Mission spacecraft model',
  },
  'voyager-2': {
    path: '/models/nasa/voyager.glb',
    format: 'glb',
    coverage: 'Mission spacecraft model',
  },
  'new-horizons': {
    path: '/models/nasa/new-horizons.glb',
    format: 'glb',
    coverage: 'Mission spacecraft model',
  },
}

export function getRenderAsset(id: string) {
  return BODY_RENDER_ASSETS[id]
}

const PROCEDURAL_RENDER_COVERAGE: Record<string, string> = {
  'pioneer-10': 'NASA-reference reconstruction',
  'pioneer-11': 'NASA-reference reconstruction',
}

export function getRenderCoverage(id: string) {
  return BODY_RENDER_ASSETS[id]?.coverage ?? PROCEDURAL_RENDER_COVERAGE[id]
}
