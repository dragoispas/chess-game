import type { BoardSize, Color, PieceType, SquareIndex } from './types.ts'
import { indexToFileRank } from '../shared/coords.ts'

export type PieceCatalogEntry = {
  id: PieceType
  name: string
  blurb: string
  /** Point cost for Point Draft mode. King is free but required. */
  cost: number
}

/** Base budget for 8×8 (classic material sans king). Scales with board size. */
export const DRAFT_BUDGET_8 = 39

/** Point budget for a side on a given board size (linear in size vs 8). */
export function draftBudgetForSize(size: BoardSize): number {
  return Math.round((DRAFT_BUDGET_8 * size) / 8)
}

/** @deprecated Prefer draftBudgetForSize — kept as 8×8 default. */
export const DRAFT_BUDGET = DRAFT_BUDGET_8

/** Classic pieces shown in the main editor palette. */
export const CLASSIC_PIECES: PieceCatalogEntry[] = [
  { id: 'king', name: 'King', blurb: 'One step any direction', cost: 0 },
  { id: 'queen', name: 'Queen', blurb: 'Rook or bishop', cost: 9 },
  { id: 'rook', name: 'Rook', blurb: 'Orthogonal slides', cost: 5 },
  { id: 'bishop', name: 'Bishop', blurb: 'Diagonal slides', cost: 3 },
  { id: 'knight', name: 'Knight', blurb: 'L-shaped leap', cost: 3 },
  { id: 'pawn', name: 'Pawn', blurb: 'Forward; captures diagonal', cost: 1 },
]

/**
 * Compound fairy pieces for the Expansion palette. Not royal.
 *
 * Costs vs classic anchors (N/B=3, R=5, Q=9), Capablanca-style:
 * - Centaur (KN) beats a rook up close → above R
 * - Archbishop (BN) ≈ minor+minor with leap synergy → under RN/Q
 * - Chancellor (RN) ≈ queen territory
 * - Dragon (QN) clearly above queen
 */
export const EXPANSION_PIECES: PieceCatalogEntry[] = [
  { id: 'archbishop', name: 'Archbishop', blurb: 'Bishop or knight', cost: 8 },
  { id: 'chancellor', name: 'Chancellor', blurb: 'Rook or knight', cost: 9 },
  { id: 'dragon', name: 'Dragon', blurb: 'Queen or knight', cost: 13 },
  { id: 'centaur', name: 'Centaur', blurb: 'King or knight', cost: 7 },
]

export const ALL_PIECES: PieceCatalogEntry[] = [
  ...CLASSIC_PIECES,
  ...EXPANSION_PIECES,
]

const COST_BY_TYPE: Record<PieceType, number> = Object.fromEntries(
  ALL_PIECES.map((entry) => [entry.id, entry.cost]),
) as Record<PieceType, number>

export function pieceCost(type: PieceType): number {
  return COST_BY_TYPE[type] ?? 0
}

/** White drafts the lower half; black the upper half. */
export function isDraftSquare(
  color: Color,
  square: SquareIndex,
  size: BoardSize = 8,
): boolean {
  const { rank } = indexToFileRank(square, size)
  const mid = size / 2
  return color === 'white' ? rank < mid : rank >= mid
}
