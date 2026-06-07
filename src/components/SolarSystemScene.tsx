import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  CameraControls,
  Html,
  Line,
  Points,
  PointMaterial,
  Sparkles,
  useGLTF,
} from '@react-three/drei'
import {
  AdditiveBlending,
  BackSide,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  OctahedronGeometry,
  SphereGeometry,
  Texture,
  Vector3,
} from 'three'
import { MOONS, PLANETS, SMALL_BODIES, SPACECRAFT, SUN } from '../data/bodies'
import {
  bodyOrientationBasis,
  bodyRotationAngle,
  earthSurfaceDirection,
  generateOrbitPath,
  getMoonScenePositions,
  getPlanetSnapshots,
  julianDate,
  mapAuToScene,
  orbitalPositionAu,
  spacecraftPositionAu,
  synchronousOrientationBasis,
} from '../lib/ephemeris'
import {
  createPlanetTexture,
  getCloudLayerDefinition,
  getLoadedTextureIds,
  hasBodyTexture,
  releasePlanetTexture,
  usesWestLongitudeTexture,
} from '../lib/textures'
import type {
  BodySnapshot,
  LayerSettings,
  MoonDefinition,
  PlanetDefinition,
  ScaleMode,
  Vec3,
} from '../types'

interface SolarSystemSceneProps {
  date: Date
  scaleMode: ScaleMode
  layers: LayerSettings
  selectedId: string
  closeView: boolean
  onSelect: (id: string) => void
}

const HIGH_DETAIL_SPHERE_GEOMETRY = new SphereGeometry(1, 64, 48)
const LOW_DETAIL_SPHERE_GEOMETRY = new SphereGeometry(1, 32, 24)
const WEST_HIGH_DETAIL_SPHERE_GEOMETRY =
  HIGH_DETAIL_SPHERE_GEOMETRY.clone()
const WEST_LOW_DETAIL_SPHERE_GEOMETRY = LOW_DETAIL_SPHERE_GEOMETRY.clone()
const SMALL_BODY_GEOMETRY = new SphereGeometry(1, 18, 12)
const SPACECRAFT_GEOMETRY = new OctahedronGeometry(0.1, 0)

for (const geometry of [
  WEST_HIGH_DETAIL_SPHERE_GEOMETRY,
  WEST_LOW_DETAIL_SPHERE_GEOMETRY,
]) {
  const uv = geometry.getAttribute('uv')
  for (let index = 0; index < uv.count; index += 1) {
    uv.setX(index, 1 - uv.getX(index))
  }
  uv.needsUpdate = true
}

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

function RuntimeDiagnostics() {
  const { gl, scene } = useThree()

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const output = document.createElement('output')
    output.dataset.testid = 'runtime-metrics'
    output.hidden = true
    document.body.appendChild(output)

    const update = () => {
      const memory = (performance as PerformanceWithMemory).memory
      output.value = JSON.stringify({
        usedHeapMB: memory
          ? Math.round((memory.usedJSHeapSize / 1_048_576) * 10) / 10
          : null,
        totalHeapMB: memory
          ? Math.round((memory.totalJSHeapSize / 1_048_576) * 10) / 10
          : null,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        sceneObjects: scene.children.length,
        loadedTextureIds: getLoadedTextureIds(),
      })
    }

    update()
    const timer = window.setInterval(update, 1_000)
    return () => {
      window.clearInterval(timer)
      output.remove()
    }
  }, [gl, scene])

  return null
}

function BodyLabel({
  name,
  selected,
  onClick,
}: {
  name: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <Html center position={[0, 1.35, 0]} distanceFactor={13} zIndexRange={[20, 0]}>
      <button
        className={`space-label ${selected ? 'is-selected' : ''}`}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
      >
        <span />
        {name}
      </button>
    </Html>
  )
}

function RingSystem({
  radius,
  subtle = false,
}: {
  radius: number
  subtle?: boolean
}) {
  const rings = subtle
    ? [
        [1.55, 1.6, 0.19],
        [1.85, 1.89, 0.14],
        [2.12, 2.15, 0.1],
      ]
    : [
        [1.28, 1.39, 0.18],
        [1.41, 1.54, 0.32],
        [1.56, 1.72, 0.48],
        [1.74, 1.83, 0.21],
        [1.86, 2.08, 0.46],
        [2.1, 2.26, 0.26],
      ]

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {rings.map(([inner, outer, opacity], index) => (
        <mesh key={index}>
          <ringGeometry args={[radius * inner, radius * outer, 128]} />
          <meshStandardMaterial
            color={subtle ? '#a7d8d7' : index % 2 ? '#d5b878' : '#f2dfac'}
            transparent
            opacity={opacity}
            side={2}
            depthWrite={false}
            roughness={0.82}
            metalness={0}
          />
        </mesh>
      ))}
    </group>
  )
}

function bodyGeometry(id: string, detailed: boolean) {
  if (usesWestLongitudeTexture(id)) {
    return detailed
      ? WEST_HIGH_DETAIL_SPHERE_GEOMETRY
      : WEST_LOW_DETAIL_SPHERE_GEOMETRY
  }
  return detailed
    ? HIGH_DETAIL_SPHERE_GEOMETRY
    : LOW_DETAIL_SPHERE_GEOMETRY
}

function useTransientTexture(id: string, enabled: boolean) {
  const [texture, setTexture] = useState<Texture>()
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (!enabled) {
      // The texture must be detached before its cleanup can dispose GPU data.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTexture(undefined)
      return
    }

    const nextTexture = createPlanetTexture(id, invalidate)
    setTexture(nextTexture)
    return () => {
      releasePlanetTexture(id, nextTexture)
    }
  }, [enabled, id, invalidate])

  return enabled ? texture : undefined
}

function orientationMatrix(basis: [Vec3, Vec3, Vec3]) {
  return new Matrix4().makeBasis(
    new Vector3(...basis[0]),
    new Vector3(...basis[1]),
    new Vector3(...basis[2]),
  )
}

function relativeCloudRotation(
  surfaceRotationHours: number,
  cloudRotationHours: number,
  date: Date,
) {
  const turn = Math.PI * 2
  const angle =
    bodyRotationAngle(cloudRotationHours, date) -
    bodyRotationAngle(surfaceRotationHours, date)
  return ((angle % turn) + turn) % turn
}

function PlanetMesh({
  definition,
  date,
  position,
  selected,
  showLabel,
  onSelect,
}: {
  definition: PlanetDefinition
  date: Date
  position: Vec3
  selected: boolean
  showLabel: boolean
  onSelect: () => void
}) {
  const invalidate = useThree((state) => state.invalidate)
  const texture = useMemo(
    () => createPlanetTexture(definition.id, invalidate),
    [definition.id, invalidate],
  )
  const cloudLayer = getCloudLayerDefinition(definition.id)
  const persistentCloud =
    definition.id === 'venus' || definition.id === 'earth'
  const persistentCloudTexture = useMemo(
    () =>
      cloudLayer && persistentCloud
        ? createPlanetTexture(`${definition.id}-clouds`, invalidate)
        : undefined,
    [cloudLayer, definition.id, invalidate, persistentCloud],
  )
  const transientCloudTexture = useTransientTexture(
    `${definition.id}-clouds`,
    Boolean(cloudLayer && !persistentCloud && selected),
  )
  const cloudTexture = persistentCloudTexture ?? transientCloudTexture
  const cloudRotation = useMemo(
    () =>
      cloudLayer
        ? relativeCloudRotation(
            definition.rotationHours,
            cloudLayer.rotationHours,
            date,
          )
        : 0,
    [cloudLayer, date, definition.rotationHours],
  )
  const geometry = bodyGeometry(definition.id, selected)
  const matrix = useMemo(
    () => orientationMatrix(bodyOrientationBasis(definition.id, date)),
    [date, definition.id],
  )
  const mapped = hasBodyTexture(definition.id)

  return (
    <group position={position}>
      <group matrix={matrix} matrixAutoUpdate={false}>
        <mesh
          scale={definition.displayRadius}
          onClick={(event) => {
            event.stopPropagation()
            onSelect()
          }}
        >
          <primitive object={geometry} attach="geometry" />
          <meshStandardMaterial
            map={texture}
            color={mapped ? '#ffffff' : definition.color}
            roughness={definition.id === 'jupiter' ? 0.9 : 0.78}
            metalness={0.02}
            emissive="#000000"
            emissiveIntensity={0}
          />
        </mesh>
        {definition.id === 'earth' && (
          <mesh scale={definition.displayRadius * 1.015}>
            <primitive
              object={
                selected
                  ? HIGH_DETAIL_SPHERE_GEOMETRY
                  : LOW_DETAIL_SPHERE_GEOMETRY
              }
              attach="geometry"
            />
            <meshPhongMaterial
              color="#b9e8ff"
              transparent
              opacity={0.035}
              depthWrite={false}
            />
          </mesh>
        )}
        {cloudLayer && cloudTexture && (
          <mesh
            scale={definition.displayRadius * cloudLayer.scale}
            rotation={[0, cloudRotation, 0]}
            renderOrder={2}
          >
            <primitive
              object={
                selected
                  ? HIGH_DETAIL_SPHERE_GEOMETRY
                  : LOW_DETAIL_SPHERE_GEOMETRY
              }
              attach="geometry"
            />
            <meshStandardMaterial
              map={cloudTexture}
              color={cloudLayer.color}
              roughness={1}
              metalness={0}
              transparent={!cloudLayer.opaque}
              opacity={cloudLayer.opacity}
              alphaTest={cloudLayer.opaque ? 0 : 0.02}
              depthWrite={Boolean(cloudLayer.opaque)}
            />
          </mesh>
        )}
        {definition.hasRings && (
          <RingSystem
            radius={definition.displayRadius}
            subtle={definition.id === 'uranus'}
          />
        )}
      </group>
      {showLabel && (
        <BodyLabel
          name={definition.name}
          selected={selected}
          onClick={onSelect}
        />
      )}
    </group>
  )
}

function SunMesh({
  date,
  selected,
  showLabel,
  onSelect,
}: {
  date: Date
  selected: boolean
  showLabel: boolean
  onSelect: () => void
}) {
  const invalidate = useThree((state) => state.invalidate)
  const texture = useMemo(
    () => createPlanetTexture('sun', invalidate),
    [invalidate],
  )
  const glowTexture = useMemo(
    () => createPlanetTexture('sun-glow', invalidate),
    [invalidate],
  )
  const matrix = useMemo(
    () => orientationMatrix(bodyOrientationBasis('sun', date)),
    [date],
  )

  return (
    <group>
      <mesh
        matrix={matrix}
        matrixAutoUpdate={false}
        scale={SUN.displayRadius}
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
      >
        <primitive object={HIGH_DETAIL_SPHERE_GEOMETRY} attach="geometry" />
        <meshStandardMaterial
          map={texture}
          color="#ff8d16"
          emissive="#ff5c0a"
          emissiveIntensity={3.5}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        color="#fff1cd"
        intensity={5.2}
        distance={0}
        decay={0}
      />
      <sprite scale={[10, 10, 1]} renderOrder={-1}>
        <spriteMaterial
          map={glowTexture}
          color="#ff8d16"
          transparent
          opacity={0.7}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite scale={[16, 16, 1]} renderOrder={-2}>
        <spriteMaterial
          map={glowTexture}
          color="#ff5c0a"
          transparent
          opacity={0.24}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <Sparkles
        count={52}
        scale={6.4}
        size={3.2}
        speed={0.35}
        color="#ffb43d"
        opacity={0.42}
        noise={0.8}
      />
      {showLabel && (
        <BodyLabel name="The Sun" selected={selected} onClick={onSelect} />
      )}
    </group>
  )
}

function PhobosModel({
  radius,
  onSelect,
}: {
  radius: number
  onSelect: () => void
}) {
  const { scene } = useGLTF('/models/phobos-nasa.glb')
  const model = useMemo(() => scene.clone(true), [scene])
  const normalization = useMemo(() => {
    const bounds = new Box3().setFromObject(model)
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    const meanSemiAxis = (size.x + size.y + size.z) / 6
    return {
      center,
      scale: radius / meanSemiAxis,
    }
  }, [model, radius])

  return (
    <group
      rotation={[0, Math.PI / 2, 0]}
      scale={normalization.scale}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      <primitive
        object={model}
        position={[
          -normalization.center.x,
          -normalization.center.y,
          -normalization.center.z,
        ]}
      />
    </group>
  )
}

function TitanAtmosphere({
  radius,
  detailed,
}: {
  radius: number
  detailed: boolean
}) {
  const geometry = detailed
    ? HIGH_DETAIL_SPHERE_GEOMETRY
    : LOW_DETAIL_SPHERE_GEOMETRY

  return (
    <>
      <mesh scale={radius * 1.028} renderOrder={2}>
        <primitive object={geometry} attach="geometry" />
        <meshPhongMaterial
          color="#e19132"
          specular="#6b2e0f"
          shininess={4}
          transparent
          opacity={0.46}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={radius * 1.065} renderOrder={3}>
        <primitive object={geometry} attach="geometry" />
        <meshPhongMaterial
          color="#ffad45"
          side={BackSide}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}

function MoonMesh({
  moon,
  date,
  position,
  parentPosition,
  showLabel,
  selected,
  onSelect,
}: {
  moon: MoonDefinition
  date: Date
  position: Vec3
  parentPosition: Vec3
  showLabel: boolean
  selected: boolean
  onSelect: () => void
}) {
  const radius = Math.max(0.045, Math.min(0.14, moon.radiusKm / 18_000))
  const mapped = hasBodyTexture(moon.id) && moon.id !== 'phobos'
  const texture = useTransientTexture(moon.id, mapped && selected)
  const geometry = bodyGeometry(moon.id, selected)
  const matrix = useMemo(
    () =>
      orientationMatrix(
        moon.id === 'moon'
          ? bodyOrientationBasis('moon', date)
          : synchronousOrientationBasis(
              position,
              parentPosition,
              moon.parentId,
              date,
            ),
      ),
    [date, moon.id, moon.parentId, parentPosition, position],
  )
  const bodyScale =
    moon.id === 'phobos'
      ? ([1.25, 0.92, 0.84] as const)
      : moon.id === 'deimos'
        ? ([1.18, 0.9, 0.86] as const)
        : ([1, 1, 1] as const)

  return (
    <group position={position}>
      <group matrix={matrix} matrixAutoUpdate={false}>
        {moon.id === 'phobos' && selected ? (
          <Suspense
            fallback={
              <mesh
                scale={[
                  bodyScale[0] * radius,
                  bodyScale[1] * radius,
                  bodyScale[2] * radius,
                ]}
              >
                <primitive object={geometry} attach="geometry" />
                <meshStandardMaterial
                  color={moon.color}
                  roughness={0.95}
                  metalness={0}
                />
              </mesh>
            }
          >
            <PhobosModel radius={radius} onSelect={onSelect} />
          </Suspense>
        ) : (
          <mesh
            scale={[
              bodyScale[0] * radius,
              bodyScale[1] * radius,
              bodyScale[2] * radius,
            ]}
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
            }}
          >
            <primitive object={geometry} attach="geometry" />
            <meshStandardMaterial
              key={texture ? `mapped-${moon.id}` : `plain-${moon.id}`}
              map={texture}
              color={texture ? '#ffffff' : moon.color}
              roughness={0.95}
              metalness={0}
              emissive="#000000"
              emissiveIntensity={0}
            />
          </mesh>
        )}
        {moon.id === 'titan' && (
          <TitanAtmosphere radius={radius} detailed={selected} />
        )}
      </group>
      {showLabel && selected && (
        <Html center position={[0, 0.36, 0]} distanceFactor={12}>
          <button className="space-label moon-label is-selected" onClick={onSelect}>
            {moon.name}
          </button>
        </Html>
      )}
    </group>
  )
}

function PlanetOrbits({ scaleMode }: { scaleMode: ScaleMode }) {
  const paths = useMemo(
    () =>
      PLANETS.map((planet) => ({
        id: planet.id,
        color: planet.color,
        points: generateOrbitPath(planet.id, scaleMode),
      })),
    [scaleMode],
  )
  return (
    <>
      {paths.map((path) => (
        <Line
          key={path.id}
          points={path.points}
          color={path.color}
          lineWidth={0.55}
          transparent
          opacity={path.id === 'pluto' ? 0.34 : 0.22}
          depthWrite={false}
        />
      ))}
    </>
  )
}

function seededRandom(seed: number) {
  const x = Math.sin(seed * 999.91) * 43_758.5453
  return x - Math.floor(x)
}

function OrbitingDust({
  date,
  scaleMode,
  kind,
}: {
  date: Date
  scaleMode: ScaleMode
  kind: 'asteroid' | 'kuiper'
}) {
  const count = kind === 'asteroid' ? 4_600 : 3_000
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const randomA = seededRandom(index * 7 + (kind === 'asteroid' ? 1 : 9))
      const randomB = seededRandom(index * 13 + 3)
      const randomC = seededRandom(index * 17 + 7)
      const semiMajor =
        kind === 'asteroid'
          ? 2.05 + randomA * 1.45
          : 30 + Math.pow(randomA, 0.72) * 24
      const eccentricity =
        kind === 'asteroid' ? randomB * 0.2 : 0.03 + randomB * 0.22
      const phase = randomC * Math.PI * 2
      const radius =
        (semiMajor * (1 - eccentricity ** 2)) /
        (1 + eccentricity * Math.cos(phase))
      const inclination =
        (kind === 'asteroid'
          ? (seededRandom(index * 19) - 0.5) * 20
          : (seededRandom(index * 19) - 0.5) * 34) *
        (Math.PI / 180)
      const position = mapAuToScene(
        [
          Math.cos(phase) * radius,
          Math.sin(phase) * Math.sin(inclination) * radius,
          Math.sin(phase) * Math.cos(inclination) * radius,
        ],
        scaleMode,
      )
      values[index * 3] = position[0]
      values[index * 3 + 1] = position[1]
      values[index * 3 + 2] = position[2]
    }
    return values
  }, [count, kind, scaleMode])
  const days = julianDate(date) - 2_451_545
  const representativeSemiMajor = kind === 'asteroid' ? 2.75 : 42
  const representativePeriod =
    365.256 * Math.pow(representativeSemiMajor, 1.5)
  const beltRotation = -((days / representativePeriod) * Math.PI * 2)

  return (
    <group rotation={[0, beltRotation, 0]}>
      <Points positions={positions} stride={3} frustumCulled>
        <PointMaterial
          transparent
          color={kind === 'asteroid' ? '#bca58a' : '#7395bc'}
          size={kind === 'asteroid' ? 0.035 : 0.045}
          sizeAttenuation
          depthWrite={false}
          opacity={kind === 'asteroid' ? 0.66 : 0.39}
        />
      </Points>
    </group>
  )
}

function OortCloud() {
  const positions = useMemo(() => {
    const count = 5_000
    const values = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const u = seededRandom(index * 3 + 1)
      const v = seededRandom(index * 5 + 2)
      const w = seededRandom(index * 11 + 3)
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const radius = 68 + Math.pow(w, 0.65) * 36
      values[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      values[index * 3 + 1] = radius * Math.cos(phi)
      values[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
    }
    return values
  }, [])

  return (
    <Points positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#8caec6"
        size={0.09}
        sizeAttenuation
        depthWrite={false}
        opacity={0.22}
      />
    </Points>
  )
}

function StarField() {
  const geometry = useMemo(() => {
    const count = 7_000
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = ['#ffffff', '#a9c8ff', '#ffe1af', '#d9e8ff']
    for (let index = 0; index < count; index += 1) {
      const u = seededRandom(index * 3 + 101)
      const v = seededRandom(index * 5 + 223)
      const radius = 155 + seededRandom(index * 7 + 17) * 55
      const theta = u * Math.PI * 2
      const phi = Math.acos(2 * v - 1)
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[index * 3 + 1] = radius * Math.cos(phi)
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta)
      const color = new Color(palette[index % palette.length])
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    }
    const result = new BufferGeometry()
    result.setAttribute('position', new BufferAttribute(positions, 3))
    result.setAttribute('color', new BufferAttribute(colors, 3))
    return result
  }, [])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={0.42}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.86}
        depthWrite={false}
      />
    </points>
  )
}

function CometTail({
  start,
  end,
  color,
}: {
  start: Vec3
  end: Vec3
  color: string
}) {
  const invalidate = useThree((state) => state.invalidate)
  const geometry = useMemo(() => {
    const result = new BufferGeometry()
    result.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(6), 3),
    )
    return result
  }, [])

  useLayoutEffect(() => {
    const attribute = geometry.getAttribute('position') as BufferAttribute
    const values = attribute.array as Float32Array
    values[0] = start[0]
    values[1] = start[1]
    values[2] = start[2]
    values[3] = end[0]
    values[4] = end[1]
    values[5] = end[2]
    attribute.needsUpdate = true
    geometry.computeBoundingSphere()
    invalidate()
  }, [end, geometry, invalidate, start])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.42} />
    </lineSegments>
  )
}

function SmallBodies({
  snapshots,
  labels,
  selectedId,
  onSelect,
  showComets,
}: {
  snapshots: Record<string, BodySnapshot>
  labels: boolean
  selectedId: string
  onSelect: (id: string) => void
  showComets: boolean
}) {
  return (
    <>
      {SMALL_BODIES.filter(
        (body) => body.kind !== 'comet' || showComets,
      ).map((body) => {
        const position = snapshots[body.id].scenePosition
        const distance = Math.hypot(...position)
        const tailLength =
          body.kind === 'comet' ? Math.max(1.4, 7 / Math.max(0.7, distance)) : 0
        const direction =
          distance > 0
            ? (position.map((value) => value / distance) as Vec3)
            : ([1, 0, 0] as Vec3)
        const tailEnd: Vec3 = [
          position[0] + direction[0] * tailLength,
          position[1] + direction[1] * tailLength,
          position[2] + direction[2] * tailLength,
        ]
        const selected = selectedId === body.id
        const bodyScale = body.scale ?? [1, 1, 1]
        return (
          <group key={body.id}>
            {body.kind === 'comet' && (
              <CometTail start={position} end={tailEnd} color={body.color} />
            )}
            <group position={position}>
              <mesh
                scale={[
                  body.radius * bodyScale[0],
                  body.radius * bodyScale[1],
                  body.radius * bodyScale[2],
                ]}
                onClick={(event) => {
                  event.stopPropagation()
                  onSelect(body.id)
                }}
              >
                <primitive object={SMALL_BODY_GEOMETRY} attach="geometry" />
                <meshStandardMaterial
                  color={body.color}
                  roughness={body.kind === 'comet' ? 0.72 : 0.95}
                  metalness={0}
                  emissive={body.kind === 'comet' ? body.color : '#000000'}
                  emissiveIntensity={body.kind === 'comet' ? 1.2 : 0}
                />
              </mesh>
              {body.hasRings && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[body.radius * 1.8, body.radius * 2.25, 64]} />
                  <meshStandardMaterial
                    color="#dce5ea"
                    transparent
                    opacity={0.38}
                    side={2}
                    depthWrite={false}
                    roughness={0.9}
                    metalness={0}
                  />
                </mesh>
              )}
              {(labels && body.kind !== 'asteroid') || selected ? (
                <Html center position={[0, 0.52, 0]} distanceFactor={13}>
                  <button
                    className={`space-label small-label ${
                      selected ? 'is-selected' : ''
                    }`}
                    onClick={() => onSelect(body.id)}
                  >
                    {body.name}
                  </button>
                </Html>
              ) : null}
            </group>
          </group>
        )
      })}
    </>
  )
}

function Spacecraft({
  date,
  scaleMode,
  labels,
  selectedId,
  onSelect,
}: {
  date: Date
  scaleMode: ScaleMode
  labels: boolean
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <>
      {SPACECRAFT.map((craft) => {
        const position = mapAuToScene(spacecraftPositionAu(craft, date), scaleMode)
        const selected = selectedId === craft.id
        return (
          <group key={craft.id} position={position}>
            <mesh
              onClick={(event) => {
                event.stopPropagation()
                onSelect(craft.id)
              }}
              scale={selected ? 1.7 : 1}
            >
              <primitive object={SPACECRAFT_GEOMETRY} attach="geometry" />
              <meshBasicMaterial color={craft.color} toneMapped={false} />
            </mesh>
            {(labels || selected) && (
              <Html center position={[0, 0.45, 0]} distanceFactor={13}>
                <button
                  className={`space-label craft-label ${
                    selected ? 'is-selected' : ''
                  }`}
                  onClick={() => onSelect(craft.id)}
                >
                  {craft.name}
                </button>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

function CameraDirector({
  date,
  selectedId,
  target,
  scaleMode,
  closeView,
}: {
  date: Date
  selectedId: string
  target: Vec3
  scaleMode: ScaleMode
  closeView: boolean
}) {
  const controls = useRef<CameraControls>(null)
  const cameraPosition = useRef(new Vector3())
  const cameraTarget = useRef(new Vector3())
  const lastSelection = useRef('')
  const lastCloseView = useRef(false)
  const planet = PLANETS.find((body) => body.id === selectedId)
  const smallBody = SMALL_BODIES.find((body) => body.id === selectedId)
  const moon = MOONS.find((body) => body.id === selectedId)
  const selectedRadius =
    selectedId === 'sun'
      ? SUN.displayRadius
      : planet?.displayRadius ??
        smallBody?.radius ??
        (moon ? Math.max(0.045, Math.min(0.14, moon.radiusKm / 18_000)) : 0.1)
  const minimumDistance = Math.max(0.04, selectedRadius * 1.035)
  const earthViewDirection = useMemo(
    () => earthSurfaceDirection(date, 12, -82),
    [date],
  )

  useEffect(() => {
    if (!controls.current) return

    if (
      lastSelection.current !== selectedId ||
      lastCloseView.current !== closeView
    ) {
      const distance =
        closeView
          ? selectedRadius * 3.25
          : selectedId === 'sun'
            ? 12
            : planet
              ? Math.max(4.8, planet.displayRadius * 8)
              : 4.2
      controls.current.setLookAt(
        target[0] +
          distance *
            (closeView && selectedId === 'earth'
              ? earthViewDirection[0]
              : closeView
                ? 0.18
                : 0.58),
        target[1] +
          distance *
            (closeView && selectedId === 'earth'
              ? earthViewDirection[1]
              : closeView
                ? 0.08
                : 0.35),
        target[2] +
          distance *
            (closeView && selectedId === 'earth'
              ? earthViewDirection[2]
              : 1),
        target[0],
        target[1],
        target[2],
        true,
      )
      lastSelection.current = selectedId
      lastCloseView.current = closeView
    } else {
      const position = controls.current.getPosition(cameraPosition.current)
      const previousTarget = controls.current.getTarget(cameraTarget.current)
      const offsetX = target[0] - previousTarget.x
      const offsetY = target[1] - previousTarget.y
      const offsetZ = target[2] - previousTarget.z
      controls.current.setLookAt(
        position.x + offsetX,
        position.y + offsetY,
        position.z + offsetZ,
        target[0],
        target[1],
        target[2],
        false,
      )
    }
  }, [
    target,
    closeView,
    earthViewDirection,
    minimumDistance,
    planet,
    scaleMode,
    selectedRadius,
    selectedId,
  ])

  return (
    <CameraControls
      ref={controls}
      makeDefault
      dollySpeed={0.45}
      minDistance={minimumDistance}
      maxDistance={180}
      dollyToCursor
      smoothTime={0.45}
    />
  )
}

function SceneContent({
  date,
  scaleMode,
  layers,
  selectedId,
  closeView,
  onSelect,
}: SolarSystemSceneProps) {
  const planets = useMemo(
    () => getPlanetSnapshots(date, scaleMode),
    [date, scaleMode],
  )
  const smallBodySnapshots = useMemo(() => {
    const snapshots: Record<string, BodySnapshot> = {}
    for (const body of SMALL_BODIES) {
      const positionAu = orbitalPositionAu(body, date)
      snapshots[body.id] = {
        id: body.id,
        positionAu,
        scenePosition: mapAuToScene(positionAu, scaleMode),
        distanceAu: Math.hypot(...positionAu),
      }
    }
    return snapshots
  }, [date, scaleMode])
  const moonParents = useMemo(
    () => ({ ...planets, ...smallBodySnapshots }),
    [planets, smallBodySnapshots],
  )
  const moons = useMemo(
    () => getMoonScenePositions(date, scaleMode, moonParents),
    [date, moonParents, scaleMode],
  )
  const selectedPosition = useMemo(() => {
    const planetPosition = planets[selectedId]?.scenePosition
    if (planetPosition) return planetPosition
    if (moons[selectedId]) return moons[selectedId]
    const smallBodyPosition = smallBodySnapshots[selectedId]?.scenePosition
    if (smallBodyPosition) return smallBodyPosition

    const craft = SPACECRAFT.find((body) => body.id === selectedId)
    return craft
      ? mapAuToScene(spacecraftPositionAu(craft, date), scaleMode)
      : ([0, 0, 0] as Vec3)
  }, [date, moons, planets, scaleMode, selectedId, smallBodySnapshots])

  return (
    <>
      <color attach="background" args={['#01030a']} />
      <fog attach="fog" args={['#02050d', 90, 235]} />
      <ambientLight intensity={0.014} color="#42608e" />
      <StarField />
      {layers.oortCloud && <OortCloud />}
      {layers.orbits && <PlanetOrbits scaleMode={scaleMode} />}
      {layers.asteroidBelt && (
        <OrbitingDust date={date} scaleMode={scaleMode} kind="asteroid" />
      )}
      {layers.kuiperBelt && (
        <OrbitingDust date={date} scaleMode={scaleMode} kind="kuiper" />
      )}
      <SunMesh
        date={date}
        selected={selectedId === 'sun'}
        showLabel={layers.labels && (!closeView || selectedId === 'sun')}
        onSelect={() => onSelect('sun')}
      />
      {PLANETS.map((planet) => (
        <PlanetMesh
          key={planet.id}
          definition={planet}
          date={date}
          position={planets[planet.id].scenePosition}
          selected={selectedId === planet.id}
          showLabel={layers.labels && (!closeView || selectedId === planet.id)}
          onSelect={() => onSelect(planet.id)}
        />
      ))}
      {layers.moons &&
        MOONS.map((moon) => (
          <MoonMesh
            key={moon.id}
            moon={moon}
            date={date}
            position={moons[moon.id]}
            parentPosition={moonParents[moon.parentId].scenePosition}
            selected={selectedId === moon.id}
            showLabel={layers.labels && (!closeView || selectedId === moon.id)}
            onSelect={() => onSelect(moon.id)}
          />
        ))}
      <SmallBodies
        snapshots={smallBodySnapshots}
        labels={layers.labels && !closeView}
        selectedId={selectedId}
        onSelect={onSelect}
        showComets={layers.comets}
      />
      {layers.spacecraft && (
        <Spacecraft
          date={date}
          scaleMode={scaleMode}
          labels={layers.labels && !closeView}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
      <CameraDirector
        date={date}
        selectedId={selectedId}
        target={selectedPosition}
        scaleMode={scaleMode}
        closeView={closeView}
      />
      <RuntimeDiagnostics />
    </>
  )
}

export function SolarSystemScene(props: SolarSystemSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.35]}
      frameloop="demand"
      camera={{ position: [13, 9, 24], fov: 48, near: 0.001, far: 500 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => props.onSelect('sun')}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
