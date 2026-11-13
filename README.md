# Chess game

A browser chess game with custom armies, fairy pieces, and online play.

Board sizes **6×6**, **8×8**, and **10×10**. Play locally, against Stockfish, or online with a friend.

---

## How to play

### Modes

| Mode | How it works |
|------|----------------|
| **Draft** | Each side spends a point budget building an army on their half of the board. Locally you pass the device; online both draft privately, then armies merge. Vs Stockfish, the board starts standard and you only customize your half. |
| **Blind** | A random mirrored setup: full pawn ranks plus a budget-limited officer row (king included; expansion pieces allowed). |

### Opponents

1. Open **Play** and choose **Local**, **Stockfish**, or **Online**.
2. Pick board size and which color you sit as (**White** / **Black**).
3. Choose **Draft** or **Blind**.

**Local** — two players on one device (Draft uses a handoff screen so the second player doesn’t peek).

**Stockfish** — you play the computer in the browser. Undo and New game are in the sidebar.

**Online** — **Create** a room (share the code; use **Copy**) or **Join** with a code. Host picks side and time control. Clocks run during the game; resign from the sidebar.

### Sandbox

**Sandbox** in the side nav: place pieces freely, then play that position (hotseat).

### Pieces

Classic chess pieces plus expansion options in Draft / Sandbox: archbishop, chancellor, dragon, and centaur (each has a point cost).

### Moving

Click or drag a piece to a highlighted square. Promote when a pawn reaches the last rank.

---

## Run locally

```bash
npm install
npm run dev
```

Opens the UI with hot reload and the online API on port 3001. Local and Stockfish play work without caring about the server; Online needs it running (included in `npm run dev`).

---

## More docs

| Doc | Contents |
|-----|----------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Code structure, stack, state, server, deploy |
| [`docs/ONLINE_UX_FIXES.md`](./docs/ONLINE_UX_FIXES.md) | Optimistic moves + reconnect (problem / fix) |
| [`TODO.md`](./TODO.md) | Improvement backlog |
| [`Credits`](./src/ui/CreditsScreen.tsx) (in-app) | Attribution |

Legal: `LICENSE`, `THIRD_PARTY_NOTICES.md`, `public/privacy.md`, `docs/LEGAL_CHECKLIST.md`.
