# Solar System

An interactive 3D Solar System simulation with live ephemerides, current-time
planetary rotation, sun-based lighting, mapped planetary surfaces, moons,
dwarf planets, comets, asteroids, and interstellar probes.

## Features

- Current and user-selectable simulation time
- Rewind, play, pause, stop, and fast-forward controls
- Browser-native CSPICE planetary ephemerides and IAU rotation models
- Sun-based phases and day/night lighting
- Analytical umbra and penumbra rendering for solar eclipses, lunar eclipses,
  satellite transits, and mutual moon events
- Celestial event director with one-click jumps and multi-object cinematic framing
- Ring shadows on planets and planet shadows across ring systems
- 8K Earth surface and dated observation maps, plus mapped views for the Moon,
  Mars, Jupiter, Titan, and other worlds
- Mission-derived global terrain for the Moon, Mercury, Enceladus, Ceres, and Vesta
- Dense measured shapes for Bennu, Ryugu, Eros, and other visited small bodies
- Mission-derived global mosaics and measured 3D shapes for selected targets
- Detailed Voyager and New Horizons spacecraft models
- Shader-rendered solar granulation, sunspots, limb darkening, and corona
- Offline NASA/JPL Horizons state-vector interpolation for tracked small bodies
  and probes from 2020 through 2040
- NASA/JPL DE442 positions for every planet and the Moon from 1550 through
  2650, evaluated locally with CSPICE WebAssembly
- Dense parent-relative Horizons trajectories for 26 additional moons from
  2025 through 2029, alongside the live Moon and Galilean-moon models
- Expanded 466-moon catalog with JPL mean-element tracking for the long tail
  of planetary satellites
- Sedna, Quaoar, Gonggong, Orcus, Didymos-Dimorphos,
  Patroclus-Menoetius, ʻOumuamua, and Borisov
- Gaia DR3 real-sky rendering with 199,547 catalog sources, BP-RP colors,
  G-band brightness, proper motion, observer parallax, and a Gaia-density
  Milky Way layer
- Earth, solar-system barycenter, Voyager, Pioneer, and New Horizons sky
  observer modes with persistent multi-select Western constellation figures
- Dated NASA VIIRS true-color Earth observations with real cloud cover near
  the acquisition date
- Searchable object navigator for planets, moons, dwarf planets, comets,
  asteroids, and probes
- Current NASA SDO visible, ultraviolet, and magnetogram observation modes
- Observation-derived Venus clouds and representative atmospheric layers
- Planet and moon selection with close-up camera controls
- Asteroid belt, Kuiper belt, Oort Cloud, comets, and spacecraft

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validation

```bash
npm run check
```

This runs linting, tests, TypeScript compilation, and the production build.

## Accuracy

Planetary positions and the Moon use a compact kernel generated from the
official NASA/JPL DE442 planetary ephemeris. The kernel is evaluated entirely
in the browser with CSPICE WebAssembly and covers January 1, 1550 through
January 1, 2650. Its sampled validation error against the source DE442 kernel
is below 0.04 km for every included body. Planetary rotation uses IAU
orientation models where available.

Eclipse and ring-shadow geometry is calculated in physical AU/km coordinates
before being projected into the app's compressed exploration scale. The
eclipse engine models finite solar size, umbra, antumbra, penumbra, partial and
total coverage, Galilean satellite transits, sibling-moon eclipses, and mutual
occultations as seen from their parent body.

Tracked small bodies, probes, and 26 additional moons use locally cached
NASA/JPL Horizons state vectors inside their stated date ranges. Galilean
moons use live specialized models. Analytical orbital fallbacks keep the
simulation usable while the SPICE kernel loads and outside each data source's
coverage. MK 2 and Dactyl retain representative paths because sufficiently
constrained JPL solutions are not available. Cloud decks and population belts
remain representative visual models rather than live weather or individually
tracked objects.

The moon catalog includes 459 entries from the JPL planetary-satellite mean
elements table plus seven dwarf-planet and asteroid moons modeled directly by
the app. Featured moons retain their higher-detail imagery and
trajectory sources; the long-tail catalog uses JPL mean elements with
representative tiny-body rendering. Unknown physical radii remain explicitly
unknown rather than being replaced with invented measurements.

The event director uses Astronomy Engine eclipse and transit searches,
geocentric conjunction minima, and the app's Galilean shadow geometry. Event
jumps change the simulation time and frame the participating objects without
replacing the normal orbital view.

The real-sky background uses a compact, reproducible subset of Gaia DR3. The
50,000 brightest returned sources form the visible star layer, while a
deduplicated random-index sample supplies large-scale Milky Way density.
Positions are propagated from Gaia's J2016.0 reference epoch with catalog
proper motions; positive parallaxes are applied from the selected observer's
physical heliocentric position. Constellation overlays are the official IAU
J2000 boundaries, not an interpretive stick-figure convention.

Near the current observation date, Earth's selected close view uses a dated
NASA GIBS Suomi-NPP VIIRS corrected-reflectance image containing observed
cloud cover. Historical and future simulation dates continue to use the
static cloud model rather than pretending the current observation applies.

Refresh the generated JPL moon catalog with:

```bash
npm run generate:moons
```

Refresh the generated Horizons cache for small bodies and spacecraft with:

```bash
npm run generate:ephemeris
```

Refresh the generated Gaia and IAU sky assets with:

```bash
npm run generate:sky
npm run generate:constellations
```

Horizons source and API documentation:
https://ssd.jpl.nasa.gov/horizons/

SPICE kernel provenance and regeneration instructions are documented in
[`public/spice/README.md`](public/spice/README.md).

Texture source attribution is documented in
[`public/textures/README.md`](public/textures/README.md).
Shape-model and spacecraft attribution is documented in
[`public/models/README.md`](public/models/README.md).
Gaia query provenance and constellation sources are documented in
[`public/sky/README.md`](public/sky/README.md).
