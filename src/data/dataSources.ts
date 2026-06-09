import { MOONS } from './bodies'

export interface ObjectDataSource {
  category:
    | 'IMAGERY + SHADER'
    | 'ATMOSPHERE + SURFACE'
    | 'SURFACE DATA'
    | '3D MODEL'
    | 'SHAPE DATA'
    | 'POSITION DATA'
    | 'SPACECRAFT MODEL'
  title: string
  organization: string
  url: string
  note?: string
}

const HORIZONS_SOURCE: ObjectDataSource = {
  category: 'POSITION DATA',
  title: 'JPL Horizons trajectory vectors',
  organization: 'NASA Jet Propulsion Laboratory',
  url: 'https://ssd.jpl.nasa.gov/horizons/',
  note: 'Appearance is representative',
}

const JPL_MEAN_ELEMENTS_SOURCE: ObjectDataSource = {
  category: 'POSITION DATA',
  title: 'JPL planetary satellite mean elements',
  organization: 'NASA/JPL Solar System Dynamics',
  url: 'https://ssd.jpl.nasa.gov/sats/elem/',
  note: 'Representative appearance with mean-element orbital tracking',
}

const NASA_3D_SOURCE = (
  title: string,
  url = 'https://science.nasa.gov/3d-resources/',
): ObjectDataSource => ({
  category: '3D MODEL',
  title,
  organization: 'NASA Science 3D Resources',
  url,
})

const PDS_SHAPE_SOURCE: ObjectDataSource = {
  category: 'SHAPE DATA',
  title: 'Mission-derived measured shape model',
  organization: 'NASA Planetary Data System Small Bodies Node',
  url: 'https://sbn.psi.edu/pds/shape-models/',
}

export const OBJECT_DATA_SOURCES: Record<string, ObjectDataSource> = {
  sun: {
    category: 'IMAGERY + SHADER',
    title: 'SDO solar imagery and simulated photosphere',
    organization: 'NASA Solar Dynamics Observatory',
    url: 'https://sdo.gsfc.nasa.gov/data/',
    note: 'Live image modes show the current Earth-facing disk',
  },
  mercury: {
    category: 'SURFACE DATA',
    title: 'MESSENGER global DEM and MDIS mosaic',
    organization: 'USGS Astrogeology / NASA MESSENGER',
    url: 'https://astrogeology.usgs.gov/search/map/mercury-messenger-global-products',
  },
  venus: {
    category: 'ATMOSPHERE + SURFACE',
    title: 'Mariner 10 cloud texture and Magellan radar mosaic',
    organization: 'NASA Jet Propulsion Laboratory',
    url: 'https://space.jpl.nasa.gov/tmaps/venus.html',
    note: 'Cloud appearance is representative rather than date-matched weather',
  },
  earth: {
    category: 'SURFACE DATA',
    title: 'Blue Marble Next Generation',
    organization: 'NASA Earth Observatory',
    url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/',
  },
  mars: {
    category: 'SURFACE DATA',
    title: 'Viking global color mosaic',
    organization: 'USGS Astrogeology / NASA Viking',
    url: 'https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m',
  },
  jupiter: {
    category: 'SURFACE DATA',
    title: 'Voyager and Galileo global map',
    organization: 'NASA Jet Propulsion Laboratory',
    url: 'https://space.jpl.nasa.gov/tmaps/',
    note: 'Includes the Great Red Spot',
  },
  saturn: {
    category: 'SURFACE DATA',
    title: 'NASA/JPL planetary reference imagery',
    organization: 'NASA Jet Propulsion Laboratory',
    url: 'https://space.jpl.nasa.gov/tmaps/',
    note: 'Atmospheric bands and clouds are representative',
  },
  uranus: NASA_3D_SOURCE(
    'Voyager-derived atmospheric composite',
    'https://science.nasa.gov/resource/uranus-3d-model/',
  ),
  neptune: NASA_3D_SOURCE(
    'Voyager-derived atmospheric composite',
    'https://science.nasa.gov/resource/neptune-3d-model/',
  ),
  pluto: NASA_3D_SOURCE(
    'New Horizons global surface model',
    'https://science.nasa.gov/resource/pluto-3d-model/',
  ),

  moon: {
    category: 'SURFACE DATA',
    title: 'LRO topography and LROC global mosaic',
    organization: 'NASA Scientific Visualization Studio',
    url: 'https://svs.gsfc.nasa.gov/14959/',
  },
  phobos: NASA_3D_SOURCE(
    'Mars mission textured shape model',
    'https://science.nasa.gov/resource/phobos-mars-moon-3d-model/',
  ),
  deimos: {
    category: 'SURFACE DATA',
    title: 'NASA/JPL spacecraft image map',
    organization: 'NASA Jet Propulsion Laboratory',
    url: 'https://space.jpl.nasa.gov/tmaps/',
  },
  io: {
    category: 'SURFACE DATA',
    title: 'Voyager and Galileo global mosaic',
    organization: 'NASA Jet Propulsion Laboratory',
    url: 'https://space.jpl.nasa.gov/tmaps/',
  },
  europa: {
    category: 'SURFACE DATA',
    title: 'Voyager and Galileo global mosaic',
    organization: 'NASA Jet Propulsion Laboratory',
    url: 'https://space.jpl.nasa.gov/tmaps/',
  },
  ganymede: {
    category: 'SURFACE DATA',
    title: 'Voyager-Galileo SSI color mosaic',
    organization: 'USGS Astrogeology / NASA',
    url: 'https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km',
  },
  callisto: {
    category: 'SURFACE DATA',
    title: 'Voyager and Galileo global mosaic',
    organization: 'NASA Jet Propulsion Laboratory',
    url: 'https://space.jpl.nasa.gov/tmaps/',
  },
  mimas: NASA_3D_SOURCE('Cassini-derived textured global model'),
  enceladus: {
    category: 'SURFACE DATA',
    title: 'Cassini global DEM and image mosaic',
    organization: 'USGS Astrogeology / NASA Cassini',
    url: 'https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-dem-200m-schenk',
  },
  tethys: NASA_3D_SOURCE('Cassini-derived textured global model'),
  dione: NASA_3D_SOURCE('Cassini-derived textured global model'),
  rhea: NASA_3D_SOURCE('Cassini-derived textured global model'),
  titan: {
    category: 'SURFACE DATA',
    title: 'Cassini SAR and HiSAR global radar mosaic',
    organization: 'USGS Astrogeology / NASA Cassini',
    url: 'https://astrogeology.usgs.gov/search/map/titan_cassini_sar_hisar_global_mosaic_351m',
    note: 'Rendered beneath a separate orange atmosphere',
  },
  hyperion: NASA_3D_SOURCE('Cassini-derived textured global model'),
  iapetus: NASA_3D_SOURCE('Cassini-derived textured global model'),
  miranda: NASA_3D_SOURCE('Voyager 2 partial surface model'),
  ariel: NASA_3D_SOURCE('Voyager 2 partial surface model'),
  umbriel: NASA_3D_SOURCE('Voyager 2 partial surface model'),
  titania: NASA_3D_SOURCE('Voyager 2 partial surface model'),
  oberon: NASA_3D_SOURCE('Voyager 2 partial surface model'),
  triton: NASA_3D_SOURCE('Voyager 2 textured global model'),
  nereid: HORIZONS_SOURCE,
  proteus: HORIZONS_SOURCE,
  charon: NASA_3D_SOURCE(
    'New Horizons global surface model',
    'https://science.nasa.gov/resource/charon-3d-model/',
  ),
  styx: HORIZONS_SOURCE,
  nix: HORIZONS_SOURCE,
  kerberos: HORIZONS_SOURCE,
  hydra: HORIZONS_SOURCE,
  hiiaka: HORIZONS_SOURCE,
  namaka: HORIZONS_SOURCE,
  mk2: {
    ...HORIZONS_SOURCE,
    title: 'Representative orbit from published orbital estimates',
    note: 'Orbit and appearance remain poorly constrained',
  },
  dysnomia: HORIZONS_SOURCE,
  dactyl: {
    ...HORIZONS_SOURCE,
    title: 'Representative orbit from Galileo observations',
    note: 'Orbit and appearance remain poorly constrained',
  },
  dimorphos: {
    category: 'POSITION DATA',
    title: 'DART binary asteroid observations',
    organization: 'NASA Double Asteroid Redirection Test',
    url: 'https://science.nasa.gov/planetary-defense-dart/',
    note: 'Representative binary orbit around Didymos',
  },
  menoetius: {
    category: 'POSITION DATA',
    title: 'Patroclus-Menoetius binary system',
    organization: 'NASA Lucy Mission',
    url: 'https://science.nasa.gov/mission/lucy/',
    note: 'Representative binary orbit around Patroclus',
  },

  ceres: {
    category: 'SURFACE DATA',
    title: 'Dawn HAMO global terrain model and mosaic',
    organization: 'USGS Astrogeology / NASA Dawn',
    url: 'https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m',
  },
  haumea: HORIZONS_SOURCE,
  makemake: HORIZONS_SOURCE,
  eris: HORIZONS_SOURCE,
  sedna: HORIZONS_SOURCE,
  quaoar: HORIZONS_SOURCE,
  gonggong: HORIZONS_SOURCE,
  orcus: HORIZONS_SOURCE,
  vesta: {
    category: 'SURFACE DATA',
    title: 'Dawn HAMO global terrain model and mosaic',
    organization: 'USGS Astrogeology / NASA Dawn',
    url: 'https://planetarymaps.usgs.gov/mosaic/Vesta_Dawn_HAMO_DTM_DLR_Global_48ppd.tif',
  },
  pallas: HORIZONS_SOURCE,
  bennu: {
    category: 'SHAPE DATA',
    title: 'OSIRIS-REx SPC v42 global terrain model',
    organization: 'NASA PDS Small Bodies Node',
    url: 'https://sbnarchive.psi.edu/pds4/orex/orex.altimetry/data_derived_altimetry_global_models/global_digital_terrain_models/',
  },
  ryugu: {
    category: 'SHAPE DATA',
    title: 'Hayabusa2 200,000-polygon shape model',
    organization: 'JAXA DARTS',
    url: 'https://data.darts.isas.jaxa.jp/pub/hayabusa2/paper/Watanabe_2019/',
  },
  psyche: HORIZONS_SOURCE,
  eros: {
    category: 'SHAPE DATA',
    title: 'NEAR Shoemaker Gaskell shape model',
    organization: 'NASA PDS Small Bodies Node',
    url: 'https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/',
  },
  apophis: {
    category: 'SHAPE DATA',
    title: 'Goldstone and Arecibo radar shape model',
    organization: 'NASA PDS Small Bodies Node',
    url: 'https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-apophis.jpl.radar.shape_model_v1.0/',
  },
  itokawa: NASA_3D_SOURCE('Hayabusa-derived measured shape model'),
  arrokoth: NASA_3D_SOURCE('New Horizons partial surface model'),
  lutetia: PDS_SHAPE_SOURCE,
  steins: PDS_SHAPE_SOURCE,
  gaspra: PDS_SHAPE_SOURCE,
  ida: PDS_SHAPE_SOURCE,
  didymos: {
    category: 'POSITION DATA',
    title: 'Didymos system trajectory and physical data',
    organization: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=65803',
  },
  patroclus: {
    category: 'POSITION DATA',
    title: 'Patroclus system trajectory and physical data',
    organization: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=617',
  },
  halley: HORIZONS_SOURCE,
  encke: HORIZONS_SOURCE,
  '67p': {
    category: 'SHAPE DATA',
    title: 'Rosetta mission shape model',
    organization: 'European Space Agency',
    url: 'https://sci.esa.int/web/rosetta/-/54726-comet-67p-churyumov-gerasimenko-shape-model',
  },
  'hale-bopp': HORIZONS_SOURCE,
  'tempel-1': PDS_SHAPE_SOURCE,
  'wild-2': PDS_SHAPE_SOURCE,
  neowise: HORIZONS_SOURCE,
  oumuamua: {
    category: 'POSITION DATA',
    title: '1I/ʻOumuamua hyperbolic trajectory',
    organization: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1I',
  },
  borisov: {
    category: 'POSITION DATA',
    title: '2I/Borisov hyperbolic trajectory',
    organization: 'NASA/JPL Solar System Dynamics',
    url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2I',
  },

  'voyager-1': {
    category: 'SPACECRAFT MODEL',
    title: 'Voyager mission spacecraft model',
    organization: 'NASA Science 3D Resources',
    url: 'https://science.nasa.gov/resource/voyager-3d-model/',
  },
  'voyager-2': {
    category: 'SPACECRAFT MODEL',
    title: 'Voyager mission spacecraft model',
    organization: 'NASA Science 3D Resources',
    url: 'https://science.nasa.gov/resource/voyager-3d-model/',
  },
  'pioneer-10': {
    category: 'SPACECRAFT MODEL',
    title: 'NASA diagram-based reference reconstruction',
    organization: 'NASA Science',
    url: 'https://science.nasa.gov/resource/pioneer-spacecraft-diagram/',
  },
  'pioneer-11': {
    category: 'SPACECRAFT MODEL',
    title: 'NASA diagram-based reference reconstruction',
    organization: 'NASA Science',
    url: 'https://science.nasa.gov/resource/pioneer-spacecraft-diagram/',
  },
  'new-horizons': {
    category: 'SPACECRAFT MODEL',
    title: 'New Horizons mission spacecraft model',
    organization: 'NASA Science 3D Resources',
    url: 'https://science.nasa.gov/resource/new-horizons-3d-model/',
  },
}

const TRACKED_MOON_IDS = new Set(MOONS.map((moon) => moon.id))

export function getObjectDataSource(id: string) {
  return (
    OBJECT_DATA_SOURCES[id] ??
    (TRACKED_MOON_IDS.has(id) ? JPL_MEAN_ELEMENTS_SOURCE : undefined)
  )
}
