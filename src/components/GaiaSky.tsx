import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ShaderMaterial,
  Vector3,
} from 'three'
import {
  equatorialSkyDirection,
  gaiaColorFromBpRp,
  GAIA_RECORD_FLOATS,
  GAIA_SKY_RADIUS,
  loadGaiaSkyData,
  yearsSinceGaiaEpoch,
  type ConstellationFigureData,
  type ConstellationFigureStar,
  type ConstellationPathStyle,
  type GaiaSkyData,
} from '../lib/gaiaSky'
import { getConstellationFigures } from '../lib/constellations'
import type { Vec3 } from '../types'

interface GaiaSkyProps {
  date: Date
  observerPositionAu: Vec3
  showStars: boolean
  showMilkyWay: boolean
  showConstellations: boolean
  selectedConstellationIds: string[]
  emphasizedConstellationId?: string
}

interface SelectedFigurePath {
  id: string
  style: ConstellationPathStyle
  points: Vec3[]
}

const vertexShader = `
attribute vec2 aProperMotion;
attribute float aSize;
attribute float aAlpha;

uniform float uYears;
uniform float uRadius;
uniform float uOpacity;
uniform vec3 uObserverPositionAu;

varying vec3 vColor;
varying float vAlpha;

const float MAS_TO_RAD = 4.84813681109536e-9;
const float AU_PER_PARALLAX_MAS = 206264806.24709636;
const float OBLIQUITY = 0.40909280422232897;

void main() {
  float dec0 = position.y;
  float ra = position.x +
    aProperMotion.x * uYears * MAS_TO_RAD / max(abs(cos(dec0)), 0.0001);
  float dec = dec0 + aProperMotion.y * uYears * MAS_TO_RAD;
  float cosDec = cos(dec);
  vec3 equatorial = vec3(
    cosDec * cos(ra),
    cosDec * sin(ra),
    sin(dec)
  );
  float eclipticY =
    equatorial.y * cos(OBLIQUITY) + equatorial.z * sin(OBLIQUITY);
  float eclipticZ =
    -equatorial.y * sin(OBLIQUITY) + equatorial.z * cos(OBLIQUITY);
  vec3 sceneDirection = vec3(
    equatorial.x,
    eclipticZ,
    -eclipticY
  );
  float inverseDistance = max(position.z, 0.0) / AU_PER_PARALLAX_MAS;
  vec3 apparentDirection = normalize(
    sceneDirection - uObserverPositionAu * inverseDistance
  );
  vec4 modelViewPosition = modelViewMatrix *
    vec4(apparentDirection * uRadius, 1.0);

  gl_Position = projectionMatrix * modelViewPosition;
  gl_PointSize = clamp(
    aSize * 250.0 / max(25.0, -modelViewPosition.z),
    0.65,
    8.0
  );
  vColor = color;
  vAlpha = aAlpha * uOpacity;
}
`

const fragmentShader = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float distanceFromCenter = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (distanceFromCenter > 1.0) discard;
  float core = pow(max(0.0, 1.0 - distanceFromCenter), 1.6);
  float halo = pow(max(0.0, 1.0 - distanceFromCenter), 0.42);
  gl_FragColor = vec4(vColor, vAlpha * (core * 0.82 + halo * 0.18));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

const figureStarVertexShader = `
attribute float aSize;
attribute float aAlpha;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewPosition;
  gl_PointSize = clamp(
    aSize * 275.0 / max(32.0, -modelViewPosition.z),
    2.4,
    20.0
  );
  vColor = color;
  vAlpha = aAlpha;
}
`

const figureStarFragmentShader = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float distanceFromCenter = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (distanceFromCenter > 1.0) discard;
  float core = pow(max(0.0, 1.0 - distanceFromCenter), 5.4);
  float halo = pow(max(0.0, 1.0 - distanceFromCenter), 0.85);
  vec3 color = mix(vColor, vec3(1.0), core * 0.82);
  gl_FragColor = vec4(color, vAlpha * (halo * 0.38 + core));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

function createStarGeometry(
  data: GaiaSkyData,
  start: number,
  count: number,
  densityLayer: boolean,
) {
  const positions = new Float32Array(count * 3)
  const properMotion = new Float32Array(count * 2)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const alphas = new Float32Array(count)

  for (let index = 0; index < count; index += 1) {
    const sourceOffset = (start + index) * GAIA_RECORD_FLOATS
    const positionOffset = index * 3
    const motionOffset = index * 2
    const magnitude = data.records[sourceOffset + 5]
    const color = gaiaColorFromBpRp(data.records[sourceOffset + 6])
    positions[positionOffset] = data.records[sourceOffset]
    positions[positionOffset + 1] = data.records[sourceOffset + 1]
    positions[positionOffset + 2] = data.records[sourceOffset + 2]
    properMotion[motionOffset] = data.records[sourceOffset + 3]
    properMotion[motionOffset + 1] = data.records[sourceOffset + 4]
    colors[positionOffset] = color[0]
    colors[positionOffset + 1] = color[1]
    colors[positionOffset + 2] = color[2]
    if (densityLayer) {
      sizes[index] = 0.82
      alphas[index] = Math.max(0.035, 0.15 - magnitude * 0.004)
    } else {
      sizes[index] = Math.max(1.15, Math.min(6.2, 6.35 - magnitude * 0.48))
      alphas[index] = Math.max(
        0.12,
        Math.min(1, Math.pow(10, -0.1 * (magnitude - 3))),
      )
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute(
    'aProperMotion',
    new BufferAttribute(properMotion, 2),
  )
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  geometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1))
  geometry.computeBoundingSphere()
  return geometry
}

function createSkyMaterial(opacity: number) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uYears: { value: 0 },
      uRadius: { value: GAIA_SKY_RADIUS },
      uOpacity: { value: opacity },
      uObserverPositionAu: { value: new Vector3() },
    },
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

function constellationDirection(star: ConstellationFigureStar) {
  return equatorialSkyDirection(
    (star.raDeg * Math.PI) / 180,
    (star.decDeg * Math.PI) / 180,
  )
}

function createConstellationGeometry(data: ConstellationFigureData) {
  const values: number[] = []
  const radius = GAIA_SKY_RADIUS - 0.8
  for (const figure of data.constellations) {
    for (const path of figure.paths) {
      for (let index = 0; index < path.stars.length - 1; index += 1) {
        const start = constellationDirection(path.stars[index])
        const end = constellationDirection(path.stars[index + 1])
        values.push(
          start[0] * radius,
          start[1] * radius,
          start[2] * radius,
          end[0] * radius,
          end[1] * radius,
          end[2] * radius,
        )
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(values), 3),
  )
  geometry.computeBoundingSphere()
  return geometry
}

function interpolateSkyArc(start: Vec3, end: Vec3, subdivisions: number) {
  const dot = Math.max(
    -1,
    Math.min(
      1,
      start[0] * end[0] + start[1] * end[1] + start[2] * end[2],
    ),
  )
  const angle = Math.acos(dot)
  if (angle < 0.0001) return [start]
  const sine = Math.sin(angle)
  return Array.from({ length: subdivisions }, (_, index) => {
    const amount = index / subdivisions
    const startWeight = Math.sin((1 - amount) * angle) / sine
    const endWeight = Math.sin(amount * angle) / sine
    return [
      start[0] * startWeight + end[0] * endWeight,
      start[1] * startWeight + end[1] * endWeight,
      start[2] * startWeight + end[2] * endWeight,
    ] as Vec3
  })
}

function createSelectedFigurePaths(
  data: ConstellationFigureData,
  ids: string[],
): SelectedFigurePath[] {
  const radius = GAIA_SKY_RADIUS - 0.22
  return getConstellationFigures(data, ids).flatMap((figure) =>
    figure.paths.map((path) => {
      const directions = path.stars.map(constellationDirection)
      const curved: Vec3[] = []
      for (let index = 0; index < directions.length - 1; index += 1) {
        const dot =
          directions[index][0] * directions[index + 1][0] +
          directions[index][1] * directions[index + 1][1] +
          directions[index][2] * directions[index + 1][2]
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
        const subdivisions = Math.max(3, Math.ceil(angle / 0.018))
        curved.push(
          ...interpolateSkyArc(
            directions[index],
            directions[index + 1],
            subdivisions,
          ),
        )
      }
      curved.push(directions[directions.length - 1])
      return {
        id: figure.id,
        style: path.style,
        points: curved.map(
          (direction) =>
            direction.map((value) => value * radius) as Vec3,
        ),
      }
    }),
  )
}

function createSelectedFigureStarGeometry(
  data: ConstellationFigureData,
  ids: string[],
  emphasized = false,
) {
  const stars = new Map<
    number,
    {
      star: ConstellationFigureStar
      links: number
      boldUses: number
    }
  >()

  for (const figure of getConstellationFigures(data, ids)) {
    for (const path of figure.paths) {
      path.stars.forEach((star, index) => {
        const existing = stars.get(star.hip)
        const links =
          (index > 0 ? 1 : 0) + (index < path.stars.length - 1 ? 1 : 0)
        if (existing) {
          existing.links += links
          if (path.style === 'bold') existing.boldUses += 1
        } else {
          stars.set(star.hip, {
            star,
            links,
            boldUses: path.style === 'bold' ? 1 : 0,
          })
        }
      })
    }
  }

  const positions = new Float32Array(stars.size * 3)
  const colors = new Float32Array(stars.size * 3)
  const sizes = new Float32Array(stars.size)
  const alphas = new Float32Array(stars.size)
  const radius = GAIA_SKY_RADIUS - 0.08

  ;[...stars.values()].forEach(({ star, links, boldUses }, index) => {
    const direction = constellationDirection(star)
    const color = gaiaColorFromBpRp(star.bv)
    const brightness = Math.max(
      0.12,
      Math.min(1, (6.3 - star.magnitude) / 6.3),
    )
    const keyStar =
      star.magnitude <= 3.25 || boldUses > 0 || links >= 4
    positions[index * 3] = direction[0] * radius
    positions[index * 3 + 1] = direction[1] * radius
    positions[index * 3 + 2] = direction[2] * radius
    colors[index * 3] = color[0]
    colors[index * 3 + 1] = color[1]
    colors[index * 3 + 2] = color[2]
    sizes[index] = keyStar
      ? (9.5 + brightness * 11.5) * (emphasized ? 1.32 : 1)
      : (3 + brightness * 3.2) * (emphasized ? 1.22 : 1)
    alphas[index] = keyStar
      ? Math.min(1, (0.7 + brightness * 0.3) * (emphasized ? 1.12 : 1))
      : Math.min(
          0.72,
          (0.18 + brightness * 0.24) * (emphasized ? 1.55 : 1),
        )
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  geometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1))
  geometry.computeBoundingSphere()
  return geometry
}

function createFigureStarMaterial() {
  return new ShaderMaterial({
    vertexShader: figureStarVertexShader,
    fragmentShader: figureStarFragmentShader,
    vertexColors: true,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

const FIGURE_LINE_STYLE = {
  bold: {
    haloWidth: 2,
    haloOpacity: 0.04,
    coreWidth: 0.76,
    coreOpacity: 0.34,
  },
  normal: {
    haloWidth: 1.65,
    haloOpacity: 0.03,
    coreWidth: 0.58,
    coreOpacity: 0.24,
  },
  thin: {
    haloWidth: 1.25,
    haloOpacity: 0.018,
    coreWidth: 0.44,
    coreOpacity: 0.14,
  },
} satisfies Record<
  ConstellationPathStyle,
  {
    haloWidth: number
    haloOpacity: number
    coreWidth: number
    coreOpacity: number
  }
>

const EMPHASIZED_LINE_STYLE = {
  bold: {
    haloWidth: 5,
    haloOpacity: 0.12,
    coreWidth: 1.35,
    coreOpacity: 0.94,
  },
  normal: {
    haloWidth: 4.2,
    haloOpacity: 0.1,
    coreWidth: 1.12,
    coreOpacity: 0.82,
  },
  thin: {
    haloWidth: 3.4,
    haloOpacity: 0.075,
    coreWidth: 0.92,
    coreOpacity: 0.62,
  },
} satisfies typeof FIGURE_LINE_STYLE

export function GaiaSky({
  date,
  observerPositionAu,
  showStars,
  showMilkyWay,
  showConstellations,
  selectedConstellationIds,
  emphasizedConstellationId,
}: GaiaSkyProps) {
  const invalidate = useThree((state) => state.invalidate)
  const [data, setData] = useState<GaiaSkyData | null>(null)

  useEffect(() => {
    let active = true
    loadGaiaSkyData()
      .then((loaded) => {
        if (!active) return
        setData(loaded)
        invalidate()
      })
      .catch((error) => console.error('Unable to load Gaia sky', error))
    return () => {
      active = false
    }
  }, [invalidate])

  const brightGeometry = useMemo(
    () =>
      data
        ? createStarGeometry(data, 0, data.metadata.brightCount, false)
        : null,
    [data],
  )
  const densityGeometry = useMemo(
    () =>
      data
        ? createStarGeometry(
            data,
            data.metadata.brightCount,
            data.metadata.densityCount,
            true,
          )
        : null,
    [data],
  )
  const constellationGeometry = useMemo(
    () =>
      data ? createConstellationGeometry(data.constellationFigures) : null,
    [data],
  )
  const contextConstellationIds = useMemo(
    () =>
      emphasizedConstellationId
        ? selectedConstellationIds.filter(
            (id) => id !== emphasizedConstellationId,
          )
        : selectedConstellationIds,
    [emphasizedConstellationId, selectedConstellationIds],
  )
  const selectedFigurePaths = useMemo(
    () =>
      data
        ? createSelectedFigurePaths(
            data.constellationFigures,
            contextConstellationIds,
          )
        : [],
    [contextConstellationIds, data],
  )
  const emphasizedFigurePaths = useMemo(
    () =>
      data && emphasizedConstellationId
        ? createSelectedFigurePaths(
            data.constellationFigures,
            [emphasizedConstellationId],
          )
        : [],
    [data, emphasizedConstellationId],
  )
  const selectedFigureStarGeometry = useMemo(
    () =>
      data && contextConstellationIds.length > 0
        ? createSelectedFigureStarGeometry(
            data.constellationFigures,
            contextConstellationIds,
          )
        : null,
    [contextConstellationIds, data],
  )
  const emphasizedFigureStarGeometry = useMemo(
    () =>
      data && emphasizedConstellationId
        ? createSelectedFigureStarGeometry(
            data.constellationFigures,
            [emphasizedConstellationId],
            true,
          )
        : null,
    [data, emphasizedConstellationId],
  )
  const brightMaterial = useMemo(() => createSkyMaterial(1), [])
  const densityMaterial = useMemo(() => createSkyMaterial(0.55), [])
  const figureStarMaterial = useMemo(() => createFigureStarMaterial(), [])

  useLayoutEffect(() => {
    const years = yearsSinceGaiaEpoch(date)
    for (const material of [brightMaterial, densityMaterial]) {
      material.uniforms.uYears.value = years
      material.uniforms.uObserverPositionAu.value.set(...observerPositionAu)
    }
    invalidate()
  }, [
    brightMaterial,
    date,
    densityMaterial,
    invalidate,
    observerPositionAu,
  ])

  useEffect(() => {
    return () => {
      brightMaterial.dispose()
      densityMaterial.dispose()
      figureStarMaterial.dispose()
    }
  }, [brightMaterial, densityMaterial, figureStarMaterial])

  useEffect(() => {
    return () => {
      selectedFigureStarGeometry?.dispose()
      emphasizedFigureStarGeometry?.dispose()
    }
  }, [emphasizedFigureStarGeometry, selectedFigureStarGeometry])

  if (!data) return null

  return (
    <group renderOrder={-100}>
      {showMilkyWay && densityGeometry && (
        <points
          geometry={densityGeometry}
          material={densityMaterial}
          frustumCulled={false}
        />
      )}
      {showStars && brightGeometry && (
        <points
          geometry={brightGeometry}
          material={brightMaterial}
          frustumCulled={false}
        />
      )}
      {showConstellations && constellationGeometry && (
        <lineSegments geometry={constellationGeometry}>
          <lineBasicMaterial
            color="#54cfff"
            transparent
            opacity={selectedConstellationIds.length > 0 ? 0.025 : 0.055}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </lineSegments>
      )}
      {selectedFigureStarGeometry && (
        <points
          geometry={selectedFigureStarGeometry}
          material={figureStarMaterial}
          frustumCulled={false}
          renderOrder={8}
        />
      )}
      {emphasizedFigureStarGeometry && (
        <points
          geometry={emphasizedFigureStarGeometry}
          material={figureStarMaterial}
          frustumCulled={false}
          renderOrder={10}
        />
      )}
      {selectedFigurePaths.map((path, index) => {
        const style = FIGURE_LINE_STYLE[path.style]
        return (
          <group key={`${path.id}-${index}`} renderOrder={7}>
            <Line
              points={path.points}
              color="#31c9ee"
              lineWidth={style.haloWidth}
              transparent
              opacity={style.haloOpacity}
              depthTest
              depthWrite={false}
              blending={AdditiveBlending}
            />
            <Line
              points={path.points}
              color="#b9f3ff"
              lineWidth={style.coreWidth}
              transparent
              opacity={style.coreOpacity}
              depthTest
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </group>
        )
      })}
      {emphasizedFigurePaths.map((path, index) => {
        const style = EMPHASIZED_LINE_STYLE[path.style]
        return (
          <group key={`emphasized-${path.id}-${index}`} renderOrder={9}>
            <Line
              points={path.points}
              color="#20d8ff"
              lineWidth={style.haloWidth}
              transparent
              opacity={style.haloOpacity}
              depthTest
              depthWrite={false}
              blending={AdditiveBlending}
            />
            <Line
              points={path.points}
              color="#effdff"
              lineWidth={style.coreWidth}
              transparent
              opacity={style.coreOpacity}
              depthTest
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </group>
        )
      })}
    </group>
  )
}
