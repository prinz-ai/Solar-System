import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Atom,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Crosshair,
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
  Square,
  Sparkles,
  X,
} from 'lucide-react'
import { SolarSystemScene } from './components/SolarSystemScene'
import {
  ALL_MAJOR_BODIES,
  MOONS,
  PLANETS,
  SMALL_BODIES,
  SPACECRAFT,
  SUN,
} from './data/bodies'
import {
  getPlanetSnapshots,
  magnitude,
  orbitalPositionAu,
  spacecraftPositionAu,
} from './lib/ephemeris'
import {
  advanceSimulationDate,
  type PlaybackDirection,
} from './lib/simulationClock'
import type { LayerSettings, ScaleMode } from './types'

const SPEEDS = [
  { label: 'REAL TIME', value: 1 },
  { label: '1 HOUR / SEC', value: 3_600 },
  { label: '1 DAY / SEC', value: 86_400 },
  { label: '1 MONTH / SEC', value: 2_629_746 },
  { label: '1 YEAR / SEC', value: 31_556_952 },
]

const initialLayers: LayerSettings = {
  labels: true,
  orbits: true,
  moons: true,
  asteroidBelt: true,
  kuiperBelt: true,
  oortCloud: false,
  comets: true,
  spacecraft: true,
}

type ObjectCategory =
  | 'planets'
  | 'dwarfs'
  | 'comets'
  | 'asteroids'
  | 'probes'

const OBJECT_CATEGORIES: {
  id: ObjectCategory
  label: string
  icon: React.ReactNode
}[] = [
  { id: 'planets', label: 'PLANETS · 8', icon: <Orbit size={12} /> },
  { id: 'dwarfs', label: 'DWARF PLANETS · 5', icon: <Atom size={12} /> },
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
    id: 'probes',
    label: `PROBES · ${SPACECRAFT.length}`,
    icon: <Satellite size={12} />,
  },
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date)
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
    }, 100)
    return () => window.clearInterval(timer)
  }, [direction, isLive, playing, speed])

  const goLive = () => {
    setDate(new Date())
    setSpeed(1)
    setDirection(1)
    setIsLive(true)
    setPlaying(false)
    lastTick.current = performance.now()
  }

  const chooseDate = (next: Date) => {
    setDate(next)
    setIsLive(false)
    lastTick.current = performance.now()
  }

  const chooseSpeed = (next: number) => {
    setSpeed(next)
    if (next !== 1) setIsLive(false)
    lastTick.current = performance.now()
  }

  const startPlayback = (nextDirection: PlaybackDirection) => {
    setDirection(nextDirection)
    setPlaying(true)
    if (nextDirection === -1 || speed !== 1) setIsLive(false)
    lastTick.current = performance.now()
  }

  const togglePlaying = () => {
    if (playing) {
      setPlaying(false)
      setIsLive(false)
    } else {
      startPlayback(direction)
    }
  }

  const stop = () => {
    setPlaying(false)
    setDirection(1)
    setIsLive(false)
    lastTick.current = performance.now()
  }

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

function AccuracyBadge({ level }: { level: 'ephemeris' | 'analytical' | 'statistical' }) {
  const labels = {
    ephemeris: 'HIGH-PRECISION EPHEMERIS',
    analytical: 'ORBITAL MODEL',
    statistical: 'POPULATION MODEL',
  }
  return <span className={`accuracy-badge ${level}`}>{labels[level]}</span>
}

function Inspector({
  selectedId,
  date,
  scaleMode,
  closeView,
  onCloseViewChange,
  onClose,
}: {
  selectedId: string
  date: Date
  scaleMode: ScaleMode
  closeView: boolean
  onCloseViewChange: (closeView: boolean) => void
  onClose: () => void
}) {
  const planet = ALL_MAJOR_BODIES.find((body) => body.id === selectedId)
  const moon = MOONS.find((body) => body.id === selectedId)
  const smallBody = SMALL_BODIES.find((body) => body.id === selectedId)
  const spacecraft = SPACECRAFT.find((body) => body.id === selectedId)
  const planetSnapshots = useMemo(
    () => getPlanetSnapshots(date, scaleMode),
    [date, scaleMode],
  )

  let title = ''
  let subtitle = ''
  let facts: string[] = []
  let precision: 'ephemeris' | 'analytical' | 'statistical' = 'analytical'
  let accent = '#7cdcff'
  let stats: { label: string; value: string }[] = []

  if (planet) {
    const snapshot = planetSnapshots[planet.id]
    title = planet.name
    subtitle = planet.subtitle
    facts = planet.facts
    precision = planet.precision
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
    const parent =
      ALL_MAJOR_BODIES.find((body) => body.id === moon.parentId) ??
      SMALL_BODIES.find((body) => body.id === moon.parentId)
    title = moon.name
    subtitle = `Moon of ${parent?.name ?? moon.parentId}`
    precision = moon.exactModel ? 'ephemeris' : 'analytical'
    accent = moon.color
    facts = [
      moon.id === 'mk2'
        ? 'MK 2’s orbit is not fully measured; this display uses a representative 12.4-day model.'
        : `${moon.name} circles ${parent?.name ?? moon.parentId} once every ${Math.abs(
            moon.orbitalPeriodDays,
          ).toFixed(2)} Earth days.`,
      `Its average orbital distance is ${moon.orbitalRadiusKm.toLocaleString()} km.`,
      moon.orbitalPeriodDays < 0
        ? 'This moon travels in a retrograde direction, opposite its planet’s rotation.'
        : 'The moon’s current orbital phase updates with the simulation clock.',
    ]
    stats = [
      { label: 'PARENT', value: parent?.name ?? moon.parentId },
      { label: 'RADIUS', value: `${moon.radiusKm.toLocaleString()} km` },
      {
        label: 'ORBIT',
        value: `${moon.orbitalRadiusKm.toLocaleString()} km`,
      },
      {
        label: 'PERIOD',
        value: `${Math.abs(moon.orbitalPeriodDays).toFixed(2)} days`,
      },
    ]
  } else if (smallBody) {
    const currentDistanceAu = magnitude(orbitalPositionAu(smallBody, date))
    const periodDays =
      365.2568983 * Math.pow(smallBody.semiMajorAxisAu, 1.5)
    title = smallBody.name
    subtitle =
      smallBody.kind === 'comet'
        ? 'Time-traveling ice and dust'
        : smallBody.kind === 'dwarf'
          ? 'IAU-recognized dwarf planet'
          : 'Main-belt asteroid'
    precision = 'analytical'
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
          periodDays > 730
            ? `${(periodDays / 365.256).toFixed(1)} Earth years`
            : `${periodDays.toFixed(0)} days`,
      },
      {
        label: 'TILT',
        value: `${smallBody.inclinationDeg.toFixed(1)}°`,
      },
    ]
  } else if (spacecraft) {
    const distanceAu = magnitude(spacecraftPositionAu(spacecraft, date))
    const launch = new Date(spacecraft.launchIso)
    title = spacecraft.name
    subtitle = 'Interstellar explorer'
    precision = 'analytical'
    accent = spacecraft.color
    facts = [
      spacecraft.fact,
      'Its displayed position uses a continuously updated long-range trajectory estimate.',
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

  if (!title) return null

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
      <AccuracyBadge level={precision} />
      <button
        className={`close-view-button ${closeView ? 'active' : ''}`}
        onClick={() => onCloseViewChange(!closeView)}
      >
        <Focus size={14} />
        {closeView ? 'RETURN TO WIDE VIEW' : 'ZOOM IN CLOSE'}
      </button>
      <div className="stat-grid">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>
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

function LayerPanel({
  layers,
  onChange,
  scaleMode,
  onScaleChange,
  open,
  onClose,
}: {
  layers: LayerSettings
  onChange: (layers: LayerSettings) => void
  scaleMode: ScaleMode
  onScaleChange: (mode: ScaleMode) => void
  open: boolean
  onClose: () => void
}) {
  const layerRows: { id: keyof LayerSettings; label: string; icon: React.ReactNode }[] = [
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
          Planets and Pluto use live analytical ephemerides. Cloud decks and
          decorative belts are representative models, not live weather or
          individually tracked rocks.
        </p>
      </div>
    </aside>
  )
}

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

interface DockObject {
  id: string
  name: string
  color: string
  visual: 'body' | 'dwarf' | 'comet' | 'asteroid' | 'probe'
}

function ObjectNavigator({
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
            ...SMALL_BODIES.filter((body) => body.kind === 'dwarf').map(
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
            : SPACECRAFT.map((craft) => ({
                id: craft.id,
                name: craft.name,
                color: craft.color,
                visual: 'probe',
              }))

  const parent =
    ALL_MAJOR_BODIES.find((body) => body.id === moonParentId) ??
    SMALL_BODIES.find(
      (body) => body.id === moonParentId && body.kind === 'dwarf',
    )
  const parentMatchesCategory =
    parent &&
    ((category === 'planets' && parent.id !== 'pluto') ||
      (category === 'dwarfs' &&
        (parent.id === 'pluto' ||
          SMALL_BODIES.some(
            (body) => body.id === parent.id && body.kind === 'dwarf',
          ))))
  const moons = parentMatchesCategory
    ? MOONS.filter((moon) => moon.parentId === moonParentId)
    : []

  return (
    <nav className="object-browser glass-panel" aria-label="Tracked objects">
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
            {parent?.name.toUpperCase()}’S MOONS
          </span>
          <div className="moon-items">
            {moons.map((moon) => (
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
}

function App() {
  const clock = useSimulationClock()
  const [scaleMode, setScaleMode] = useState<ScaleMode>('explore')
  const [selectedId, setSelectedId] = useState('earth')
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [layersOpen, setLayersOpen] = useState(false)
  const [layers, setLayers] = useState<LayerSettings>(initialLayers)
  const [objectCategory, setObjectCategory] =
    useState<ObjectCategory>('planets')
  const [moonParentId, setMoonParentId] = useState<string | null>('earth')
  const [closeView, setCloseView] = useState(false)

  const selectBody = (id: string) => {
    const planet = ALL_MAJOR_BODIES.find((body) => body.id === id)
    const moon = MOONS.find((body) => body.id === id)
    const smallBody = SMALL_BODIES.find((body) => body.id === id)
    const spacecraft = SPACECRAFT.find((body) => body.id === id)

    if (planet) {
      setObjectCategory(planet.id === 'pluto' ? 'dwarfs' : 'planets')
      setMoonParentId(planet.id)
    } else if (moon) {
      const parentIsDwarf =
        moon.parentId === 'pluto' ||
        SMALL_BODIES.some(
          (body) => body.id === moon.parentId && body.kind === 'dwarf',
        )
      setObjectCategory(parentIsDwarf ? 'dwarfs' : 'planets')
      setMoonParentId(moon.parentId)
      setLayers((current) => ({ ...current, moons: true }))
    } else if (smallBody) {
      setObjectCategory(
        smallBody.kind === 'dwarf'
          ? 'dwarfs'
          : smallBody.kind === 'comet'
            ? 'comets'
            : 'asteroids',
      )
      if (smallBody.kind === 'comet') {
        setLayers((current) => ({ ...current, comets: true }))
      }
      if (smallBody.kind === 'dwarf') {
        setMoonParentId(smallBody.id)
      }
    } else if (spacecraft) {
      setObjectCategory('probes')
      setLayers((current) => ({ ...current, spacecraft: true }))
    }

    setSelectedId(id)
    setCloseView(false)
    setInspectorOpen(true)
    setLayersOpen(false)
  }

  return (
    <main className="app-shell">
      <div className="scene-wrap">
        <SolarSystemScene
          date={clock.date}
          scaleMode={scaleMode}
          layers={layers}
          selectedId={selectedId}
          closeView={closeView}
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
          <span className="status-dot" />
          LIVE EPHEMERIS
          <span className="divider" />
          {MOONS.length} MOONS
          <span className="divider" />
          <span className="desktop-only">J2000 ECLIPTIC FRAME</span>
        </div>
        <button
          className="layers-toggle"
          onClick={() => {
            const nextOpen = !layersOpen
            setLayersOpen(nextOpen)
            if (nextOpen) setInspectorOpen(false)
          }}
          aria-label="Open display layers"
        >
          <Menu size={20} />
        </button>
      </header>

      {inspectorOpen && (
        <Inspector
          selectedId={selectedId}
          date={clock.date}
          scaleMode={scaleMode}
          closeView={closeView}
          onCloseViewChange={setCloseView}
          onClose={() => setInspectorOpen(false)}
        />
      )}

      <LayerPanel
        layers={layers}
        onChange={setLayers}
        scaleMode={scaleMode}
        onScaleChange={setScaleMode}
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
      />

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
        onDateChange={clock.chooseDate}
        onLive={clock.goLive}
      />

      <div className="interaction-hint">
        <RotateCcw size={14} />
        DRAG TO ORBIT · SCROLL TO FLY · CLICK A WORLD
      </div>
    </main>
  )
}

export default App
