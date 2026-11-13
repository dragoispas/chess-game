import type { Board, BoardSize, Color, Piece, PieceType } from '../types.ts'
import { fileRankToIndex, squareCount } from '../../shared/coords.ts'

function p(type: Piece['type'], color: Piece['color']): Piece {
  return { type, color }
}

/** Standard back ranks by board size (mirrored for Black). */
function backRankForSize(size: BoardSize): PieceType[] {
  if (size === 6) {
    return ['rook', 'knight', 'bishop', 'king', 'knight', 'rook']
  }
  if (size === 10) {
    // Capablanca-style: archbishop + chancellor outside the bishops.
    return [
      'rook',
      'knight',
      'archbishop',
      'bishop',
      'queen',
      'king',
      'bishop',
      'chancellor',
      'knight',
      'rook',
    ]
  }
  return [
    'rook',
    'knight',
    'bishop',
    'queen',
    'king',
    'bishop',
    'knight',
    'rook',
  ]
}

/** Starting position for the given size. Index 0 = a1. */
export function createStandardBoard(size: BoardSize): Board {
  const board: Board = Array.from({ length: squareCount(size) }, () => null)
  const back = backRankForSize(size)

  for (let file = 0; file < size; file++) {
    board[fileRankToIndex(file, 0, size)] = p(back[file]!, 'white')
    board[fileRankToIndex(file, 1, size)] = p('pawn', 'white')
    board[fileRankToIndex(file, size - 2, size)] = p('pawn', 'black')
    board[fileRankToIndex(file, size - 1, size)] = p(back[file]!, 'black')
  }

  return board
}

/** Standard chess starting position on 8×8. Index 0 = a1. */
export function createClassicBoard(): Board {
  return createStandardBoard(8)
}

/** Copy one color’s pieces from a full board onto an empty board of the same size. */
export function extractColorHalf(
  full: Board,
  color: Color,
  size: BoardSize,
): Board {
  const board: Board = Array.from({ length: squareCount(size) }, () => null)
  for (let i = 0; i < full.length; i++) {
    if (full[i]?.color === color) board[i] = full[i]
  }
  return board
}
