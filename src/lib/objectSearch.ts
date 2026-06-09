export type SearchableObjectKind =
  | 'planet'
  | 'moon'
  | 'dwarf'
  | 'dwarf-candidate'
  | 'comet'
  | 'asteroid'
  | 'interstellar'
  | 'probe'

export interface SearchableObject {
  id: string
  name: string
  kind: SearchableObjectKind
  parentName?: string
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function compact(value: string) {
  return normalize(value).replace(/\s+/g, '')
}

function scoreObject(object: SearchableObject, query: string) {
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return undefined
  const queryTokens = normalizedQuery.split(' ')
  const compactQuery = compact(query)
  const name = normalize(object.name)
  const id = normalize(object.id)
  const parent = normalize(object.parentName ?? '')
  const searchableText = `${name} ${id} ${parent}`
  const compactName = compact(object.name)
  const compactId = compact(object.id)
  if (name === normalizedQuery) return 0
  if (name.startsWith(normalizedQuery)) return 1
  if (id === normalizedQuery) return 2
  if (id.startsWith(normalizedQuery)) return 3
  if (compactName === compactQuery) return 4
  if (compactId === compactQuery) return 5
  if (name.includes(normalizedQuery)) return 6
  if (id.includes(normalizedQuery)) return 7
  if (parent.includes(normalizedQuery)) return 8
  if (queryTokens.every((token) => searchableText.includes(token))) return 9
  return undefined
}

export function searchObjects(
  objects: SearchableObject[],
  query: string,
  limit = 12,
) {
  return objects
    .map((object) => ({
      object,
      score: scoreObject(object, query),
    }))
    .filter(
      (candidate): candidate is {
        object: SearchableObject
        score: number
      } => candidate.score !== undefined,
    )
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.object.name.localeCompare(right.object.name),
    )
    .slice(0, limit)
    .map((candidate) => candidate.object)
}
