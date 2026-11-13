import type {
  BoardSize,
  PieceType,
  PromotionPiece,
  SquareIndex,
} from '../types.ts'
import { indexToFileRank } from '../../shared/coords.ts'

/** FSF / FEN letter for each of our piece types (lowercase). */
export const PIECE_TO_LETTER: Record<PieceType, string> = {
  pawn: 'p',
  rook: 'r',
  knight: 'n',
  bishop: 'b',
  queen: 'q',
  king: 'k',
  archbishop: 'a',
  chancellor: 'c',
  dragon: 'd',
  centaur: 's',
}

const LETTER_TO_PIECE: Record<string, PieceType> = Object.fromEntries(
  Object.entries(PIECE_TO_LETTER).map(([type, letter]) => [letter, type as PieceType]),
)

const PROMO_LETTER: Record<PromotionPiece, string> = {
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
}

const LETTER_TO_PROMO: Record<string, PromotionPiece> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
}

export function variantNameForSize(size: BoardSize): string {
  return `interview${size}`
}

export function squareToUci(square: SquareIndex, size: BoardSize): string {
  const { file, rank } = indexToFileRank(square, size)
  return `${String.fromCharCode(97 + file)}${rank + 1}`
}

export function uciToSquare(token: string, size: BoardSize): SquareIndex | null {
  const match = /^([a-z]+)(\d+)$/i.exec(token)
  if (!match) return null
  const fileChars = match[1]!.toLowerCase()
  const rank = Number(match[2]) - 1
  if (fileChars.length !== 1) return null
  const file = fileChars.charCodeAt(0) - 97
  if (file < 0 || file >= size || rank < 0 || rank >= size) return null
  return file + rank * size
}

export function moveToUci(
  from: SquareIndex,
  to: SquareIndex,
  size: BoardSize,
  promotion?: PromotionPiece,
): string {
  const base = `${squareToUci(from, size)}${squareToUci(to, size)}`
  return promotion ? `${base}${PROMO_LETTER[promotion]}` : base
}

export type ParsedUciMove = {
  from: SquareIndex
  to: SquareIndex
  promotion?: PromotionPiece
}

export function parseUciMove(
  uci: string,
  size: BoardSize,
): ParsedUciMove | null {
  const trimmed = uci.trim().toLowerCase()
  if (trimmed.length < 4) return null

  // Rank can be 10 on a 10×10 board → from/to lengths vary.
  // Match: file + rank + file + rank + optional promo.
  const match = /^([a-z])(\d+)([a-z])(\d+)([qrbn])?$/.exec(trimmed)
  if (!match) return null

  const fromFile = match[1]!.charCodeAt(0) - 97
  const fromRank = Number(match[2]) - 1
  const toFile = match[3]!.charCodeAt(0) - 97
  const toRank = Number(match[4]) - 1
  if (
    fromFile < 0 ||
    fromFile >= size ||
    toFile < 0 ||
    toFile >= size ||
    fromRank < 0 ||
    fromRank >= size ||
    toRank < 0 ||
    toRank >= size
  ) {
    return null
  }

  const from = fromFile + fromRank * size
  const to = toFile + toRank * size
  const promoLetter = match[5]
  const promotion = promoLetter ? LETTER_TO_PROMO[promoLetter] : undefined
  return { from, to, promotion }
}

export function letterToPiece(letter: string): PieceType | null {
  return LETTER_TO_PIECE[letter.toLowerCase()] ?? null
}

export function pieceToLetter(type: PieceType, color: 'white' | 'black'): string {
  const letter = PIECE_TO_LETTER[type]
  return color === 'white' ? letter.toUpperCase() : letter
}
