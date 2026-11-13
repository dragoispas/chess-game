import { resignAs, tryMove } from '../../../src/engine/game.ts'
import { toPosition } from '../../../src/engine/moves.ts'
import { formatMoveLabel } from '../../../src/engine/notation.ts'
import type {
  PromotionPiece,
  SquareIndex,
} from '../../../src/engine/types.ts'
import type { ServerMessage } from '../../../src/online/protocol.ts'
import { checkActiveFlag, settleClockAfterMove } from './clocks.ts'
import { sendToRoom } from './net.ts'
import { statePayload } from './payloads.ts'
import { persistEvent, persistGame, retireLiveRoom } from './persist.ts'
import { colorForPlayer, findRoomForPlayer } from './seats.ts'

export function playMove(
  playerId: string,
  from: SquareIndex,
  to: SquareIndex,
  promotion?: PromotionPiece,
): ServerMessage {
  const room = findRoomForPlayer(playerId)
  if (!room) {
    return { type: 'error', code: 'not_in_room', message: 'Not in a room.' }
  }
  if (room.phase !== 'playing') {
    return {
      type: 'error',
      code: 'not_playing',
      message: 'Game has not started.',
    }
  }
  if (!room.white || !room.black) {
    return {
      type: 'error',
      code: 'waiting',
      message: 'Waiting for opponent.',
    }
  }
  const color = colorForPlayer(room, playerId)
  if (!color) {
    return { type: 'error', code: 'not_seated', message: 'Not seated.' }
  }
  if (room.state.status !== 'ongoing') {
    return { type: 'error', code: 'game_over', message: 'Game is over.' }
  }
  if (room.state.turn !== color) {
    return { type: 'error', code: 'not_your_turn', message: 'Not your turn.' }
  }

  checkActiveFlag(room)
  if (room.state.status !== 'ongoing') {
    return { type: 'error', code: 'game_over', message: 'Game is over.' }
  }

  const result = tryMove(room.state, from, to, promotion)
  if (result.type !== 'moved') {
    return {
      type: 'error',
      code: 'illegal_move',
      message: 'Illegal move.',
    }
  }

  const at = Date.now()
  if (!settleClockAfterMove(room, color, at)) {
    return statePayload(room)
  }

  const position = toPosition(room.state)
  const moveLabel = formatMoveLabel(position, from, to, promotion)
  room.state = result.state
  room.lastMove = { from, to }
  room.moveLog.push({ from, to, promotion, moveLabel })

  const finished = room.state.status !== 'ongoing'
  if (finished) {
    room.turnStartedAt = null
  }

  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'move', {
    playerId,
    from,
    to,
    promotion: promotion ?? null,
    moveLabel,
    whiteMs: room.whiteMs,
    blackMs: room.blackMs,
  })
  persistGame(room)

  const message = statePayload(room, { moveLabel })
  sendToRoom(room, message)
  if (finished) retireLiveRoom(room)
  return message
}

export function playResign(playerId: string): ServerMessage {
  const room = findRoomForPlayer(playerId)
  if (!room) {
    return { type: 'error', code: 'not_in_room', message: 'Not in a room.' }
  }
  if (room.phase !== 'playing') {
    return {
      type: 'error',
      code: 'not_playing',
      message: 'Game has not started.',
    }
  }
  const color = colorForPlayer(room, playerId)
  if (!color) {
    return { type: 'error', code: 'not_seated', message: 'Not seated.' }
  }
  if (room.state.status !== 'ongoing') {
    return { type: 'error', code: 'game_over', message: 'Game is over.' }
  }

  room.state = resignAs(room.state, color)
  room.turnStartedAt = null
  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'resign', { playerId, color })
  persistGame(room)

  const message = statePayload(room)
  sendToRoom(room, message)
  retireLiveRoom(room)
  return message
}
