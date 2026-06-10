import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Atom,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CirclePause,
  CirclePlay,
  Crosshair,
  Database,
  ExternalLink,
  Focus,
  Eye,
  EyeOff,
  Gauge,
  Layers3,
  LocateFixed,
  Menu,
  Orbit,
  FastForward,
  Rewind,
  RotateCcw,
  Satellite,
  Search,
  Square,
  Sparkles,
  Telescope,
  X,
} from 'lucide-react'
import { SolarSystemScene } from './components/SolarSystemScene'
import {
  ALL_MAJOR_BODIES,
  FEATURED_MOONS,
  MOONS,
  PLANETS,
  SMALL_BODIES,
  SPACECRAFT,
  SUN,
} from './data/bodies'
import { getObjectDataSource } from './data/dataSources'
import { getRenderCoverage } from './data/renderAssets'
import {
  getPlanetSnapshots,
  getMoonRelativePositionsAu,
  magnitude,
  orbitalPositionAu,
  spacecraftPositionAu,
} from './lib/ephemeris'
import {
  computeEclipseEvents,
  eclipseEventsForBody,
  type EclipseBody,
  type EclipseEvent,
} from './lib/eclipses'
import { useHorizonsEphemeris } from './lib/horizonsEphemeris'
import { useMoonHorizonsEphemeris } from './lib/moonHorizonsEphemeris'
import {
  SPICE_SOURCE_NAME,
  SPICE_SOURCE_URL,
  useSpiceEphemeris,
} from './lib/spiceEphemeris'
import {
  advanceSimulationDate,
  type PlaybackDirection,
} from './lib/simulationClock'
import { closeViewAfterSelection } from './lib/cameraInteraction'
import {
  EARTH_OBSERVATION,
  isEarthObservationCurrent,
} from './lib/earthObservation'
import {
  searchObjects,
  type SearchableObject,
} from './lib/objectSearch'
import {
  findUpcomingCelestialEvents,
  type CelestialEventGuide,
} from './lib/celestialEvents'
import {
  CONSTELLATIONS,
  getConstellation,
  searchConstellations,
} from './lib/constellations'
import type {
  CinematicFocus,
  LayerSettings,
  ScaleMode,
  SkyObserverId,
  SunViewMode,
} from './types'

const SPEEDS = [
  { label: 'REAL TIME', value: 1 },
  { label: '1 HOUR / SEC', value: 3_600 },
  { label: '1 DAY / SEC', value: 86_400 },
  { label: '1 MONTH / SEC', value: 2_629_746 },
  { label: '1 YEAR / SEC', value: 31_556_952 },
]

const initialLayers: LayerSettings = {
  stars: true,
  milkyWay: true,
  constellations: false,
  labels: true,
  orbits: true,
  moons: true,
  asteroidBelt: true,
  kuiperBelt: true,
  oortCloud: false,
  comets: true,
  spacecraft: true,
}

const SKY_OBSERVER_OPTIONS: { id: SkyObserverId; label: string }[] = [
  { id: 'earth', label: 'EARTH · GEOCENTER' },
  { id: 'solar-system', label: 'SOLAR SYSTEM BARYCENTER' },
  ...SPACECRAFT.map((spacecraft) => ({
    id: spacecraft.id as SkyObserverId,
    label: spacecraft.name.toUpperCase(),
  })),
]

type ObjectCategory =
  | 'planets'
  | 'dwarfs'
  | 'comets'
  | 'asteroids'
  | 'interstellar'
  | 'probes'

const OBJECT_CATEGORIES: {
  id: ObjectCategory
  label: string
  icon: React.ReactNode
}[] = [
  { id: 'planets', label: 'PLANETS · 8', icon: <Orbit size={12} /> },
  {
    id: 'dwarfs',
    label: `DWARF WORLDS · ${
      SMALL_BODIES.filter(
        (body) =>
          body.kind === 'dwarf' || body.kind === 'dwarf-candidate',
      ).length + 1
    }`,
    icon: <Atom size={12} />,
  },
  {
    id: 'comets',
    label: `COMETS · ${SMALL_BODIES.filter((body) => body.kind === 'comet').length}`,
    icon: <Sparkles size={12} />,
  },
  {
    id: 'asteroids',
    label: `ASTEROIDS · ${SMALL_BODIES.filter((body) => body.kind === 'asteroid').length}`,
    icon: <Sparkles size={12} />,
  },
  {
    id: 'interstellar',
    label: `INTERSTELLAR · ${
      SMALL_BODIES.filter((body) => body.kind === 'interstellar').length
    }`,
    icon: <Sparkles size={12} />,
  },
  {
    id: 'probes',
    label: `PROBES · ${SPACECRAFT.length}`,
    icon: <Satellite size={12} />,
  },
]

const SUN_VIEW_OPTIONS: { id: SunViewMode; label: string }[] = [
  { id: 'photosphere', label: 'REALISTIC' },
  { id: 'visible', label: 'VISIBLE' },
  { id: '171', label: 'UV 171' },
  { id: '193', label: 'UV 193' },
  { id: '304', label: 'UV 304' },
  { id: 'magnetogram', label: 'MAGNETIC' },
]

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

function formatDate(date: Date) {
  return dateFormatter.format(date)
}

function dateTimeInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function useSimulationClock() {
  const [date, setDate] = useState(() => new Date())
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [direction, setDirection] = useState<PlaybackDirection>(1)
  const [isLive, setIsLive] = useState(true)
  const lastTick = useRef(0)

  useEffect(() => {
    lastTick.current = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const elapsedMs = now - lastTick.current
      lastTick.current = now
      if (!playing) return

      if (isLive && speed === 1 && direction === 1) {
        setDate(new Date())
      } else {
        setDate((current) =>
          advanceSimulationDate(current, elapsedMs, speed, direction),
        )
      }
    }, 200)
    return () => window.clearInterval(timer)
  }, [direction, isLive, playing, speed])

  const goLive = useCallback(() => {
    setDate(new Date())
    setSpeed(1)
    setDirection(1)
    setIsLive(true)
    setPlaying(false)
    lastTick.current = performance.now()
  }, [])

  const chooseDate = useCallback((next: Date) => {
    setDate(next)
    setIsLive(false)
    lastTick.current = performance.now()
  }, [])

  const chooseSpeed = useCallback((next: number) => {
    setSpeed(next)
    if (next !== 1) setIsLive(false)
    lastTick.current = performance.now()
  }, [])

  const startPlayback = useCallback((nextDirection: PlaybackDirection) => {
    setDirection(nextDirection)
    setPlaying(true)
    if (nextDirection === -1 || speed !== 1) setIsLive(false)
    lastTick.current = performance.now()
  }, [speed])

  const togglePlaying = useCallback(() => {
    if (playing) {
      setPlaying(false)
      setIsLive(false)
    } else {
      startPlayback(direction)
    }
  }, [direction, playing, startPlayback])

  const stop = useCallback(() => {
    setPlaying(false)
    setDirection(1)
    setIsLive(false)
    lastTick.current = performance.now()
  }, [])

  return {
    date,
    playing,
    speed,
    direction,
    isLive,
    togglePlaying,
    startPlayback,
    stop,
    chooseDate,
    chooseSpeed,
    goLive,
  }
}

function AccuracyBadge({
  level,
  label,
}: {
  level: 'ephemeris' | 'analytical' | 'statistical'
  label?: string
}) {
  const labels = {
    ephemeris: 'HIGH-PRECISION EPHEMERIS',
    analytical: 'ORBITAL MODEL',
    statistical: 'POPULATION MODEL',
  }
  return (
    <span className={`accuracy-badge ${level}`}>
      {label ?? labels[level]}
    </span>
  )
}

function eclipseEventLabel(event: EclipseEvent) {
  const labels = {
    'solar-eclipse': 'SOLAR ECLIPSE',
    'lunar-eclipse': 'LUNAR ECLIPSE',
    'moon-transit': 'SATELLITE TRANSIT',
    'mutual-eclipse': 'MUTUAL SATELLITE ECLIPSE',
    'mutual-occultation': 'MUTUAL OCCULTATION',
  }
  return labels[event.type]
}

function Inspector({
  selectedId,
  date,
  scaleMode,
  closeView,
  sunViewMode,
  onCloseViewChange,
  onSunViewModeChange,
  onClose,
}: {
  selectedId: string
  date: Date
  scaleMode: ScaleMode
  closeView: boolean
  sunViewMode: SunViewMode
  onCloseViewChange: (closeView: boolean) => void
  onSunViewModeChange: (mode: SunViewMode) => void
  onClose: () => void
}) {
  const spice = useSpiceEphemeris()
  const horizons = useHorizonsEphemeris()
  const moonHorizons = useMoonHorizonsEphemeris()
  const planet = ALL_MAJOR_BODIES.find((body) => body.id === selectedId)
  const moon = MOONS.find((body) => body.id === selectedId)
  const smallBody = SMALL_BODIES.find((body) => body.id === selectedId)
  const spacecraft = SPACECRAFT.find((body) => body.id === selectedId)
  const dataSource = getObjectDataSource(selectedId)
  const renderCoverage = getRenderCoverage(selectedId)
  const spicePlanetPositions = useMemo(
    () => spice.planetPositionsAu(date),
    [date, spice],
  )
  const spiceMoonPosition = useMemo(
    () => spice.moonPositionAu(date),
    [date, spice],
  )
  const planetSnapshots = useMemo(
    () => getPlanetSnapshots(date, scaleMode, spicePlanetPositions),
    [date, scaleMode, spicePlanetPositions],
  )
  const eclipseMoonVectors = useMemo(() => {
    const vectors: Record<string, [number, number, number]> = {}
    if (spiceMoonPosition) vectors.moon = spiceMoonPosition
    for (const candidate of FEATURED_MOONS) {
      if (candidate.id === 'moon' && spiceMoonPosition) continue
      const vector = moonHorizons.positionAu(candidate.id, date)
      if (vector) vectors[candidate.id] = vector
    }
    return vectors
  }, [date, moonHorizons, spiceMoonPosition])
  const eclipseEvents = useMemo(() => {
    const relativeMoons = getMoonRelativePositionsAu(
      date,
      eclipseMoonVectors,
      FEATURED_MOONS,
    )
    const bodies: EclipseBody[] = [
      {
        id: 'sun',
        name: SUN.name,
        radiusKm: SUN.radiusKm,
        positionAu: [0, 0, 0],
        kind: 'sun',
      },
      ...PLANETS.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        radiusKm: candidate.radiusKm,
        positionAu: planetSnapshots[candidate.id].positionAu,
        kind: 'planet' as const,
      })),
    ]
    for (const candidate of FEATURED_MOONS) {
      if (!candidate.radiusKm) continue
      const parent = planetSnapshots[candidate.parentId]
      const relative = relativeMoons[candidate.id]
      if (!parent || !relative) continue
      bodies.push({
        id: candidate.id,
        name: candidate.name,
        radiusKm: candidate.radiusKm,
        positionAu: [
          parent.positionAu[0] + relative[0],
          parent.positionAu[1] + relative[1],
          parent.positionAu[2] + relative[2],
        ],
        parentId: candidate.parentId,
        kind: 'moon',
      })
    }
    return computeEclipseEvents(bodies)
  }, [date, eclipseMoonVectors, planetSnapshots])
  const selectedEclipseEvents = useMemo(
    () => eclipseEventsForBody(eclipseEvents, selectedId).slice(0, 4),
    [eclipseEvents, selectedId],
  )
  const [referenceNow] = useState(() => Date.now())
  const currentEarthObservation =
    selectedId === 'earth' && isEarthObservationCurrent(date)

  let title = ''
  let subtitle = ''
  let facts: string[] = []
  let precision: 'ephemeris' | 'analytical' | 'statistical' = 'analytical'
  let precisionLabel: string | undefined
  let orbitSource:
    | { title: string; organization: string; url: string; note: string }
    | undefined
  let accent = '#7cdcff'
  let stats: { label: string; value: string }[] = []

  if (planet) {
    const snapshot = planetSnapshots[planet.id]
    title = planet.name
    subtitle = planet.subtitle
    facts = planet.facts
    precision = planet.precision
    if (planet.id !== 'sun' && spicePlanetPositions[planet.id]) {
      precisionLabel = 'NASA/JPL DE442 · CSPICE'
      orbitSource = {
        title: 'DE442 planetary ephemeris',
        organization: 'NASA/JPL Navigation and Ancillary Information Facility',
        url: SPICE_SOURCE_URL,
        note: 'Evaluated locally in CSPICE WebAssembly',
      }
    } else if (planet.id !== 'sun') {
      orbitSource = {
        title: 'Astronomy Engine planetary solution',
        organization: 'Astronomy Engine',
        url: 'https://github.com/cosinekitty/astronomy',
        note: 'Fallback outside the DE442 range or while SPICE loads',
      }
    }
    accent = planet.accent
    stats = [
      {
        label: 'SUN DISTANCE',
        value:
          planet.id === 'sun'
            ? '0 AU'
            : `${snapshot.distanceAu.toFixed(snapshot.distanceAu < 10 ? 3 : 2)} AU`,
      },
      {
        label: 'RADIUS',
        value: `${planet.radiusKm.toLocaleString()} km`,
      },
      {
        label: 'YEAR',
        value:
          planet.id === 'sun'
            ? '—'
            : planet.orbitalPeriodDays > 730
              ? `${(planet.orbitalPeriodDays / 365.256).toFixed(1)} Earth years`
              : `${planet.orbitalPeriodDays.toFixed(1)} days`,
      },
      {
        label: 'DAY',
        value:
          Math.abs(planet.rotationHours) > 48
            ? `${(Math.abs(planet.rotationHours) / 24).toFixed(1)} Earth days`
            : `${Math.abs(planet.rotationHours).toFixed(1)} hours`,
      },
    ]
  } else if (moon) {
    const horizonsPosition = moonHorizons.positionAu(moon.id, date)
    const parent =
      ALL_MAJOR_BODIES.find((body) => body.id === moon.parentId) ??
      SMALL_BODIES.find((body) => body.id === moon.parentId)
    title = moon.name
    subtitle = `Moon of ${parent?.name ?? moon.parentId}`
    const usesSpice = moon.id === 'moon' && Boolean(spiceMoonPosition)
    precision =
      moon.exactModel || horizonsPosition || usesSpice
        ? 'ephemeris'
        : 'analytical'
    if (usesSpice) {
      precisionLabel = 'NASA/JPL DE442 · CSPICE'
      orbitSource = {
        title: 'DE442 Earth-Moon ephemeris',
        organization: 'NASA/JPL Navigation and Ancillary Information Facility',
        url: SPICE_SOURCE_URL,
        note: 'Parent-relative state evaluated locally in CSPICE',
      }
    } else if (horizonsPosition) {
      precisionLabel = 'NASA/JPL HORIZONS CACHE'
      orbitSource = {
        title: 'JPL Horizons trajectory vectors',
        organization: 'NASA/JPL Solar System Dynamics',
        url: 'https://ssd.jpl.nasa.gov/horizons/',
        note: 'Dense parent-relative state-vector interpolation',
      }
    } else if (moon.exactModel) {
      precisionLabel = 'SPECIALIZED SATELLITE MODEL'
      orbitSource = {
        title: 'Astronomy Engine satellite solution',
        organization: 'Astronomy Engine',
        url: 'https://github.com/cosinekitty/astronomy',
        note: 'Fallback while DE442 loads or outside cached coverage',
      }
    } else if (moon.meanAnomalyDeg !== undefined) {
      precisionLabel = 'JPL MEAN ELEMENTS'
      orbitSource = {
        title: 'JPL planetary satellite mean elements',
        organization: 'NASA/JPL Solar System Dynamics',
        url: 'https://ssd.jpl.nasa.gov/sats/elem/',
        note: 'General orbit shape for the expanded moon catalog',
      }
    }
    accent = moon.color
    facts = [
      moon.id === 'mk2' || moon.id === 'dactyl'
        ? moon.id === 'mk2'
          ? 'MK 2’s orbit is not fully measured; this display uses a representative 12.4-day model.'
          : 'Dactyl’s orbit is poorly constrained; this display uses a representative 1.54-day path around Ida.'
        : `${moon.name} circles ${parent?.name ?? moon.parentId} once every ${Math.abs(
            moon.orbitalPeriodDays,
          ).toFixed(2)} Earth days.`,
      `Its average orbital distance is ${moon.orbitalRadiusKm.toLocaleString()} km.`,
      moon.retrograde || moon.orbitalPeriodDays < 0
        ? 'This moon travels in a retrograde direction, opposite its planet’s rotation.'
        : 'The moon’s current orbital phase updates with the simulation clock.',
    ]
    stats = [
      { label: 'PARENT', value: parent?.name ?? moon.parentId },
      {
        label: 'RADIUS',
        value:
          moon.radiusKm === undefined
            ? 'UNKNOWN'
            : `${moon.radiusKm.toLocaleString()} km`,
      },
      {
        label: 'ORBIT',
        value: `${moon.orbitalRadiusKm.toLocaleString()} km`,
      },
      {
        label: 'PERIOD',
        value: `${Math.abs(moon.orbitalPeriodDays).toFixed(2)} days`,
      },
    ]
    if (moon.jplCode) {
      stats.push({
        label: 'JPL CODE',
        value: moon.jplCode,
      })
    }
    if (moon.ephemeris) {
      stats.push({
        label: 'SOLUTION',
        value: moon.ephemeris,
      })
    }
  } else if (smallBody) {
    const horizonsPosition = horizons.positionAu(smallBody.id, date)
    const currentDistanceAu = magnitude(
      horizonsPosition ?? orbitalPositionAu(smallBody, date),
    )
    const periodDays =
      smallBody.eccentricity > 1
        ? undefined
        : 365.2568983 *
          Math.pow(Math.abs(smallBody.semiMajorAxisAu), 1.5)
    title = smallBody.name
    subtitle =
      smallBody.kind === 'interstellar'
        ? 'Visitor from interstellar space'
        : smallBody.kind === 'comet'
        ? 'Time-traveling ice and dust'
        : smallBody.kind === 'dwarf'
          ? 'IAU-recognized dwarf planet'
          : smallBody.kind === 'dwarf-candidate'
            ? 'Dwarf-planet candidate'
          : smallBody.semiMajorAxisAu > 30
            ? 'Kuiper Belt object'
            : smallBody.semiMajorAxisAu < 1.7
              ? 'Near-Earth asteroid'
              : 'Main-belt asteroid'
    precision = horizonsPosition ? 'ephemeris' : 'analytical'
    if (horizonsPosition) {
      precisionLabel = 'NASA/JPL HORIZONS CACHE'
      orbitSource = {
        title: 'JPL Horizons trajectory vectors',
        organization: 'NASA/JPL Solar System Dynamics',
        url: 'https://ssd.jpl.nasa.gov/horizons/',
        note: 'Offline state-vector interpolation',
      }
    }
    accent = smallBody.color
    facts = [smallBody.fact]
    stats = [
      {
        label: 'SUN DISTANCE',
        value: `${currentDistanceAu.toFixed(currentDistanceAu < 10 ? 2 : 1)} AU`,
      },
      {
        label: 'RADIUS',
        value: smallBody.physicalRadiusKm
          ? `${smallBody.physicalRadiusKm.toLocaleString()} km`
          : 'Not measured',
      },
      {
        label: 'YEAR',
        value:
          periodDays === undefined
            ? 'UNBOUND'
            : periodDays > 730
            ? `${(periodDays / 365.256).toFixed(1)} Earth years`
            : `${periodDays.toFixed(0)} days`,
      },
      {
        label: 'TILT',
        value: `${smallBody.inclinationDeg.toFixed(1)}°`,
      },
    ]
  } else if (spacecraft) {
    const horizonsPosition = horizons.positionAu(spacecraft.id, date)
    const distanceAu = magnitude(
      horizonsPosition ?? spacecraftPositionAu(spacecraft, date),
    )
    const launch = new Date(spacecraft.launchIso)
    title = spacecraft.name
    subtitle = 'Interstellar explorer'
    precision = horizonsPosition ? 'ephemeris' : 'analytical'
    if (horizonsPosition) {
      precisionLabel = 'NASA/JPL HORIZONS CACHE'
      orbitSource = {
        title: 'JPL Horizons trajectory vectors',
        organization: 'NASA/JPL Solar System Dynamics',
        url: 'https://ssd.jpl.nasa.gov/horizons/',
        note: 'Offline state-vector interpolation',
      }
    }
    accent = spacecraft.color
    facts = [
      spacecraft.fact,
      horizonsPosition
        ? 'Its displayed position is interpolated from NASA/JPL Horizons state vectors.'
        : 'Its displayed position uses a continuously updated long-range trajectory estimate.',
    ]
    stats = [
      {
        label: 'LAUNCHED',
        value: launch.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      },
      {
        label: 'SUN DISTANCE',
        value: `${distanceAu.toFixed(1)} AU`,
      },
      {
        label: 'SPEED',
        value: `${spacecraft.speedAuPerYear.toFixed(2)} AU / year`,
      },
      {
        label: 'LIGHT TIME',
        value: `${(distanceAu * 8.3167 / 60).toFixed(1)} hours`,
      },
    ]
  }

  if (renderCoverage) {
    stats = [
      ...stats,
      {
        label: spacecraft ? 'DETAIL MODEL' : 'SURFACE MODEL',
        value: renderCoverage,
      },
    ]
  }
  if (currentEarthObservation) {
    stats = [
      ...stats,
      {
        label: 'EARTH IMAGE',
        value: `NASA VIIRS · ${EARTH_OBSERVATION.date}`,
      },
    ]
  }

  if (!title) return null
  const liveSolarView =
    Math.abs(date.getTime() - referenceNow) < 12 * 3_600_000
  const showDataSource =
    dataSource &&
    (!orbitSource ||
      dataSource.url !== orbitSource.url ||
      dataSource.title !== orbitSource.title)
      ? dataSource
      : undefined

  return (
    <aside className="inspector glass-panel" style={{ '--accent': accent } as React.CSSProperties}>
      <button className="panel-close" onClick={onClose} aria-label="Close details">
        <X size={17} />
      </button>
      <div className="inspector-kicker">
        <Crosshair size={13} />
        TARGET LOCKED
      </div>
      <h2>{title}</h2>
      <p className="inspector-subtitle">{subtitle}</p>
      <AccuracyBadge level={precision} label={precisionLabel} />
      <button
        className={`close-view-button ${closeView ? 'active' : ''}`}
        onClick={() => onCloseViewChange(!closeView)}
      >
        <Focus size={14} />
        {closeView ? 'RETURN TO WIDE VIEW' : 'ZOOM IN CLOSE'}
      </button>
      {planet?.id === 'sun' && (
        <div className="solar-view-control">
          <span>OBSERVATION MODE</span>
          <div className="solar-view-options">
            {SUN_VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={sunViewMode === option.id ? 'active' : ''}
                onClick={() => onSunViewModeChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {sunViewMode !== 'photosphere' && (
            <small>
              {liveSolarView
                ? 'NASA SDO image · current Earth-facing hemisphere'
                : 'Live SDO views are available only within 12 hours of the present. Showing the simulated photosphere.'}
            </small>
          )}
        </div>
      )}
      <div className="stat-grid">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
      {selectedEclipseEvents.length > 0 && (
        <div className="eclipse-events">
          <span className="eclipse-events-title">
            <Orbit size={12} />
            ACTIVE SHADOW GEOMETRY
          </span>
          {selectedEclipseEvents.map((event) => {
            const receiving = event.targetId === selectedId
            const counterpart = receiving
              ? event.occluderName
              : event.targetName
            const percentage = Math.max(
              event.centerObscuration,
              event.coverage,
            )
            return (
              <div className="eclipse-event-card" key={event.id}>
                <strong>{eclipseEventLabel(event)}</strong>
                <span>
                  {receiving ? `${counterpart} in front` : `Shadowing ${counterpart}`}
                </span>
                <small>
                  {event.phase.toUpperCase()}
                  {' · '}
                  {(percentage * 100).toFixed(percentage < 0.01 ? 2 : 1)}%
                  {event.type === 'mutual-occultation'
                    ? ' apparent overlap'
                    : ' geometric coverage'}
                </small>
              </div>
            )
          })}
        </div>
      )}
      {orbitSource && (
        <a
          className="data-source-card orbit-source-card"
          href={orbitSource.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open orbital data source for ${title}: ${orbitSource.title}`}
        >
          <span className="data-source-heading">
            <Orbit size={12} />
            ORBIT DATA
            <ExternalLink size={11} />
          </span>
          <strong>{orbitSource.title}</strong>
          <small>
            {orbitSource.organization} · {orbitSource.note}
          </small>
        </a>
      )}
      {showDataSource && (
        <a
          className="data-source-card"
          href={showDataSource.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open source data for ${title}: ${showDataSource.title}`}
        >
          <span className="data-source-heading">
            <Database size={12} />
            {showDataSource.category}
            <ExternalLink size={11} />
          </span>
          <strong>{showDataSource.title}</strong>
          <small>
            {showDataSource.organization}
            {showDataSource.note ? ` · ${showDataSource.note}` : ''}
          </small>
        </a>
      )}
      {currentEarthObservation && (
        <a
          className="data-source-card earth-observation-card"
          href={EARTH_OBSERVATION.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open NASA GIBS Earth observation source"
        >
          <span className="data-source-heading">
            <Database size={12} />
            DATED EARTH OBSERVATION
            <ExternalLink size={11} />
          </span>
          <strong>{EARTH_OBSERVATION.sourceName}</strong>
          <small>
            {EARTH_OBSERVATION.date} · Displayed only near the observation
            date
          </small>
        </a>
      )}
      <div className="fact-list">
        {facts.map((fact, index) => (
          <div className="fact" key={fact}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{fact}</p>
          </div>
        ))}
      </div>
    </aside>
  )
}

const LayerPanel = memo(function LayerPanel({
  layers,
  onChange,
  scaleMode,
  onScaleChange,
  skyObserverId,
  onSkyObserverChange,
  open,
  onClose,
}: {
  layers: LayerSettings
  onChange: (layers: LayerSettings) => void
  scaleMode: ScaleMode
  onScaleChange: (mode: ScaleMode) => void
  skyObserverId: SkyObserverId
  onSkyObserverChange: (observer: SkyObserverId) => void
  open: boolean
  onClose: () => void
}) {
  const spice = useSpiceEphemeris()
  const layerRows: { id: keyof LayerSettings; label: string; icon: React.ReactNode }[] = [
    { id: 'stars', label: 'Gaia DR3 stars', icon: <Sparkles size={15} /> },
    { id: 'milkyWay', label: 'Gaia Milky Way', icon: <Sparkles size={15} /> },
    {
      id: 'constellations',
      label: 'All constellation figures',
      icon: <Crosshair size={15} />,
    },
    { id: 'labels', label: 'Names & labels', icon: <Eye size={15} /> },
    { id: 'orbits', label: 'Orbit paths', icon: <Orbit size={15} /> },
    { id: 'moons', label: `Moons (${MOONS.length})`, icon: <Atom size={15} /> },
    { id: 'asteroidBelt', label: 'Asteroid belt', icon: <Sparkles size={15} /> },
    { id: 'kuiperBelt', label: 'Kuiper belt', icon: <Sparkles size={15} /> },
    { id: 'oortCloud', label: 'Oort Cloud', icon: <Sparkles size={15} /> },
    { id: 'comets', label: 'Tracked comets', icon: <Orbit size={15} /> },
    { id: 'spacecraft', label: 'Interstellar probes', icon: <Satellite size={15} /> },
  ]

  return (
    <aside className={`layers-panel glass-panel ${open ? 'is-open' : ''}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">MISSION DISPLAY</span>
          <h3>
            <Layers3 size={17} /> Layers
          </h3>
        </div>
        <button className="panel-close mobile-only" onClick={onClose} aria-label="Close layers">
          <X size={17} />
        </button>
      </div>
      <div className="scale-switch" role="group" aria-label="Distance scale">
        <button
          className={scaleMode === 'explore' ? 'active' : ''}
          onClick={() => onScaleChange('explore')}
        >
          EXPLORE
        </button>
        <button
          className={scaleMode === 'true' ? 'active' : ''}
          onClick={() => onScaleChange('true')}
        >
          TRUE DISTANCE
        </button>
      </div>
      <p className="scale-note">
        {scaleMode === 'explore'
          ? 'Distances are logarithmically compressed. Orbital directions stay accurate.'
          : 'Orbital distances share one linear scale. Planet and moon sizes remain boosted.'}
      </p>
      <label className="sky-observer-control">
        <span>SKY OBSERVER</span>
        <select
          value={skyObserverId}
          onChange={(event) =>
            onSkyObserverChange(event.target.value as SkyObserverId)
          }
        >
          {SKY_OBSERVER_OPTIONS.map((observer) => (
            <option key={observer.id} value={observer.id}>
              {observer.label}
            </option>
          ))}
        </select>
        <small>Proper motion and parallax update for this position.</small>
      </label>
      <div className="layer-list">
        {layerRows.map((row) => (
          <button
            className={layers[row.id] ? 'active' : ''}
            key={row.id}
            onClick={() => onChange({ ...layers, [row.id]: !layers[row.id] })}
          >
            <span className="layer-icon">{row.icon}</span>
            <span>{row.label}</span>
            {layers[row.id] ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        ))}
      </div>
      <div className="model-note">
        <Gauge size={16} />
        <p>
          {spice.status === 'ready'
            ? `${SPICE_SOURCE_NAME} drives every planet and the Moon from ${spice.coverage[0]} through ${spice.coverage[1]}.`
            : spice.status === 'loading'
              ? `Loading ${SPICE_SOURCE_NAME}: ${Math.round(spice.progress * 100)}%. Analytical positions remain active until it is ready.`
              : `The DE442 kernel is unavailable, so analytical planetary fallbacks are active.`}{' '}
          Small bodies, probes, and twenty-six featured moons use cached
          NASA/JPL Horizons vectors within their stated ranges. The remaining
          catalog moons use JPL mean elements for general orbit shape.
        </p>
      </div>
    </aside>
  )
})

const ConstellationFinder = memo(function ConstellationFinder({
  open,
  selectedIds,
  emphasizedId,
  onSelect,
  onFocus,
  onSelectAll,
  onClear,
  onClose,
}: {
  open: boolean
  selectedIds: string[]
  emphasizedId?: string
  onSelect: (id: string) => void
  onFocus: (id: string) => void
  onSelectAll: () => void
  onClear: () => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchConstellations(query), [query])
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const allSelected = selectedIds.length === CONSTELLATIONS.length

  if (!open) return null

  return (
    <aside className="constellation-finder glass-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CELESTIAL NAVIGATION</span>
          <h3>
            <LocateFixed size={17} /> Constellation finder
          </h3>
        </div>
        <button
          className="constellation-finder-close"
          onClick={onClose}
          aria-label="Close constellation finder"
        >
          <X size={15} />
        </button>
      </div>
      <p className="constellation-finder-intro">
        Select any number of constellations. Click a selected figure again
        to turn your current view toward it.
      </p>
      <div className="constellation-selection-summary">
        <span>{selectedIds.length} SELECTED</span>
        <div>
          <button
            onClick={onSelectAll}
            disabled={allSelected}
          >
            {allSelected ? 'ALL SELECTED' : 'SELECT ALL'}
          </button>
          {selectedIds.length > 0 && (
            <button onClick={onClear}>CLEAR ALL</button>
          )}
        </div>
      </div>
      <label className="constellation-search">
        <Search size={14} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SEARCH BY NAME OR ABBREVIATION"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear constellation search"
          >
            <X size={12} />
          </button>
        )}
      </label>
      <div className="constellation-results">
        {results.map((constellation) => (
          <button
            className={[
              selected.has(constellation.id) ? 'active' : '',
              emphasizedId === constellation.id ? 'is-emphasized' : '',
            ].join(' ')}
            key={constellation.id}
            onClick={() =>
              selected.has(constellation.id)
                ? onFocus(constellation.id)
                : onSelect(constellation.id)
            }
            aria-pressed={selected.has(constellation.id)}
            aria-label={
              selected.has(constellation.id)
                ? `Show ${constellation.name} in current view`
                : `Select ${constellation.name}`
            }
          >
            <span>{constellation.id}</span>
            <strong>{constellation.name}</strong>
            {selected.has(constellation.id) ? (
              <LocateFixed size={14} />
            ) : (
              <span className="constellation-add">+</span>
            )}
          </button>
        ))}
        {results.length === 0 && <span>No constellation found.</span>}
      </div>
    </aside>
  )
})

function TimeControls({
  date,
  playing,
  speed,
  direction,
  isLive,
  onTogglePlaying,
  onStartPlayback,
  onStop,
  onSpeedChange,
  onDateChange,
  onLive,
}: {
  date: Date
  playing: boolean
  speed: number
  direction: PlaybackDirection
  isLive: boolean
  onTogglePlaying: () => void
  onStartPlayback: (direction: PlaybackDirection) => void
  onStop: () => void
  onSpeedChange: (speed: number) => void
  onDateChange: (date: Date) => void
  onLive: () => void
}) {
  const jump = (days: number) =>
    onDateChange(new Date(date.getTime() + days * 86_400_000))
  const speedLabel =
    SPEEDS.find((option) => option.value === speed)?.label ?? `${speed}×`

  return (
    <div className="time-console glass-panel">
      <div className="time-main">
        <div className="mission-time">
          <span>SIMULATION TIME</span>
          <strong>{formatDate(date)}</strong>
          <small>LOCAL TIME · {date.toISOString().slice(11, 19)} UTC</small>
          <small className="transport-status">
            {playing
              ? `${direction === -1 ? 'REWINDING' : 'ADVANCING'} · ${speedLabel}`
              : `STOPPED · ${speedLabel}`}
          </small>
        </div>
        <button
          className={`live-button ${isLive ? 'active' : ''}`}
          onClick={onLive}
        >
          <LocateFixed size={14} />
          NOW
        </button>
      </div>
      <div className="time-actions">
        <div className="transport-controls" aria-label="Time playback controls">
          <button
            className={playing && direction === -1 ? 'active' : ''}
            onClick={() => onStartPlayback(-1)}
            aria-label="Rewind time at selected speed"
            title="Rewind at selected speed"
          >
            <Rewind size={16} />
          </button>
          <button
            className={playing ? 'active' : ''}
            onClick={onTogglePlaying}
            aria-label={playing ? 'Pause time' : 'Play time'}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? <CirclePause size={17} /> : <CirclePlay size={17} />}
          </button>
          <button
            onClick={onStop}
            disabled={!playing}
            aria-label="Stop time"
            title="Stop"
          >
            <Square size={13} />
          </button>
          <button
            className={playing && direction === 1 ? 'active' : ''}
            onClick={() => onStartPlayback(1)}
            aria-label="Fast-forward time at selected speed"
            title="Fast-forward at selected speed"
          >
            <FastForward size={16} />
          </button>
        </div>
        <button
          className="month-jump"
          onClick={() => jump(-30)}
          aria-label="Back one month"
        >
          <ChevronLeft size={14} />
          30D
        </button>
        <button onClick={() => jump(-1)} aria-label="Back one day">
          <ChevronLeft size={14} />
          1D
        </button>
        <label className="date-picker">
          <CalendarClock size={14} />
          <input
            type="datetime-local"
            value={dateTimeInputValue(date)}
            onChange={(event) => {
              const next = new Date(event.target.value)
              if (!Number.isNaN(next.getTime())) onDateChange(next)
            }}
          />
        </label>
        <button onClick={() => jump(1)} aria-label="Forward one day">
          1D
          <ChevronRight size={14} />
        </button>
        <button
          className="month-jump"
          onClick={() => jump(30)}
          aria-label="Forward one month"
        >
          30D
          <ChevronRight size={14} />
        </button>
        <select
          aria-label="Simulation speed"
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
        >
          {SPEEDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function CelestialEventPanel({
  events,
  open,
  onClose,
  onActivate,
}: {
  events: CelestialEventGuide[]
  open: boolean
  onClose: () => void
  onActivate: (event: CelestialEventGuide) => void
}) {
  if (!open) return null

  return (
    <aside className="event-director glass-panel">
      <div className="panel-heading">
        <div>
          <span>CELESTIAL EVENT DIRECTOR</span>
          <h3>Upcoming scenes</h3>
        </div>
        <button onClick={onClose} aria-label="Close celestial events">
          <X size={15} />
        </button>
      </div>
      <p className="event-director-intro">
        Jump the simulation clock and frame the participating worlds.
      </p>
      <div className="event-list">
        {events.map((event) => (
          <button
            key={event.id}
            style={{ '--event-accent': event.accent } as React.CSSProperties}
            onClick={() => onActivate(event)}
          >
            <span>{event.kind.replaceAll('-', ' ').toUpperCase()}</span>
            <strong>{event.title}</strong>
            <small>{event.subtitle}</small>
            <time>{formatDate(event.date)}</time>
          </button>
        ))}
      </div>
    </aside>
  )
}

function CinematicEventCaption({
  event,
  onClose,
}: {
  event: CelestialEventGuide
  onClose: () => void
}) {
  return (
    <div
      className="event-caption glass-panel"
      style={{ '--event-accent': event.accent } as React.CSSProperties}
    >
      <span>EVENT LOCK · {event.kind.replaceAll('-', ' ').toUpperCase()}</span>
      <strong>{event.title}</strong>
      <small>
        {event.subtitle} · {formatDate(event.date)}
      </small>
      <button
        onPointerDown={(event) => {
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
      >
        EXIT CINEMATIC VIEW
      </button>
    </div>
  )
}

interface DockObject {
  id: string
  name: string
  color: string
  visual: 'body' | 'dwarf' | 'comet' | 'asteroid' | 'probe'
}

const ObjectNavigator = memo(function ObjectNavigator({
  category,
  selectedId,
  moonParentId,
  onCategoryChange,
  onSelect,
}: {
  category: ObjectCategory
  selectedId: string
  moonParentId: string | null
  onCategoryChange: (category: ObjectCategory) => void
  onSelect: (id: string) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const pluto = PLANETS.find((body) => body.id === 'pluto')!
  const objects: DockObject[] =
    category === 'planets'
      ? [SUN, ...PLANETS.filter((body) => body.id !== 'pluto')].map((body) => ({
          id: body.id,
          name: body.name,
          color: body.color,
          visual: 'body',
        }))
      : category === 'dwarfs'
        ? [
            {
              id: pluto.id,
              name: pluto.name,
              color: pluto.color,
              visual: 'dwarf' as const,
            },
            ...SMALL_BODIES.filter(
              (body) =>
                body.kind === 'dwarf' ||
                body.kind === 'dwarf-candidate',
            ).map(
              (body) => ({
                id: body.id,
                name: body.name,
                color: body.color,
                visual: 'dwarf' as const,
              }),
            ),
          ]
        : category === 'comets'
          ? SMALL_BODIES.filter((body) => body.kind === 'comet').map((body) => ({
              id: body.id,
              name: body.name,
              color: body.color,
              visual: 'comet',
            }))
          : category === 'asteroids'
            ? SMALL_BODIES.filter((body) => body.kind === 'asteroid').map(
                (body) => ({
                  id: body.id,
                  name: body.name,
                  color: body.color,
                  visual: 'asteroid',
                }),
              )
            : category === 'interstellar'
              ? SMALL_BODIES.filter(
                  (body) => body.kind === 'interstellar',
                ).map((body) => ({
                  id: body.id,
                  name: body.name,
                  color: body.color,
                  visual: 'comet',
                }))
              : SPACECRAFT.map((craft) => ({
                  id: craft.id,
                  name: craft.name,
                  color: craft.color,
                  visual: 'probe',
                }))

  const searchableObjects = useMemo<SearchableObject[]>(() => {
    const parents = new Map(
      [...ALL_MAJOR_BODIES, ...SMALL_BODIES].map((body) => [body.id, body.name]),
    )
    return [
      ...[SUN, ...PLANETS].map((body) => ({
        id: body.id,
        name: body.name,
        kind: body.id === 'pluto' ? ('dwarf' as const) : ('planet' as const),
      })),
      ...MOONS.map((moon) => ({
        id: moon.id,
        name: moon.name,
        kind: 'moon' as const,
        parentName: parents.get(moon.parentId),
      })),
      ...SMALL_BODIES.map((body) => ({
        id: body.id,
        name: body.name,
        kind: body.kind,
      })),
      ...SPACECRAFT.map((craft) => ({
        id: craft.id,
        name: craft.name,
        kind: 'probe' as const,
      })),
    ]
  }, [])
  const searchResults = useMemo(
    () => searchObjects(searchableObjects, searchQuery),
    [searchQuery, searchableObjects],
  )

  const parent =
    ALL_MAJOR_BODIES.find((body) => body.id === moonParentId) ??
    SMALL_BODIES.find((body) => body.id === moonParentId)
  const parentMatchesCategory =
    parent &&
    ((category === 'planets' && parent.id !== 'pluto') ||
      (category === 'dwarfs' &&
        (parent.id === 'pluto' ||
          SMALL_BODIES.some(
            (body) =>
              body.id === parent.id &&
              (body.kind === 'dwarf' ||
                body.kind === 'dwarf-candidate'),
          ))) ||
      (category === 'asteroids' &&
        SMALL_BODIES.some(
          (body) => body.id === parent.id && body.kind === 'asteroid',
        )))
  const moons = parentMatchesCategory
    ? MOONS.filter((moon) => moon.parentId === moonParentId)
    : []
  const visibleMoons =
    moons.length > 18
      ? moons.filter(
          (moon) => moon.showLabel !== false || moon.id === selectedId,
        )
      : moons
  const hasMoreMoons = visibleMoons.length < moons.length

  return (
    <nav className="object-browser glass-panel" aria-label="Tracked objects">
      <div className="object-search">
        <Search size={13} />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setSearchQuery('')
            } else if (event.key === 'Enter' && searchResults[0]) {
              event.preventDefault()
              setSearchQuery('')
              onSelect(searchResults[0].id)
            }
          }}
          placeholder="Search planets, moons, probes..."
          aria-label="Search tracked objects"
          aria-expanded={searchQuery.length > 0}
          aria-controls="object-search-results"
        />
        {searchQuery && (
          <button
            className="object-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear object search"
          >
            <X size={11} />
          </button>
        )}
      </div>
      {searchQuery && (
        <div className="object-search-results" id="object-search-results">
          {searchResults.length > 0 ? (
            searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => {
                  setSearchQuery('')
                  onSelect(result.id)
                }}
              >
                <strong>{result.name}</strong>
                <small>
                  {result.kind.toUpperCase()}
                  {result.parentName ? ` · ${result.parentName}` : ''}
                </small>
              </button>
            ))
          ) : (
            <span>No tracked object matches that search.</span>
          )}
        </div>
      )}
      <div className="object-categories" role="tablist" aria-label="Object categories">
        {OBJECT_CATEGORIES.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={category === item.id}
            className={category === item.id ? 'active' : ''}
            onClick={() => onCategoryChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      {moons.length > 0 && (
        <div className="moon-tray">
          <span className="moon-tray-title">
            <Atom size={12} />
            {parent?.name.toUpperCase()}’S MOONS · {moons.length}
          </span>
          <div className="moon-items">
            {visibleMoons.map((moon) => (
              <button
                key={moon.id}
                className={selectedId === moon.id ? 'active' : ''}
                onClick={() => onSelect(moon.id)}
                title={`Fly to ${moon.name}`}
              >
                <span
                  className="moon-orb"
                  style={{ '--body-color': moon.color } as React.CSSProperties}
                />
                {moon.name}
              </button>
            ))}
          </div>
          {hasMoreMoons && (
            <span className="moon-tray-more">SEARCH +{moons.length - visibleMoons.length}</span>
          )}
        </div>
      )}
      <div className="object-items">
        {objects.map((object) => (
          <button
            key={object.id}
            className={`${selectedId === object.id ? 'active' : ''} object-${object.visual}`}
            onClick={() => onSelect(object.id)}
            title={`Fly to ${object.name}`}
          >
            {object.visual === 'probe' ? (
              <Satellite className="object-icon" size={18} />
            ) : object.visual === 'comet' ? (
              <Sparkles className="object-icon comet-icon" size={18} />
            ) : object.visual === 'asteroid' ? (
              <span
                className="body-orb asteroid-orb"
                style={{ '--body-color': object.color } as React.CSSProperties}
              />
            ) : (
              <span
                className={`body-orb body-${object.id} ${
                  object.visual === 'dwarf' ? 'dwarf-orb' : ''
                }`}
                style={{ '--body-color': object.color } as React.CSSProperties}
              />
            )}
            <small>{object.name.toUpperCase()}</small>
          </button>
        ))}
      </div>
    </nav>
  )
})

function App() {
  const clock = useSimulationClock()
  const spice = useSpiceEphemeris()
  const [scaleMode, setScaleMode] = useState<ScaleMode>('explore')
  const [selectedId, setSelectedId] = useState('earth')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [layersOpen, setLayersOpen] = useState(false)
  const [layers, setLayers] = useState<LayerSettings>(initialLayers)
  const [objectCategory, setObjectCategory] =
    useState<ObjectCategory>('planets')
  const [moonParentId, setMoonParentId] = useState<string | null>('earth')
  const [closeView, setCloseView] = useState(false)
  const [sunViewMode, setSunViewMode] =
    useState<SunViewMode>('photosphere')
  const [skyObserverId, setSkyObserverId] =
    useState<SkyObserverId>('earth')
  const [eventsOpen, setEventsOpen] = useState(false)
  const [constellationFinderOpen, setConstellationFinderOpen] =
    useState(false)
  const [selectedConstellationIds, setSelectedConstellationIds] =
    useState<string[]>([])
  const [emphasizedConstellationId, setEmphasizedConstellationId] =
    useState<string>()
  const [constellationTrayExpanded, setConstellationTrayExpanded] =
    useState(false)
  const [constellationFocusRequest, setConstellationFocusRequest] =
    useState<{ id: string; sequence: number }>()
  const [activeEvent, setActiveEvent] =
    useState<CelestialEventGuide | null>(null)
  const [eventSearchDate, setEventSearchDate] = useState(() => clock.date)
  const upcomingEvents = useMemo(
    () => findUpcomingCelestialEvents(eventSearchDate),
    [eventSearchDate],
  )

  const selectBody = useCallback((id: string) => {
    const planet = ALL_MAJOR_BODIES.find((body) => body.id === id)
    const moon = MOONS.find((body) => body.id === id)
    const smallBody = SMALL_BODIES.find((body) => body.id === id)
    const spacecraft = SPACECRAFT.find((body) => body.id === id)

    if (planet) {
      setObjectCategory(planet.id === 'pluto' ? 'dwarfs' : 'planets')
      setMoonParentId(planet.id)
    } else if (moon) {
      const smallParent = SMALL_BODIES.find(
        (body) => body.id === moon.parentId,
      )
      setObjectCategory(
        moon.parentId === 'pluto' ||
        smallParent?.kind === 'dwarf' ||
        smallParent?.kind === 'dwarf-candidate'
          ? 'dwarfs'
          : smallParent?.kind === 'asteroid'
            ? 'asteroids'
            : 'planets',
      )
      setMoonParentId(moon.parentId)
      setLayers((current) => ({ ...current, moons: true }))
    } else if (smallBody) {
      setObjectCategory(
        smallBody.kind === 'dwarf' ||
        smallBody.kind === 'dwarf-candidate'
          ? 'dwarfs'
          : smallBody.kind === 'comet'
            ? 'comets'
            : 'asteroids',
      )
      if (smallBody.kind === 'comet') {
        setLayers((current) => ({ ...current, comets: true }))
      }
      if (smallBody.kind === 'interstellar') {
        setObjectCategory('interstellar')
        setLayers((current) => ({ ...current, comets: true }))
      }
      if (MOONS.some((candidate) => candidate.parentId === smallBody.id)) {
        setMoonParentId(smallBody.id)
      }
    } else if (spacecraft) {
      setObjectCategory('probes')
      setLayers((current) => ({ ...current, spacecraft: true }))
    }

    setSelectedId(id)
    setActiveEvent(null)
    setCloseView((current) =>
      closeViewAfterSelection(current, selectedId, id),
    )
    setInspectorOpen(true)
    setLayersOpen(false)
    setConstellationFinderOpen(false)
  }, [selectedId])
  const closeLayers = useCallback(() => setLayersOpen(false), [])
  const selectConstellation = useCallback((id: string) => {
    setSelectedConstellationIds((current) =>
      current.includes(id) ? current : [...current, id],
    )
    setEmphasizedConstellationId(id)
    setLayers((current) => ({ ...current, stars: true }))
  }, [])
  const removeConstellation = useCallback((id: string) => {
    setSelectedConstellationIds((current) =>
      current.filter((selectedId) => selectedId !== id),
    )
    setEmphasizedConstellationId((current) =>
      current === id ? undefined : current,
    )
  }, [])
  const focusConstellation = useCallback((id: string) => {
    setEmphasizedConstellationId(id)
    setConstellationFocusRequest((current) => ({
      id,
      sequence: (current?.sequence ?? 0) + 1,
    }))
    setConstellationFinderOpen(false)
    setConstellationTrayExpanded(false)
  }, [])
  const selectAllConstellations = useCallback(() => {
    setSelectedConstellationIds(
      CONSTELLATIONS.map((constellation) => constellation.id),
    )
    setConstellationTrayExpanded(false)
    setLayers((current) => ({ ...current, stars: true }))
  }, [])
  const clearConstellations = useCallback(() => {
    setSelectedConstellationIds([])
    setEmphasizedConstellationId(undefined)
    setConstellationTrayExpanded(false)
  }, [])
  const activateEvent = useCallback(
    (event: CelestialEventGuide) => {
      clock.chooseDate(event.date)
      selectBody(event.focusId)
      setCloseView(event.closeView)
      setActiveEvent(event)
      setEventsOpen(false)
      setInspectorOpen(true)
    },
    [clock, selectBody],
  )
  const cinematicFocus = useMemo<CinematicFocus | undefined>(
    () =>
      activeEvent
        ? {
            id: activeEvent.id,
            targetIds: activeEvent.targetIds,
          }
        : undefined,
    [activeEvent],
  )
  const selectedConstellations = useMemo(
    () =>
      selectedConstellationIds
        .map((id) => getConstellation(id))
        .filter((constellation) => constellation !== undefined),
    [selectedConstellationIds],
  )

  return (
    <main className="app-shell">
      <div className="scene-wrap">
        <SolarSystemScene
          date={clock.date}
          scaleMode={scaleMode}
          layers={layers}
          selectedId={selectedId}
          closeView={closeView}
          sunViewMode={sunViewMode}
          skyObserverId={skyObserverId}
          selectedConstellationIds={selectedConstellationIds}
          emphasizedConstellationId={emphasizedConstellationId}
          constellationFocusRequest={constellationFocusRequest}
          cinematicFocus={cinematicFocus}
          onSelect={selectBody}
        />
      </div>
      <div className="nebula-overlay" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Orbit size={25} />
          </div>
          <div>
            <h1>SOLAR SYSTEM</h1>
          </div>
        </div>
        <div className="top-status">
          <span className={`status-dot ${spice.status}`} />
          {spice.status === 'ready'
            ? spice.supportsDate(clock.date)
              ? 'DE442 SPICE READY'
              : 'DE442 OUT OF RANGE'
            : spice.status === 'loading'
              ? `LOADING DE442 · ${Math.round(spice.progress * 100)}%`
              : spice.status === 'error'
                ? 'EPHEMERIS FALLBACK'
                : 'STARTING EPHEMERIS'}
          <span className="divider" />
          {MOONS.length} MOONS
          <span className="divider" />
          <span className="desktop-only">J2000 ECLIPTIC FRAME</span>
        </div>
        <div className="topbar-actions">
          <button
            className={`events-toggle ${eventsOpen ? 'active' : ''}`}
            onClick={() => {
              const nextOpen = !eventsOpen
              if (nextOpen) setEventSearchDate(clock.date)
              setEventsOpen(nextOpen)
              setLayersOpen(false)
              setConstellationFinderOpen(false)
            }}
            aria-label="Open celestial event director"
          >
            <Telescope size={18} />
            <span>EVENTS</span>
          </button>
          <button
            className={`constellations-toggle ${
              constellationFinderOpen || selectedConstellationIds.length > 0
                ? 'active'
                : ''
            }`}
            onClick={() => {
              const nextOpen = !constellationFinderOpen
              setConstellationFinderOpen(nextOpen)
              setEventsOpen(false)
              setLayersOpen(false)
            }}
            aria-label="Open constellation finder"
          >
            <LocateFixed size={18} />
            <span>CONSTELLATIONS</span>
            {selectedConstellationIds.length > 0 && (
              <b>{selectedConstellationIds.length}</b>
            )}
          </button>
          <button
            className="layers-toggle"
            onClick={() => {
              const nextOpen = !layersOpen
              setLayersOpen(nextOpen)
              setEventsOpen(false)
              setConstellationFinderOpen(false)
              if (nextOpen) setInspectorOpen(false)
            }}
            aria-label="Open display layers"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {inspectorOpen && (
        <Inspector
          selectedId={selectedId}
          date={clock.date}
          scaleMode={scaleMode}
          closeView={closeView}
          sunViewMode={sunViewMode}
          onCloseViewChange={setCloseView}
          onSunViewModeChange={setSunViewMode}
          onClose={() => setInspectorOpen(false)}
        />
      )}

      <LayerPanel
        layers={layers}
        onChange={setLayers}
        scaleMode={scaleMode}
        onScaleChange={setScaleMode}
        skyObserverId={skyObserverId}
        onSkyObserverChange={setSkyObserverId}
        open={layersOpen}
        onClose={closeLayers}
      />

      <CelestialEventPanel
        events={upcomingEvents}
        open={eventsOpen}
        onClose={() => setEventsOpen(false)}
        onActivate={activateEvent}
      />

      <ConstellationFinder
        open={constellationFinderOpen}
        selectedIds={selectedConstellationIds}
        emphasizedId={emphasizedConstellationId}
        onSelect={selectConstellation}
        onFocus={focusConstellation}
        onSelectAll={selectAllConstellations}
        onClear={clearConstellations}
        onClose={() => setConstellationFinderOpen(false)}
      />

      {selectedConstellations.length > 0 && !constellationFinderOpen && (
        <div
          className={`constellation-selection-tray glass-panel ${
            constellationTrayExpanded ? 'is-expanded' : ''
          }`}
        >
          <div className="constellation-tray-toolbar">
            <LocateFixed size={15} />
            <strong>{selectedConstellations.length} SELECTED</strong>
            {emphasizedConstellationId && (
              <span className="constellation-emphasis-status">
                EMPHASIZED ·{' '}
                {getConstellation(emphasizedConstellationId)?.name}
              </span>
            )}
            {selectedConstellations.length > 1 && (
              <button
                className="constellation-tray-expand"
                onClick={() =>
                  setConstellationTrayExpanded((current) => !current)
                }
                aria-expanded={constellationTrayExpanded}
              >
                {constellationTrayExpanded ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                {constellationTrayExpanded ? 'COLLAPSE' : 'BROWSE SELECTED'}
              </button>
            )}
            <button
              className="constellation-selection-clear"
              onClick={clearConstellations}
              aria-label="Clear all constellation highlights"
            >
              CLEAR
            </button>
          </div>
          <div
            className="constellation-selection-chips"
            role="list"
            aria-label="Selected constellations"
          >
            {selectedConstellations.map((constellation) => (
              <div
                className={`constellation-selection-chip ${
                  constellation.id === emphasizedConstellationId
                    ? 'is-emphasized'
                    : ''
                }`}
                key={constellation.id}
                role="listitem"
              >
                <button
                  className="constellation-chip-focus"
                  onClick={() => focusConstellation(constellation.id)}
                  aria-label={`Show ${constellation.name} in current view`}
                >
                  <span>{constellation.id}</span>
                  {constellation.name}
                  <LocateFixed size={11} />
                </button>
                <button
                  className="constellation-chip-remove"
                  onClick={() => removeConstellation(constellation.id)}
                  aria-label={`Hide ${constellation.name}`}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <ObjectNavigator
        category={objectCategory}
        selectedId={selectedId}
        moonParentId={moonParentId}
        onCategoryChange={setObjectCategory}
        onSelect={selectBody}
      />

      <TimeControls
        date={clock.date}
        playing={clock.playing}
        speed={clock.speed}
        direction={clock.direction}
        isLive={clock.isLive}
        onTogglePlaying={clock.togglePlaying}
        onStartPlayback={clock.startPlayback}
        onStop={clock.stop}
        onSpeedChange={clock.chooseSpeed}
        onDateChange={(date) => {
          setActiveEvent(null)
          clock.chooseDate(date)
        }}
        onLive={() => {
          setActiveEvent(null)
          clock.goLive()
        }}
      />

      {activeEvent && (
        <CinematicEventCaption
          event={activeEvent}
          onClose={() => {
            setActiveEvent(null)
            setCloseView(false)
          }}
        />
      )}

      <div className="interaction-hint">
        <RotateCcw size={14} />
        DRAG TO ORBIT · SCROLL TO FLY · CLICK A WORLD
      </div>
    </main>
  )
}

export default App
