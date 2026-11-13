import { createGame, tryMove } from '../engine/game.ts'
import { toPosition } from '../engine/moves.ts'
import { pieceCapturedOnMove } from '../engine/notation.ts'
import type {
  BoardSetup,
  Piece,
  PromotionPiece,
  SquareIndex,
} from '../engine/types.ts'

export type ReplayPly = {
  from: SquareIndex
  to: SquareIndex
  promotion?: PromotionPiece
}

export function rebuildCapturesFromPlies(
  setup: BoardSetup,
  plies: ReplayPly[],
): { capturedByWhite: Piece[]; capturedByBlack: Piece[] } {
  let state = createGame(setup)
  const capturedByWhite: Piece[] = []
  const capturedByBlack: Piece[] = []

  for (const ply of plies) {
    const position = toPosition(state)
    const captured = pieceCapturedOnMove(position, ply.from, ply.to)
    if (captured) {
      if (captured.color === 'black') capturedByWhite.push(captured)
      else capturedByBlack.push(captured)
    }
    const result = tryMove(state, ply.from, ply.to, ply.promotion)
    if (result.type !== 'moved') break
    state = result.state
  }

  return { capturedByWhite, capturedByBlack }
}
