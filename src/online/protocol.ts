import type {
  Board,
  BoardSetup,
  BoardSize,
  Color,
  GameState,
  LastMove,
  PieceType,
  PromotionPiece,
  SquareIndex,
} from '../engine/types.ts'
import type { ClockSnapshot, TimeControlId } from './timeControls.ts'

export type OnlineGameMode = 'blind' | 'draft'

/** Messages the browser sends to the game server. */
export type ClientMessage =
  | { type: 'hello'; playerId: string }
  | {
      type: 'room:create'
      size: BoardSize
      timeControl: TimeControlId
      mode: OnlineGameMode
      /** Color the host sits as. Joiner takes the other seat. */
      preferredColor: Color
    }
  | { type: 'room:join'; code: string }
  | { type: 'room:leave' }
  | {
      type: 'draft:place'
      square: SquareIndex
      pieceType: PieceType | null
    }
  | { type: 'draft:clear' }
  | { type: 'draft:confirm' }
  | { type: 'draft:unconfirm' }
  | {
      type: 'move'
      from: SquareIndex
      to: SquareIndex
      promotion?: PromotionPiece
    }
  | { type: 'resign' }

export type SeatPresence = {
  whiteConnected: boolean
  blackConnected: boolean
}

/** Messages the game server sends to the browser. */
export type ServerMessage =
  | { type: 'hello:ok'; playerId: string }
  | {
      type: 'room:created'
      code: string
      gameId: string
      color: Color
      timeControl: TimeControlId
      mode: OnlineGameMode
    }
  | {
      type: 'room:joined'
      code: string
      gameId: string
      color: Color
      mode: OnlineGameMode
    }
  | {
      type: 'draft:state'
      code: string
      gameId: string
      you: Color
      size: BoardSize
      budget: number
      timeControl: TimeControlId
      board: Board
      youReady: boolean
      opponentReady: boolean
      waiting?: boolean
      seats: SeatPresence
    }
  | {
      type: 'room:ready'
      code: string
      gameId: string
      setup: BoardSetup
      state: GameState
      you: Color
      waiting?: boolean
      mode: OnlineGameMode
      clock: ClockSnapshot
      lastMove: LastMove | null
      moves: string[]
      plies: Array<{
        from: SquareIndex
        to: SquareIndex
        promotion?: PromotionPiece
      }>
      seats: SeatPresence
    }
  | {
      type: 'state'
      state: GameState
      lastMove: LastMove | null
      moveLabel?: string
      clock: ClockSnapshot
      seats: SeatPresence
    }
  | { type: 'error'; code: string; message: string }

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const data = JSON.parse(raw) as ClientMessage
    if (!data || typeof data !== 'object' || !('type' in data)) return null
    return data
  } catch {
    return null
  }
}
