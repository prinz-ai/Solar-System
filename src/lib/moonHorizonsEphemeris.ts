import { useEffect, useState } from 'react'
import type { Vec3 } from '../types'

interface MoonSegment {
  startJd: number
  stepDays: number
  offset: number
  count: number
}

interface MoonDatasetIndex {
  coverage: [string, string]
  stride: number
  targets: Record<string, { segments: MoonSegment[] }>
}

export interface MoonDataset {
  index: MoonDatasetIndex
  values: Float32Array
}

let cachedDataset: MoonDataset | undefined
let datasetPromise: Promise<MoonDataset> | undefined

function loadDataset() {
  if (!datasetPromise) {
    datasetPromise = Promise.all([
      fetch('/ephemeris/horizons-moons-2025-2030.json'),
      fetch('/ephemeris/horizons-moons-2025-2030.bin'),
    ]).then(async ([indexResponse, binaryResponse]) => {
      if (!indexResponse.ok || !binaryResponse.ok) {
        throw new Error(
          `Moon cache returned HTTP ${indexResponse.status}/${binaryResponse.status}`,
        )
      }
      cachedDataset = {
        index: (await indexResponse.json()) as MoonDatasetIndex,
        values: new Float32Array(await binaryResponse.arrayBuffer()),
      }
      return cachedDataset
    })
  }
  return datasetPromise
}

function julianDate(date: Date) {
  return date.getTime() / 86_400_000 + 2_440_587.5
}

export function interpolateMoonPosition(
  dataset: MoonDataset | undefined,
  id: string,
  date: Date,
): Vec3 | undefined {
  const target = dataset?.index.targets[id]
  if (!target) return undefined
  const jd = julianDate(date)
  const segment = target.segments.find((candidate) => {
    const end =
      candidate.startJd + (candidate.count - 1) * candidate.stepDays
    return jd >= candidate.startJd && jd <= end + 1e-8
  })
  if (!segment) return undefined

  const rawIndex = (jd - segment.startJd) / segment.stepDays
  const lowerIndex = Math.min(Math.floor(rawIndex), segment.count - 1)
  const first = (segment.offset + lowerIndex) * dataset.index.stride
  if (lowerIndex === segment.count - 1) {
    return Array.from(dataset.values.slice(first, first + 3)) as Vec3
  }

  const t = rawIndex - lowerIndex
  const t2 = t * t
  const t3 = t2 * t
  const h00 = 2 * t3 - 3 * t2 + 1
  const h10 = t3 - 2 * t2 + t
  const h01 = -2 * t3 + 3 * t2
  const h11 = t3 - t2
  const second = first + dataset.index.stride

  return [0, 1, 2].map((axis) => {
    const p0 = dataset.values[first + axis]
    const v0 = dataset.values[first + axis + 3]
    const p1 = dataset.values[second + axis]
    const v1 = dataset.values[second + axis + 3]
    return (
      h00 * p0 +
      h10 * segment.stepDays * v0 +
      h01 * p1 +
      h11 * segment.stepDays * v1
    )
  }) as Vec3
}

export function useMoonHorizonsEphemeris() {
  const [dataset, setDataset] = useState(cachedDataset)

  useEffect(() => {
    let active = true
    loadDataset()
      .then((loaded) => {
        if (active) setDataset(loaded)
      })
      .catch((error) => {
        console.warn('Unable to load the local JPL moon cache.', error)
      })
    return () => {
      active = false
    }
  }, [])

  return {
    coverage: dataset?.index.coverage,
    positionAu: (id: string, date: Date) =>
      interpolateMoonPosition(dataset, id, date),
  }
}
