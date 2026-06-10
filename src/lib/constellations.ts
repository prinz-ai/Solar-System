import type {
  ConstellationFigureData,
  ConstellationLineFeature,
} from './gaiaSky'
import { equatorialSkyDirection } from './gaiaSky'
import type { Vec3 } from '../types'

export interface ConstellationDefinition {
  id: string
  name: string
  sourceIds: string[]
}

export const CONSTELLATIONS: ConstellationDefinition[] = [
  { id: 'AND', name: 'Andromeda', sourceIds: ['AND'] },
  { id: 'ANT', name: 'Antlia', sourceIds: ['ANT'] },
  { id: 'APS', name: 'Apus', sourceIds: ['APS'] },
  { id: 'AQR', name: 'Aquarius', sourceIds: ['AQR'] },
  { id: 'AQL', name: 'Aquila', sourceIds: ['AQL'] },
  { id: 'ARA', name: 'Ara', sourceIds: ['ARA'] },
  { id: 'ARI', name: 'Aries', sourceIds: ['ARI'] },
  { id: 'AUR', name: 'Auriga', sourceIds: ['AUR'] },
  { id: 'BOO', name: 'Bootes', sourceIds: ['BOO'] },
  { id: 'CAE', name: 'Caelum', sourceIds: ['CAE'] },
  { id: 'CAM', name: 'Camelopardalis', sourceIds: ['CAM'] },
  { id: 'CNC', name: 'Cancer', sourceIds: ['CNC'] },
  { id: 'CVN', name: 'Canes Venatici', sourceIds: ['CVN'] },
  { id: 'CMA', name: 'Canis Major', sourceIds: ['CMA'] },
  { id: 'CMI', name: 'Canis Minor', sourceIds: ['CMI'] },
  { id: 'CAP', name: 'Capricornus', sourceIds: ['CAP'] },
  { id: 'CAR', name: 'Carina', sourceIds: ['CAR'] },
  { id: 'CAS', name: 'Cassiopeia', sourceIds: ['CAS'] },
  { id: 'CEN', name: 'Centaurus', sourceIds: ['CEN'] },
  { id: 'CEP', name: 'Cepheus', sourceIds: ['CEP'] },
  { id: 'CET', name: 'Cetus', sourceIds: ['CET'] },
  { id: 'CHA', name: 'Chamaeleon', sourceIds: ['CHA'] },
  { id: 'CIR', name: 'Circinus', sourceIds: ['CIR'] },
  { id: 'COL', name: 'Columba', sourceIds: ['COL'] },
  { id: 'COM', name: 'Coma Berenices', sourceIds: ['COM'] },
  { id: 'CRA', name: 'Corona Australis', sourceIds: ['CRA'] },
  { id: 'CRB', name: 'Corona Borealis', sourceIds: ['CRB'] },
  { id: 'CRV', name: 'Corvus', sourceIds: ['CRV'] },
  { id: 'CRT', name: 'Crater', sourceIds: ['CRT'] },
  { id: 'CRU', name: 'Crux', sourceIds: ['CRU'] },
  { id: 'CYG', name: 'Cygnus', sourceIds: ['CYG'] },
  { id: 'DEL', name: 'Delphinus', sourceIds: ['DEL'] },
  { id: 'DOR', name: 'Dorado', sourceIds: ['DOR'] },
  { id: 'DRA', name: 'Draco', sourceIds: ['DRA'] },
  { id: 'EQU', name: 'Equuleus', sourceIds: ['EQU'] },
  { id: 'ERI', name: 'Eridanus', sourceIds: ['ERI'] },
  { id: 'FOR', name: 'Fornax', sourceIds: ['FOR'] },
  { id: 'GEM', name: 'Gemini', sourceIds: ['GEM'] },
  { id: 'GRU', name: 'Grus', sourceIds: ['GRU'] },
  { id: 'HER', name: 'Hercules', sourceIds: ['HER'] },
  { id: 'HOR', name: 'Horologium', sourceIds: ['HOR'] },
  { id: 'HYA', name: 'Hydra', sourceIds: ['HYA'] },
  { id: 'HYI', name: 'Hydrus', sourceIds: ['HYI'] },
  { id: 'IND', name: 'Indus', sourceIds: ['IND'] },
  { id: 'LAC', name: 'Lacerta', sourceIds: ['LAC'] },
  { id: 'LEO', name: 'Leo', sourceIds: ['LEO'] },
  { id: 'LMI', name: 'Leo Minor', sourceIds: ['LMI'] },
  { id: 'LEP', name: 'Lepus', sourceIds: ['LEP'] },
  { id: 'LIB', name: 'Libra', sourceIds: ['LIB'] },
  { id: 'LUP', name: 'Lupus', sourceIds: ['LUP'] },
  { id: 'LYN', name: 'Lynx', sourceIds: ['LYN'] },
  { id: 'LYR', name: 'Lyra', sourceIds: ['LYR'] },
  { id: 'MEN', name: 'Mensa', sourceIds: ['MEN'] },
  { id: 'MIC', name: 'Microscopium', sourceIds: ['MIC'] },
  { id: 'MON', name: 'Monoceros', sourceIds: ['MON'] },
  { id: 'MUS', name: 'Musca', sourceIds: ['MUS'] },
  { id: 'NOR', name: 'Norma', sourceIds: ['NOR'] },
  { id: 'OCT', name: 'Octans', sourceIds: ['OCT'] },
  { id: 'OPH', name: 'Ophiuchus', sourceIds: ['OPH'] },
  { id: 'ORI', name: 'Orion', sourceIds: ['ORI'] },
  { id: 'PAV', name: 'Pavo', sourceIds: ['PAV'] },
  { id: 'PEG', name: 'Pegasus', sourceIds: ['PEG'] },
  { id: 'PER', name: 'Perseus', sourceIds: ['PER'] },
  { id: 'PHE', name: 'Phoenix', sourceIds: ['PHE'] },
  { id: 'PIC', name: 'Pictor', sourceIds: ['PIC'] },
  { id: 'PSC', name: 'Pisces', sourceIds: ['PSC'] },
  { id: 'PSA', name: 'Piscis Austrinus', sourceIds: ['PSA'] },
  { id: 'PUP', name: 'Puppis', sourceIds: ['PUP'] },
  { id: 'PYX', name: 'Pyxis', sourceIds: ['PYX'] },
  { id: 'RET', name: 'Reticulum', sourceIds: ['RET'] },
  { id: 'SGE', name: 'Sagitta', sourceIds: ['SGE'] },
  { id: 'SGR', name: 'Sagittarius', sourceIds: ['SGR'] },
  { id: 'SCO', name: 'Scorpius', sourceIds: ['SCO'] },
  { id: 'SCL', name: 'Sculptor', sourceIds: ['SCL'] },
  { id: 'SCT', name: 'Scutum', sourceIds: ['SCT'] },
  { id: 'SER', name: 'Serpens', sourceIds: ['SER'] },
  { id: 'SEX', name: 'Sextans', sourceIds: ['SEX'] },
  { id: 'TAU', name: 'Taurus', sourceIds: ['TAU'] },
  { id: 'TEL', name: 'Telescopium', sourceIds: ['TEL'] },
  { id: 'TRI', name: 'Triangulum', sourceIds: ['TRI'] },
  { id: 'TRA', name: 'Triangulum Australe', sourceIds: ['TRA'] },
  { id: 'TUC', name: 'Tucana', sourceIds: ['TUC'] },
  { id: 'UMA', name: 'Ursa Major', sourceIds: ['UMA'] },
  { id: 'UMI', name: 'Ursa Minor', sourceIds: ['UMI'] },
  { id: 'VEL', name: 'Vela', sourceIds: ['VEL'] },
  { id: 'VIR', name: 'Virgo', sourceIds: ['VIR'] },
  { id: 'VOL', name: 'Volans', sourceIds: ['VOL'] },
  { id: 'VUL', name: 'Vulpecula', sourceIds: ['VUL'] },
]

export function getConstellation(id: string | null | undefined) {
  if (!id) return undefined
  return CONSTELLATIONS.find((constellation) => constellation.id === id)
}

export function searchConstellations(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return CONSTELLATIONS
  return CONSTELLATIONS.filter(
    (constellation) =>
      constellation.name.toLowerCase().includes(normalized) ||
      constellation.id.toLowerCase().includes(normalized),
  )
}

export function getConstellationFigure(
  data: ConstellationFigureData,
  id: string | null | undefined,
): ConstellationLineFeature | undefined {
  if (!id) return undefined
  return data.constellations.find((figure) => figure.id === id)
}

export function getConstellationFigures(
  data: ConstellationFigureData,
  ids: Iterable<string>,
) {
  const selected = new Set(ids)
  return data.constellations.filter((figure) => selected.has(figure.id))
}

export function getConstellationDirection(
  data: ConstellationFigureData,
  id: string | null | undefined,
): Vec3 | undefined {
  const figure = getConstellationFigure(data, id)
  if (!figure) return undefined

  const stars = new Map(
    figure.paths.flatMap((path) =>
      path.stars.map((star) => [star.hip, star] as const),
    ),
  )
  const center = [...stars.values()]
    .map((star) =>
      equatorialSkyDirection(
        (star.raDeg * Math.PI) / 180,
        (star.decDeg * Math.PI) / 180,
      ),
    )
    .reduce(
      (sum, direction) =>
        sum.map(
          (value, index) => value + direction[index],
        ) as Vec3,
      [0, 0, 0] as Vec3,
    )
  const length = Math.hypot(...center)
  if (length < 0.0001) return undefined
  return center.map((value) => value / length) as Vec3
}
