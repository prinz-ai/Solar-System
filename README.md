# Solar System

An interactive 3D Solar System simulation with live ephemerides, current-time
planetary rotation, sun-based lighting, mapped planetary surfaces, moons,
dwarf planets, comets, asteroids, and interstellar probes.

## Features

- Current and user-selectable simulation time
- Rewind, play, pause, stop, and fast-forward controls
- Analytical planetary ephemerides and IAU rotation models
- Sun-based phases and day/night lighting
- Surface maps for Earth, the Moon, Mars, Jupiter, Titan, and other worlds
- Mission-derived global terrain for the Moon, Mercury, Enceladus, Ceres, and Vesta
- Dense measured shapes for Bennu, Ryugu, Eros, and other visited small bodies
- Mission-derived global mosaics and measured 3D shapes for selected targets
- Detailed Voyager and New Horizons spacecraft models
- Shader-rendered solar granulation, sunspots, limb darkening, and corona
- Offline NASA/JPL Horizons state-vector interpolation for tracked small bodies
  and probes from 2020 through 2040
- Dense parent-relative Horizons trajectories for 26 additional moons from
  2025 through 2029, alongside the live Moon and Galilean-moon models
- Current NASA SDO visible, ultraviolet, and magnetogram observation modes
- Representative atmospheric cloud layers
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

Planetary positions use analytical ephemerides, and planetary rotation uses
IAU orientation models where available. Tracked small bodies, probes, and 26
moons use locally cached NASA/JPL Horizons state vectors inside their stated
date ranges. The Moon and Galilean moons use live specialized models. MK 2
and Dactyl retain representative paths because sufficiently constrained JPL
solutions are not available. Cloud decks and population belts remain
representative visual models rather than live weather or individually tracked
objects.

Horizons source and API documentation:
https://ssd.jpl.nasa.gov/horizons/

Texture source attribution is documented in
[`public/textures/README.md`](public/textures/README.md).
Shape-model and spacecraft attribution is documented in
[`public/models/README.md`](public/models/README.md).
