import type { WebSocket } from 'ws'
import type {
  Board,
  BoardSetup,
  BoardSize,
  Color,
  GameState,
  LastMove,
  PromotionPiece,
  SquareIndex,
} from '../../../src/engine/types.ts'
import type { OnlineGameMode } from '../../../src/online/protocol.ts'
import type { TimeControl } from '../../../src/online/timeControls.ts'

export type Seat = {
  playerId: string
  color: Color
  socket: WebSocket | null
  /** Set when the seat's socket drops; used to pick which side to reclaim. */
  disconnectedAt: number | null
}

export type RoomPhase = 'waiting' | 'draft' | 'playing'

export type LiveRoom = {
  code: string
  gameId: string
  mode: OnlineGameMode
  phase: RoomPhase
  size: BoardSize
  setup: BoardSetup
  state: GameState
  hostPlayerId: string
  white: Seat | null
  black: Seat | null
  eventSeq: number
  lastMove: LastMove | null
  moveLog: Array<{
    from: SquareIndex
    to: SquareIndex
    promotion?: PromotionPiece
    moveLabel: string
  }>
  timeControl: TimeControl
  whiteMs: number
  blackMs: number
  /**
   * Wall-clock start of the current side's turn.
   * Null while paused: missing seat, before first move, or game over.
   */
  turnStartedAt: number | null
  draftWhite: Board
  draftBlack: Board
  whiteReady: boolean
  blackReady: boolean
}
