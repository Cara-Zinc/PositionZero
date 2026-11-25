# Third-party notices

Position Zero's bundled and runtime dependencies remain governed by their own
licenses.

## Stockfish 18

- Project: https://github.com/official-stockfish/Stockfish
- Release tag: `sf_18`, commit `cb3d4ee`
- Binary: `stockfish-macos-m1-apple-silicon`
- Release archive SHA-256:
  `4d77c4aa3ad9bd1ea8111f2ac5a4620fe7ebf998d6893bf828d49ccd579c8cb0`
- License: GNU General Public License v3.0
- Exact release source:
  https://github.com/official-stockfish/Stockfish/releases/tag/sf_18

The complete GPL text is stored at `third_party/stockfish/Copying.txt`. Any
future distribution must keep the license and provide the corresponding source
or a durable pointer to the exact source used to produce the binary.

## Chess position recognition

- `@scoriiu/fenshot` — MIT License — https://github.com/scoriiu/fenshot
- `onnxruntime-web` — MIT License — https://github.com/microsoft/onnxruntime

Recognition runs locally. Imported images are never uploaded.

## Chess and PGN libraries

- `chess.js` — BSD-2-Clause — https://github.com/jhlywa/chess.js
- `cm-pgn` — MIT License — https://github.com/shaack/cm-pgn

## Opening data

- Lichess chess-openings — CC0 1.0 Public Domain Dedication
- Source: https://github.com/lichess-org/chess-openings

The five upstream ECO TSV files are preserved under
`third_party/lichess-openings/` and compiled into the runtime index without
adding proprietary game data.

## Classic 3D chess set and renderer

- pjhanzlik — “Chess”, CC0 1.0 Universal — https://opengameart.org/content/chess
- Original GLB and provenance: `third_party/chess-classic/README.md`.
- Three.js — MIT License — https://github.com/mrdoob/three.js
- Renderer license is preserved in `third_party/chess-classic/THREE-LICENSE.txt`.

The 3D set runs entirely from bundled local assets; it does not replace the 2D
piece sets or send positions to any external service.

## Standard 2D chess pieces

- Extracted from [Chessboard by Clker-Free-Vector-Images](https://pixabay.com/vectors/chessboard-chess-board-game-29630/).
- Source SVG groups are cropped to individual pieces and used within the app.

## Application framework

- Tauri — Apache-2.0 / MIT
- React — MIT
- Vite — MIT
