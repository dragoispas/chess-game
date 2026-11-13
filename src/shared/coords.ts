import type { BoardSize, Color, SquareIndex } from '../engine/types.ts'

export const BOARD_SIZES: BoardSize[] = [6, 8, 10]

export function squareCount(size: BoardSize): number {
  return size * size
}

export function fileRankToIndex(
  file: number,
  rank: number,
  size: BoardSize,
): SquareIndex {
  return file + rank * size
}

export function indexToFileRank(
  index: SquareIndex,
  size: BoardSize,
): { file: number; rank: number } {
  return {
    file: index % size,
    rank: Math.floor(index / size),
  }
}

export function inBounds(file: number, rank: number, size: BoardSize): boolean {
  return file >= 0 && file < size && rank >= 0 && rank < size
}

/** Algebraic like "e4" — useful for debugging / move lists. */
export function indexToAlgebraic(
  index: SquareIndex,
  size: BoardSize,
): string {
  const { file, rank } = indexToFileRank(index, size)
  return `${String.fromCharCode(97 + file)}${rank + 1}`
}

export function homeKingFile(size: BoardSize): number {
  return size / 2
}

export function backRank(color: Color, size: BoardSize): number {
  return color === 'white' ? 0 : size - 1
}

export function pawnStartRank(color: Color, size: BoardSize): number {
  return color === 'white' ? 1 : size - 2
}

export function promotionRank(color: Color, size: BoardSize): number {
  return color === 'white' ? size - 1 : 0
}
