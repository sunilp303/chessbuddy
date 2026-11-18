# How to use ChessBuddy

## 1. Setup

1. Install Node.js 20.19+ or 22.12+.
2. From the project folder, install dependencies: `npm ci` (or `make install`). On Windows PowerShell use `npm.cmd ci`.
3. Optional: copy `.env.example` to `.env` and adjust values (see [Configuration](#3-configuration)).
4. Optional: add the Chess Quick Guide image (see [Guide image](#guide-image)).
5. Start the app: `npm run dev` (or `make dev`) and open http://127.0.0.1:4317.
6. Under **Settings**, enter a public Lichess username, then choose **Sync Lichess**.

For a production build run `npm run build` then `npm start` (`make build`, `make start`). To deploy to Cloudflare Workers see the README.

## 2. Using every feature

1. Use **Sync Lichess** in the header of any tab to refresh completed games and public rating history. When a time control has no rating history, the chart can show recorded ratings from imported rated games. No Lichess password is required.
2. Choose a completed game under **My games**.
3. Choose **Analyze game** to import saved Lichess annotations and run Stockfish over the completed game. To request Lichess server analysis, open the linked Lichess board and choose **Request a computer analysis** there, then refresh the review in ChessBuddy.
4. Choose a flagged move to open the position just before it. Compare the played move, the suggested line and the available evaluations. Filter by player and judgment. Stockfish estimates are labeled separately from Lichess judgments.
5. On the starting position for a move, drag a piece or select its square and destination to try a variation. Stockfish replies automatically.
6. Visit **Parent notebook** to copy all imported annotations and practice positions into your existing ChatGPT conversation.
7. Open **Rating progress** and select the rating series to overlay. Use Week (last 7 days), Month (last 30 days), YTD, 1 year, Last year, All time, or inclusive custom dates. Choose raw ratings or change from each series' first visible observation. Exact observations appear in a table.
8. Add dated USCF Regular / Quick / Blitz ratings under **Settings**. Entries support notes, provisional status and reversible removal/restoration. They appear in **Rating progress** for the chosen timeframe.
9. Open **Skill progress** for error counts/rates, official Lichess accuracy, and opening/middlegame/endgame trends. Refresh analysis data to import `accuracy=true` and `division=true`. Filter dates, time control, opponent rating/rating gap, and provisional games; group by game, week or month. The phase selector changes the trend chart and its data table. ACPL is whole-game only.
10. Read, copy or download the locally generated progress report. It compares chronological halves, notes opponent mix and missing data, and suggests real flagged positions. The parent coaching summary also includes this opponent-aware context.
11. Open **Guide rules** to review the user-supplied Roshen Nair Foundation Chess Quick Guide. The rulebook includes piece values/notation, stages, opening principles, the pre-move checklist, and trading principles. The original image is available locally at `/chess-quick-guide.png` with source attribution.
12. Select an automatic guide cue to see the position before/after the move, orange played-move arrows, amber related squares and a green Lichess alternative where available. Use the rule/evidence/game/date filters, or open the same position in the main review. Cue totals and weekly counts are separate from blunders and from human reflections.
13. Save **followed / did not follow / unsure** reflections for a particular player move and guide principle. Thinking habits, piece quality, pawn-structure tradeoffs and attack-based trading decisions cannot be read reliably from a move list. The app records human assessments rather than inventing compliance verdicts. Preview a chosen reflection position before saving.
14. Teaching thresholds are adjustable and saved locally (default opening window: 10 own moves; pawn cue from the fourth pawn move; castling review at own move 10 after a legal opportunity; rook connection review at own move 12). These numeric thresholds are app heuristics, not poster requirements. Download/copy the guide report or include it in the parent coaching summary.
15. **Choose what to track** is shared across Guide rules, Skill progress, and Rating progress. Select all imported games, one specific game (date/time/opponent/game ID), an exact calendar month, a calendar year, or custom inclusive dates. Shortcuts offer recent days and YTD. The selection survives tab changes and reloads using local browser storage. Advanced filters narrow the scope further. Parent coaching-summary copies also use this scope. One-game rating scope shows that date’s daily observations; it does not claim to identify a per-game rating change. Scope selection does not download additional game history; game sync still checks the latest 30 completed games and retains earlier imports.
16. Under **My games**, choose the position before a move to improve, then click **Try a move against Stockfish**. Select a piece and destination, or click **Try suggested …** when a validated recommendation is available. Local Stockfish automatically replies, and you can continue the practice variation, undo the last turn, reset, or exit. Selecting another original game position starts a fresh branch. Variations are temporary and do not modify the original game or practice scores. Reply searches use Stockfish 17.1 lite up to depth 16 / 200,000 nodes, so “best reply” means the best move found in that search. The server reconstructs and validates every move from an imported completed-game position; arbitrary live FENs are not accepted. No login or cloud AI is needed.
17. **Chess lessons** offers 89 topics: tactics, named checkmate patterns, strategy, pawn structures, basic mates, and endgames including Lucena/Philidor. Search by topic, category or level. There are 33 legal worked study positions with step-through example lines and 56 on-demand themed puzzle topics. It is a broad curriculum, not an assertion that every possible chess idea is covered.
18. Puzzle lessons load one public Lichess puzzle at a time when requested, using its official theme and selected difficulty. The PGN setup, side to move, and full solution are validated with chess.js and cached locally. **Practice the puzzle** checks each player move against the published line and automatically plays its published reply. Other good moves may exist. Hints and viewing example moves mark that run as assisted. Unique unassisted puzzle completions, assisted completions, and submitted moves are stored in `state.learning.progress`; repeating a solve does not add a second unique solve. No mass puzzle download occurs. A single fork puzzle may be seeded from `data/learning-fork.json` during setup.
19. **Practice vs Stockfish** lets you explore any registered lesson’s starting position without a fixed answer. **Ask Stockfish about this position** supplies an engine move, legal continuation, evaluation and a brief factual observation. Written lesson explanations and questions teach the concepts; there is no cloud AI pretending to explain the engine’s intent. Strategic practice is counted as exploration turns rather than graded as uniquely correct. Engine requests validate all variation moves from registered lesson/puzzle positions, never arbitrary submitted FENs. Search limits match interactive game review. Cached examples and study positions work offline; a new themed puzzle needs internet access. Learning-library progress is separate from game/date scope and appears as a separately labeled section in the parent coaching summary.
20. **Helper mode** (checkbox under any board where you play Stockfish: My games, Practice time, and Chess lessons → Practice vs Stockfish). While it is your turn, Stockfish quietly finds its best move. If you have not moved after 30 seconds, it appears as a green arrow. If you move sooner, the helper says whether your move matched Stockfish, was about as strong (within 0.3 pawns), or whether a better move existed, with both evaluations. The setting is remembered in this browser.
21. **Practice time** is a playable board: drag or click pieces, and Stockfish replies so you can keep going. Only your first move is scored. **Show me a clue** draws the recommended move at the start, and Stockfish's suggestion later in the line. **Undo last turn** and **Reset position** are always available.
22. **Famous patterns** under each game in My games lists Fool's mate, Scholar's mate (including the earlier threat and how to defend it), smothered mate, back-rank mate, knight forks, and, after analysis, patterns that were missed (including mate in one). Choose one to open that position with arrows and a short explanation. Other strategies, such as pins and openings, are not detected.
23. **Filter games** above the Completed games list: rated or casual, registered or anonymous opponents, time control (such as 25+5 or 10+5), speed, result, your color, how the game ended, reviewed or not, date range, opponent rating range, and opponent or opening search. Quick buttons cover common choices. Filters are remembered in this browser.
24. **Show suggestion now** (next to the helper countdown) skips the 30-second wait. It counts the same as waiting, so no "better move" feedback follows and, in Practice time, the position is not scored as solved on your own.
25. **Play Stockfish’s move ▶** is on every Stockfish board. It plays Stockfish’s best move for you, then Stockfish replies. In Practice time, using it for the first move counts as a clue.
26. After each turn, your move shows as a blue arrow and Stockfish’s reply as a purple arrow; the squares the pieces left show faded grey “ghost” pieces. A key under the board names both moves.
27. The **win / loss / draw** boxes above the game list show percentages and counts for the games that match your filters.

### How the numbers are calculated

Lesson references: [Lichess Practice](https://lichess.org/practice), [Puzzle Themes](https://lichess.org/training/themes). Public Lichess puzzles are public domain. Some named teaching positions cite their official Lichess practice chapters directly; explanations in this app are original. The worked strategic continuations demonstrate ideas, not forced or uniquely best play, and Stockfish may suggest another move. The stalemate lesson intentionally demonstrates a drawing mistake and explains the mating alternative.

Guide detections are **possible departures / discussion cues**, not illegal moves or proof a principle was violated. Some cues share a move; an independent Lichess error label does not prove the pattern caused that error. Quiet early queen moves, repeated piece moves, rim-knight development, pawn-heavy development and delayed king/rook development are observable patterns. Loose-material and early-queen-chase cues require relevant Lichess annotations; equal-value exchanges while materially behind are partial trading cues. Tactical checks/captures/forced replies are conservatively excluded where appropriate. No automatic detection is claimed for every guide rule, no compliance percentage is calculated, and no flag is not proof of compliance. Automatic cues, engine judgments and human reports remain separately labeled.

Skill progress counts only evaluated moves by the selected player and normalizes error rates per 100 evaluated moves. Accuracy is the equal-game average of supplied Lichess game or phase scores; missing values are excluded. Phase labels use supplied Lichess division boundaries; no arbitrary move-number split is substituted. Partial games and unknown ratings remain visible. Date grouping uses America/Los_Angeles. Opponents within ±100 points are “similar”; other bands are lower/higher or unknown, using both historical ratings at game time. The report requires at least three earlier and three recent games in a known band for a within-band comparison. This is descriptive context, not a statistical rating adjustment or proof of improvement. Provisional ratings and already-decided positions can make conclusions unreliable. [Lichess accuracy methodology](https://lichess.org/page/accuracy).

## 3. Configuration

### Environment variables

Set these in your shell before starting the server (the server does not read `.env` by itself; on Node 20.6+ you can run `node --env-file=.env server/index.js`).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4317` | Port for the local server. Vite’s live-reload connection always uses 4318 in development. |
| `CHESSBUDDY_DATA_DIR` | `./data` | Folder holding the notebook `state.json` and optional seed files. |
| `CHESSBUDDY_LEGACY_USERNAME` | not set | Only for old single-account data: the Lichess username to import `data/import.ndjson` and `data/rating-history.json` under, the first time an old notebook without a username is opened. Not needed for new installs. |

### In-app settings

| Setting | Where | Stored |
|---|---|---|
| Lichess username | Settings | Notebook |
| USCF ratings | Settings | Notebook |
| Teaching thresholds | Guide rules | Notebook |
| Game filters | My games → Filter games | This browser (local storage, per address) |
| Helper mode on/off | Checkbox under any Stockfish board | This browser |
| Tracking scope | Choose what to track | This browser |

Browser-stored settings are separate for `http://127.0.0.1:4317` and `http://localhost:4317`; use the same address each time.

### Guide image

The Roshen Nair Foundation Chess Quick Guide poster is not part of this repository. If you have a copy, save it as `public/chess-quick-guide.png`. Without it, the Guide rules tab works normally; only the link to the original image is missing.

### Limits

- Practice lines against Stockfish can run to 400 half-moves (200 each side) from the starting position.
- Stockfish replies and suggestions search up to depth 16 / 200,000 nodes; the quick game review uses depth 13 / 45,000 nodes.
- The helper shows its suggestion after 30 seconds, or immediately with **Show suggestion now**.

## 4. Troubleshooting

| Problem | Cause and fix |
|---|---|
| “Failed to fetch” when you move | The server is not running. Start it again with `npm run dev` and reload the page. |
| “Stockfish is busy” | Another Stockfish search (a game review or a helper hint) is still running. Wait a moment and try again. |
| Helper says it could not make a suggestion | The server was started before the helper existed, or Stockfish was busy. Restart the server; the next turn will retry. |
| Server exits with `Cannot read properties of null (reading 'port')` | Port 4317 or 4318 is already in use, usually by another ChessBuddy server. Stop it, or set a different `PORT`. |
| Filters or helper setting “forgotten” after refresh | You opened a different address (127.0.0.1 vs localhost) or a private window. Settings are kept per address and browser. |
| “Lichess asks us to wait” | Lichess rate limiting. Wait a full minute before syncing again. |
| No famous patterns listed | None of the detected patterns occurred. Choose **Analyze game** to also find missed patterns. |
| Practice board stops accepting moves | The game ended (checkmate or draw) or the line reached 400 half-moves. Use **Reset**. |
| Start fresh | Stop the server and delete `data/state.json`. |
