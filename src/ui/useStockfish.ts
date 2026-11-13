import { useEffect, useRef } from 'react'
import { getPiece } from '../engine/board.ts'
import { gameToFen } from '../engine/fairy/fen.ts'
import {
  cancelStockfishSearch,
  getBestUciMove,
} from '../engine/fairy/engine.ts'
import { moveToUci, parseUciMove } from '../engine/fairy/uci.ts'
import { tryMove } from '../engine/game.ts'
import {
  isPromotionMove,
  legalMoves,
  toPosition,
} from '../engine/moves.ts'
import type {
  Color,
  GameState,
  PromotionPiece,
  SquareIndex,
} from '../engine/types.ts'

const PROMOTIONS: PromotionPiece[] = ['queen', 'rook', 'bishop', 'knight']

export type StockfishMove = {
  from: SquareIndex
  to: SquareIndex
  promotion?: PromotionPiece
}

function allLegalUci(game: GameState): string[] {
  const position = toPosition(game)
  const moves: string[] = []

  for (let from = 0; from < game.board.length; from++) {
    const piece = getPiece(game.board, from)
    if (!piece || piece.color !== game.turn) continue

    for (const to of legalMoves(position, from)) {
      if (isPromotionMove(piece, to, game.size)) {
        for (const promotion of PROMOTIONS) {
          moves.push(moveToUci(from, to, game.size, promotion))
        }
      } else {
        moves.push(moveToUci(from, to, game.size))
      }
    }
  }

  return moves
}

function randomLegalMove(game: GameState): StockfishMove | null {
  const uciMoves = allLegalUci(game)
  if (uciMoves.length === 0) return null
  const pick = uciMoves[Math.floor(Math.random() * uciMoves.length)]!
  return parseUciMove(pick, game.size)
}

/**
 * When `enabled`, requests a Fairy-Stockfish (or fallback) move whenever it
 * is `engineColor` to play, then calls `onMove`.
 */
export function useStockfish(options: {
  enabled: boolean
  game: GameState
  /** Side Stockfish plays. Default black. */
  engineColor?: Color
  onMove: (move: StockfishMove) => void
  onThinkingChange?: (thinking: boolean) => void
}): void {
  const {
    enabled,
    game,
    engineColor = 'black',
    onMove,
    onThinkingChange,
  } = options
  const onMoveRef = useRef(onMove)
  const thinkingRef = useRef(onThinkingChange)

  useEffect(() => {
    onMoveRef.current = onMove
    thinkingRef.current = onThinkingChange
  }, [onMove, onThinkingChange])

  useEffect(() => {
    if (!enabled) return
    if (game.status !== 'ongoing' || game.turn !== engineColor) return

    let cancelled = false
    thinkingRef.current?.(true)

    void (async () => {
      const searchmoves = allLegalUci(game)
      const fen = gameToFen(game)
      const best = await getBestUciMove({
        fen,
        size: game.size,
        searchmoves,
      })

      if (cancelled) return

      let move = best ? parseUciMove(best, game.size) : null
      if (move) {
        const applied = tryMove(game, move.from, move.to, move.promotion)
        if (applied.type !== 'moved') move = null
      }
      if (!move) {
        console.warn(
          '[fairy-stockfish] no usable engine move; falling back to a random legal move',
        )
        move = randomLegalMove(game)
      }
      if (!move || cancelled) {
        thinkingRef.current?.(false)
        return
      }

      thinkingRef.current?.(false)
      onMoveRef.current(move)
    })()

    return () => {
      cancelled = true
      cancelStockfishSearch()
      thinkingRef.current?.(false)
    }
  }, [enabled, engineColor, game])
}
