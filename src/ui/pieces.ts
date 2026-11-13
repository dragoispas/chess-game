import type { Color, PieceType } from '../engine/types.ts'

import bA from '../assets/pieces/bA.svg'
import bB from '../assets/pieces/bB.svg'
import bC from '../assets/pieces/bC.svg'
import bD from '../assets/pieces/bD.svg'
import bK from '../assets/pieces/bK.svg'
import bN from '../assets/pieces/bN.svg'
import bP from '../assets/pieces/bP.svg'
import bQ from '../assets/pieces/bQ.svg'
import bR from '../assets/pieces/bR.svg'
import bS from '../assets/pieces/bS.svg'
import wA from '../assets/pieces/wA.svg'
import wB from '../assets/pieces/wB.svg'
import wC from '../assets/pieces/wC.svg'
import wD from '../assets/pieces/wD.svg'
import wK from '../assets/pieces/wK.svg'
import wN from '../assets/pieces/wN.svg'
import wP from '../assets/pieces/wP.svg'
import wQ from '../assets/pieces/wQ.svg'
import wR from '../assets/pieces/wR.svg'
import wS from '../assets/pieces/wS.svg'

/**
 * Cburnett chess SVGs (classic + fairy compounds).
 * Fairy codes: A=Amazon(dragon), a=Archbishop, c=Chancellor, C=Centaur.
 * Source: Wikimedia Commons / Cburnett (GFDL / CC BY-SA).
 */
export const pieceSprites: Record<Color, Record<PieceType, string>> = {
  white: {
    pawn: wP,
    rook: wR,
    knight: wN,
    bishop: wB,
    queen: wQ,
    king: wK,
    archbishop: wA,
    chancellor: wC,
    dragon: wD,
    centaur: wS,
  },
  black: {
    pawn: bP,
    rook: bR,
    knight: bN,
    bishop: bB,
    queen: bQ,
    king: bK,
    archbishop: bA,
    chancellor: bC,
    dragon: bD,
    centaur: bS,
  },
}
