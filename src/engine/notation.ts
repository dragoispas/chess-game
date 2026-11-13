import { getPiece } from './board.ts'
import {
  applyPositionMove,
  hasAnyLegalMove,
  isInCheck,
  legalMoves,
  opposite,
} from './moves.ts'
import type {
  BoardSize,
  Piece,
  PieceType,
  Position,
  PromotionPiece,
  SquareIndex,
} from './types.ts'
import { indexToAlgebraic, indexToFileRank } from '../shared/coords.ts'

const PIECE_LETTER: Partial<Record<PieceType, string>> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  archbishop: 'A',
  chancellor: 'C',
  dragon: 'D',
  centaur: 'S',
}

/**
 * SAN disambiguation: among same-type pieces that can also legally reach `to`,
 * use file, else rank, else both.
 */
function disambiguator(
  position: Position,
  from: SquareIndex,
  to: SquareIndex,
  piece: Piece,
): string {
  const { board, size } = position
  const { file: fromFile, rank: fromRank } = indexToFileRank(from, size)

  const others: SquareIndex[] = []
  for (let i = 0; i < board.length; i++) {
    if (i === from) continue
    const other = board[i]
    if (!other || other.type !== piece.type || other.color !== piece.color) {
      continue
    }
    if (legalMoves(position, i).includes(to)) others.push(i)
  }

  if (others.length === 0) return ''

  const sameFile = others.some(
    (square) => indexToFileRank(square, size).file === fromFile,
  )
  const sameRank = others.some(
    (square) => indexToFileRank(square, size).rank === fromRank,
  )

  if (!sameFile) return String.fromCharCode(97 + fromFile)
  if (!sameRank) return String(fromRank + 1)
  return `${String.fromCharCode(97 + fromFile)}${fromRank + 1}`
}

function checkSuffix(
  position: Position,
  from: SquareIndex,
  to: SquareIndex,
  promotion?: PromotionPiece,
): string {
  const piece = getPiece(position.board, from)
  if (!piece) return ''

  const next = applyPositionMove(position, from, to, promotion ?? 'queen')
  const opponent = opposite(piece.color)
  if (!isInCheck(next.board, opponent, next.size)) return ''
  if (!hasAnyLegalMove(next, opponent)) return '#'
  return '+'
}

/** Standard algebraic notation for the move list (with disambiguation). */
export function formatMoveLabel(
  position: Position,
  from: SquareIndex,
  to: SquareIndex,
  promotion?: PromotionPiece,
): string {
  const piece = getPiece(position.board, from)
  if (!piece) return '—'

  const { size } = position
  const { file: fromFile } = indexToFileRank(from, size)
  const { file: toFile } = indexToFileRank(to, size)
  const dest = indexToAlgebraic(to, size)
  const suffix = checkSuffix(position, from, to, promotion)

  if (piece.type === 'king' && Math.abs(toFile - fromFile) === 2) {
    return `${toFile > fromFile ? 'O-O' : 'O-O-O'}${suffix}`
  }

  const target = getPiece(position.board, to)
  const isEp =
    piece.type === 'pawn' &&
    position.enPassant !== null &&
    to === position.enPassant &&
    !target
  const capture = target !== null || isEp

  if (piece.type === 'pawn') {
    const fileLetter = String.fromCharCode(97 + fromFile)
    let label = capture ? `${fileLetter}x${dest}` : dest
    if (promotion) {
      label += `=${PIECE_LETTER[promotion] ?? 'Q'}`
    }
    return `${label}${suffix}`
  }

  const letter = PIECE_LETTER[piece.type] ?? '?'
  const disambig = disambiguator(position, from, to, piece)
  return `${letter}${disambig}${capture ? 'x' : ''}${dest}${suffix}`
}

export function pieceCapturedOnMove(
  position: Position,
  from: SquareIndex,
  to: SquareIndex,
): Piece | null {
  const mover = getPiece(position.board, from)
  if (!mover) return null

  const direct = getPiece(position.board, to)
  if (direct) return direct

  if (
    mover.type === 'pawn' &&
    position.enPassant !== null &&
    to === position.enPassant
  ) {
    const { size } = position
    const { file: toFile, rank: toRank } = indexToFileRank(to, size)
    const capturedRank = mover.color === 'white' ? toRank - 1 : toRank + 1
    return getPiece(position.board, toFile + capturedRank * size)
  }

  return null
}

export function boardSizeLabel(size: BoardSize): string {
  return `${size}×${size}`
}
