# Fairy-Stockfish pieces

Reference for how [Fairy-Stockfish](https://github.com/fairy-stockfish/Fairy-Stockfish) defines pieces, and how this app maps its expansion set onto the engine.

## How pieces are defined

Fairy-Stockfish loads variants from an INI-style config (`variants.ini`). Each variant:

1. Names a section (optionally inheriting a parent), e.g. `[interview8:chess]`.
2. Assigns **letters** to **predefined piece types** (or custom Betza pieces).
3. Sets board size, promotion, castling, etc.

Predefined types use [Betza notation](https://www.gnu.org/software/xboard/Betza.html). Compounds are written as letter fusion, e.g. `BN` = bishop + knight.

Custom variants for this app live in [`src/engine/fairy/variants.ini`](../src/engine/fairy/variants.ini) and are loaded into the WASM engine at runtime via Fairy’s `load` command (MEMFS file path, with heredoc `load <<EOF` as fallback). After load, the bridge re-runs `uci` and requires `interview6` / `interview8` / `interview10` to appear in `UCI_Variant` before play.

## Built-in piece types (selection)

| FSF type | Betza | Meaning |
| --- | --- | --- |
| pawn | fmWfceF | Standard pawn |
| knight | N | Knight |
| bishop | B | Bishop |
| rook | R | Rook |
| queen | Q | Queen |
| king | K | King |
| archbishop | BN | Bishop + knight (princess / cardinal) |
| chancellor | RN | Rook + knight (empress / marshall) |
| amazon | QN | Queen + knight |
| centaur | KN | King + knight |
| bers | RF | Rook + fers (often called “dragon” in shogi-adjacent sets) |
| dragonHorse | BW | Bishop + wazir |
| commoner | K | Non-royal king moves |
| wazir | W | One orthogonal step |
| fers | F | One diagonal step |
| alfil | A | (2,2) leap |
| silver | FfW | Shogi silver |
| gold | WfF | Shogi gold |
| cannon | mRcpR | Xiangqi cannon |

Full list: Fairy-Stockfish `variants.ini` header (“See the list below for all available predefined piece types”).

## Our current mapping (authoritative)

These letters are what the AI bridge writes into FEN / UCI for the pieces we ship today:

| Our type | FSF type | FEN letter | Moves |
| --- | --- | --- | --- |
| pawn | pawn | `p` | Standard |
| rook | rook | `r` | Standard |
| knight | knight | `n` | Standard |
| bishop | bishop | `b` | Standard |
| queen | queen | `q` | Standard |
| king | king | `k` | Standard |
| archbishop | archbishop | `a` | Bishop + knight |
| chancellor | chancellor | `c` | Rook + knight |
| dragon | amazon | `d` | Queen + knight |
| centaur | centaur | `s` | King + knight |

Variants: `interview6`, `interview8`, `interview10` (board size = max file/rank).

## Adding a piece later

1. Document it here (our name, FSF type or custom Betza, proposed FEN letter).
2. Add it to the engine catalog / move generator / sprites.
3. Extend `variants.ini` with the new letter and rebuild the bridge tables in `src/engine/fairy/uci.ts`.
