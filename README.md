# ChessBuddy

A kid-friendly chess coach that imports your Lichess games, finds mistakes and famous patterns, and lets you replay any position against Stockfish, with a 30-second helper, clues, game filters, rating charts and lessons. Runs locally or on Cloudflare Workers.

Set a public Lichess username under **Settings** (it starts blank; choosing a previously used username restores its saved data). ChessBuddy imports completed games and their Lichess computer analysis, runs its own Stockfish review, and turns mistakes into practice positions. A parent notebook copies an engine-grounded summary to paste into ChatGPT.

## Features

- **My games**: filter by rated/casual, registered/anonymous opponent, time control (25+5, 10+5…), result, color, date and rating, with a win/loss summary. Review flagged moves, see famous patterns (Scholar’s mate, forks, back-rank mate…) drawn with arrows, and replay any position against Stockfish.
- **Helper mode** on every Stockfish board: a suggestion after 30 seconds (or right away), feedback on whether a better move existed, a **Play Stockfish’s move** button, and colored arrows with grey “ghost” pieces for the last turn.
- **Practice time**: replay your own mistakes on a playable board with clues, undo and reset.
- **Chess lessons**: 89 topics with worked examples, Lichess puzzles and free play against Stockfish.
- **Guide rules, Skill progress, Rating progress** and a **Parent notebook** for trends and coaching.

## Quick start

Requires Node.js 20.19+ or 22.12+.

```sh
npm ci          # or: make install
npm run dev     # or: make dev
```

Open http://127.0.0.1:4317, go to **Settings**, enter a public Lichess username, then choose **Sync Lichess**. Full instructions, every feature, configuration and troubleshooting: [HOW-TO-USE.md](HOW-TO-USE.md).

## Inputs and outputs

| | What | Where |
|---|---|---|
| Input | Public Lichess games, computer analysis and rating history (no password) | Fetched from lichess.org on **Sync Lichess** |
| Input | USCF ratings you type in | **Settings** |
| Input | Your moves on the practice boards | Browser |
| Input | Optional: Lichess themed puzzles, one at a time | Fetched from lichess.org on request |
| Output | Notebook: games, analysis, practice progress, settings | `data/state.json` locally, or a per-browser Durable Object on Cloudflare |
| Output | Stockfish evaluations, replies and suggestions | Computed locally (Node) or in the visitor’s browser (Workers) |
| Output | Coaching summary and progress/guide reports | Copied to the clipboard or downloaded as text |
| Output | Per-browser preferences (game filters, helper mode, scope) | Browser local storage |

## Architecture

```
 Browser (React + Vite UI)                          lichess.org
 ┌──────────────────────────────┐                ┌──────────────┐
 │ Boards · filters · helper    │                │ games, evals │
 │ patterns · charts · lessons  │                │ ratings,     │
 │ (Stockfish WASM on Workers)  │                │ puzzles      │
 └──────────────┬───────────────┘                └──────▲───────┘
                │ /api/*  JSON                          │ public HTTP
 ┌──────────────▼───────────────────────────────────────┴───────┐
 │ Shared API routes (server/api.js)                             │
 │  • Local:  Express (server/index.js) + Stockfish 17.1 lite    │
 │            child process, notebook in data/state.json         │
 │  • Hosted: Cloudflare Worker (worker/) + Durable Object       │
 │            notebook per browser cookie                        │
 └───────────────────────────────────────────────────────────────┘
```

## Project structure

```
.
├── index.html               Vite entry page
├── src/                     React UI and shared logic (also imported by the server)
│   ├── main.jsx             App shell, tabs, game list
│   ├── GameReview.jsx       Game review, flagged moves, famous patterns
│   ├── ReviewBoard.jsx      Play a game position against Stockfish
│   ├── PracticeTime.jsx     Playable practice from your mistakes
│   ├── ChessLessons.jsx     Lesson library and lesson board
│   ├── MoveHelper.jsx       Helper mode, turn arrows, Play Stockfish’s move
│   ├── GameFilters.jsx      Game filters and win/loss summary
│   ├── patterns.js          Famous-pattern detection
│   ├── game-filters.js      Filter and summary logic
│   └── …                    Ratings, skill progress, guide rules, lessons
├── server/                  Express server, Lichess import, Stockfish (UCI) engine
├── worker/                  Cloudflare Worker entry and router
├── scripts/                 Build helpers (copies Stockfish for Workers)
├── public/                  Static files (add your own guide image here, see HOW-TO-USE)
├── tests/                   node:test suites (npm test)
├── data/                    Local notebook — not committed
├── wrangler.jsonc           Cloudflare Workers config
├── Makefile                 install / dev / test / lint / build / deploy
└── .env.example             Optional environment variables
```

## Deploy to Cloudflare Workers

Use Node.js 22 or later and run these commands from the project directory:

```sh
npm ci
npx wrangler login
npm run deploy:worker
```

Wrangler builds the app, packages the browser Stockfish engine, and creates the SQLite-backed Durable Object binding in `wrangler.jsonc`. For a local Cloudflare preview, run `npm run dev:worker`. The regular Node service still runs with `npm run dev`.

Each browser profile gets a private notebook, identified by an opaque cookie. The selected Lichess username, USCF ratings, game data, and practice progress are stored in that notebook and restored on return. A different browser profile or hostname starts a fresh notebook. Keep the site's cookie to reopen the same notebook. The deployment starts with empty notebooks and does not upload `data/state.json`.

The hosted app runs Stockfish in the visitor’s browser. The license and source link are available at `/stockfish/SOURCE.txt`.

## Run on Windows

Requires Node.js 20.19+ (or 22.12+).

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:4317. For a production build:

```powershell
npm.cmd run build
npm.cmd start
```

`npm.cmd test` checks game filtering, score orientation, analysis-to-move alignment, castling recommendations, lesson validation, rating dates and presets, USCF input validation, and a real Stockfish forced mate.

## Current scope and limitations

- Local Node/Express server, React/Vite interface, chess.js legality, Stockfish 17.1 lite single-threaded WASM. This first version uses an atomic local JSON store instead of SQLite; a Python service is not needed.
- Only completed games imported from the fixed account are analyzed. No ongoing games, arbitrary positions, or live move suggestions are accepted by the API.
- Local quick review: maximum depth 13 / 45,000 nodes per position. Scores are normalized to White. Selected moves lose at least 120 centipawns, excluding already extreme positions. This is a heuristic, not a definitive diagnosis. These filters and the five-position cap do not apply to imported Lichess annotations. Importing a Lichess review uses its recommendations for practice while retaining local evaluations.
- Only the engine's first choice is marked correct. Other good or equivalent moves may be rejected. The interface discloses this. Tactical categories are conservative descriptions, not detected forks or pins.
- Progress is stored under `data/state.json` on this computer. It is excluded from Git. Remove this file to reset the notebook after stopping the server. `data/import.ndjson` is the initial public game snapshot.
- The server binds only to loopback and rejects cross-origin writes. Do not expose it to the internet. It has no multi-user authentication.
- No cloud model or subscription integration is enabled. Copying the summary lets you choose what to share with ChatGPT. Official Sign in with ChatGPT supports eligible open-source partners and selected private clients; eligibility and the full OAuth flow need to be established before adding it here: https://developers.openai.com/siwc/quickstart
- Stockfish/chess.js run locally. Application network calls read public Lichess games, analysis exports and rating history, plus Google Fonts for typography. A system font fallback works offline. Lichess requests are serialized and respect a full-minute cooldown after rate limiting. Rating API months are converted from zero-based indices.
- No paid API, cloud hosting, account changes, or automated messaging.

## Source context

Started as a child-friendly, post-game coach. Priorities for later iterations: deeper analysis, accept equivalent good moves, richer verified tactical labels, durable job recovery, weekly trend reports, and an eligible optional AI provider.

## Third-party software

Stockfish.js is GPLv3, distributed via the `stockfish` npm package. Its source and license are available at https://github.com/nmrugg/stockfish.js and `node_modules/stockfish/Copying.txt`. Stockfish engine source: https://github.com/official-stockfish/Stockfish. If distributing this application, comply with the applicable Stockfish GPL requirements. Other package licenses remain in their installed packages.

## License

ChessBuddy is licensed under the GNU General Public License v3.0; see [LICENSE](LICENSE). The Roshen Nair Foundation Chess Quick Guide image is not included; see HOW-TO-USE.md to add your own copy.
