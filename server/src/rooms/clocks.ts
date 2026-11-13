import { timeoutAs } from '../../../src/engine/game.ts'
import type { Color } from '../../../src/engine/types.ts'
import { sendToRoom } from './net.ts'
import { statePayload } from './payloads.ts'
import { persistEvent, persistGame, retireLiveRoom } from './persist.ts'
import { seatConnected } from './seats.ts'
import { rooms } from './store.ts'
import type { LiveRoom } from './types.ts'

const FLAG_TICK_MS = 250

/** Stop the active clock and mark a timeout loss for `flagged`. */
export function flagTimeout(room: LiveRoom, flagged: Color): void {
  if (room.state.status !== 'ongoing') return
  room.state = timeoutAs(room.state, flagged)
  room.turnStartedAt = null
  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'timeout', {
    flagged,
    winner: room.state.winner,
  })
  persistGame(room)
  const finalState = statePayload(room)
  sendToRoom(room, finalState)
  retireLiveRoom(room)
}

/**
 * If the disconnected player is to move, bank their elapsed time and freeze.
 * If the remaining player is to move, their clock keeps running.
 */
export function freezeDisconnectedPlayersClock(
  room: LiveRoom,
  disconnected: Color,
): void {
  if (room.state.status !== 'ongoing') return
  if (room.state.turn !== disconnected) return
  if (room.turnStartedAt == null) return

  const elapsed = Math.max(0, Date.now() - room.turnStartedAt)
  if (disconnected === 'white') {
    room.whiteMs = Math.max(0, room.whiteMs - elapsed)
    if (room.whiteMs <= 0) {
      room.whiteMs = 0
      room.turnStartedAt = null
      flagTimeout(room, 'white')
      return
    }
  } else {
    room.blackMs = Math.max(0, room.blackMs - elapsed)
    if (room.blackMs <= 0) {
      room.blackMs = 0
      room.turnStartedAt = null
      flagTimeout(room, 'black')
      return
    }
  }
  room.turnStartedAt = null
}

export function startOpponentClockIfPresent(
  room: LiveRoom,
  mover: Color,
  at: number,
): void {
  const opponent: Color = mover === 'white' ? 'black' : 'white'
  const seat = opponent === 'white' ? room.white : room.black
  room.turnStartedAt = seatConnected(seat) ? at : null
}

/**
 * When a player rejoins on their turn after a disconnect freeze, start their
 * clock again. Does not touch a clock that was already running (remaining player).
 */
export function resumeClockIfRejoinedOnTurn(
  room: LiveRoom,
  color: Color,
): void {
  if (room.state.status !== 'ongoing') return
  if (room.moveLog.length === 0) return
  if (room.state.turn !== color) return
  if (room.turnStartedAt != null) return
  const seat = color === 'white' ? room.white : room.black
  if (!seatConnected(seat)) return
  room.turnStartedAt = Date.now()
}

/**
 * Deduct elapsed time for the mover, apply increment, start opponent's clock.
 * Before the first move (and while paused), no elapsed is deducted.
 * Returns false if the mover flagged.
 */
export function settleClockAfterMove(
  room: LiveRoom,
  mover: Color,
  at: number,
): boolean {
  if (room.turnStartedAt == null) {
    if (mover === 'white') {
      room.whiteMs += room.timeControl.incrementMs
    } else {
      room.blackMs += room.timeControl.incrementMs
    }
    startOpponentClockIfPresent(room, mover, at)
    return true
  }
  const elapsed = Math.max(0, at - room.turnStartedAt)
  if (mover === 'white') {
    const remaining = room.whiteMs - elapsed
    if (remaining <= 0) {
      room.whiteMs = 0
      flagTimeout(room, 'white')
      return false
    }
    room.whiteMs = remaining + room.timeControl.incrementMs
  } else {
    const remaining = room.blackMs - elapsed
    if (remaining <= 0) {
      room.blackMs = 0
      flagTimeout(room, 'black')
      return false
    }
    room.blackMs = remaining + room.timeControl.incrementMs
  }
  startOpponentClockIfPresent(room, mover, at)
  return true
}

export function checkActiveFlag(room: LiveRoom): void {
  if (room.state.status !== 'ongoing' || room.turnStartedAt == null) return
  if (!seatConnected(room.state.turn === 'white' ? room.white : room.black)) {
    return
  }
  const elapsed = Date.now() - room.turnStartedAt
  if (room.state.turn === 'white') {
    if (room.whiteMs - elapsed <= 0) {
      room.whiteMs = 0
      flagTimeout(room, 'white')
    }
  } else if (room.blackMs - elapsed <= 0) {
    room.blackMs = 0
    flagTimeout(room, 'black')
  }
}

setInterval(() => {
  for (const room of rooms.values()) {
    checkActiveFlag(room)
  }
}, FLAG_TICK_MS)
