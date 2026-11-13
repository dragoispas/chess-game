import {
  clearDraftHalf,
  draftSideValid,
  finalizeDraftSetup,
  tryPlaceDraftPiece,
} from '../../../src/engine/draft.ts'
import { createGame } from '../../../src/engine/game.ts'
import type {
  Board,
  Color,
  PieceType,
  SquareIndex,
} from '../../../src/engine/types.ts'
import type { ServerMessage } from '../../../src/online/protocol.ts'
import { send } from './net.ts'
import { draftStatePayload, readyPayload } from './payloads.ts'
import { persistEvent, persistGame } from './persist.ts'
import { colorForPlayer, findRoomForPlayer } from './seats.ts'
import { syncSeat } from './sync.ts'
import type { LiveRoom } from './types.ts'

function draftBoardFor(room: LiveRoom, color: Color): Board {
  return color === 'white' ? room.draftWhite : room.draftBlack
}

function setDraftBoard(room: LiveRoom, color: Color, board: Board) {
  if (color === 'white') room.draftWhite = board
  else room.draftBlack = board
}

function setDraftReady(room: LiveRoom, color: Color, ready: boolean) {
  if (color === 'white') room.whiteReady = ready
  else room.blackReady = ready
}

function tryStartDraftGame(room: LiveRoom): ServerMessage | null {
  if (!room.whiteReady || !room.blackReady) return null
  const finalized = finalizeDraftSetup(
    room.draftWhite,
    room.draftBlack,
    room.size,
  )
  if (!finalized.ok) {
    room.whiteReady = false
    room.blackReady = false
    if (room.white) syncSeat(room, 'white')
    if (room.black) syncSeat(room, 'black')
    return {
      type: 'error',
      code: 'draft_invalid',
      message: finalized.message,
    }
  }

  room.setup = finalized.setup
  room.state = createGame(finalized.setup)
  room.phase = 'playing'
  room.lastMove = null
  room.moveLog = []
  room.turnStartedAt = null
  room.whiteMs = room.timeControl.initialMs
  room.blackMs = room.timeControl.initialMs

  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'draft_start', {
    setup: finalized.setup,
  })
  persistGame(room)

  if (room.white) syncSeat(room, 'white')
  if (room.black) syncSeat(room, 'black')
  return null
}

export function draftPlace(
  playerId: string,
  square: SquareIndex,
  pieceType: PieceType | null,
): ServerMessage {
  const room = findRoomForPlayer(playerId)
  if (!room) {
    return { type: 'error', code: 'not_in_room', message: 'Not in a room.' }
  }
  if (room.mode !== 'draft' || room.phase !== 'draft') {
    return {
      type: 'error',
      code: 'not_drafting',
      message: 'Not in draft phase.',
    }
  }
  const color = colorForPlayer(room, playerId)
  if (!color) {
    return { type: 'error', code: 'not_seated', message: 'Not seated.' }
  }
  if (color === 'white' ? room.whiteReady : room.blackReady) {
    return {
      type: 'error',
      code: 'already_ready',
      message: 'Unconfirm before editing.',
    }
  }

  const result = tryPlaceDraftPiece(
    draftBoardFor(room, color),
    color,
    room.size,
    square,
    pieceType,
  )
  if (!result.ok) {
    return { type: 'error', code: 'draft_place', message: result.message }
  }
  setDraftBoard(room, color, result.board)
  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'draft_place', {
    playerId,
    color,
    square,
    pieceType,
  })
  const payload = draftStatePayload(room, color, false)
  send((color === 'white' ? room.white : room.black)?.socket, payload)
  return payload
}

export function draftClear(playerId: string): ServerMessage {
  const room = findRoomForPlayer(playerId)
  if (!room) {
    return { type: 'error', code: 'not_in_room', message: 'Not in a room.' }
  }
  if (room.mode !== 'draft' || room.phase !== 'draft') {
    return {
      type: 'error',
      code: 'not_drafting',
      message: 'Not in draft phase.',
    }
  }
  const color = colorForPlayer(room, playerId)
  if (!color) {
    return { type: 'error', code: 'not_seated', message: 'Not seated.' }
  }
  if (color === 'white' ? room.whiteReady : room.blackReady) {
    return {
      type: 'error',
      code: 'already_ready',
      message: 'Unconfirm before editing.',
    }
  }

  setDraftBoard(
    room,
    color,
    clearDraftHalf(draftBoardFor(room, color), color, room.size),
  )
  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'draft_clear', { playerId, color })
  const payload = draftStatePayload(room, color, false)
  send((color === 'white' ? room.white : room.black)?.socket, payload)
  return payload
}

export function draftConfirm(playerId: string): ServerMessage {
  const room = findRoomForPlayer(playerId)
  if (!room) {
    return { type: 'error', code: 'not_in_room', message: 'Not in a room.' }
  }
  const color = colorForPlayer(room, playerId)
  if (!color) {
    return { type: 'error', code: 'not_seated', message: 'Not seated.' }
  }
  if (room.mode === 'draft' && room.phase === 'playing') {
    return readyPayload(room, color, false)
  }
  if (room.mode !== 'draft' || room.phase !== 'draft') {
    return {
      type: 'error',
      code: 'not_drafting',
      message: 'Not in draft phase.',
    }
  }

  const valid = draftSideValid(draftBoardFor(room, color), color, room.size)
  if (!valid.ok) {
    return { type: 'error', code: 'draft_invalid', message: valid.message }
  }

  setDraftReady(room, color, true)
  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'draft_confirm', {
    playerId,
    color,
  })

  const startError = tryStartDraftGame(room)
  if (startError) return startError
  if (room.phase === 'playing') {
    return readyPayload(room, color, false)
  }

  if (room.white) syncSeat(room, 'white')
  if (room.black) syncSeat(room, 'black')
  return draftStatePayload(room, color, false)
}

export function draftUnconfirm(playerId: string): ServerMessage {
  const room = findRoomForPlayer(playerId)
  if (!room) {
    return { type: 'error', code: 'not_in_room', message: 'Not in a room.' }
  }
  if (room.mode !== 'draft' || room.phase !== 'draft') {
    return {
      type: 'error',
      code: 'not_drafting',
      message: 'Not in draft phase.',
    }
  }
  const color = colorForPlayer(room, playerId)
  if (!color) {
    return { type: 'error', code: 'not_seated', message: 'Not seated.' }
  }

  setDraftReady(room, color, false)
  room.eventSeq += 1
  persistEvent(room.gameId, room.eventSeq, 'draft_unconfirm', {
    playerId,
    color,
  })
  if (room.white) syncSeat(room, 'white')
  if (room.black) syncSeat(room, 'black')
  return draftStatePayload(room, color, false)
}
