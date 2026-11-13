import { getPiece } from './board.ts'
import type {
  Board,
  BoardSize,
  CastlingUnmoved,
  Color,
  Piece,
  Position,
  PromotionPiece,
  SquareIndex,
} from './types.ts'
import {
  fileRankToIndex,
  inBounds,
  indexToFileRank,
  pawnStartRank,
  promotionRank,
  squareCount,
} from '../shared/coords.ts'

/**
 * Castling requires at least two empty squares between king and rook
 * (|Δfile| >= 3). King always moves two files toward that rook.
 */
const CASTLE_MIN_FILE_GAP = 3

const KNIGHT_DELTAS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const

const KING_DELTAS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const

export function opposite(color: Color): Color {
  return color === 'white' ? 'black' : 'white'
}

function sq(file: number, rank: number, size: BoardSize): SquareIndex {
  return fileRankToIndex(file, rank, size)
}

/** Mark every king and rook square as unmoved at position start. */
export function initialCastlingUnmoved(board: Board): CastlingUnmoved {
  const unmoved: SquareIndex[] = []
  for (let i = 0; i < board.length; i++) {
    const piece = board[i]
    if (piece && (piece.type === 'king' || piece.type === 'rook')) {
      unmoved.push(i)
    }
  }
  return unmoved
}

function isUnmoved(castling: CastlingUnmoved, square: SquareIndex): boolean {
  return castling.includes(square)
}

function updateCastlingUnmoved(
  castling: CastlingUnmoved,
  from: SquareIndex,
  to: SquareIndex,
): CastlingUnmoved {
  return castling.filter((square) => square !== from && square !== to)
}

function slide(
  board: Board,
  from: SquareIndex,
  color: Color,
  size: BoardSize,
  directions: readonly (readonly [number, number])[],
): SquareIndex[] {
  const { file, rank } = indexToFileRank(from, size)
  const targets: SquareIndex[] = []

  for (const [df, dr] of directions) {
    let f = file + df
    let r = rank + dr
    while (inBounds(f, r, size)) {
      const idx = sq(f, r, size)
      const occupant = getPiece(board, idx)
      if (!occupant) {
        targets.push(idx)
      } else {
        if (occupant.color === opposite(color)) targets.push(idx)
        break
      }
      f += df
      r += dr
    }
  }

  return targets
}

function slideAttacks(
  board: Board,
  from: SquareIndex,
  size: BoardSize,
  directions: readonly (readonly [number, number])[],
): SquareIndex[] {
  const { file, rank } = indexToFileRank(from, size)
  const targets: SquareIndex[] = []

  for (const [df, dr] of directions) {
    let f = file + df
    let r = rank + dr
    while (inBounds(f, r, size)) {
      const idx = sq(f, r, size)
      targets.push(idx)
      if (getPiece(board, idx)) break
      f += df
      r += dr
    }
  }

  return targets
}

const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const

const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS] as const

function unionUnique(...lists: SquareIndex[][]): SquareIndex[] {
  return [...new Set(lists.flat())]
}

function knightTargets(
  board: Board,
  from: SquareIndex,
  color: Color,
  size: BoardSize,
): SquareIndex[] {
  const { file, rank } = indexToFileRank(from, size)
  return KNIGHT_DELTAS.flatMap(([df, dr]) => {
    const f = file + df
    const r = rank + dr
    if (!inBounds(f, r, size)) return []
    const idx = sq(f, r, size)
    const occupant = getPiece(board, idx)
    if (!occupant || occupant.color === opposite(color)) return [idx]
    return []
  })
}

function knightAttacks(from: SquareIndex, size: BoardSize): SquareIndex[] {
  const { file, rank } = indexToFileRank(from, size)
  return KNIGHT_DELTAS.flatMap(([df, dr]) => {
    const f = file + df
    const r = rank + dr
    return inBounds(f, r, size) ? [sq(f, r, size)] : []
  })
}

function kingStepTargets(
  board: Board,
  from: SquareIndex,
  color: Color,
  size: BoardSize,
): SquareIndex[] {
  const { file, rank } = indexToFileRank(from, size)
  return KING_DELTAS.flatMap(([df, dr]) => {
    const f = file + df
    const r = rank + dr
    if (!inBounds(f, r, size)) return []
    const idx = sq(f, r, size)
    const occupant = getPiece(board, idx)
    if (!occupant || occupant.color === opposite(color)) return [idx]
    return []
  })
}

function kingStepAttacks(from: SquareIndex, size: BoardSize): SquareIndex[] {
  const { file, rank } = indexToFileRank(from, size)
  return KING_DELTAS.flatMap(([df, dr]) => {
    const f = file + df
    const r = rank + dr
    return inBounds(f, r, size) ? [sq(f, r, size)] : []
  })
}

/** Attacked squares from a piece (check / castling-through). */
export function attacksFrom(
  board: Board,
  from: SquareIndex,
  size: BoardSize,
): SquareIndex[] {
  const piece = getPiece(board, from)
  if (!piece) return []

  const { file, rank } = indexToFileRank(from, size)
  const { color, type } = piece

  if (type === 'pawn') {
    const dir = color === 'white' ? 1 : -1
    return [-1, 1].flatMap((df) => {
      const f = file + df
      const r = rank + dir
      return inBounds(f, r, size) ? [sq(f, r, size)] : []
    })
  }

  if (type === 'knight') return knightAttacks(from, size)

  if (type === 'king' || type === 'centaur') {
    const steps = kingStepAttacks(from, size)
    return type === 'centaur'
      ? unionUnique(steps, knightAttacks(from, size))
      : steps
  }

  if (type === 'bishop') return slideAttacks(board, from, size, BISHOP_DIRS)

  if (type === 'rook') return slideAttacks(board, from, size, ROOK_DIRS)

  if (type === 'queen') return slideAttacks(board, from, size, QUEEN_DIRS)

  if (type === 'archbishop') {
    return unionUnique(
      slideAttacks(board, from, size, BISHOP_DIRS),
      knightAttacks(from, size),
    )
  }

  if (type === 'chancellor') {
    return unionUnique(
      slideAttacks(board, from, size, ROOK_DIRS),
      knightAttacks(from, size),
    )
  }

  if (type === 'dragon') {
    return unionUnique(
      slideAttacks(board, from, size, QUEEN_DIRS),
      knightAttacks(from, size),
    )
  }

  return []
}

export function isSquareAttacked(
  board: Board,
  square: SquareIndex,
  by: Color,
  size: BoardSize,
): boolean {
  for (let i = 0; i < board.length; i++) {
    const piece = board[i]
    if (!piece || piece.color !== by) continue
    if (attacksFrom(board, i, size).includes(square)) return true
  }
  return false
}

export function findKing(board: Board, color: Color): SquareIndex | null {
  for (let i = 0; i < board.length; i++) {
    const piece = board[i]
    if (piece && piece.type === 'king' && piece.color === color) {
      return i
    }
  }
  return null
}

export function isInCheck(
  board: Board,
  color: Color,
  size: BoardSize,
): boolean {
  const kingSquare = findKing(board, color)
  if (kingSquare === null) return false
  return isSquareAttacked(board, kingSquare, opposite(color), size)
}

export function isPromotionMove(
  piece: Piece,
  to: SquareIndex,
  size: BoardSize,
): boolean {
  if (piece.type !== 'pawn') return false
  const { rank } = indexToFileRank(to, size)
  return rank === promotionRank(piece.color, size)
}

function tryCastleWithRook(
  position: Position,
  color: Color,
  kingFrom: SquareIndex,
  rookFrom: SquareIndex,
): SquareIndex | null {
  const { board, castling, size } = position
  if (!isUnmoved(castling, kingFrom) || !isUnmoved(castling, rookFrom)) {
    return null
  }

  const { file: kingFile, rank: kingRank } = indexToFileRank(kingFrom, size)
  const { file: rookFile, rank: rookRank } = indexToFileRank(rookFrom, size)
  if (kingRank !== rookRank) return null
  if (Math.abs(rookFile - kingFile) < CASTLE_MIN_FILE_GAP) return null

  const dir = Math.sign(rookFile - kingFile) as -1 | 1
  const kingDestFile = kingFile + 2 * dir
  if (!inBounds(kingDestFile, kingRank, size)) return null

  // Entire path between king and rook must be empty.
  for (let file = kingFile + dir; file !== rookFile; file += dir) {
    if (getPiece(board, sq(file, kingRank, size))) return null
  }

  const enemy = opposite(color)
  if (isInCheck(board, color, size)) return null
  // Squares the king crosses and lands on must not be attacked.
  for (let step = 1; step <= 2; step++) {
    const file = kingFile + step * dir
    if (isSquareAttacked(board, sq(file, kingRank, size), enemy, size)) {
      return null
    }
  }

  return sq(kingDestFile, kingRank, size)
}

function castlingTargets(
  position: Position,
  color: Color,
  from: SquareIndex,
): SquareIndex[] {
  if (!isUnmoved(position.castling, from)) return []

  const { board, size } = position
  const { rank: kingRank } = indexToFileRank(from, size)
  const targets: SquareIndex[] = []

  for (let i = 0; i < board.length; i++) {
    const piece = board[i]
    if (!piece || piece.type !== 'rook' || piece.color !== color) continue
    if (indexToFileRank(i, size).rank !== kingRank) continue
    const dest = tryCastleWithRook(position, color, from, i)
    if (dest !== null) targets.push(dest)
  }

  return targets
}

/** Piece geometry + castling + en passant — may leave own king in check. */
export function pseudoLegalMoves(
  position: Position,
  from: SquareIndex,
): SquareIndex[] {
  const piece = getPiece(position.board, from)
  if (!piece) return []

  const { board, enPassant, size } = position
  const { file, rank } = indexToFileRank(from, size)
  const { color, type } = piece

  if (type === 'knight') return knightTargets(board, from, color, size)

  if (type === 'king') {
    return [
      ...kingStepTargets(board, from, color, size),
      ...castlingTargets(position, color, from),
    ]
  }

  if (type === 'centaur') {
    return unionUnique(
      kingStepTargets(board, from, color, size),
      knightTargets(board, from, color, size),
    )
  }

  if (type === 'bishop') return slide(board, from, color, size, BISHOP_DIRS)

  if (type === 'rook') return slide(board, from, color, size, ROOK_DIRS)

  if (type === 'queen') return slide(board, from, color, size, QUEEN_DIRS)

  if (type === 'archbishop') {
    return unionUnique(
      slide(board, from, color, size, BISHOP_DIRS),
      knightTargets(board, from, color, size),
    )
  }

  if (type === 'chancellor') {
    return unionUnique(
      slide(board, from, color, size, ROOK_DIRS),
      knightTargets(board, from, color, size),
    )
  }

  if (type === 'dragon') {
    return unionUnique(
      slide(board, from, color, size, QUEEN_DIRS),
      knightTargets(board, from, color, size),
    )
  }

  if (type !== 'pawn') return []

  const dir = color === 'white' ? 1 : -1
  const startRank = pawnStartRank(color, size)
  const targets: SquareIndex[] = []

  const oneRank = rank + dir
  if (inBounds(file, oneRank, size)) {
    const one = sq(file, oneRank, size)
    if (!getPiece(board, one)) {
      targets.push(one)
      if (rank === startRank) {
        const two = sq(file, rank + dir * 2, size)
        if (!getPiece(board, two)) targets.push(two)
      }
    }
  }

  for (const df of [-1, 1]) {
    const f = file + df
    const r = rank + dir
    if (!inBounds(f, r, size)) continue
    const idx = sq(f, r, size)
    const occupant = getPiece(board, idx)
    if (occupant && occupant.color === opposite(color)) {
      targets.push(idx)
    } else if (enPassant !== null && idx === enPassant) {
      targets.push(idx)
    }
  }

  return targets
}

/** Apply a move including castling rook shift, EP capture, and promotion. */
export function applyPositionMove(
  position: Position,
  from: SquareIndex,
  to: SquareIndex,
  promotion: PromotionPiece = 'queen',
): Position {
  const piece = getPiece(position.board, from)
  if (!piece) return position

  const { size } = position
  const { file: fromFile, rank: fromRank } = indexToFileRank(from, size)
  const { file: toFile, rank: toRank } = indexToFileRank(to, size)
  const nextBoard = position.board.slice() as Board

  const isEnPassant =
    piece.type === 'pawn' &&
    position.enPassant !== null &&
    to === position.enPassant &&
    !getPiece(position.board, to)

  const isCastle = piece.type === 'king' && Math.abs(toFile - fromFile) === 2

  nextBoard[from] = null

  if (isEnPassant) {
    const capturedRank = piece.color === 'white' ? toRank - 1 : toRank + 1
    nextBoard[sq(toFile, capturedRank, size)] = null
    nextBoard[to] = piece
  } else if (isCastle) {
    const dir = toFile > fromFile ? 1 : -1
    let rookFrom: SquareIndex | null = null
    for (let file = fromFile + dir; inBounds(file, toRank, size); file += dir) {
      const idx = sq(file, toRank, size)
      const rook = getPiece(position.board, idx)
      if (rook?.type === 'rook' && rook.color === piece.color) {
        rookFrom = idx
        break
      }
    }
    const rookDest = sq(fromFile + dir, toRank, size)
    if (rookFrom !== null) nextBoard[rookFrom] = null
    nextBoard[to] = piece
    nextBoard[rookDest] = { type: 'rook', color: piece.color }
  } else if (isPromotionMove(piece, to, size)) {
    nextBoard[to] = { type: promotion, color: piece.color }
  } else {
    nextBoard[to] = piece
  }

  let enPassant: SquareIndex | null = null
  if (piece.type === 'pawn' && Math.abs(toRank - fromRank) === 2) {
    enPassant = sq(fromFile, (fromRank + toRank) / 2, size)
  }

  return {
    board: nextBoard,
    size,
    castling: updateCastlingUnmoved(position.castling, from, to),
    enPassant,
  }
}

export function toPosition(state: {
  board: Board
  size: BoardSize
  castling: CastlingUnmoved
  enPassant: SquareIndex | null
}): Position {
  return {
    board: state.board,
    size: state.size,
    castling: state.castling,
    enPassant: state.enPassant,
  }
}

/** Legal destinations that do not leave the moving side's king in check. */
export function legalMoves(
  position: Position,
  from: SquareIndex,
): SquareIndex[] {
  const piece = getPiece(position.board, from)
  if (!piece) return []

  return pseudoLegalMoves(position, from).filter((to) => {
    const next = applyPositionMove(position, from, to, 'queen')
    return !isInCheck(next.board, piece.color, position.size)
  })
}

export function hasAnyLegalMove(position: Position, color: Color): boolean {
  const n = squareCount(position.size)
  for (let i = 0; i < n; i++) {
    const piece = position.board[i]
    if (!piece || piece.color !== color) continue
    if (legalMoves(position, i).length > 0) return true
  }
  return false
}
