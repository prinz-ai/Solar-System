import { useEffect, useState } from 'react'
import type { Vec3 } from '../types'

interface HorizonsTarget {
  startJd: number
  stepDays: number
  values: number[]
}

interface HorizonsDataset {
  coverage: [string, string]
  targets: Record<string, HorizonsTarget>
}

let cachedDataset: HorizonsDataset | undefined
let datasetPromise: Promise<HorizonsDataset> | undefined

function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = fetch('/ephemeris/horizons-2020-2041.json').then(
      async (response) => {
        if (!response.ok) {
          throw new Error(`Horizons cache returned HTTP ${response.status}`)
        }
        cachedDataset = (await response.json()) as HorizonsDataset
        return cachedDataset
      },
    )
  }
  return datasetPromise
}

function julianDate(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5
}

export function interpolateHorizonsPosition(
  dataset: HorizonsDataset | undefined,
  id: string,
  date: Date,
): Vec3 | undefined {
  const target = dataset?.targets[id]
  if (!target || target.values.length < 6) return undefined

  const jd = julianDate(date)
  const stateCount = target.values.length / 6
  const finalJd = target.startJd + (stateCount - 1) * target.stepDays
  if (jd < target.startJd || jd > finalJd) return undefined

  const rawIndex = (jd - target.startJd) / target.stepDays
  const lowerIndex = Math.min(Math.floor(rawIndex), stateCount - 1)
  if (lowerIndex === stateCount - 1) {
    const offset = lowerIndex * 6
    return target.values.slice(offset, offset + 3) as Vec3
  }

  const t = rawIndex - lowerIndex
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  const first = lowerIndex * 6
  const second = first + 6

  return [0, 1, 2].map((axis) => {
    const p0 = target.values[first + axis]
    const v0 = target.values[first + axis + 3]
    const p1 = target.values[second + axis]
    const v1 = target.values[second + axis + 3]
    return (
      h00 * p0 +
      h10 * target.stepDays * v0 +
      h01 * p1 +
      h11 * target.stepDays * v1
    )
  }) as Vec3
}

export function useHorizonsEphemeris() {
  const [dataset, setDataset] = useState(cachedDataset)

  useEffect(() => {
    let active = true
    loadDataset()
      .then((loaded) => {
        if (active) setDataset(loaded)
      })
      .catch((error) => {
        console.warn('Unable to load the local JPL Horizons cache.', error)
      })
    return () => {
      active = false
    }
  }, [])

  return {
    coverage: dataset?.coverage,
    positionAu: (id: string, date: Date) =>
      interpolateHorizonsPosition(dataset, id, date),
  }
}
