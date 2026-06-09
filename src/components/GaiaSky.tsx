import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
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
  type GaiaSkyData,
} from '../lib/gaiaSky'
import type { Vec3 } from '../types'

interface GaiaSkyProps {
  date: Date
  observerPositionAu: Vec3
  showStars: boolean
  showMilkyWay: boolean
  showConstellations: boolean
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

function createConstellationGeometry(data: GaiaSkyData) {
  const values: number[] = []
  for (const boundary of data.constellations.boundaries) {
    for (let index = 0; index < boundary.points.length; index += 1) {
      const nextIndex = (index + 1) % boundary.points.length
      const start = equatorialSkyDirection(...boundary.points[index])
      const end = equatorialSkyDirection(...boundary.points[nextIndex])
      values.push(
        start[0] * (GAIA_SKY_RADIUS - 1),
        start[1] * (GAIA_SKY_RADIUS - 1),
        start[2] * (GAIA_SKY_RADIUS - 1),
        end[0] * (GAIA_SKY_RADIUS - 1),
        end[1] * (GAIA_SKY_RADIUS - 1),
        end[2] * (GAIA_SKY_RADIUS - 1),
      )
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

export function GaiaSky({
  date,
  observerPositionAu,
  showStars,
  showMilkyWay,
  showConstellations,
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
    () => (data ? createConstellationGeometry(data) : null),
    [data],
  )
  const brightMaterial = useMemo(() => createSkyMaterial(1), [])
  const densityMaterial = useMemo(() => createSkyMaterial(0.55), [])

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
    }
  }, [brightMaterial, densityMaterial])

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
            opacity={0.24}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </lineSegments>
      )}
    </group>
  )
}
