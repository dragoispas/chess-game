import type { Color } from '../../../src/engine/types.ts'
import type { ServerMessage } from '../../../src/online/protocol.ts'
import {
  freezeDisconnectedPlayersClock,
  resumeClockIfRejoinedOnTurn,
} from './clocks.ts'
import { send, sendToRoom } from './net.ts'
import { draftStatePayload, readyPayload, statePayload } from './payloads.ts'
import { persistEvent, persistGame, retireLiveRoom } from './persist.ts'
import { attachSeat, isSoloWaitingLobby, seatConnected } from './seats.ts'
import { rooms } from './store.ts'
import type { LiveRoom } from './types.ts'

export function syncSeat(room: LiveRoom, color: Color) {
  const seat = color === 'white' ? room.white : room.black
  if (!seat) return
  if (room.phase === 'waiting' || room.phase === 'draft') {
    send(
      seat.socket,
      draftStatePayload(room, color, room.phase === 'waiting'),
    )
    return
  }
  send(seat.socket, readyPayload(room, color, isSoloWaitingLobby(room)))
  if (room.lastMove || room.state.status !== 'ongoing') {
    send(seat.socket, statePayload(room))
  }
}

/**
 * Mark a seat abandoned so the player is no longer findable there, while
 * leaving the slot reclaimable (`playerId` cleared, socket cleared).
 */
export function abandonSeat(room: LiveRoom, color: Color): void {
  const seat = color === 'white' ? room.white : room.black
  if (!seat) return
  seat.socket = null
  seat.disconnectedAt = Date.now()
  seat.playerId = ''
  if (room.phase === 'playing') freezeDisconnectedPlayersClock(room, color)
}

/**
 * Drop this player from rooms other than `keepCode`.
 * Solo waiting lobbies they host are closed; started games keep an open seat for reclaim.
 */
export function vacateFromOtherRooms(
  playerId: string,
  keepCode: string | null,
) {
  for (const room of [...rooms.values()]) {
    if (keepCode && room.code === keepCode) continue
    if (room.phase === 'playing' && room.state.status !== 'ongoing') continue

    const asWhite = room.white?.playerId === playerId
    const asBlack = room.black?.playerId === playerId
    if (!asWhite && !asBlack) continue

    if (isSoloWaitingLobby(room)) {
      retireLiveRoom(room)
      continue
    }

    if (asWhite) abandonSeat(room, 'white')
    if (asBlack) abandonSeat(room, 'black')

    if (room.phase === 'playing') sendToRoom(room, statePayload(room))
    else {
      if (room.white?.playerId) syncSeat(room, 'white')
      if (room.black?.playerId) syncSeat(room, 'black')
    }
  }
}

/** Explicit leave from the lobby / current seats (Back). */
export function leaveRooms(playerId: string): void {
  vacateFromOtherRooms(playerId, null)
}

export function reclaimSeat(
  room: LiveRoom,
  color: Color,
  playerId: string,
): ServerMessage {
  const previous =
    color === 'white' ? room.white?.playerId : room.black?.playerId
  const seat = attachSeat(room, color, playerId)
  if (color === 'white') room.hostPlayerId = playerId

  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'reclaim', {
    playerId,
    color,
    previousPlayerId: previous ?? null,
  })
  persistGame(room)
  vacateFromOtherRooms(playerId, room.code)
  if (room.phase === 'playing') resumeClockIfRejoinedOnTurn(room, color)

  send(seat.socket, {
    type: 'room:joined',
    code: room.code,
    gameId: room.gameId,
    color,
    mode: room.mode,
  })
  syncSeat(room, color)
  const other = color === 'white' ? room.black : room.white
  if (other) syncSeat(room, other.color)

  return {
    type: 'room:joined',
    code: room.code,
    gameId: room.gameId,
    color,
    mode: room.mode,
  }
}
