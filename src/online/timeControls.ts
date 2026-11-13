export type TimeControlId = '1+1' | '3+2' | '5+5' | '15+10'

export type TimeControl = {
  id: TimeControlId
  /** Starting time on each clock. */
  initialMs: number
  /** Added after each move by that side. */
  incrementMs: number
  label: string
  blurb: string
}

export const TIME_CONTROLS: TimeControl[] = [
  {
    id: '1+1',
    initialMs: 60_000,
    incrementMs: 1_000,
    label: '1+1',
    blurb: '1 min · +1s / move',
  },
  {
    id: '3+2',
    initialMs: 180_000,
    incrementMs: 2_000,
    label: '3+2',
    blurb: '3 min · +2s / move',
  },
  {
    id: '5+5',
    initialMs: 300_000,
    incrementMs: 5_000,
    label: '5+5',
    blurb: '5 min · +5s / move',
  },
  {
    id: '15+10',
    initialMs: 900_000,
    incrementMs: 10_000,
    label: '15+10',
    blurb: '15 min · +10s / move',
  },
]

export function timeControlById(id: string): TimeControl | null {
  return TIME_CONTROLS.find((entry) => entry.id === id) ?? null
}

export type ClockSnapshot = {
  whiteMs: number
  blackMs: number
  /** Side currently ticking; null if paused / waiting / over. */
  active: 'white' | 'black' | null
  /** Server `Date.now()` when this snapshot was produced. */
  serverNow: number
  timeControl: TimeControlId
}

export function formatClockMs(ms: number): string {
  const clamped = Math.max(0, Math.ceil(ms / 100) * 100)
  const totalSec = Math.floor(clamped / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min >= 1) {
    return `${min}:${String(sec).padStart(2, '0')}`
  }
  const tenths = Math.floor((clamped % 1000) / 100)
  return `0:${String(sec).padStart(2, '0')}.${tenths}`
}
