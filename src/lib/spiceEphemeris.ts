import { useEffect, useMemo, useSyncExternalStore } from 'react'
import WebspiceShell from 'webspice'
import furnsh from 'webspice/dist/include/methods/furnsh.js'
import spkez from 'webspice/dist/include/methods/spkez.js'
import str2et from 'webspice/dist/include/methods/str2et.js'
import type { Vec3 } from '../types'

const AU_KM = 149_597_870.7
const COVERAGE_START = Date.parse('1550-01-01T00:00:00Z')
const COVERAGE_END = Date.parse('2650-01-01T00:00:00Z')

export const SPICE_SOURCE_NAME = 'NASA/JPL DE442 SPICE'
export const SPICE_SOURCE_URL =
  'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de442.bsp'
export const SPICE_COVERAGE: [string, string] = ['1550-01-01', '2650-01-01']

const PLANET_TARGETS: Record<string, number> = {
  mercury: 199,
  venus: 299,
  earth: 399,
  mars: 4,
  jupiter: 5,
  saturn: 6,
  uranus: 7,
  neptune: 8,
  pluto: 9,
}

function namedSpiceMethod(method: unknown, name: string) {
  if (typeof method !== 'function') {
    throw new TypeError(`WebSPICE method ${name} is not callable.`)
  }
  Object.defineProperty(method, 'name', {
    configurable: true,
    value: name,
  })
  return method
}

// WebSPICE binds methods by Function.name, which production minifiers rename.
const SPICE_METHODS = [
  namedSpiceMethod(furnsh, 'furnsh'),
  namedSpiceMethod(spkez, 'spkez'),
  namedSpiceMethod(str2et, 'str2et'),
]

interface SpiceMetadata {
  source: string
  sourceUrl: string
  frame: string
  coverage: [string, string]
  interpolation: string
  validationMaxErrorKm: Record<string, number>
}

export type SpiceStatus = 'idle' | 'loading' | 'ready' | 'error'

interface SpiceStore {
  engine?: WebspiceShell
  metadata?: SpiceMetadata
  status: SpiceStatus
  progress: number
  stage: string
  error?: string
}

let store: SpiceStore = {
  status: 'idle',
  progress: 0,
  stage: 'Waiting to load',
}
let loadPromise: Promise<void> | undefined
const listeners = new Set<() => void>()

function updateStore(update: Partial<SpiceStore>) {
  store = { ...store, ...update }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return store
}

function loadSpiceEngine() {
  if (loadPromise) return loadPromise

  updateStore({
    status: 'loading',
    progress: 0.01,
    stage: 'Starting CSPICE',
    error: undefined,
  })

  loadPromise = Promise.all([
    WebspiceShell.instantiate(SPICE_METHODS, {
      basePath: '/spice/',
    }),
    fetch('/spice/solar-system-de442.json').then(async (response) => {
      if (!response.ok) {
        throw new Error(`DE442 metadata returned HTTP ${response.status}`)
      }
      return response.json() as Promise<SpiceMetadata>
    }),
  ])
    .then(async ([engine, metadata]) => {
      updateStore({
        metadata,
        progress: 0.05,
        stage: 'Loading leap seconds',
      })
      await engine.furnsh('/spice/naif0012.tls')

      let reportedProgress = 0
      updateStore({
        progress: 0.08,
        stage: 'Loading NASA/JPL DE442',
      })
      await engine.furnsh(
        '/spice/solar-system-de442.bsp',
        ({ contentLength, receivedLength, done }) => {
          const ratio =
            done || contentLength <= 0
              ? 1
              : Math.min(receivedLength / contentLength, 1)
          if (!done && ratio - reportedProgress < 0.01) return
          reportedProgress = ratio
          updateStore({
            progress: 0.08 + ratio * 0.92,
            stage: 'Loading NASA/JPL DE442',
          })
        },
      )

      updateStore({
        engine,
        metadata,
        status: 'ready',
        progress: 1,
        stage: 'DE442 ready',
      })
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Unknown CSPICE loading error'
      console.warn('Unable to load the local NASA/JPL DE442 SPICE kernel.', error)
      updateStore({
        status: 'error',
        progress: 0,
        stage: 'Analytical fallback active',
        error: message,
      })
    })

  return loadPromise
}

export function isSpiceDateSupported(date: Date) {
  const time = date.getTime()
  return Number.isFinite(time) && time >= COVERAGE_START && time <= COVERAGE_END
}

export function eclipticStateToSceneAu(
  stateKm: readonly [number, number, number, ...number[]],
): Vec3 {
  return [
    stateKm[0] / AU_KM,
    stateKm[2] / AU_KM,
    -stateKm[1] / AU_KM,
  ]
}

function ephemerisTime(engine: WebspiceShell, date: Date) {
  return engine.str2et(date.toISOString())
}

function statePositionAu(
  engine: WebspiceShell,
  target: number,
  observer: number,
  et: number,
) {
  const [state] = engine.spkez(target, et, 'ECLIPJ2000', 'NONE', observer)
  return eclipticStateToSceneAu(state)
}

export function useSpiceEphemeris() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    void loadSpiceEngine()
  }, [])

  return useMemo(() => {
    const engine = snapshot.engine

    return {
      status: snapshot.status,
      progress: snapshot.progress,
      stage: snapshot.stage,
      error: snapshot.error,
      coverage: snapshot.metadata?.coverage ?? SPICE_COVERAGE,
      source: snapshot.metadata?.source ?? SPICE_SOURCE_NAME,
      sourceUrl: snapshot.metadata?.sourceUrl ?? SPICE_SOURCE_URL,
      interpolation: snapshot.metadata?.interpolation,
      validationMaxErrorKm: snapshot.metadata?.validationMaxErrorKm,
      supportsDate: isSpiceDateSupported,
      planetPositionsAu(date: Date): Record<string, Vec3> {
        if (!engine || !isSpiceDateSupported(date)) return {}
        const et = ephemerisTime(engine, date)
        return Object.fromEntries(
          Object.entries(PLANET_TARGETS).map(([id, target]) => [
            id,
            statePositionAu(engine, target, 10, et),
          ]),
        )
      },
      moonPositionAu(date: Date): Vec3 | undefined {
        if (!engine || !isSpiceDateSupported(date)) return undefined
        return statePositionAu(engine, 301, 399, ephemerisTime(engine, date))
      },
    }
  }, [snapshot])
}
