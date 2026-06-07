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

Planetary positions use analytical ephemerides. Planetary rotation uses IAU
orientation models where available, and major moons use exact or
synchronously rotating models. Cloud decks and population belts are
representative visual models rather than live weather or individually tracked
objects.

Texture source attribution is documented in
[`public/textures/README.md`](public/textures/README.md).
