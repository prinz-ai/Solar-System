import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api'
const OUTPUT_PATH = resolve(
  process.cwd(),
  'public/ephemeris/horizons-2020-2041.json',
)

const targets = [
  ['ceres', '1;', 4],
  ['haumea', '136108;', 16],
  ['makemake', '136472;', 16],
  ['eris', '136199;', 16],
  ['sedna', '90377;', 32],
  ['quaoar', '50000;', 16],
  ['gonggong', '225088;', 16],
  ['orcus', '90482;', 16],
  ['vesta', '4;', 4],
  ['pallas', '2;', 4],
  ['bennu', '101955;', 1],
  ['ryugu', '162173;', 1],
  ['psyche', '16;', 4],
  ['eros', '433;', 1],
  ['apophis', '99942;', 1],
  ['itokawa', '25143;', 1],
  ['arrokoth', '486958;', 16],
  ['lutetia', '21;', 4],
  ['steins', '2867;', 4],
  ['gaspra', '951;', 4],
  ['ida', '243;', 4],
  ['didymos', '65803;', 1],
  ['patroclus', '617;', 4],
  ['halley', '1P;', 4],
  ['encke', '2P;', 4],
  ['67p', '67P;', 4],
  ['hale-bopp', 'C/1995 O1;', 4],
  ['tempel-1', '9P;', 4],
  ['wild-2', '81P;', 4],
  ['neowise', 'C/2020 F3;', 4],
  ['oumuamua', '1I;', 16],
  ['borisov', '2I;', 16],
  ['voyager-1', '-31', 32],
  ['voyager-2', '-32', 32],
  ['pioneer-10', '-23', 32],
  ['pioneer-11', '-24', 32],
  ['new-horizons', '-98', 16],
]

function quoted(value) {
  return `'${value}'`
}

function compact(value) {
  return Number(value.toPrecision(13))
}

async function fetchTarget(id, command, stepDays, resolved = false) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: quoted(command),
    OBJ_DATA: quoted('NO'),
    MAKE_EPHEM: quoted('YES'),
    EPHEM_TYPE: quoted('VECTORS'),
    CENTER: quoted('500@10'),
    START_TIME: quoted('2020-01-01'),
    STOP_TIME: quoted('2041-01-01'),
    STEP_SIZE: quoted(`${stepDays}d`),
    VEC_TABLE: quoted('2'),
    VEC_CORR: quoted('NONE'),
    CSV_FORMAT: quoted('YES'),
    OUT_UNITS: quoted('AU-D'),
    REF_PLANE: quoted('ECLIPTIC'),
    REF_SYSTEM: quoted('ICRF'),
  })
  const response = await fetch(`${API_URL}?${params}`)
  if (!response.ok) {
    throw new Error(`${id}: Horizons returned HTTP ${response.status}`)
  }
  const payload = await response.json()
  if (payload.error) throw new Error(`${id}: ${payload.error}`)

  const start = payload.result.indexOf('$$SOE')
  const end = payload.result.indexOf('$$EOE')
  if (start < 0 || end < 0) {
    const records = [
      ...payload.result.matchAll(/^\s+(9\d{7})\s+\S+/gm),
    ].map((match) => match[1])
    if (!resolved && records.length > 0) {
      return fetchTarget(
        id,
        `${records[records.length - 1]};`,
        stepDays,
        true,
      )
    }
    throw new Error(`${id}: Horizons response did not contain vector data`)
  }

  const rows = payload.result
    .slice(start + 5, end)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(',').map((value) => value.trim()))

  const values = []
  for (const columns of rows) {
    const [, , x, y, z, vx, vy, vz] = columns
    const numbers = [x, z, -Number(y), vx, vz, -Number(vy)].map(Number)
    if (numbers.some((value) => !Number.isFinite(value))) {
      throw new Error(`${id}: invalid vector row ${columns.join(',')}`)
    }
    values.push(...numbers.map(compact))
  }

  console.log(`${id}: ${rows.length} state vectors`)
  return {
    startJd: Number(rows[0][0]),
    stepDays,
    values,
  }
}

const dataset = {
  source: 'NASA/JPL Horizons API',
  frame: 'J2000 ecliptic, heliocentric',
  generatedAt: new Date().toISOString(),
  coverage: ['2020-01-01', '2041-01-01'],
  targets: {},
}

for (const [id, command, stepDays] of targets) {
  dataset.targets[id] = await fetchTarget(id, command, stepDays)
}

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
await writeFile(OUTPUT_PATH, JSON.stringify(dataset))
console.log(`Wrote ${OUTPUT_PATH}`)
