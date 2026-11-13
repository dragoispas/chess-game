export type Color = 'white' | 'black'

export type BoardSize = 6 | 8 | 10

export type PieceType =
  | 'pawn'
  | 'rook'
  | 'knight'
  | 'bishop'
  | 'queen'
  | 'king'
  | 'archbishop'
  | 'chancellor'
  | 'dragon'
  | 'centaur'

export type PromotionPiece = 'queen' | 'rook' | 'bishop' | 'knight'

/** A piece on the board. Location lives on the board index, not here. */
export type Piece = {
  type: PieceType
  color: Color
}

/** Board slot index: `file + rank * size`. Prefer coord helpers at call sites. */
export type SquareIndex = number

/**
 * Flat board, index 0 = a1 (file 0, rank 0), white at the bottom in the
 * standard view. Length is `size * size`.
 */
export type Board = (Piece | null)[]

/**
 * Start squares of kings and rooks that have not moved (or been captured)
 * since the position began. Used for castling eligibility.
 */
export type CastlingUnmoved = SquareIndex[]

export type GameStatus =
  | 'ongoing'
  | 'checkmate'
  | 'stalemate'
  | 'resigned'
  | 'timeout'

export type GameState = {
  board: Board
  size: BoardSize
  turn: Color
  castling: CastlingUnmoved
  /** Square skipped by a double pawn push, if the opponent may capture there. */
  enPassant: SquareIndex | null
  /** Whether the side to move is currently in check. */
  inCheck: boolean
  status: GameStatus
  /** Set when status is checkmate, resigned, or timeout. */
  winner: Color | null
}

/** Subset of state needed to generate / apply moves. */
export type Position = {
  board: Board
  size: BoardSize
  castling: CastlingUnmoved
  enPassant: SquareIndex | null
}

/** Serializable starting position for custom / classic games. */
export type BoardSetup = {
  board: Board
  size: BoardSize
  turn: Color
  castling: CastlingUnmoved
  enPassant: null
}

export type SetupIssue =
  | 'missing_white_king'
  | 'missing_black_king'
  | 'multiple_white_kings'
  | 'multiple_black_kings'
  | 'opponent_in_check'
  | 'checkmate'
  | 'stalemate'

export type LastMove = {
  from: SquareIndex
  to: SquareIndex
}
