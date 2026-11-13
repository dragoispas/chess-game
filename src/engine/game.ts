import { getPiece } from './board.ts'
import {
  applyPositionMove,
  hasAnyLegalMove,
  initialCastlingUnmoved,
  isInCheck,
  isPromotionMove,
  legalMoves,
  opposite,
  toPosition,
} from './moves.ts'
import { classicSetup } from './setup.ts'
import type {
  BoardSetup,
  Color,
  GameState,
  PromotionPiece,
  SquareIndex,
} from './types.ts'
import { createClassicBoard } from './variants/classic.ts'

function withTurnState(
  position: ReturnType<typeof toPosition>,
  turn: GameState['turn'],
): GameState {
  const inCheck = isInCheck(position.board, turn, position.size)
  const canMove = hasAnyLegalMove(position, turn)

  if (!canMove) {
    if (inCheck) {
      return {
        ...position,
        turn,
        inCheck: true,
        status: 'checkmate',
        winner: opposite(turn),
      }
    }
    return {
      ...position,
      turn,
      inCheck: false,
      status: 'stalemate',
      winner: null,
    }
  }

  return {
    ...position,
    turn,
    inCheck,
    status: 'ongoing',
    winner: null,
  }
}

export function createGame(setup?: BoardSetup): GameState {
  if (!setup) {
    const board = createClassicBoard()
    return withTurnState(
      {
        board,
        size: 8,
        castling: initialCastlingUnmoved(board),
        enPassant: null,
      },
      'white',
    )
  }

  return withTurnState(
    {
      board: setup.board.slice(),
      size: setup.size,
      castling: setup.castling.slice(),
      enPassant: null,
    },
    setup.turn,
  )
}

/** Active setup used for reset; null means default classic. */
export function resolveSetup(setup: BoardSetup | null): BoardSetup {
  return setup ?? classicSetup()
}

/** Resign as the side to move (hotseat). Prefer `resignAs` when color is known. */
export function resignGame(state: GameState): GameState {
  return resignAs(state, state.turn)
}

/** Resign as a specific color — winner is the opponent. */
export function resignAs(state: GameState, color: Color): GameState {
  if (state.status !== 'ongoing') return state
  return {
    ...state,
    status: 'resigned',
    inCheck: false,
    winner: opposite(color),
  }
}

/** Flag a side for running out of time — winner is the opponent. */
export function timeoutAs(state: GameState, color: Color): GameState {
  if (state.status !== 'ongoing') return state
  return {
    ...state,
    status: 'timeout',
    inCheck: false,
    winner: opposite(color),
  }
}

export type TryMoveResult =
  | { type: 'moved'; state: GameState }
  | { type: 'needs-promotion'; from: SquareIndex; to: SquareIndex }
  | { type: 'invalid' }

export function tryMove(
  state: GameState,
  from: SquareIndex,
  to: SquareIndex,
  promotion?: PromotionPiece,
): TryMoveResult {
  if (state.status !== 'ongoing') return { type: 'invalid' }

  const piece = getPiece(state.board, from)
  if (!piece || piece.color !== state.turn) return { type: 'invalid' }

  const position = toPosition(state)
  const destinations = legalMoves(position, from)
  if (!destinations.includes(to)) return { type: 'invalid' }

  if (isPromotionMove(piece, to, state.size) && !promotion) {
    return { type: 'needs-promotion', from, to }
  }

  const nextPosition = applyPositionMove(
    position,
    from,
    to,
    promotion ?? 'queen',
  )
  return {
    type: 'moved',
    state: withTurnState(nextPosition, opposite(state.turn)),
  }
}

export function formatResignMessage(winner: Color): string {
  const loser = opposite(winner)
  const cap = (c: Color) => c.charAt(0).toUpperCase() + c.slice(1)
  return `${cap(loser)} resigns — ${cap(winner)} wins.`
}

export function formatTimeoutMessage(winner: Color): string {
  const loser = opposite(winner)
  const cap = (c: Color) => c.charAt(0).toUpperCase() + c.slice(1)
  return `${cap(loser)} ran out of time — ${cap(winner)} wins.`
}
