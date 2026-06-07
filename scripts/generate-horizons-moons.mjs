import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api'
const INDEX_PATH = resolve(
  process.cwd(),
  'public/ephemeris/horizons-moons-2025-2030.json',
)
const BINARY_PATH = resolve(
  process.cwd(),
  'public/ephemeris/horizons-moons-2025-2030.bin',
)
const START_JD = Date.parse('2025-01-01T00:00:00Z') / 86_400_000 + 2_440_587.5
const END_JD = Date.parse('2030-01-01T00:00:00Z') / 86_400_000 + 2_440_587.5
const MAX_INTERVALS = 8_000

const targets = [
  ['phobos', '401', '500@499', 0.3189],
  ['deimos', '402', '500@499', 1.2624],
  ['mimas', '601', '500@699', 0.942],
  ['enceladus', '602', '500@699', 1.37],
  ['tethys', '603', '500@699', 1.888],
  ['dione', '604', '500@699', 2.737],
  ['rhea', '605', '500@699', 4.518],
  ['titan', '606', '500@699', 15.945],
  ['hyperion', '607', '500@699', 21.277],
  ['iapetus', '608', '500@699', 79.3215],
  ['ariel', '701', '500@799', 2.52],
  ['umbriel', '702', '500@799', 4.144],
  ['titania', '703', '500@799', 8.706],
  ['oberon', '704', '500@799', 13.463],
  ['miranda', '705', '500@799', 1.413],
  ['triton', '801', '500@899', 5.877],
  ['nereid', '802', '500@899', 360.14],
  ['proteus', '808', '500@899', 1.122],
  ['charon', '901', '500@999', 6.387],
  ['nix', '902', '500@999', 24.855],
  ['hydra', '903', '500@999', 38.202],
  ['kerberos', '904', '500@999', 32.168],
  ['styx', '905', '500@999', 20.162],
  ['hiiaka', '120136108', '500@10', 49.46, '136108;'],
  ['namaka', '220136108', '500@10', 18.278, '136108;'],
  ['dysnomia', '120136199', '500@10', 15.786, '136199;'],
]

function quoted(value) {
  return `'${value}'`
}

async function fetchRows(command, center, startJd, stopJd, intervals) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: quoted(command),
    OBJ_DATA: quoted('NO'),
    MAKE_EPHEM: quoted('YES'),
    EPHEM_TYPE: quoted('VECTORS'),
    CENTER: quoted(center),
    START_TIME: quoted(`JD${startJd}`),
    STOP_TIME: quoted(`JD${stopJd}`),
    STEP_SIZE: quoted(String(intervals)),
    VEC_TABLE: quoted('2'),
    VEC_CORR: quoted('NONE'),
    CSV_FORMAT: quoted('YES'),
    OUT_UNITS: quoted('AU-D'),
    REF_PLANE: quoted('ECLIPTIC'),
    REF_SYSTEM: quoted('ICRF'),
  })
  const response = await fetch(`${API_URL}?${params}`)
  if (!response.ok) throw new Error(`Horizons returned HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.error) throw new Error(payload.error)
  const start = payload.result.indexOf('$$SOE')
  const end = payload.result.indexOf('$$EOE')
  if (start < 0 || end < 0) {
    throw new Error(`No vector data for Horizons target ${command}`)
  }
  return payload.result
    .slice(start + 5, end)
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const columns = line.split(',').map((value) => value.trim())
      return {
        jd: Number(columns[0]),
        state: columns.slice(2, 8).map(Number),
      }
    })
}

const values = []
const index = {
  source: 'NASA/JPL Horizons API',
  frame: 'Parent-relative J2000 ecliptic',
  generatedAt: new Date().toISOString(),
  coverage: ['2025-01-01', '2030-01-01'],
  stride: 6,
  targets: {},
}

for (const [id, command, center, periodDays, parentCommand] of targets) {
  const desiredStepDays = Math.min(1, periodDays / 32)
  const segments = []
  let segmentStart = START_JD

  while (segmentStart < END_JD - 1e-8) {
    const segmentStop = Math.min(
      END_JD,
      segmentStart + desiredStepDays * MAX_INTERVALS,
    )
    const intervals = Math.ceil(
      (segmentStop - segmentStart) / desiredStepDays,
    )
    const rows = await fetchRows(
      command,
      center,
      segmentStart,
      segmentStop,
      intervals,
    )
    const parentRows = parentCommand
      ? await fetchRows(
          parentCommand,
          '500@10',
          segmentStart,
          segmentStop,
          intervals,
        )
      : undefined
    if (parentRows && parentRows.length !== rows.length) {
      throw new Error(`${id}: parent and moon vector counts differ`)
    }

    const offset = values.length / 6
    for (const [rowIndex, row] of rows.entries()) {
      const source = parentRows
        ? row.state.map(
            (value, component) =>
              value - parentRows[rowIndex].state[component],
          )
        : row.state
      const [x, y, z, vx, vy, vz] = source
      values.push(x, z, -y, vx, vz, -vy)
    }
    const stepDays =
      rows.length > 1 ? rows[1].jd - rows[0].jd : desiredStepDays
    segments.push({
      startJd: rows[0].jd,
      stepDays,
      offset,
      count: rows.length,
    })
    segmentStart = rows[rows.length - 1].jd
  }

  index.targets[id] = { segments }
  console.log(
    `${id}: ${segments.reduce((sum, segment) => sum + segment.count, 0)} vectors`,
  )
}

await mkdir(dirname(INDEX_PATH), { recursive: true })
await writeFile(INDEX_PATH, JSON.stringify(index))
const floats = Float32Array.from(values)
await writeFile(
  BINARY_PATH,
  Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength),
)
console.log(`Wrote ${INDEX_PATH}`)
console.log(`Wrote ${BINARY_PATH}`)
