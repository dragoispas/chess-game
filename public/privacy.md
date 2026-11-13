# Privacy Policy

**Effective date:** 11 November 2026  
**Operator:** Dragos Ispas (“we”, “us”)

This policy describes how the chess game handles information when you use the
web app and online multiplayer features. It is written for the product as it
exists today (guest play, no accounts).

## What we collect

### On your device (browser)

- A random **guest player id** in `sessionStorage` (cleared when the tab
  session ends), used only so you can reconnect to a seat in a room.
- Optional **room codes** you recently used, also in `sessionStorage`, for the
  “Resume” list.

We do **not** use advertising cookies or third-party analytics in the current
build.

### On the game server (when you play online)

- Your guest player id and WebSocket connection while you are connected.
- Game / room records: room code, board setup, moves, clocks, seat
  assignments, and related event logs needed to run and resume matches.

We do **not** currently ask for your name, email, password, or payment details.

## How we use it

- Run multiplayer games and seat reclaim / reconnect.
- Operate and debug the service (for example, fixing connection issues).

We do not sell personal data.

## Sharing

Data stays on the infrastructure that hosts the game, except as needed to
operate that hosting (e.g. a cloud provider processing server logs). We do not
share guest ids or game records with advertisers.

## Retention

- Browser `sessionStorage` lasts for the browser session.
- Server game and player rows may be kept while useful for the service; we may
  delete old lobbies and finished games as part of normal maintenance.

## Your choices

- Close the tab / clear site data to remove local guest id and resume codes.
- Leave a room from the UI to disconnect from a match.
- Contact us (see Credits) if you want help understanding what is stored for
  online play.

## Children

The game is a general-audience hobby project. Do not use online play if you
are not allowed to use online services where you live.

## Changes

If we add accounts, analytics, or payments, we will update this policy and the
in-app Credits / Privacy section.

## Contact

Dragos Ispas — see the in-app **Credits** page for project attribution.
