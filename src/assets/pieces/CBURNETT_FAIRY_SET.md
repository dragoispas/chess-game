# Cburnett extended fairy piece set

Reference for SVG icons available with the Cburnett chess set on
[Wikimedia Commons — Template:SVG chess pieces](https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces).

## File naming

Files are named `Chess_XYZ45.svg`:

| Letter | Meaning |
|--------|---------|
| 1st (`X`) | Piece type code (see tables below) |
| 2nd (`Y`) | `l` = white (light), `d` = black (dark) |
| 3rd (`Z`) | `t` = transparent background (preferred for our UI) |

Example: `Chess_alt45.svg` = white Archbishop, transparent background.

License: GFDL and/or CC BY-SA (see each Commons file page). Keep credit in `ATTRIBUTION.md`.

---

## Classic pieces (already used)

| Piece | Code | Our `PieceType` | Moves |
|-------|------|-----------------|-------|
| King | `k` | `king` | 1 any direction (royal) |
| Queen | `q` | `queen` | Rook or bishop |
| Rook | `r` | `rook` | Orthogonal slides |
| Bishop | `b` | `bishop` | Diagonal slides |
| Knight | `n` | `knight` | (1,2) leap |
| Pawn | `p` | `pawn` | Forward; capture diagonal |

Rotated classic icons also exist (`f` king, `g` queen, `m` rook, `B` bishop, `N` knight, `h` pawn) — useful for inverted pieces, not new unit types.

---

## Fairy pieces — in our game now

| Piece | Code | Our `PieceType` | Moves (Betza) |
|-------|------|-----------------|---------------|
| Archbishop | `a` | `archbishop` | Bishop + knight (`BN`) |
| Chancellor | `c` | `chancellor` | Rook + knight (`RN`) |
| Amazon | `A` | `dragon` | Queen + knight (`QN`) — named “Dragon” in our catalog |
| Centaur | `C` | `centaur` | King + knight (`KN`), not royal |

Asset files: `wA`/`bA`, `wC`/`bC`, `wD`/`bD` (Amazon), `wS`/`bS` (Centaur).

---

## Fairy pieces — available in the set (not wired yet)

| Piece | Code | Typical moves | Notes |
|-------|------|---------------|-------|
| Ferz | `F` | 1 diagonal (`F`) | Ancient “bishop”; xiangqi advisor family |
| Wazir | `W` | 1 orthogonal (`W`) | Ancient “rook” step |
| Dabbaba | `v` | Leap 2 orthogonal (`D`) | |
| Elephant (Alfil) | `e` | Leap 2 diagonal (`A`) | Not the xiangqi elephant |
| Giraffe | `G` | (1,4) leap | |
| Unicorn | `U` | Variant-dependent | Often 3D unicorn or diagonal nightrider — confirm before implementing |
| Zebra | `Z` | (2,3) leap | |
| Nightrider | `K` | Repeat knight leaps in a line (`NN`) | Strong fairy rider |
| Mann | `M` | Non-royal king (`K`) | Same steps as king, not royal |
| Commoner | `x` | Non-royal king (`K`) | Same idea as Mann; separate glyph |
| Champion | `z` | Wazir + dabbaba + alfil | Omega Chess–style |
| Wizard | `w` | Ferz + camel `(1,3)` | Omega Chess–style |
| Fool | `t` | Variant-dependent | Confirm rules before adding |
| Dragon | `D` | **Not** the same as our Amazon | Separate glyph; fairy “dragon” meanings vary |
| Short rook | `S` | Limited-range rook | |
| Boat / Ship | `s` | Xiangqi-style boat (often) | Some Commons variants incomplete |

### Colored variants

Some fairy icons also exist in green / red / yellow / blue (3rd letter still `t`, or other background codes). We use black/white transparent only.

---

## Suggested next adds (rules + Fairy-Stockfish friendly)

Good candidates for Point Draft expansion:

1. **Ferz** / **Wazir** — simple steppers  
2. **Commoner (Mann)** — non-royal king  
3. **Elephant (Alfil)** / **Dabbaba** — short leapers  
4. **Nightrider** — distinctive rider  
5. **Champion** / **Wizard** — Omega Chess compounds  

---

## Sources

- Icon table: https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces  
- Fairy piece encyclopedia: https://en.wikipedia.org/wiki/List_of_fairy_chess_pieces  
- Engine piece names (for later wiring): Fairy-Stockfish `variants.ini`
