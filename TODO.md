# Chess game — improvement backlog

## High value

- [x] **Split `roomManager.ts`** — extract seating, clocks, draft, moves, and persistence into focused modules so online bugs stay isolatable.
- [x] **Production start path** — add a real start script (and ideally a Dockerfile) for Railway/Render; don’t rely on `tsx watch` in production.
- [ ] **Tighten protocol parsing** — validate `ClientMessage` fields (`preferredColor`, squares, etc.) instead of trusting JSON shape.
- [ ] **Engine unit tests** — cover legal moves, castling, en passant, draft merge/validation, Blind generation, and fairy pieces.

## Medium

- [ ] **Deduplicate play UI** — shared shells for local vs online game/draft screens (header, sidebar, board column).
- [ ] **Drop or use Hono** — either wire it for `/health` + static hosting, or remove unused deps.
- [ ] **Resume after server restart** — rehydrate open games from SQLite, or fail Resume clearly when the live room is gone.
- [ ] **Play menu UX polish** — section labels, shorter blurbs, clearer setup flow.

## Nice later

- [ ] **Extract shared engine package** — only if FE/server packaging for deploy gets awkward (`src/engine` + protocol).
- [ ] **E2E smoke test** — create room → join → one move (e.g. Playwright against local server).

## Out of scope / keep

- Shared pure-TS engine on FE + server (local play + online authority) — keep this architecture.
