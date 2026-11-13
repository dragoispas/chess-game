import type { Color } from '../engine/types.ts'
import { formatClockMs, type TimeControlId } from '../online/timeControls.ts'

function capitalize(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1)
}

export function ClockFace({
  color,
  ms,
  active,
}: {
  color: Color
  ms: number
  active: boolean
}) {
  const low = ms < 10_000
  return (
    <div
      className={[
        'clock-face',
        active ? 'clock-active' : '',
        low ? 'clock-low' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${capitalize(color)} clock`}
    >
      <span className="clock-time">{formatClockMs(ms)}</span>
    </div>
  )
}

export function ClockStack({
  whiteMs,
  blackMs,
  active,
  timeControl,
  /** Top / bottom colors for orientation (online). Default white at bottom. */
  topColor = 'black',
  bottomColor = 'white',
}: {
  whiteMs: number
  blackMs: number
  active: Color | null
  timeControl: TimeControlId
  topColor?: Color
  bottomColor?: Color
}) {
  return (
    <div className="clock-stack" aria-label={`Clocks (${timeControl})`}>
      <ClockFace
        color={topColor}
        ms={topColor === 'white' ? whiteMs : blackMs}
        active={active === topColor}
      />
      <ClockFace
        color={bottomColor}
        ms={bottomColor === 'white' ? whiteMs : blackMs}
        active={active === bottomColor}
      />
    </div>
  )
}
