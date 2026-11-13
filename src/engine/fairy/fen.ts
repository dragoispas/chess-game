import { getPiece } from '../board.ts'
import type { Color, GameState, Position, SquareIndex } from '../types.ts'
import { indexToFileRank } from '../../shared/coords.ts'
import { pieceToLetter, squareToUci } from './uci.ts'

function enPassantToken(
  enPassant: SquareIndex | null,
  size: GameState['size'],
): string {
  if (enPassant === null) return '-'
  return squareToUci(enPassant, size)
}

/**
 * Approximate FSF castling rights from our unmoved list.
 * Our castling rules differ; `searchmoves` keeps the game legal.
 */
function castlingToken(position: Position): string {
  const { board, size, castling } = position
  const unmoved = new Set(castling)
  let rights = ''

  for (const color of ['white', 'black'] as Color[]) {
    const back = color === 'white' ? 0 : size - 1
    let kingSq: SquareIndex | null = null
    const rookFiles: number[] = []

    for (let file = 0; file < size; file++) {
      const sq = file + back * size
      const piece = getPiece(board, sq)
      if (!piece || piece.color !== color) continue
      if (piece.type === 'king' && unmoved.has(sq)) kingSq = sq
      if (piece.type === 'rook' && unmoved.has(sq)) rookFiles.push(file)
    }

    if (kingSq === null || rookFiles.length === 0) continue
    const kingFile = indexToFileRank(kingSq, size).file
    const hasKingside = rookFiles.some((f) => f > kingFile)
    const hasQueenside = rookFiles.some((f) => f < kingFile)
    if (color === 'white') {
      if (hasKingside) rights += 'K'
      if (hasQueenside) rights += 'Q'
    } else {
      if (hasKingside) rights += 'k'
      if (hasQueenside) rights += 'q'
    }
  }

  return rights || '-'
}

/** Fairy-Stockfish FEN for the current position (no move clocks needed for search). */
export function positionToFen(
  position: Position,
  turn: Color,
): string {
  const { board, size } = position
  const ranks: string[] = []

  for (let rank = size - 1; rank >= 0; rank--) {
    let empty = 0
    let row = ''
    for (let file = 0; file < size; file++) {
      const piece = getPiece(board, file + rank * size)
      if (!piece) {
        empty += 1
        continue
      }
      if (empty > 0) {
        row += String(empty)
        empty = 0
      }
      row += pieceToLetter(piece.type, piece.color)
    }
    if (empty > 0) row += String(empty)
    ranks.push(row)
  }

  const side = turn === 'white' ? 'w' : 'b'
  return `${ranks.join('/')} ${side} ${castlingToken(position)} ${enPassantToken(position.enPassant, size)} 0 1`
}

export function gameToFen(game: GameState): string {
  return positionToFen(
    {
      board: game.board,
      size: game.size,
      castling: game.castling,
      enPassant: game.enPassant,
    },
    game.turn,
  )
}
