import type { Color } from '../../../src/engine/types.ts'
import type { ClockSnapshot } from '../../../src/online/timeControls.ts'
import type { LiveRoom } from './types.ts'

export function clockSnapshot(room: LiveRoom): ClockSnapshot {
  const serverNow = Date.now()
  let whiteMs = room.whiteMs
  let blackMs = room.blackMs
  let active: Color | null = null

  if (room.state.status === 'ongoing' && room.turnStartedAt != null) {
    active = room.state.turn
    const elapsed = Math.max(0, serverNow - room.turnStartedAt)
    if (active === 'white') whiteMs = Math.max(0, whiteMs - elapsed)
    else blackMs = Math.max(0, blackMs - elapsed)
  }

  return {
    whiteMs,
    blackMs,
    active,
    serverNow,
    timeControl: room.timeControl.id,
  }
}
