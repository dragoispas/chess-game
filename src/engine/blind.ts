import {
  ALL_PIECES,
  draftBudgetForSize,
  pieceCost,
} from './catalog.ts'
import { getPiece } from './board.ts'
import { createGame, tryMove } from './game.ts'
import {
  initialCastlingUnmoved,
  isInCheck,
  legalMoves,
  toPosition,
} from './moves.ts'
import { classicSetup, emptyBoard, validateSetup } from './setup.ts'
import type {
  Board,
  BoardSetup,
  BoardSize,
  PieceType,
  PromotionPiece,
  SquareIndex,
} from './types.ts'
import { fileRankToIndex, indexToFileRank } from '../shared/coords.ts'

const MAX_ATTEMPTS = 300

const PROMOTIONS: PromotionPiece[] = ['queen', 'rook', 'bishop', 'knight']

/** Non-pawn, non-king pieces eligible for the back rank. */
const OFFICERS = ALL_PIECES.filter(
  (entry) => entry.id !== 'king' && entry.id !== 'pawn',
)

const MEDIUM_TYPES: PieceType[] = ['knight', 'bishop', 'rook', 'centaur']

type ArmyCounts = Record<PieceType, number>

function emptyCounts(): ArmyCounts {
  return {
    king: 0,
    pawn: 0,
    knight: 0,
    bishop: 0,
    rook: 0,
    queen: 0,
    archbishop: 0,
    chancellor: 0,
    dragon: 0,
    centaur: 0,
  }
}

function canAddOfficer(type: PieceType, counts: ArmyCounts): boolean {
  if (type === 'queen' && counts.queen >= 1) return false
  if (type === 'dragon' && counts.dragon >= 1) return false
  if (
    (type === 'archbishop' || type === 'chancellor') &&
    counts.archbishop + counts.chancellor >= 2
  ) {
    return false
  }
  if (type === 'rook' && counts.rook >= 3) return false
  if (type === 'centaur' && counts.centaur >= 3) return false
  return true
}

function shuffle<T>(items: T[]): T[] {
  const next = items.slice()
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  return next
}

function pickWeighted(
  options: { id: PieceType; cost: number }[],
): PieceType | null {
  if (options.length === 0) return null
  let total = 0
  const weights = options.map((entry) => {
    const w = 1 / entry.cost
    total += w
    return w
  })
  let roll = Math.random() * total
  for (let i = 0; i < options.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return options[i]!.id
  }
  return options[options.length - 1]!.id
}

function squaresOnRanks(size: BoardSize, ranks: number[]): SquareIndex[] {
  const out: SquareIndex[] = []
  for (const rank of ranks) {
    for (let file = 0; file < size; file++) {
      out.push(fileRankToIndex(file, rank, size))
    }
  }
  return out
}

function mirrorSquare(square: SquareIndex, size: BoardSize): SquareIndex {
  const { file, rank } = indexToFileRank(square, size)
  return fileRankToIndex(file, size - 1 - rank, size)
}

function placeMirrored(
  board: Board,
  square: SquareIndex,
  type: PieceType,
  size: BoardSize,
): void {
  board[square] = { type, color: 'white' }
  board[mirrorSquare(square, size)] = { type, color: 'black' }
}

/**
 * Spend the post-pawn budget on back-rank officers only.
 * At most `size - 1` pieces (king already claims one back-rank square).
 */
function rollOfficers(size: BoardSize): PieceType[] | null {
  const budget = draftBudgetForSize(size) - size
  if (budget < 0) return null

  const maxOfficers = size - 1
  const counts = emptyCounts()
  const officers: PieceType[] = []
  let remaining = budget

  function add(type: PieceType): boolean {
    const cost = pieceCost(type)
    if (cost > remaining) return false
    if (officers.length >= maxOfficers) return false
    if (!canAddOfficer(type, counts)) return false
    officers.push(type)
    counts[type] += 1
    remaining -= cost
    return true
  }

  function candidates(
    predicate: (type: PieceType, cost: number) => boolean = () => true,
  ) {
    return OFFICERS.filter((entry) => {
      if (!predicate(entry.id, entry.cost)) return false
      if (entry.cost > remaining) return false
      if (!canAddOfficer(entry.id, counts)) return false
      return true
    }).map((entry) => ({ id: entry.id, cost: entry.cost }))
  }

  // Seed 1–2 medium pieces when budget allows.
  const seedCount = 1 + (Math.random() < 0.5 ? 1 : 0)
  for (let i = 0; i < seedCount; i++) {
    const mediums = candidates((type) => MEDIUM_TYPES.includes(type))
    const pick = pickWeighted(mediums)
    if (!pick) break
    add(pick)
  }

  while (remaining > 0 && officers.length < maxOfficers) {
    const options = candidates()
    const pick = pickWeighted(options)
    if (!pick) break
    if (!add(pick)) break
  }

  if (remaining > 0 && officers.length < maxOfficers) {
    const exact = candidates((_type, cost) => cost === remaining)
    const pick = pickWeighted(exact)
    if (pick) add(pick)
  }

  if (remaining !== 0) return null
  if (officers.length === 0) return null
  return officers
}

function whiteHasMateInOne(setup: BoardSetup): boolean {
  const state = createGame(setup)
  if (state.status !== 'ongoing' || state.turn !== 'white') return false

  const position = toPosition(state)

  for (let from = 0; from < state.board.length; from++) {
    const piece = getPiece(state.board, from)
    if (!piece || piece.color !== 'white') continue

    for (const to of legalMoves(position, from)) {
      const direct = tryMove(state, from, to)
      if (direct.type === 'moved' && direct.state.status === 'checkmate') {
        return true
      }
      if (direct.type === 'needs-promotion') {
        for (const promotion of PROMOTIONS) {
          const promoted = tryMove(state, from, to, promotion)
          if (
            promoted.type === 'moved' &&
            promoted.state.status === 'checkmate'
          ) {
            return true
          }
        }
      }
    }
  }
  return false
}

/**
 * Full second rank of pawns; back rank = king + random officers
 * (no pawns on the back rank). Mirrored to Black.
 */
function tryGenerateOnce(size: BoardSize): BoardSetup | null {
  const board = emptyBoard(size)
  const pawnRank = squaresOnRanks(size, [1])
  const backRank = squaresOnRanks(size, [0])

  for (const square of pawnRank) {
    placeMirrored(board, square, 'pawn', size)
  }

  const officers = rollOfficers(size)
  if (!officers) return null

  const slots = shuffle(backRank)
  const kingSquare = slots[0]!
  placeMirrored(board, kingSquare, 'king', size)

  for (let i = 0; i < officers.length; i++) {
    const square = slots[i + 1]
    if (square === undefined) return null
    placeMirrored(board, square, officers[i]!, size)
  }

  const setup: BoardSetup = {
    board,
    size,
    turn: 'white',
    castling: initialCastlingUnmoved(board),
    enPassant: null,
  }

  if (validateSetup(setup).length > 0) return null
  if (isInCheck(board, 'white', size)) return null
  if (whiteHasMateInOne(setup)) return null

  return setup
}

function fallbackBlind(size: BoardSize): BoardSetup {
  if (size === 8) return classicSetup()
  const board = emptyBoard(size)
  const mid = Math.floor(size / 2)
  placeMirrored(board, fileRankToIndex(mid, 0, size), 'king', size)
  for (let file = 0; file < size; file++) {
    placeMirrored(board, fileRankToIndex(file, 1, size), 'pawn', size)
  }
  return {
    board,
    size,
    turn: 'white',
    castling: initialCastlingUnmoved(board),
    enPassant: null,
  }
}

/** Random mirrored armies for the given size, with fairness filters. */
export function generateBlindSetup(size: BoardSize = 8): BoardSetup {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const setup = tryGenerateOnce(size)
    if (setup) return setup
  }
  return fallbackBlind(size)
}

function placeBlackOnly(
  board: Board,
  square: SquareIndex,
  type: PieceType,
): void {
  board[square] = { type, color: 'black' }
}

function tryIndependentBlackArmy(size: BoardSize): Board | null {
  const board = emptyBoard(size)
  const pawnRank = squaresOnRanks(size, [size - 2])
  const backRank = squaresOnRanks(size, [size - 1])

  for (const square of pawnRank) {
    placeBlackOnly(board, square, 'pawn')
  }

  const officers = rollOfficers(size)
  if (!officers) return null

  const slots = shuffle(backRank)
  placeBlackOnly(board, slots[0]!, 'king')
  for (let i = 0; i < officers.length; i++) {
    const square = slots[i + 1]
    if (square === undefined) return null
    placeBlackOnly(board, square, officers[i]!)
  }
  return board
}

function fallbackBlackArmy(size: BoardSize): Board {
  const board = emptyBoard(size)
  const mid = Math.floor(size / 2)
  placeBlackOnly(board, fileRankToIndex(mid, size - 1, size), 'king')
  for (let file = 0; file < size; file++) {
    placeBlackOnly(board, fileRankToIndex(file, size - 2, size), 'pawn')
  }
  return board
}

/**
 * Independent Black army: full pawn rank + king/officers on the back rank.
 * Retries until the merged setup is legal vs the given White half.
 */
export function generateIndependentBlackArmy(
  size: BoardSize,
  whiteBoard?: Board,
): Board {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const black = tryIndependentBlackArmy(size)
    if (!black) continue

    if (!whiteBoard) {
      if (isInCheck(black, 'black', size)) continue
      return black
    }

    const merged: BoardSetup = {
      board: emptyBoard(size),
      size,
      turn: 'white',
      castling: [],
      enPassant: null,
    }
    for (let i = 0; i < merged.board.length; i++) {
      if (whiteBoard[i]?.color === 'white') merged.board[i] = whiteBoard[i]
      if (black[i]?.color === 'black') merged.board[i] = black[i]
    }
    merged.castling = initialCastlingUnmoved(merged.board)
    if (validateSetup(merged).length > 0) continue
    if (whiteHasMateInOne(merged)) continue
    return black
  }

  return fallbackBlackArmy(size)
}

function placeWhiteOnly(
  board: Board,
  square: SquareIndex,
  type: PieceType,
): void {
  board[square] = { type, color: 'white' }
}

function tryIndependentWhiteArmy(size: BoardSize): Board | null {
  const board = emptyBoard(size)
  const pawnRank = squaresOnRanks(size, [1])
  const backRank = squaresOnRanks(size, [0])

  for (const square of pawnRank) {
    placeWhiteOnly(board, square, 'pawn')
  }

  const officers = rollOfficers(size)
  if (!officers) return null

  const slots = shuffle(backRank)
  placeWhiteOnly(board, slots[0]!, 'king')
  for (let i = 0; i < officers.length; i++) {
    const square = slots[i + 1]
    if (square === undefined) return null
    placeWhiteOnly(board, square, officers[i]!)
  }
  return board
}

function fallbackWhiteArmy(size: BoardSize): Board {
  const board = emptyBoard(size)
  const mid = Math.floor(size / 2)
  placeWhiteOnly(board, fileRankToIndex(mid, 0, size), 'king')
  for (let file = 0; file < size; file++) {
    placeWhiteOnly(board, fileRankToIndex(file, 1, size), 'pawn')
  }
  return board
}

/**
 * Independent White army for when the human drafts Black vs Stockfish.
 */
export function generateIndependentWhiteArmy(
  size: BoardSize,
  blackBoard?: Board,
): Board {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const white = tryIndependentWhiteArmy(size)
    if (!white) continue

    if (!blackBoard) {
      if (isInCheck(white, 'white', size)) continue
      return white
    }

    const merged: BoardSetup = {
      board: emptyBoard(size),
      size,
      turn: 'white',
      castling: [],
      enPassant: null,
    }
    for (let i = 0; i < merged.board.length; i++) {
      if (white[i]?.color === 'white') merged.board[i] = white[i]
      if (blackBoard[i]?.color === 'black') merged.board[i] = blackBoard[i]
    }
    merged.castling = initialCastlingUnmoved(merged.board)
    if (validateSetup(merged).length > 0) continue
    if (whiteHasMateInOne(merged)) continue
    return white
  }

  return fallbackWhiteArmy(size)
}
