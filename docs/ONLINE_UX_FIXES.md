# Online UX fixes

Notes on two client-side online play issues and how they were fixed. Server remains authoritative for moves and seating; these changes only improve feel and resilience in the browser.

---

## 1. Moves felt laggy (waited on the server)

### Problem

In online games, `Board` already validated the move locally with the shared engine and produced the next `GameState`, but `OnlineGameScreen` ignored that result. It only sent `{ type: 'move', … }` and updated the board when a `state` message came back.

On a remote API (e.g. Railway), that round-trip made every move feel delayed even when the move was legal.

### Fix

**Optimistic UI** in `OnlineGameScreen`:

1. On move, apply the local `BoardMoveEvent.state` immediately (board, last move, move list, captures).
2. Keep a rollback snapshot and mark the move “in flight” (board stays non-interactive).
3. Send the move to the server as before.
4. When `state` confirms the same `lastMove`, sync clocks / authoritative state and refresh the move label if the server sent one — **without** appending a second ply.
5. On `error` (or disconnect while pending), restore the rollback snapshot so the piece snaps back.

Relevant code: `src/ui/OnlineGameScreen.tsx` (`pendingRef`, `handleMove`, `state` / `error` handlers).

The server is still the source of truth; the client just assumes success until told otherwise.

---

## 2. Disconnects were silent (no UI, no auto-reconnect)

### Problem

`connectOnlineSocket()` opened a single WebSocket. If the connection dropped (network blip, tab sleep, server restart):

- The UI kept looking “normal” (no clear “you’re offline” signal for *your* socket — only opponent seat presence).
- Nothing reopened the socket or rejoined the room.
- The player had to leave and use Resume / Join manually.

### Fix

**Connection-aware socket** in `src/online/socket.ts`:

1. Track status: `connecting` | `connected` | `disconnected` | `reconnecting`.
2. On unexpected `close`, schedule reconnect with exponential backoff (capped).
3. Also retry when the browser fires `online`.
4. After each successful `hello:ok`, if a resume room code is set, automatically send `room:join` so the server reattaches the same guest id to the seat (existing reclaim / rejoin paths).
5. `close()` (Back / leave) sets an intentional flag so reconnect does **not** run.

**UI**

- `useConnectionStatus` + status copy (“Connection lost — reconnecting…”).
- Lobby, draft, and game screens show that status and disable play actions while not `connected`.
- In-flight optimistic moves roll back if the link drops before confirm.
- `setResumeRoom(code)` is set when a room is created/joined (and again on game/draft mount).

Relevant code: `src/online/socket.ts`, `src/ui/useConnectionStatus.ts`, `OnlineLobby` / `OnlineDraftScreen` / `OnlineGameScreen`.
