import {
  draftBudgetForSize,
  isDraftSquare,
  pieceCost,
} from './catalog.ts'
import {
  emptySetup,
  initialCastlingUnmoved,
  placePiece,
  validateSetup,
} from './setup.ts'
import type {
  Board,
  BoardSetup,
  BoardSize,
  Color,
  Piece,
  PieceType,
  SquareIndex,
} from './types.ts'

export function spentOnBoard(board: Board, color: Color): number {
  let spent = 0
  for (const piece of board) {
    if (piece && piece.color === color) spent += pieceCost(piece.type)
  }
  return spent
}

export function countKings(board: Board, color: Color): number {
  let n = 0
  for (const piece of board) {
    if (piece && piece.type === 'king' && piece.color === color) n += 1
  }
  return n
}

export function draftSideValid(
  board: Board,
  color: Color,
  size: BoardSize,
): { ok: true } | { ok: false; message: string } {
  const budget = draftBudgetForSize(size)
  const spent = spentOnBoard(board, color)
  const kings = countKings(board, color)
  if (kings !== 1) {
    return { ok: false, message: 'Place exactly one king.' }
  }
  if (spent > budget) {
    return { ok: false, message: 'Over budget.' }
  }
  for (let i = 0; i < board.length; i++) {
    const piece = board[i]
    if (!piece || piece.color !== color) continue
    if (!isDraftSquare(color, i, size)) {
      return { ok: false, message: 'Piece outside your half.' }
    }
  }
  return { ok: true }
}

export function mergeDraftBoards(
  whiteBoard: Board,
  blackBoard: Board,
  size: BoardSize,
): BoardSetup {
  const board = emptySetup(size).board
  for (let i = 0; i < board.length; i++) {
    if (isDraftSquare('white', i, size) && whiteBoard[i]) {
      board[i] = whiteBoard[i]
    }
    if (isDraftSquare('black', i, size) && blackBoard[i]) {
      board[i] = blackBoard[i]
    }
  }
  return {
    board,
    size,
    turn: 'white',
    castling: initialCastlingUnmoved(board),
    enPassant: null,
  }
}

export function tryPlaceDraftPiece(
  board: Board,
  color: Color,
  size: BoardSize,
  square: SquareIndex,
  pieceType: PieceType | null,
): { ok: true; board: Board } | { ok: false; message: string } {
  if (!isDraftSquare(color, square, size)) {
    return { ok: false, message: 'Not your half of the board.' }
  }
  if (pieceType === null) {
    return { ok: true, board: placePiece(board, square, null) }
  }

  const budget = draftBudgetForSize(size)
  const spent = spentOnBoard(board, color)
  const kings = countKings(board, color)
  const cost = pieceCost(pieceType)
  const existing = board[square]
  const refund =
    existing && existing.color === color ? pieceCost(existing.type) : 0
  if (cost - refund > budget - spent) {
    return { ok: false, message: 'Not enough points.' }
  }
  if (pieceType === 'king' && kings >= 1 && existing?.type !== 'king') {
    return { ok: false, message: 'Only one king allowed.' }
  }

  const piece: Piece = { type: pieceType, color }
  return { ok: true, board: placePiece(board, square, piece) }
}

export function clearDraftHalf(
  board: Board,
  color: Color,
  size: BoardSize,
): Board {
  let next = board
  for (let i = 0; i < board.length; i++) {
    if (isDraftSquare(color, i, size) && board[i]) {
      next = placePiece(next, i, null)
    }
  }
  return next
}

export function finalizeDraftSetup(
  whiteBoard: Board,
  blackBoard: Board,
  size: BoardSize,
): { ok: true; setup: BoardSetup } | { ok: false; message: string } {
  const whiteOk = draftSideValid(whiteBoard, 'white', size)
  if (!whiteOk.ok) return { ok: false, message: `White: ${whiteOk.message}` }
  const blackOk = draftSideValid(blackBoard, 'black', size)
  if (!blackOk.ok) return { ok: false, message: `Black: ${blackOk.message}` }
  const setup = mergeDraftBoards(whiteBoard, blackBoard, size)
  const issues = validateSetup(setup)
  if (issues.length > 0) {
    return { ok: false, message: 'Merged setup is invalid.' }
  }
  return { ok: true, setup }
}
