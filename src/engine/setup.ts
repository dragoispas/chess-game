import {
  hasAnyLegalMove,
  initialCastlingUnmoved,
  isInCheck,
  opposite,
} from './moves.ts'
import type {
  Board,
  BoardSetup,
  BoardSize,
  Color,
  Piece,
  SetupIssue,
  SquareIndex,
} from './types.ts'
import { squareCount } from '../shared/coords.ts'
import {
  createClassicBoard,
  createStandardBoard,
  extractColorHalf,
} from './variants/classic.ts'

export function emptyBoard(size: BoardSize): Board {
  return Array.from({ length: squareCount(size) }, () => null)
}

export function emptySetup(size: BoardSize = 8): BoardSetup {
  return {
    board: emptyBoard(size),
    size,
    turn: 'white',
    castling: [],
    enPassant: null,
  }
}

export function classicSetup(): BoardSetup {
  const board = createClassicBoard()
  return {
    board,
    size: 8,
    turn: 'white',
    castling: initialCastlingUnmoved(board),
    enPassant: null,
  }
}

/** Standard starting position for 6 / 8 / 10 (classic on 8×8). */
export function standardSetup(size: BoardSize): BoardSetup {
  const board = createStandardBoard(size)
  return {
    board,
    size,
    turn: 'white',
    castling: initialCastlingUnmoved(board),
    enPassant: null,
  }
}

/** One side’s pieces from the standard starting position. */
export function standardHalfBoard(color: Color, size: BoardSize): Board {
  return extractColorHalf(createStandardBoard(size), color, size)
}

export function placePiece(
  board: Board,
  square: SquareIndex,
  piece: Piece | null,
): Board {
  const next = board.slice() as Board
  next[square] = piece
  return next
}

export { initialCastlingUnmoved }

function countKings(board: Board, color: Piece['color']): number {
  let count = 0
  for (const piece of board) {
    if (piece && piece.type === 'king' && piece.color === color) count += 1
  }
  return count
}

const ISSUE_MESSAGES: Record<SetupIssue, string> = {
  missing_white_king: 'White needs exactly one king.',
  missing_black_king: 'Black needs exactly one king.',
  multiple_white_kings: 'White has more than one king.',
  multiple_black_kings: 'Black has more than one king.',
  opponent_in_check: 'The side not to move is in check (illegal position).',
  checkmate: 'Side to move is already checkmated.',
  stalemate: 'Side to move has no legal moves (stalemate).',
}

export function setupIssueMessage(issue: SetupIssue): string {
  return ISSUE_MESSAGES[issue]
}

export function validateSetup(setup: BoardSetup): SetupIssue[] {
  const issues: SetupIssue[] = []
  const whiteKings = countKings(setup.board, 'white')
  const blackKings = countKings(setup.board, 'black')

  if (whiteKings === 0) issues.push('missing_white_king')
  if (whiteKings > 1) issues.push('multiple_white_kings')
  if (blackKings === 0) issues.push('missing_black_king')
  if (blackKings > 1) issues.push('multiple_black_kings')

  if (whiteKings !== 1 || blackKings !== 1) return issues

  const opponent = opposite(setup.turn)
  if (isInCheck(setup.board, opponent, setup.size)) {
    issues.push('opponent_in_check')
    return issues
  }

  const position = {
    board: setup.board,
    size: setup.size,
    castling: setup.castling,
    enPassant: setup.enPassant,
  }
  const canMove = hasAnyLegalMove(position, setup.turn)
  if (!canMove) {
    issues.push(
      isInCheck(setup.board, setup.turn, setup.size) ? 'checkmate' : 'stalemate',
    )
  }

  return issues
}
