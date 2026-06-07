# 3D Model Sources

Detailed models load only when a target is selected. This keeps the normal
wide Solar System view responsive while preserving mission-derived geometry
for close inspection.

## NASA

NASA 3D resources supply textured or measured models for Uranus, Neptune,
Pluto, Charon, Ceres, Vesta, Mimas, Enceladus, Tethys, Dione, Rhea,
Hyperion, Iapetus, Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Bennu,
Eros, Itokawa, Arrokoth, Voyager, and New Horizons.

- https://science.nasa.gov/3d-resources/
- https://science.nasa.gov/resource/pluto-3d-model/
- https://science.nasa.gov/resource/charon-3d-model/
- https://science.nasa.gov/resource/ceres-3d-model/
- https://science.nasa.gov/resource/vesta-3d-model/
- https://science.nasa.gov/resource/uranus-3d-model/
- https://science.nasa.gov/resource/neptune-3d-model/
- https://science.nasa.gov/resource/voyager-3d-model/
- https://science.nasa.gov/resource/new-horizons-3d-model/

The Uranus and Neptune close views preserve the NASA models' measured
oblateness and observation-derived atmospheric composites. Their clouds are
historical composites rather than live weather maps. Uranus's 13 rings and
Neptune's five principal rings use measured radial locations; very narrow
rings receive a small display-width minimum, and Neptune's Adams-ring arcs are
shown representatively.

- https://pds-rings.seti.org/uranus/uranus_rings_table.html
- https://pds-rings.seti.org/neptune/neptune_rings_table.html

The existing Phobos model is the NASA/JPL-Caltech textured shape model:

- https://science.nasa.gov/resource/phobos-mars-moon-3d-model/

The selected Moon close view uses NASA SVS's 8K LRO topographic model:

- https://svs.gsfc.nasa.gov/14959/

## USGS Global Terrain

The Mercury, Enceladus, Ceres, and Vesta close views use mission-derived
global digital elevation or terrain models. The source rasters are sampled
into 512 by 256 UV meshes for real-time browser rendering while preserving
the source datum, radii, and longitude convention.

- Mercury MESSENGER global DEM:
  https://astrogeology.usgs.gov/search/map/mercury-messenger-global-products
- Enceladus Cassini global DEM, 200 m:
  https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-dem-200m-schenk
- Ceres Dawn FC2 HAMO global DTM, 137 m:
  https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m
- Vesta Dawn HAMO global DTM:
  https://planetarymaps.usgs.gov/mosaic/Vesta_Dawn_HAMO_DTM_DLR_Global_48ppd.tif

Pioneer 10 and Pioneer 11 are code-native reference reconstructions rather
than downloaded meshes. Their shared spacecraft design is modeled from
NASA's labeled instrument diagram, classroom paper model, mission overview,
and engineering dimensions. The reconstruction includes the 2.74-meter
high-gain antenna, hexagonal equipment compartment, two paired SNAP-19 RTG
assemblies, magnetometer boom, medium- and low-gain antennas, science
instruments, thrusters, and plaque.

- https://science.nasa.gov/resource/pioneer-spacecraft-diagram/
- https://science.nasa.gov/wp-content/uploads/2023/09/Pioneer_10_Instr.pdf
- https://science.nasa.gov/mission/pioneer-10/
- https://pds.nasa.gov/

## Planetary Data System

NASA's PDS Small Bodies Node supplies measured shape models for Apophis,
Lutetia, Šteins, Gaspra, Ida, Tempel 1, and Wild 2.

- https://sbn.psi.edu/pds/shape-models/
- https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast-apophis.jpl.radar.shape_model_v1.0/

The upgraded dense models are:

- Bennu OSIRIS-REx SPC v42, 3.17 m plate model:
  https://sbnarchive.psi.edu/pds4/orex/orex.altimetry/data_derived_altimetry_global_models/global_digital_terrain_models/
- Eros Gaskell 128-plate-level shape model:
  https://sbnarchive.psi.edu/pds4/non_mission/gaskell.ast-eros.shape-model/data/vertex/
- Ryugu Hayabusa2 200,000-polygon shape model:
  https://data.darts.isas.jaxa.jp/pub/hayabusa2/paper/Watanabe_2019/

The original PDS longitude/latitude/radius grids for Gaspra and Ida are kept
beside the generated OBJ files. `scripts/convert-radius-grid-to-obj.mjs`
recreates those meshes.

## JAXA and ESA

- Ryugu shape model, Hayabusa2/JAXA DARTS:
  https://data.darts.isas.jaxa.jp/pub/hayabusa2/paper/Watanabe_2019/
- Comet 67P shape model, ESA Rosetta:
  https://sci.esa.int/web/rosetta/-/54726-comet-67p-churyumov-gerasimenko-shape-model

## Display Notes

- "Global spacecraft mosaic" indicates broad mapped image coverage.
- "Partial spacecraft mosaic" uses real imaged terrain with incomplete
  coverage or lower-confidence reconstruction on unseen regions.
- "Measured shape model" preserves the observed or radar-derived geometry,
  but may use a representative neutral surface material.
- Object sizes are enlarged for visibility. Orbital distances and positions
  still follow the simulation's selected distance mode.
