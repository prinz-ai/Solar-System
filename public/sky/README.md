# Real-sky data

The star catalog is generated from the official ESA Gaia DR3 TAP service:
https://gea.esac.esa.int/tap-server/tap/sync

The binary contains the 50,000 brightest
returned Gaia DR3 sources followed by a deduplicated random-index sample of
149,547 sources used to show the
large-scale Milky Way density. Exact ADQL queries and the binary record layout
are stored in `gaia-dr3-stars.json`.

The constellation finder uses the Western Sky & Telescope star figures from
Stellarium Sky Cultures:
https://github.com/Stellarium/stellarium-skycultures/tree/master/western_SnT

The figures are credited to Paul Krizak and Jonathan E. Piskor, with later
rework by the Stellarium team, and are distributed under CC BY-SA 2.0. See
`ATTRIBUTION-constellations.md`.

Figure-star coordinates, magnitudes, and B-V colors are resolved from
D3-Celestial's `stars.14.json`. D3-Celestial's BSD 3-Clause license is stored
in `LICENSE-d3-celestial.txt`.

The official IAU J2000 boundary text files are also retained from:
https://www.iau.org/Iau/Iau/Science/What-we-do/The-Constellations.aspx

Regenerate all assets from the repository root with:

```bash
npm run generate:sky
npm run generate:constellations
```
