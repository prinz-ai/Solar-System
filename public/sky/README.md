# Real-sky data

The star catalog is generated from the official ESA Gaia DR3 TAP service:
https://gea.esac.esa.int/tap-server/tap/sync

The binary contains the 50,000 brightest
returned Gaia DR3 sources followed by a deduplicated random-index sample of
149,547 sources used to show the
large-scale Milky Way density. Exact ADQL queries and the binary record layout
are stored in `gaia-dr3-stars.json`.

Constellation overlays use the official IAU J2000 boundary text files linked
from:
https://www.iau.org/Iau/Iau/Science/What-we-do/The-Constellations.aspx

Regenerate all assets from the repository root with:

```bash
npm run generate:sky
```
