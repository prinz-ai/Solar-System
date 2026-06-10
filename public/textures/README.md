Earth texture: NASA Blue Marble, land surface, ocean color, and sea ice.
Source: https://visibleearth.nasa.gov/images/57730/the-blue-marble-land-surface-ocean-color-and-sea-ice

Current full-globe texture: NASA Blue Marble Next Generation with topography
and bathymetry. The app uses an 8192x4096 June global map, downsampled from
NASA's 21600x10800 source, plus a derived land/ocean roughness mask for
surface lighting.
Source: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/

Additional mapped bodies:

- Moon: NASA SVS CGI Moon Kit, LRO/LROC.
  https://svs.gsfc.nasa.gov/4720/
  A 4096x2048 derivative of the 8K texture embedded in NASA's model and a
  2048x1024 relief texture are also used on a denser lightweight orbital-view
  sphere, while the selected close view retains the full NASA LRO topographic
  model.
- Mercury: USGS Astrogeology MESSENGER MDIS global mosaic.
  https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_mosaic_250m
- Enceladus: the 2024 USGS Cassini global 100 m mosaic, downsampled to a
  browser-ready 4096x2048 map and remapped onto the USGS global terrain mesh.
  https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-mosaic-100m-schenk
- Ceres and Vesta: mission mosaics embedded in NASA's published 3D resources,
  remapped onto the higher-resolution USGS terrain meshes.
  Longitude-edge cross-fades remove projection seams without altering the
  mapped interior.
- Venus: NASA/JPL Magellan radar mosaic beneath JPL's visible-frequency global
  cloud texture, cloned from a Mariner 10 image for full-globe coverage.
  https://space.jpl.nasa.gov/tmaps/venus.html
- Mars: USGS Astrogeology Viking global color mosaic.
  https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m
- Phobos: NASA/JPL-Caltech textured 3D shape model, with the USGS
  Astrogeology Mars Express SRC global mosaic retained as the fallback map.
  https://science.nasa.gov/resource/phobos-mars-moon-3d-model/
  https://astrogeology.usgs.gov/search/map/phobos_mars_express_src_global_mosaic_12m
- Deimos and Jupiter: NASA/JPL texture maps derived from Voyager and Galileo
  imagery. The displayed Jupiter texture
  contrast-enhances the source-map Great Red Spot region so the storm remains
  visible at globe scale.
  https://space.jpl.nasa.gov/tmaps/
- Io, Ganymede, and Callisto: 4096x2048 derivatives of USGS
  Voyager-Galileo global mosaics. Europa retains the NASA/JPL global map.
  The five major mapped moons also use grayscale relief maps for close-view
  surface lighting; Titan's relief is visualization-derived from its radar
  composite rather than a literal global elevation model.
  https://astrogeology.usgs.gov/search/map/io_voyager_galileo_ssi_false_color_global_mosaic_1km
  https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km
  https://astrogeology.usgs.gov/search/map/callisto_voyager_galileossi_global_mosaic_1km
- Titan: a visualization composite of the NASA/JPL-Caltech/University of
  Arizona Cassini ISS global near-infrared mosaic and the JPL/USGS Cassini
  SAR/HiSAR global coverage mosaic. The radar swaths are rendered over the
  near-infrared base beneath a separate orange atmospheric shell.
  https://science.nasa.gov/resource/titan-mosaic-the-surface-under-the-haze/
  https://astrogeology.usgs.gov/search/map/titan_cassini_sar_hisar_global_mosaic_351m
- When a planet or dwarf planet is selected, its featured moons retain
  recognizable contextual surfaces instead of reverting to plain spheres.
  Orbital views use lower-resolution global mosaics where available and
  lightweight mission models for shape-dominated moons; full-resolution maps,
  relief, and dense terrain assets remain reserved for selected close views.

Atmospheric rendering:

- Venus uses an opaque Mariner-derived cloud deck with a four-day retrograde
  super-rotation and a separate sunlight-aware sulfuric-acid haze shell. The
  map is representative rather than weather matched to the simulation date.
- Earth, Mars, Jupiter, Saturn, Uranus, and Neptune use deterministic
  representative cloud layers. They respond to the simulation time and
  sunlight, but they are not live weather observations.
- Uranus preserves the pale visible-light Voyager composite beneath a
  higher-contrast representative layer informed by Hubble OPAL and Webb
  observations: faint latitude bands, seasonal north-polar haze and boundary,
  and several bright methane-cloud storms. These features are
  observation-inspired rather than weather-matched to the simulation date.
  https://science.nasa.gov/missions/hubble/hubble-monitors-changing-weather-and-seasons-at-jupiter-and-uranus/
  https://science.nasa.gov/missions/webb/nasas-webb-rings-in-holidays-with-ringed-planet-uranus/
- Near its acquisition date, Earth's selected close view uses a NASA GIBS
  Suomi-NPP and NOAA-20 VIIRS corrected-reflectance composite with observed
  cloud cover at 8192x4096. Remaining black no-data pixels are filled from the
  aligned Blue Marble base map when ImageMagick is available during refresh.
  Outside that date window, a separate 4096x2048 cloud layer derived from the
  same observation remains visible as representative cloud cover instead of
  reverting to the lower-detail generated fallback.
  Refresh the dated snapshot with `npm run update:earth -- YYYY-MM-DD`.
  https://gibs.earthdata.nasa.gov/

Solar rendering:

- The default Sun is a deterministic shader model with granulation,
  supergranulation, limb darkening, faculae, sunspots, differential rotation,
  and a structured corona.
- Optional current visible-light, 171 Å, 193 Å, 304 Å, and magnetogram views
  use the latest Earth-facing disk from NASA's Solar Dynamics Observatory.
  These modes are deliberately disabled when the simulation clock is more
  than 12 hours from the real present because the feed is not a historical or
  future full-sphere model.
  https://sdo.gsfc.nasa.gov/data/
