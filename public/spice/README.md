# Browser SPICE Ephemeris

The app evaluates planetary positions locally with CSPICE compiled to
WebAssembly. It does not call a live ephemeris service at runtime.

## Files

- `solar-system-de442.bsp`: compact SPK generated from NASA/JPL DE442
- `solar-system-de442.json`: coverage, source, and validation metadata
- `naif0012.tls`: NAIF leap-seconds kernel
- `libwebspice.wasm`: CSPICE WebAssembly runtime from `webspice`

The compact kernel covers January 1, 1550 through January 1, 2650 in the
`ECLIPJ2000` frame. It includes heliocentric states for Mercury through Pluto
and an Earth-relative state for the Moon.

Source planetary kernel:
https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de442.bsp

Source leap-seconds kernel:
https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls

NAIF SPICE:
https://naif.jpl.nasa.gov/naif/

WebSPICE:
https://gitlab.com/afeder/webspice

## Regeneration

Install Python, NumPy, and SpiceyPy, then run:

```bash
python3 scripts/generate-spice-kernel.py
```

The generator samples the official DE442 kernel, writes a degree-15 SPK
type-13 interpolation kernel, and validates 160 deterministic random epochs
against the source. The maximum sampled position error for each target is
recorded in `solar-system-de442.json`; all current errors are below 0.04 km.
