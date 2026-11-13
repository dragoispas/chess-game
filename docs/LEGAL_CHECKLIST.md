# Legal checklist (practical)

This is **not legal advice**. It is an engineering checklist for publishing
this game more safely. For a commercial launch, talk to a lawyer in your
jurisdiction.

## Protect your own work

- [x] Assert copyright on original code (`LICENSE` — Dragos Ispas, all rights reserved).
- [x] Name on copyright line and Credits screen.
- [ ] Keep the git history / dated copies as evidence of authorship.
- [ ] Don’t paste large chunks of other people’s code without a license.

## Comply with third parties

- [x] Piece art attribution (`THIRD_PARTY_NOTICES.md`, Credits UI, `ATTRIBUTION.md`).
- [x] Ship Fairy-Stockfish GPL text + AUTHORS next to the WASM build.
- [x] Written source offer: `public/licenses/SOURCE_OFFER.md` (+ Credits link).
- [ ] If you **modify** Stockfish or the piece SVGs, follow share-alike / GPL
      rules for those derivatives.
- [ ] Before a **closed-source commercial** release: get advice on bundling
      GPL WASM. Practical options people use:
      1. Keep the app proprietary hobby / free (current posture) + strong notices.
      2. Open-source the app under GPL-3.0 as well (simplest compliance story).
      3. Counsel-reviewed architecture (e.g. how the engine is shipped vs linked).

## Product / online play

- [x] Basic Terms & disclaimer on the Credits screen.
- [x] Privacy Policy for current guest-only data (`public/privacy.md` + Credits).
- [ ] Update Privacy Policy if you add accounts, analytics, or payments.
- [ ] If you take payments: consumer / tax / refund rules apply.
- [ ] Don’t use protected brand names (e.g. “Chess.com”, “Lichess”) in a
      way that suggests endorsement or affiliation.

## Trademarks / content

- Chess **rules** are not copyrighted; **code, art, names, and logos** can be.
- Fairy piece **ideas** (archbishop, etc.) are traditional; **our
  implementation and branding** are ours; **Cburnett drawings** stay theirs.

## Before each public deploy

1. Credits page reachable in the UI.
2. `/licenses/fairy-stockfish/COPYING.txt`, `AUTHORS`, and `SOURCE_OFFER.md` live.
3. `/privacy.md` and `/licenses/THIRD_PARTY_NOTICES.md` live.
4. Re-read Stockfish GPL obligations if the distribution model changed.
