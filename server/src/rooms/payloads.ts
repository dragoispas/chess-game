import { draftBudgetForSize } from '../../../src/engine/catalog.ts'
import { emptySetup } from '../../../src/engine/setup.ts'
import type { BoardSize, Color, GameState } from '../../../src/engine/types.ts'
import type { ServerMessage } from '../../../src/online/protocol.ts'
import { clockSnapshot } from './clockView.ts'
import { seatPresence } from './seats.ts'
import type { LiveRoom } from './types.ts'

export function readyPayload(
  room: LiveRoom,
  you: Color,
  waiting: boolean,
): ServerMessage {
  return {
    type: 'room:ready',
    code: room.code,
    gameId: room.gameId,
    setup: room.setup,
    state: room.state,
    you,
    waiting,
    mode: room.mode,
    clock: clockSnapshot(room),
    lastMove: room.lastMove,
    moves: room.moveLog.map((entry) => entry.moveLabel),
    plies: room.moveLog.map(({ from, to, promotion }) => ({
      from,
      to,
      promotion,
    })),
    seats: seatPresence(room),
  }
}

export function draftStatePayload(
  room: LiveRoom,
  you: Color,
  waiting: boolean,
): ServerMessage {
  const board = you === 'white' ? room.draftWhite : room.draftBlack
  const youReady = you === 'white' ? room.whiteReady : room.blackReady
  const opponentReady = you === 'white' ? room.blackReady : room.whiteReady
  return {
    type: 'draft:state',
    code: room.code,
    gameId: room.gameId,
    you,
    size: room.size,
    budget: draftBudgetForSize(room.size),
    timeControl: room.timeControl.id,
    board,
    youReady,
    opponentReady,
    waiting,
    seats: seatPresence(room),
  }
}

/** Placeholder ongoing state while drafting (empty board would be stalemate). */
export function draftPlaceholderState(size: BoardSize): GameState {
  return {
    board: emptySetup(size).board,
    size,
    castling: [],
    enPassant: null,
    turn: 'white',
    inCheck: false,
    status: 'ongoing',
    winner: null,
  }
}

export function statePayload(
  room: LiveRoom,
  extras: { moveLabel?: string } = {},
): ServerMessage {
  return {
    type: 'state',
    state: room.state,
    lastMove: room.lastMove,
    moveLabel: extras.moveLabel,
    clock: clockSnapshot(room),
    seats: seatPresence(room),
  }
}
