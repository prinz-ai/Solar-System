import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  CameraControls,
  Html,
  Line,
  Points,
  PointMaterial,
} from '@react-three/drei'
import {
  AdditiveBlending,
  BackSide,
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Object3D,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MOONS, PLANETS, SMALL_BODIES, SPACECRAFT, SUN } from '../data/bodies'
import {
  getRenderAsset,
  type RenderAsset,
} from '../data/renderAssets'
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
import { useHorizonsEphemeris } from '../lib/horizonsEphemeris'
import { useMoonHorizonsEphemeris } from '../lib/moonHorizonsEphemeris'
import {
  createPlanetTexture,
  getCloudLayerDefinition,
  getLoadedTextureIds,
  hasBodyTexture,
  releasePlanetTexture,
  usesWestLongitudeTexture,
} from '../lib/textures'
import { isSelectionClick } from '../lib/cameraInteraction'
import type {
  BodySnapshot,
  LayerSettings,
  MoonDefinition,
  PlanetDefinition,
  ScaleMode,
  SunViewMode,
  Vec3,
} from '../types'

interface SolarSystemSceneProps {
  date: Date
  scaleMode: ScaleMode
  layers: LayerSettings
  selectedId: string
  closeView: boolean
  sunViewMode: SunViewMode
  onSelect: (id: string) => void
}

function selectFromSceneClick(
  event: { delta: number; stopPropagation: () => void },
  onSelect: () => void,
) {
  event.stopPropagation()
  if (isSelectionClick(event.delta)) onSelect()
}

const HIGH_DETAIL_SPHERE_GEOMETRY = new SphereGeometry(1, 64, 48)
const LOW_DETAIL_SPHERE_GEOMETRY = new SphereGeometry(1, 32, 24)
const WEST_HIGH_DETAIL_SPHERE_GEOMETRY =
  HIGH_DETAIL_SPHERE_GEOMETRY.clone()
const WEST_LOW_DETAIL_SPHERE_GEOMETRY = LOW_DETAIL_SPHERE_GEOMETRY.clone()
const SMALL_BODY_GEOMETRY = new SphereGeometry(1, 18, 12)
const SPACECRAFT_GEOMETRY = new OctahedronGeometry(0.1, 0)
const PIONEER_DISH_PROFILE = Array.from({ length: 25 }, (_, index) => {
  const radius = (index / 24) * 1.37
  return new Vector2(radius, radius * radius * 0.14)
})

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
  bodyId,
}: {
  radius: number
  bodyId: string
}) {
  const ringBand = (
    centerKm: number,
    widthKm: number,
    planetRadiusKm: number,
    opacity: number,
    color: string,
  ) => {
    const center = centerKm / planetRadiusKm
    const halfWidth = Math.max(widthKm / planetRadiusKm, 0.005) / 2
    return [center - halfWidth, center + halfWidth, opacity, color] as const
  }

  const rings =
    bodyId === 'uranus'
      ? [
          ringBand(38_000, 3_500, 25_559, 0.045, '#b9dde0'),
          ringBand(41_837, 3, 25_559, 0.24, '#c5e7e9'),
          ringBand(42_234, 3, 25_559, 0.22, '#a7ced2'),
          ringBand(42_570, 3, 25_559, 0.2, '#d2edef'),
          ringBand(44_718, 10, 25_559, 0.28, '#afd6da'),
          ringBand(45_661, 10, 25_559, 0.27, '#cde9eb'),
          ringBand(47_176, 2, 25_559, 0.18, '#9fc7cc'),
          ringBand(47_627, 4, 25_559, 0.3, '#d8f0f1'),
          ringBand(48_300, 7, 25_559, 0.25, '#aacfd3'),
          ringBand(50_024, 2, 25_559, 0.19, '#d5edef'),
          ringBand(51_149, 70, 25_559, 0.42, '#b8dadd'),
          ringBand(67_300, 3_800, 25_559, 0.035, '#8eb9bf'),
          ringBand(97_700, 17_000, 25_559, 0.024, '#83abb1'),
        ]
      : bodyId === 'neptune'
        ? [
            ringBand(41_900, 2_000, 24_764, 0.075, '#8aa4bd'),
            ringBand(53_200, 110, 24_764, 0.2, '#b3cadc'),
            ringBand(55_200, 4_000, 24_764, 0.045, '#829db5'),
            ringBand(57_200, 100, 24_764, 0.12, '#a8bfd3'),
            ringBand(62_930, 50, 24_764, 0.24, '#c4d8e7'),
          ]
        : [
            [1.28, 1.39, 0.18, '#f2dfac'] as const,
            [1.41, 1.54, 0.32, '#d5b878'] as const,
            [1.56, 1.72, 0.48, '#f2dfac'] as const,
            [1.74, 1.83, 0.21, '#d5b878'] as const,
            [1.86, 2.08, 0.46, '#f2dfac'] as const,
            [2.1, 2.26, 0.26, '#d5b878'] as const,
          ]
  const neptuneArcRadius = 62_930 / 24_764
  const neptuneArcs = [
    [0.1, 0.18],
    [0.39, 0.12],
    [0.61, 0.14],
    [0.88, 0.17],
  ] as const

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {rings.map(([inner, outer, opacity, color], index) => (
        <mesh key={index}>
          <ringGeometry args={[radius * inner, radius * outer, 128]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={opacity}
            side={2}
            depthWrite={false}
            roughness={0.82}
            metalness={0}
          />
        </mesh>
      ))}
      {bodyId === 'neptune' &&
        neptuneArcs.map(([start, length], index) => (
          <mesh key={`arc-${index}`}>
            <ringGeometry
              args={[
                radius * (neptuneArcRadius - 0.006),
                radius * (neptuneArcRadius + 0.006),
                48,
                1,
                start,
                length,
              ]}
            />
            <meshStandardMaterial
              color="#e1eff9"
              transparent
              opacity={0.52}
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

function disposeObject(object: Object3D) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  const textures = new Set<Texture>()

  object.traverse((child) => {
    if (!(child instanceof Mesh)) return
    geometries.add(child.geometry)
    const childMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    childMaterials.forEach((material) => {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof Texture) textures.add(value)
      }
    })
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
}

function DetailedModel({
  asset,
  radius,
  color,
  fallbackScale = [1, 1, 1],
  onSelect,
}: {
  asset: RenderAsset
  radius: number
  color: string
  fallbackScale?: Vec3
  onSelect: () => void
}) {
  const [model, setModel] = useState<Object3D>()
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    let active = true
    let loadedObject: Object3D | undefined
    const detailedTexture = asset.texturePath
      ? new TextureLoader().load(asset.texturePath, () => invalidate())
      : undefined
    if (detailedTexture) detailedTexture.colorSpace = SRGBColorSpace

    const finish = (object: Object3D) => {
      loadedObject = object
      if (asset.format === 'obj') {
        object.traverse((child) => {
          if (!(child instanceof Mesh)) return
          const originalMaterials = Array.isArray(child.material)
            ? child.material
            : [child.material]
          originalMaterials.forEach((material) => material.dispose())
          if (!child.geometry.getAttribute('normal')) {
            child.geometry.computeVertexNormals()
          }
          child.material = new MeshStandardMaterial({
            color: asset.color ?? color,
            map: detailedTexture,
            roughness: 0.94,
            metalness: 0,
          })
        })
      }
      if (active) {
        setModel(object)
        invalidate()
      } else {
        disposeObject(object)
      }
    }

    const fail = () => invalidate()
    if (asset.format === 'glb') {
      new GLTFLoader().load(
        asset.path,
        (gltf) => finish(gltf.scene),
        undefined,
        fail,
      )
    } else {
      new OBJLoader().load(asset.path, finish, undefined, fail)
    }

    return () => {
      active = false
      if (loadedObject) disposeObject(loadedObject)
      else detailedTexture?.dispose()
    }
  }, [asset, color, invalidate])

  const normalization = useMemo(() => {
    if (!model) return undefined
    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model)
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    const largestSemiAxis = Math.max(size.x, size.y, size.z) / 2
    return {
      center,
      scale: largestSemiAxis > 0 ? radius / largestSemiAxis : 1,
    }
  }, [model, radius])

  if (!model || !normalization) {
    return (
      <mesh
        scale={[
          radius * fallbackScale[0],
          radius * fallbackScale[1],
          radius * fallbackScale[2],
        ]}
        onClick={(event) => {
          selectFromSceneClick(event, onSelect)
        }}
      >
        <primitive object={SMALL_BODY_GEOMETRY} attach="geometry" />
        <meshStandardMaterial color={color} roughness={0.94} metalness={0} />
      </mesh>
    )
  }

  return (
    <group
      rotation={asset.rotation ?? [0, 0, 0]}
      scale={normalization.scale}
      onClick={(event) => {
        selectFromSceneClick(event, onSelect)
      }}
    >
      <group
        position={[
          -normalization.center.x,
          -normalization.center.y,
          -normalization.center.z,
        ]}
      >
        <primitive object={model} />
      </group>
    </group>
  )
}

function SpaceBeam({
  start,
  end,
  radius,
  color,
}: {
  start: Vec3
  end: Vec3
  radius: number
  color: string
}) {
  const transform = useMemo(() => {
    const startVector = new Vector3(...start)
    const endVector = new Vector3(...end)
    const direction = endVector.clone().sub(startVector)
    const length = direction.length()
    const position = startVector.add(endVector).multiplyScalar(0.5)
    const quaternion = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction.normalize(),
    )
    return { length, position, quaternion }
  }, [end, start])

  return (
    <mesh position={transform.position} quaternion={transform.quaternion}>
      <cylinderGeometry args={[radius, radius, transform.length, 10]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.75} />
    </mesh>
  )
}

function PioneerRtg({ position }: { position: Vec3 }) {
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      {[-0.19, 0.19].map((offset) => (
        <group key={offset} position={[0, 0, offset]}>
          <mesh>
            <cylinderGeometry args={[0.105, 0.105, 0.66, 18]} />
            <meshStandardMaterial
              color="#3b3d3b"
              roughness={0.7}
              metalness={0.72}
            />
          </mesh>
          {[-0.25, -0.15, -0.05, 0.05, 0.15, 0.25].map((ring) => (
            <mesh key={ring} position={[0, ring, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.15, 0.018, 6, 18]} />
              <meshStandardMaterial
                color="#777873"
                roughness={0.5}
                metalness={0.8}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function PioneerProbeModel({
  radius,
  variant,
  sunward,
  onSelect,
}: {
  radius: number
  variant: 'pioneer-10' | 'pioneer-11'
  sunward: Vec3
  onSelect: () => void
}) {
  const scale = radius / 3.55
  const orientation = useMemo(
    () =>
      new Quaternion().setFromUnitVectors(
        new Vector3(0, 1, 0),
        new Vector3(...sunward).normalize(),
      ),
    [sunward],
  )
  const leftRtg: Vec3 = [-2.65, -0.22, 0.45]
  const rightRtg: Vec3 = [2.65, -0.22, 0.45]
  const magnetometer: Vec3 = [0, -0.08, -3.35]
  const feed: Vec3 = [0, 1.62, 0]

  return (
    <group
      scale={scale}
      quaternion={orientation}
      onClick={(event) => {
        selectFromSceneClick(event, onSelect)
      }}
    >
      <group rotation={[0, variant === 'pioneer-10' ? -0.24 : 0.24, 0]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.52, 6]} />
        <meshStandardMaterial
          color="#a88132"
          roughness={0.58}
          metalness={0.66}
        />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <latheGeometry args={[PIONEER_DISH_PROFILE, 72]} />
        <meshStandardMaterial
          color="#e7dfc6"
          roughness={0.62}
          metalness={0.28}
          side={2}
        />
      </mesh>
      <mesh position={[0, 0.683, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.37, 0.018, 8, 72]} />
        <meshStandardMaterial color="#c9c1a9" roughness={0.48} metalness={0.52} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.18, 0.28, 0.18, 24]} />
        <meshStandardMaterial color="#9b8e72" roughness={0.5} metalness={0.6} />
      </mesh>

      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle) => (
        <SpaceBeam
          key={angle}
          start={[Math.cos(angle) * 1.08, 0.59, Math.sin(angle) * 1.08]}
          end={feed}
          radius={0.022}
          color="#8a867b"
        />
      ))}
      <mesh position={feed}>
        <cylinderGeometry args={[0.08, 0.12, 0.34, 18]} />
        <meshStandardMaterial color="#c8b16a" roughness={0.45} metalness={0.75} />
      </mesh>
      <SpaceBeam
        start={[0, 1.78, 0]}
        end={[0, 2.16, 0]}
        radius={0.018}
        color="#bcb9ad"
      />
      <mesh position={[0, 2.2, 0]}>
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshStandardMaterial color="#d6d1c2" roughness={0.4} metalness={0.62} />
      </mesh>

      <SpaceBeam
        start={[-0.48, -0.12, 0.3]}
        end={leftRtg}
        radius={0.035}
        color="#8e8b81"
      />
      <SpaceBeam
        start={[0.48, -0.12, 0.3]}
        end={rightRtg}
        radius={0.035}
        color="#8e8b81"
      />
      <PioneerRtg position={leftRtg} />
      <PioneerRtg position={rightRtg} />

      <SpaceBeam
        start={[0, -0.04, -0.5]}
        end={magnetometer}
        radius={0.025}
        color="#8d8980"
      />
      <mesh position={magnetometer}>
        <boxGeometry args={[0.16, 0.12, 0.22]} />
        <meshStandardMaterial color="#a5a39c" roughness={0.48} metalness={0.62} />
      </mesh>

      <mesh position={[0, -0.52, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.22, 0.55, 24, 1, true]} />
        <meshStandardMaterial
          color="#d5c9a9"
          roughness={0.58}
          metalness={0.32}
          side={2}
        />
      </mesh>
      <SpaceBeam
        start={[0, -0.48, 0]}
        end={[0, -1.12, 0]}
        radius={0.014}
        color="#c9c6bb"
      />

      <mesh position={[0, -0.08, 0.635]}>
        <boxGeometry args={[0.42, 0.25, 0.08]} />
        <meshStandardMaterial color="#262c31" roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh position={[0.38, -0.1, 0.52]} rotation={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.09, 0.13, 0.22, 16]} />
        <meshStandardMaterial color="#575e60" roughness={0.55} metalness={0.65} />
      </mesh>
      <mesh position={[-0.42, -0.11, 0.46]} rotation={[0, 0.62, 0]}>
        <boxGeometry args={[0.19, 0.22, 0.2]} />
        <meshStandardMaterial color="#32383c" roughness={0.64} metalness={0.52} />
      </mesh>
      <mesh position={[0.19, -0.09, -0.58]}>
        <boxGeometry args={[0.18, 0.2, 0.14]} />
        <meshStandardMaterial color="#626866" roughness={0.62} metalness={0.5} />
      </mesh>

      <mesh position={[0, -0.12, 0.665]}>
        <boxGeometry args={[0.19, 0.13, 0.018]} />
        <meshStandardMaterial
          color="#d7a94e"
          roughness={0.32}
          metalness={0.82}
          emissive="#5e3505"
          emissiveIntensity={0.12}
        />
      </mesh>

      {[
        [-0.48, -0.31, -0.24],
        [0.48, -0.31, -0.24],
        [0, -0.31, 0.5],
      ].map((position) => (
        <mesh
          key={position.join(',')}
          position={position as Vec3}
          rotation={[Math.PI, 0, 0]}
        >
          <coneGeometry args={[0.065, 0.15, 12]} />
          <meshStandardMaterial color="#74746e" roughness={0.52} metalness={0.7} />
        </mesh>
      ))}
      </group>
    </group>
  )
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
  const renderAsset = getRenderAsset(definition.id)

  return (
    <group position={position}>
      <group matrix={matrix} matrixAutoUpdate={false}>
        {selected && renderAsset ? (
          <DetailedModel
            asset={renderAsset}
            radius={definition.displayRadius}
            color={definition.color}
            onSelect={onSelect}
          />
        ) : (
          <mesh
            scale={definition.displayRadius}
            onClick={(event) => {
              selectFromSceneClick(event, onSelect)
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
        )}
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
        {cloudLayer && cloudTexture && !(selected && renderAsset) && (
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
          <RingSystem radius={definition.displayRadius} bodyId={definition.id} />
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

const SUN_VERTEX_SHADER = `
  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  void main() {
    vObjectPosition = normalize(position);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const SUN_FRAGMENT_SHADER = `
  precision highp float;

  uniform float uDays;
  varying vec3 vObjectPosition;
  varying vec3 vWorldNormal;
  varying vec3 vViewDirection;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.55;
    for (int octave = 0; octave < 5; octave++) {
      value += noise3(p) * amplitude;
      p = p * 2.03 + vec3(7.1, 3.7, 5.3);
      amplitude *= 0.48;
    }
    return value;
  }

  float sunspot(vec3 p, vec3 center, float radius) {
    float distanceOnSphere = acos(clamp(dot(p, normalize(center)), -1.0, 1.0));
    return 1.0 - smoothstep(radius * 0.55, radius, distanceOnSphere);
  }

  void main() {
    vec3 p = normalize(vObjectPosition);
    float sinLatitude = p.y;
    float sin2 = sinLatitude * sinLatitude;
    float relativeDegrees =
      (-2.396 * sin2 - 1.787 * sin2 * sin2) * mod(uDays, 27.2753);
    float shift = radians(relativeDegrees);
    mat2 rotation = mat2(cos(shift), -sin(shift), sin(shift), cos(shift));
    p.xz = rotation * p.xz;

    float cells = fbm(p * 42.0);
    float supergranules = fbm(p * 8.5 + vec3(2.7));
    float filaments = abs(noise3(p * 19.0) - 0.5) * 2.0;
    float spotMask =
      sunspot(p, vec3(0.78, 0.20, 0.59), 0.105) +
      sunspot(p, vec3(-0.66, -0.27, 0.70), 0.075) +
      sunspot(p, vec3(0.18, -0.36, -0.92), 0.055);
    spotMask = clamp(spotMask, 0.0, 1.0);

    float facing = max(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0);
    float limb = mix(0.48, 1.0, pow(facing, 0.38));
    float faculae = pow(1.0 - facing, 2.0) * smoothstep(0.58, 0.9, supergranules);
    float heat = 0.57 + cells * 0.35 + supergranules * 0.16 - filaments * 0.05;
    heat += faculae * 0.26;

    vec3 deepOrange = vec3(1.0, 0.19, 0.015);
    vec3 golden = vec3(1.0, 0.61, 0.08);
    vec3 whiteHot = vec3(1.0, 0.93, 0.53);
    vec3 color = mix(deepOrange, golden, smoothstep(0.4, 0.78, heat));
    color = mix(color, whiteHot, smoothstep(0.72, 1.02, heat));
    color *= limb;
    color = mix(color, vec3(0.13, 0.035, 0.012), spotMask * 0.88);
    color += vec3(1.0, 0.55, 0.08) * faculae * 0.45;

    gl_FragColor = vec4(color, 1.0);
  }
`

const SUN_OBSERVATION_URLS: Record<SunViewMode, string> = {
  photosphere: '',
  visible: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIIC.jpg',
  '171': 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0171.jpg',
  '193': 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0193.jpg',
  '304': 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_0304.jpg',
  magnetogram: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_1024_HMIB.jpg',
}

function SunMesh({
  date,
  selected,
  showLabel,
  viewMode,
  onSelect,
}: {
  date: Date
  selected: boolean
  showLabel: boolean
  viewMode: SunViewMode
  onSelect: () => void
}) {
  const invalidate = useThree((state) => state.invalidate)
  const glowTexture = useMemo(
    () => createPlanetTexture('sun-glow', invalidate),
    [invalidate],
  )
  const coronaTexture = useMemo(
    () => createPlanetTexture('sun-corona', invalidate),
    [invalidate],
  )
  const matrix = useMemo(
    () => orientationMatrix(bodyOrientationBasis('sun', date)),
    [date],
  )
  const shaderUniforms = useMemo(
    () => ({
      uDays: { value: julianDate(date) - 2_451_545 },
    }),
    [date],
  )
  const [referenceNow] = useState(() => Date.now())
  const nearPresent =
    Math.abs(date.getTime() - referenceNow) < 12 * 3_600_000
  const showObservation = viewMode !== 'photosphere' && nearPresent
  const observationUrl = SUN_OBSERVATION_URLS[viewMode]
  const observationCacheKey = Math.floor(referenceNow / 900_000)
  const coronaRotation = bodyRotationAngle(609.12, date) * 0.08

  return (
    <group>
      <mesh
        matrix={matrix}
        matrixAutoUpdate={false}
        scale={SUN.displayRadius}
        onClick={(event) => {
          selectFromSceneClick(event, onSelect)
        }}
      >
        <primitive object={HIGH_DETAIL_SPHERE_GEOMETRY} attach="geometry" />
        <shaderMaterial
          vertexShader={SUN_VERTEX_SHADER}
          fragmentShader={SUN_FRAGMENT_SHADER}
          uniforms={shaderUniforms}
          toneMapped={false}
        />
      </mesh>
      {showObservation && (
        <Html
          center
          transform
          sprite
          distanceFactor={1.75}
          zIndexRange={[12, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="sdo-solar-disk">
            <img
              src={`${observationUrl}?v=${observationCacheKey}`}
              alt="Current Earth-facing Sun from NASA Solar Dynamics Observatory"
              draggable={false}
            />
          </div>
        </Html>
      )}
      <pointLight
        color="#fffdf7"
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
      <sprite scale={[14, 14, 1]} renderOrder={-1}>
        <spriteMaterial
          map={coronaTexture}
          color="#ffc36a"
          rotation={coronaRotation}
          transparent
          opacity={0.72}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <sprite scale={[21, 21, 1]} renderOrder={-2}>
        <spriteMaterial
          map={coronaTexture}
          color="#ff6e25"
          rotation={-coronaRotation * 0.7}
          transparent
          opacity={0.25}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {showLabel && (
        <BodyLabel name="The Sun" selected={selected} onClick={onSelect} />
      )}
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
  const renderAsset = getRenderAsset(moon.id)
  const mapped = hasBodyTexture(moon.id)
  const texture = useTransientTexture(
    moon.id,
    mapped && selected && !renderAsset,
  )
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
        {selected && renderAsset ? (
          <DetailedModel
            asset={renderAsset}
            radius={radius}
            color={moon.color}
            fallbackScale={[...bodyScale]}
            onSelect={onSelect}
          />
        ) : (
          <mesh
            scale={[
              bodyScale[0] * radius,
              bodyScale[1] * radius,
              bodyScale[2] * radius,
            ]}
            onClick={(event) => {
              selectFromSceneClick(event, onSelect)
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
  date,
  snapshots,
  labels,
  selectedId,
  onSelect,
  showComets,
}: {
  date: Date
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
        const renderAsset = getRenderAsset(body.id)
        const rotation = body.rotationHours
          ? bodyRotationAngle(body.rotationHours, date)
          : 0
        return (
          <group key={body.id}>
            {body.kind === 'comet' && (
              <CometTail start={position} end={tailEnd} color={body.color} />
            )}
            <group position={position}>
              <group rotation={[0, rotation, 0]}>
                {selected && renderAsset ? (
                  <DetailedModel
                    asset={renderAsset}
                    radius={body.radius}
                    color={body.color}
                    fallbackScale={bodyScale}
                    onSelect={() => onSelect(body.id)}
                  />
                ) : (
                  <mesh
                    scale={[
                      body.radius * bodyScale[0],
                      body.radius * bodyScale[1],
                      body.radius * bodyScale[2],
                    ]}
                    onClick={(event) => {
                      selectFromSceneClick(event, () => onSelect(body.id))
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
                )}
              </group>
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
  scaleMode,
  positionsAu,
  labels,
  closeView,
  selectedId,
  onSelect,
}: {
  scaleMode: ScaleMode
  positionsAu: Record<string, Vec3>
  labels: boolean
  closeView: boolean
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <>
      {SPACECRAFT.map((craft) => {
        const position = mapAuToScene(positionsAu[craft.id], scaleMode)
        const selected = selectedId === craft.id
        const renderAsset = getRenderAsset(craft.id)
        const pioneer =
          craft.id === 'pioneer-10' || craft.id === 'pioneer-11'
        const distance = Math.hypot(...position)
        const sunward = position.map(
          (value) => -value / Math.max(distance, 0.001),
        ) as Vec3
        return (
          <group key={craft.id} position={position}>
            {selected && pioneer ? (
              <PioneerProbeModel
                radius={0.22}
                variant={craft.id as 'pioneer-10' | 'pioneer-11'}
                sunward={sunward}
                onSelect={() => onSelect(craft.id)}
              />
            ) : selected && renderAsset ? (
              <DetailedModel
                asset={renderAsset}
                radius={0.22}
                color={craft.color}
                onSelect={() => onSelect(craft.id)}
              />
            ) : (
              <mesh
                onClick={(event) => {
                  selectFromSceneClick(event, () => onSelect(craft.id))
                }}
                scale={selected ? 1.7 : 1}
              >
                <primitive object={SPACECRAFT_GEOMETRY} attach="geometry" />
                <meshBasicMaterial color={craft.color} toneMapped={false} />
              </mesh>
            )}
            {(labels || (selected && !closeView)) && (
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
  const craft = SPACECRAFT.find((body) => body.id === selectedId)
  const selectedRadius =
    selectedId === 'sun'
      ? SUN.displayRadius
      : planet?.displayRadius ??
        smallBody?.radius ??
        (moon
          ? Math.max(0.045, Math.min(0.14, moon.radiusKm / 18_000))
          : craft
            ? 0.22
            : 0.1)
  const minimumDistance = Math.max(0.04, selectedRadius * 1.035)
  const earthViewDirection = useMemo(
    () => earthSurfaceDirection(date, 12, -82),
    [date],
  )
  const sunwardViewDirection = useMemo(() => {
    const distanceFromSun = Math.hypot(...target)
    if (distanceFromSun < 0.001) return [0.18, 0.08, 1] as Vec3
    const direction: Vec3 = [
      -target[0] / distanceFromSun,
      -target[1] / distanceFromSun + 0.08,
      -target[2] / distanceFromSun,
    ]
    const length = Math.hypot(...direction)
    return direction.map((value) => value / length) as Vec3
  }, [target])
  const closeViewDirection = useMemo(() => {
    if (craft?.id !== 'pioneer-10' && craft?.id !== 'pioneer-11') {
      return sunwardViewDirection
    }

    const direction = new Vector3(...sunwardViewDirection)
    const tangent = new Vector3(direction.z, 0, -direction.x)
    if (tangent.lengthSq() > 0.001) {
      direction.addScaledVector(tangent.normalize(), 0.38)
    }
    direction.y += 0.14
    return direction.normalize().toArray() as Vec3
  }, [craft?.id, sunwardViewDirection])

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
                ? closeViewDirection[0]
                : 0.58),
        target[1] +
          distance *
            (closeView && selectedId === 'earth'
              ? earthViewDirection[1]
              : closeView
                ? closeViewDirection[1]
                : 0.35),
        target[2] +
          distance *
            (closeView && selectedId === 'earth'
              ? earthViewDirection[2]
              : closeView
                ? closeViewDirection[2]
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
    closeViewDirection,
    earthViewDirection,
    minimumDistance,
    planet,
    scaleMode,
    selectedRadius,
    selectedId,
    sunwardViewDirection,
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
  sunViewMode,
  onSelect,
}: SolarSystemSceneProps) {
  const isolateSun = closeView && selectedId === 'sun'
  const horizons = useHorizonsEphemeris()
  const moonHorizons = useMoonHorizonsEphemeris()
  const planets = useMemo(
    () => getPlanetSnapshots(date, scaleMode),
    [date, scaleMode],
  )
  const smallBodySnapshots = useMemo(() => {
    const snapshots: Record<string, BodySnapshot> = {}
    for (const body of SMALL_BODIES) {
      const positionAu =
        horizons.positionAu(body.id, date) ?? orbitalPositionAu(body, date)
      snapshots[body.id] = {
        id: body.id,
        positionAu,
        scenePosition: mapAuToScene(positionAu, scaleMode),
        distanceAu: Math.hypot(...positionAu),
      }
    }
    return snapshots
  }, [date, horizons, scaleMode])
  const spacecraftPositions = useMemo(() => {
    const positions: Record<string, Vec3> = {}
    for (const craft of SPACECRAFT) {
      positions[craft.id] =
        horizons.positionAu(craft.id, date) ??
        spacecraftPositionAu(craft, date)
    }
    return positions
  }, [date, horizons])
  const moonParents = useMemo(
    () => ({ ...planets, ...smallBodySnapshots }),
    [planets, smallBodySnapshots],
  )
  const precisionMoonVectors = useMemo(() => {
    const vectors: Record<string, Vec3> = {}
    for (const moon of MOONS) {
      const vector = moonHorizons.positionAu(moon.id, date)
      if (vector) vectors[moon.id] = vector
    }
    return vectors
  }, [date, moonHorizons])
  const moons = useMemo(
    () =>
      getMoonScenePositions(
        date,
        scaleMode,
        moonParents,
        precisionMoonVectors,
      ),
    [date, moonParents, precisionMoonVectors, scaleMode],
  )
  const selectedPosition = useMemo(() => {
    const planetPosition = planets[selectedId]?.scenePosition
    if (planetPosition) return planetPosition
    if (moons[selectedId]) return moons[selectedId]
    const smallBodyPosition = smallBodySnapshots[selectedId]?.scenePosition
    if (smallBodyPosition) return smallBodyPosition

    const craft = SPACECRAFT.find((body) => body.id === selectedId)
    return craft
      ? mapAuToScene(spacecraftPositions[craft.id], scaleMode)
      : ([0, 0, 0] as Vec3)
  }, [
    moons,
    planets,
    scaleMode,
    selectedId,
    smallBodySnapshots,
    spacecraftPositions,
  ])

  return (
    <>
      <color attach="background" args={['#01030a']} />
      <fog attach="fog" args={['#02050d', 90, 235]} />
      <ambientLight intensity={0.014} color="#42608e" />
      <StarField />
      {layers.oortCloud && !isolateSun && <OortCloud />}
      {layers.orbits && !isolateSun && <PlanetOrbits scaleMode={scaleMode} />}
      {layers.asteroidBelt && !isolateSun && (
        <OrbitingDust date={date} scaleMode={scaleMode} kind="asteroid" />
      )}
      {layers.kuiperBelt && !isolateSun && (
        <OrbitingDust date={date} scaleMode={scaleMode} kind="kuiper" />
      )}
      <SunMesh
        date={date}
        selected={selectedId === 'sun'}
        showLabel={layers.labels && (!closeView || selectedId === 'sun')}
        viewMode={sunViewMode}
        onSelect={() => onSelect('sun')}
      />
      {!isolateSun &&
        PLANETS.map((planet) => (
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
        !isolateSun &&
        MOONS.filter((moon) => !closeView || moon.id === selectedId).map(
          (moon) => (
            <MoonMesh
              key={moon.id}
              moon={moon}
              date={date}
              position={moons[moon.id]}
              parentPosition={moonParents[moon.parentId].scenePosition}
              selected={selectedId === moon.id}
              showLabel={
                layers.labels && (!closeView || selectedId === moon.id)
              }
              onSelect={() => onSelect(moon.id)}
            />
          ),
        )}
      {!isolateSun && (
        <SmallBodies
          date={date}
          snapshots={smallBodySnapshots}
          labels={layers.labels && !closeView}
          selectedId={selectedId}
          onSelect={onSelect}
          showComets={layers.comets}
        />
      )}
      {layers.spacecraft && !isolateSun && (
        <Spacecraft
          scaleMode={scaleMode}
          positionsAu={spacecraftPositions}
          labels={layers.labels && !closeView}
          closeView={closeView}
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
      onPointerMissed={() => {
        if (!props.closeView) props.onSelect('sun')
      }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
