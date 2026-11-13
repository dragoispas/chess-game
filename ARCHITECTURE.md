# Architecture & technical notes

Product overview and how to play: see [`README.md`](./README.md).

---

## High level

```text
┌─────────────────────────────┐     WebSocket JSON      ┌──────────────────────────┐
│  Vite + React client        │ ◄─────────────────────► │  Node HTTP + ws server   │
│  src/                       │   (online play only)    │  server/src/             │
│                             │                         │                          │
│  • Pure TS chess engine     │                         │  • Live rooms (in memory)│
│  • UI screens               │                         │  • Same engine for moves │
│  • Fairy-Stockfish WASM     │                         │  • SQLite via Drizzle    │
└─────────────────────────────┘                         └──────────────────────────┘
```

**Important splits**

1. **Engine is pure TypeScript** (`src/engine/`) — no React, no Node APIs. The browser and the server both import it for legal moves, checkmate, draft validation, Blind generation, etc.
2. **Online authority lives on the server.** Clients send intents (`move`, `draft:place`, …); the server validates with the engine and broadcasts `state` / `draft:state`.
3. **Stockfish never runs on the server.** It loads as WASM in the browser (`public/fairy-stockfish/`). Local/Stockfish games need no backend.
4. **Single package.** One `package.json`, one git root (`chess-game/`). Frontend and server deploy from the same repo to different hosts if needed.

Local / Stockfish need the engine in the FE for offline play and instant move highlights. Online also needs it on the server so clients can’t cheat or desync.

---

## Repo layout

```text
chess-game/
├── src/
│   ├── App.tsx                 # Nav + play/sandbox phase machine
│   ├── main.tsx
│   ├── engine/                 # Pure rules + setups
│   │   ├── types.ts            # Board, Piece, GameState, BoardSize, …
│   │   ├── board.ts
│   │   ├── moves.ts            # Legal moves, check, castling, EP
│   │   ├── game.ts             # tryMove, resign, timeout, createGame
│   │   ├── setup.ts            # Empty/classic setups, validation
│   │   ├── catalog.ts          # Piece costs, draft half rules, budgets
│   │   ├── draft.ts            # Draft place/clear/finalize helpers
│   │   ├── blind.ts            # Blind + army generators
│   │   ├── notation.ts
│   │   ├── variants/classic.ts
│   │   └── fairy/              # FEN / UCI bridge for Stockfish
│   ├── online/                 # Client networking helpers
│   │   ├── protocol.ts         # Shared ClientMessage / ServerMessage
│   │   ├── socket.ts           # WebSocket wrapper + VITE_WS_URL
│   │   ├── playerId.ts         # Guest id in sessionStorage
│   │   ├── activeOnline.ts     # Resume room codes (localStorage)
│   │   ├── timeControls.ts
│   │   └── rebuildCaptures.ts
│   ├── shared/coords.ts        # file/rank ↔ index (6/8/10)
│   └── ui/                     # Screens + Board + pieces
├── server/
│   └── src/
│       ├── index.ts            # HTTP /health + WebSocketServer
│       ├── roomManager.ts      # Re-exports public room API
│       ├── rooms/              # Seating, clocks, draft, play, persist
│       └── db/                 # better-sqlite3 + Drizzle schema
├── public/
│   ├── fairy-stockfish/        # Copied WASM build (postinstall)
│   ├── licenses/
│   └── privacy.md
├── data/                       # chess.sqlite (gitignored)
├── Dockerfile                  # Production API image
├── docs/
└── package.json
```

---

## Libraries & toolchain

| Layer | Choice | Role |
|-------|--------|------|
| UI | React 19 + TypeScript | Screens and board interaction |
| Bundler | Vite 8 (`@vitejs/plugin-react`) | Dev server, build, COOP/COEP headers for WASM threads |
| Lint | Oxlint | Fast lint (`npm run lint`) |
| Engine AI | `fairy-stockfish-nnue.wasm` | Browser opponent |
| Server runtime | Node `http` + `ws` | Long-lived WebSockets |
| HTTP helper | Hono / `@hono/node-server` | Present in deps; WS server is plain `http` + `ws` today |
| DB | `better-sqlite3` + Drizzle ORM | Persist games, events, rooms, players |
| Dev | `tsx watch`, `concurrently` | `npm run dev` runs Vite + API together |
| Prod API | `tsx` (no watch) / Docker | `npm start` — see `Dockerfile` |

**Not used:** Redux/Zustand, React Router, an ORM-backed realtime sync layer. Navigation and play flow are local React state in `App.tsx`.

---

## Client state

### App shell (`App.tsx`)

Top-level React state drives which screen is mounted:

- `nav`: `play` | `sandbox` | `credits`
- Play: `playPhase` (`menu` → `draft` / `blind-game` / `online-lobby` → …)
- Chosen `playSize`, `playOpponent`, `playAs`, `playSetup`
- Online: `onlineIntent`, then `onlineDraft` or `onlineSession` (includes the live socket)
- Sandbox: editor ↔ game with its own setup

Leaving Play (or hitting Back) closes the socket and clears online session state.

### Local / Stockfish games (`GameScreen`)

- History is an **append-only snapshot stack** (`game`, moves, captures, last move).
- Undo pops one ply (or two vs Stockfish after the engine reply).
- Stockfish side is controlled by `playAs` / `engineColor` via `useStockfish`.
- No server involvement.

### Draft (local)

- `DraftScreen` holds white/black boards, phase (`white` | `handoff` | `black`), palette selection.
- Vs Stockfish, the board starts from a **standard setup**; the human edits `playAs`, Stockfish keeps the standard other half.

### Online client

- `OnlineLobby` opens a socket, sends `room:create` / `room:join`, waits for `draft:state` or `room:ready`, then hands off to `OnlineDraftScreen` or `OnlineGameScreen`.
- Those screens keep **local mirrors** of board/state/clocks for rendering; authoritative updates arrive as server messages.
- Guest id: `sessionStorage` (`playerId.ts`) so two tabs on one machine can be two players.
- Resume codes: `localStorage` via `activeOnline.ts`.
- **Optimistic moves** and **auto-reconnect**: see [`docs/ONLINE_UX_FIXES.md`](./docs/ONLINE_UX_FIXES.md).

### Board UI

- Click or drag to move; promotion picker overlay.
- Orientation follows your color online / `playAs` locally vs Stockfish.
- Move list auto-scrolls (`MoveList`).

---

## Server & data

### Process model

- `server/src/index.ts` listens on `PORT` (default **3001**).
- `/health` for probes; all gameplay is WebSocket JSON.
- Dev: Vite proxies `/ws` → `ws://localhost:3001` (see `vite.config.ts`).
- Prod client: set `VITE_WS_URL=wss://…` or same-origin `/ws`.

### Live rooms (`server/src/rooms/`)

Authoritative match state lives in an in-memory `Map` of `LiveRoom`:

- Seats (`white` / `black`) with `playerId`, socket, disconnect timestamp
- Phase: `waiting` → `draft` (draft mode) → `playing`
- Game `state`, setup, move log, clocks (`whiteMs` / `blackMs`, `turnStartedAt`)
- Per-color draft boards + ready flags

**Behaviors worth knowing**

- Host chooses `preferredColor` on create; joiner takes the empty seat.
- Solo waiting lobby closes if the host leaves/disconnects.
- Disconnect freezes that side’s clock when it is their turn; reclaim/rejoin resumes.
- Moves/resigns validated with the shared engine; illegal intents get `error` messages.
- Draft: each seat only sees/edits its half; when both confirm, armies merge and play starts.

### SQLite (`data/chess.sqlite`)

Persistence is **secondary** to the live map (reconnect / audit / history), not a full event-sourced game engine:

| Table | Purpose |
|-------|---------|
| `players` | Guest ids seen by the server |
| `games` | Setup/state JSON, mode, size, seat player ids, result |
| `game_events` | Sequenced events (`create`, `join`, moves, …) |
| `rooms` | Room code → game, host, open/full/closed |

- Path: `data/chess.sqlite` by default (gitignored), or `DATA_DIR`.
- WAL mode. Schema ensured on startup in `server/src/db/index.ts`.
- Deploy note: put `data/` on a **persistent volume** if the host is ephemeral.

---

## Chess rules & pieces (engine)

- Board sizes: **6, 8, 10** (`BoardSize`).
- Flat board: index `file + rank * size`; a1-style coords in `shared/coords.ts`.
- Classic pieces + expansion: archbishop, chancellor, dragon, centaur (`catalog.ts` costs + blurbs).
- Castling tracked as “unmoved king/rook start squares”; en passant supported.
- Draft budget scales with board size; each side may only place on its half.
- Blind generation retries for legality / no trivial White mate-in-one vs the mirror.

Fairy-Stockfish integration: position → FEN/UCI (`engine/fairy/`), best move (or random legal fallback) applied through `tryMove`.

Vite serves with **COOP/COEP** so SharedArrayBuffer / WASM threads work.

---

## Online message protocol

Defined once in `src/online/protocol.ts` (imported by the server).

**Client → server (examples):** `hello`, `room:create`, `room:join`, `room:leave`, `draft:*`, `move`, `resign`

**Server → client (examples):** `room:created` / `room:joined`, `draft:state`, `room:ready`, `state`, `error`

Payloads carry serializable engine types (`GameState`, `BoardSetup`, square indices, clocks, seat presence).

---

## Scripts

```bash
npm install             # also copies Fairy-Stockfish WASM + license files into public/
npm run dev             # Vite (:5173) + API with file watch (:3001)
npm run dev:web         # frontend only
npm run server:dev      # API only with tsx watch (local iteration)
npm run server          # API once (no watch) — same as production entry
npm start               # production API entry (Railway/Render default)
npm run start:server    # alias of start
npm run build           # tsc -b && vite build → dist/
npm run preview         # preview production frontend build
npm run lint
```

`tsx watch` is for local iteration (restarts on file save). Production uses `tsx` **without** watch via `npm start`.

---

## Deploy

| Piece | Where | Notes |
|-------|--------|------|
| Static UI (`dist/`) | e.g. Vercel | Free hobby tier is fine |
| Node WS + SQLite | Always-on host (Railway, Render, Fly, VPS) | **Not** serverless; needs sticky process + disk for SQLite |
| Stockfish | Browser only | No server cost |

**API on Railway/Render**

- Start command: `npm start` (runs `tsx server/src/index.ts` — **not** `tsx watch`)
- Or deploy the included `Dockerfile` and mount a volume at `/app/data`
- Optional env: `PORT` (platform usually sets this), `DATA_DIR` (SQLite folder; default `./data`)

Env for a split frontend deploy: `VITE_WS_URL=wss://your-api-host`.

Alternatively host UI + API on one machine and proxy `/ws` to the Node process.

**Git:** one repo for the whole `chess-game/` folder (frontend + server). Same GitHub repo can feed Vercel and Railway/Render.

---

## Legal pointers

- Original code: `LICENSE` — © 2026 Dragos Ispas
- Third-party: `THIRD_PARTY_NOTICES.md` / `public/licenses/`
- Stockfish source offer: `public/licenses/SOURCE_OFFER.md`
- Privacy (guest play): `public/privacy.md`
- Publish checklist: `docs/LEGAL_CHECKLIST.md`
- Piece art: `src/assets/pieces/ATTRIBUTION.md`
