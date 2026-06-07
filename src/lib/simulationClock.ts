export type PlaybackDirection = -1 | 1

export function advanceSimulationDate(
  date: Date,
  elapsedMs: number,
  speed: number,
  direction: PlaybackDirection,
) {
  return new Date(date.getTime() + elapsedMs * speed * direction)
}
