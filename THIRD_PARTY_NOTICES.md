# Third-party notices

This project includes software and artwork under separate licenses. Those
licenses still apply. This file is for attribution and compliance navigation.

## Fairy-Stockfish (WASM)

- Package: `fairy-stockfish-nnue.wasm`
- Upstream: https://github.com/fairy-stockfish/Fairy-Stockfish  
  WASM port: https://github.com/fairy-stockfish/fairy-stockfish.wasm
- License: **GNU GPL v3** — full text: `public/licenses/fairy-stockfish/COPYING.txt`
- Authors: `public/licenses/fairy-stockfish/AUTHORS`

**Source offer:** Corresponding source for the shipped WASM build is described
in `public/licenses/SOURCE_OFFER.md` (also served at `/licenses/SOURCE_OFFER.md`).
Upstream repositories and the npm package contents provide that source. If you
redistribute this app, keep the GPL license files with the Stockfish binaries
and preserve this notice.

## Piece artwork (Cburnett / Commons)

- Classic and fairy chess SVGs derived from **Cburnett** icons on
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/Template:SVG_chess_pieces)
- Typical terms: **GFDL** and/or **CC BY-SA** (check each file’s Commons page)
- Local inventory & codes: `src/assets/pieces/ATTRIBUTION.md`,
  `src/assets/pieces/CBURNETT_FAIRY_SET.md`

Required practice for our use:

1. Credit Cburnett / Wikimedia Commons (Credits screen + this file).
2. If SVG artwork is modified and redistributed, keep a compatible share-alike
   license on those art files.

## Other runtime / build dependencies

Major libraries (non-exhaustive; see `package-lock.json` for the full tree):

| Package | License (as declared on npm) |
|---------|------------------------------|
| `react`, `react-dom` | MIT |
| `vite` | MIT |
| `ws` | MIT |
| `hono`, `@hono/node-server` | MIT |
| `drizzle-orm` | Apache-2.0 |
| `better-sqlite3` | MIT |

Their license texts ship inside `node_modules/<package>/`.
