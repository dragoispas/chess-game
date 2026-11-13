import type { Board, Piece, SquareIndex } from './types.ts'

export function getPiece(board: Board, square: SquareIndex): Piece | null {
  return board[square] ?? null
}

export function applyMove(
  board: Board,
  from: SquareIndex,
  to: SquareIndex,
  placed?: Piece,
): Board {
  const next = board.slice() as Board
  const piece = placed ?? next[from]
  next[from] = null
  next[to] = piece
  return next
}
