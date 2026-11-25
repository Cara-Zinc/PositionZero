import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type Square } from "chess.js";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { AnalysisTimeline } from "./components/AnalysisTimeline";
import { BackgroundMusic } from "./components/BackgroundMusic";
import { BoardStylePicker } from "./components/BoardStylePicker";
import { ChessBoard } from "./components/ChessBoard";
import { ImportDialog } from "./components/ImportDialog";
import { LogoMark } from "./components/LogoMark";
import { ReviewView } from "./components/ReviewView";
import { applyBoardVariables, useThemeId } from "./lib/appearance";
import { explainLine, expectation } from "./lib/coach";
import { clampAnalysisCursor, cursorForStudy, fenAtCursor, movesThroughCursor } from "./lib/analysisHistory";
import { analyzePosition, getEngineStatus, initializeEngine, restartEngine } from "./lib/engine";
import { epdKey, findOpening, loadOpeningBook, type OpeningRecord } from "./lib/openings";
import {
  addPlayerAlias, clearAnalysisCache, dueCards, gradeCard, listCards, listPlayerAliases,
  listStudies, nextCardNumber, saveCard, saveStudy,
} from "./lib/storage";
import { resolvePalette, resolveTheme } from "./lib/themes";
import type {
  AnalysisLine, EngineProfileName, EngineSettings, EngineStatus, ImportedGame, MoveEvaluation,
  ReviewGrade, Severity, Study, TrainingCard,
} from "./types";

const START_FEN = new Chess().fen();
const ChessBoard3D = lazy(() => import("./components/ChessBoard3D").then(module => ({ default: module.ChessBoard3D })));
const EMPTY_ENGINE: EngineStatus = {
  state: "starting", engineName: null, currentJobId: null, message: "Starting local engine…",
};

function now(): string { return new Date().toISOString(); }
function pz(number: number): string { return `PZ—${number.toString().padStart(4, "0")}`; }

function severity(loss: number, mate = false): Severity {
  if (mate || loss >= 0.25) return "blunder";
  if (loss >= 0.12) return "mistake";
  if (loss >= 0.05) return "inaccuracy";
  return "info";
}

function makeTransientStudy(): Study {
  const timestamp = now();
  return {
    id: "transient", cardNumber: 0, title: "Unfiled position", sourceType: "manual",
    sourceGameId: null, accountId: null, rootFen: START_FEN, currentFen: START_FEN,
    originalPgn: null, moveTree: [], notes: "", tags: [], createdAt: timestamp, updatedAt: timestamp,
  };
}

export default function App() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [current, setCurrent] = useState<Study>(makeTransientStudy);
  const [lines, setLines] = useState<AnalysisLine[]>([]);
  const [engine, setEngine] = useState<EngineStatus>(EMPTY_ENGINE);
  const [profile, setProfile] = useState<EngineProfileName>("quick");
  const [orientation, setOrientation] = useState<Color>("w");
  const [boardMode, setBoardMode] = useState<"2d" | "3d">("2d");
  const [inverted, setInverted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingGames, setPendingGames] = useState<ImportedGame[]>([]);
  const [setupGame, setSetupGame] = useState<ImportedGame | null>(null);
  const [selectedPly, setSelectedPly] = useState(0);
  const [evaluations, setEvaluations] = useState<Record<number, MoveEvaluation>>({});
  const [scanProgress, setScanProgress] = useState<number | null>(null);
  const [cards, setCards] = useState<TrainingCard[]>([]);
  const [reviewCards, setReviewCards] = useState<TrainingCard[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [opening, setOpening] = useState<OpeningRecord | null>(null);
  const themeId = useThemeId();
  const appRef = useRef<HTMLDivElement>(null);
  const fenRef = useRef(current.currentFen);
  const engineRef = useRef(engine);
  const analysisSequence = useRef(0);
  const saveTimer = useRef<number | null>(null);

  const currentGame = useMemo<ImportedGame | null>(() => current.originalPgn ? {
    id: current.sourceGameId || current.id,
    title: current.title,
    headers: {},
    originalPgn: current.originalPgn,
    startFen: current.rootFen,
    moves: current.moveTree,
  } : null, [current]);
  const best = lines[0];
  const insight = useMemo(() => explainLine(current.currentFen, best), [current.currentFen, best]);
  const arrows = useMemo(() => lines.slice(0, 3).flatMap((line) => line.pvUci[0]
    ? [{ from: line.pvUci[0].slice(0, 2), to: line.pvUci[0].slice(2, 4) }] : []), [lines]);
  const suggestions = useMemo(() => Object.values(evaluations)
    .filter((evaluation) => evaluation.severity !== "info")
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 3), [evaluations]);

  useEffect(() => { engineRef.current = engine; }, [engine]);

  // Day palette on the document: every board in the app, including the review
  // and screenshot dialogs, inherits the chosen skin from these variables.
  useEffect(() => {
    applyBoardVariables(resolvePalette(resolveTheme(themeId), false), document.documentElement);
  }, [themeId]);

  // The shell re-declares the same skin for a dark room, so night mode dims the
  // board without changing which skin is selected.
  useEffect(() => {
    if (appRef.current) applyBoardVariables(resolvePalette(resolveTheme(themeId), inverted), appRef.current);
  }, [themeId, inverted]);

  const bootEngine = useCallback(async (): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        setEngine(await initializeEngine());
        return;
      } catch (error) {
        setEngine((state) => ({ ...state, state: "error", message: error instanceof Error ? error.message : String(error) }));
        await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }, []);

  useEffect(() => {
    Promise.all([listStudies(), listCards()]).then(([loadedStudies, loadedCards]) => {
      setStudies(loadedStudies);
      setCards(loadedCards);
      if (loadedStudies[0]) {
        setCurrent(loadedStudies[0]);
        setSelectedPly(cursorForStudy(loadedStudies[0]));
      }
    });
    void bootEngine();
    const monitor = window.setInterval(() => {
      if (engineRef.current.state === "thinking" || engineRef.current.state === "starting") return;
      void getEngineStatus().then((status) => {
        setEngine(status);
        if (status.state === "stopped" || status.state === "error") {
          return restartEngine().then(setEngine).catch((error) => setEngine((state) => ({
            ...state, state: "error", message: error instanceof Error ? error.message : String(error),
          })));
        }
        return undefined;
      }).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(monitor);
  }, [bootEngine]);

  useEffect(() => { fenRef.current = current.currentFen; }, [current.currentFen]);

  useEffect(() => {
    let live = true;
    findOpening(current.currentFen).then((record) => { if (live) setOpening(record); }).catch(() => setOpening(null));
    return () => { live = false; };
  }, [current.currentFen]);

  const runAnalysis = useCallback(async (timeLimitMs: number, nextProfile: EngineProfileName = "quick", settings?: EngineSettings) => {
    const requestedFen = fenRef.current;
    const sequence = ++analysisSequence.current;
    setProfile(nextProfile);
    setEngine((state) => ({ ...state, state: "thinking", message: null }));
    try {
      const result = await analyzePosition({
        fen: requestedFen,
        profile: nextProfile,
        multiPv: nextProfile === "scan" ? 1 : 3,
        timeLimitMs,
        threads: settings?.threads,
        hashMb: settings?.hashMb,
        depth: settings?.depth || undefined,
      }, (partial) => {
        if (analysisSequence.current === sequence && fenRef.current === requestedFen) setLines(partial);
      });
      if (analysisSequence.current === sequence && fenRef.current === requestedFen) {
        setLines(result.lines);
        setEngine((state) => ({ ...state, state: "ready", currentJobId: null, message: null }));
      }
    } catch (error) {
      if (analysisSequence.current === sequence) {
        setEngine((state) => ({ ...state, state: "error", message: error instanceof Error ? error.message : String(error) }));
      }
    }
  }, []);

  const engineAvailable = engine.state === "ready" || engine.state === "thinking";

  useEffect(() => {
    setLines([]);
    if (!engineAvailable) return;
    const timer = window.setTimeout(() => void runAnalysis(1_000, "quick"), 220);
    return () => window.clearTimeout(timer);
  }, [current.currentFen, engineAvailable, runAnalysis]);

  function persist(next: Study): void {
    setCurrent(next);
    if (next.id === "transient") return;
    setStudies((items) => [next, ...items.filter((item) => item.id !== next.id)]);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveStudy(next), 180);
  }

  function movePiece(from: Square, to: Square, promotion: "q" | "r" | "b" | "n" = "q"): boolean {
    const chess = new Chess(current.currentFen);
    let move: ReturnType<Chess["move"]>;
    try {
      move = chess.move({ from, to, promotion });
    } catch {
      return false;
    }
    if (!move) return false;
    const cursor = clampAnalysisCursor(selectedPly, current.moveTree.length);
    const branch = movesThroughCursor(current.moveTree, cursor);
    const importedMove = {
      ply: branch.length + 1,
      color: move.color,
      san: move.san,
      uci: `${from}${to}${move.promotion || ""}`,
      fenBefore: current.currentFen,
      fenAfter: chess.fen(),
      comments: [], nags: [],
    };
    persist({ ...current, currentFen: chess.fen(), moveTree: [...branch, importedMove], updatedAt: now() });
    setSelectedPly(branch.length + 1);
    setEvaluations({});
    return true;
  }

  function playEngineMove(uci: string): void {
    if (uci.length < 4) return;
    movePiece(
      uci.slice(0, 2) as Square,
      uci.slice(2, 4) as Square,
      (uci[4] || "q") as "q" | "r" | "b" | "n",
    );
  }

  async function prepareGame(game: ImportedGame): Promise<void> {
    const aliases = (await listPlayerAliases()).map((alias) => alias.toLowerCase());
    const whiteMatch = aliases.includes((game.headers.White || "").toLowerCase());
    const blackMatch = aliases.includes((game.headers.Black || "").toLowerCase());
    if (whiteMatch !== blackMatch) {
      await createStudyFromGame(game, whiteMatch ? "w" : "b");
    } else {
      setSetupGame(game);
      setPendingGames([]);
    }
  }

  async function createStudyFromGame(game: ImportedGame, player: Color | "both"): Promise<void> {
    const cardNumber = await nextCardNumber();
    const timestamp = now();
    const study: Study = {
      id: crypto.randomUUID(), cardNumber, title: game.title, sourceType: "pgn",
      sourceGameId: game.id, accountId: null, rootFen: game.startFen, currentFen: game.startFen,
      originalPgn: game.originalPgn, moveTree: game.moves, notes: "", tags: [`player:${player}`],
      createdAt: timestamp, updatedAt: timestamp,
    };
    if (player !== "both") {
      await addPlayerAlias(player === "w" ? game.headers.White || "" : game.headers.Black || "");
    }
    await saveStudy(study);
    setStudies((items) => [study, ...items]);
    setCurrent(study);
    setSelectedPly(0);
    setPendingGames([]);
    setSetupGame(null);
    setImportOpen(false);
  }

  async function createStudyFromPosition(fen: string, sourceType: "fen" | "vision"): Promise<void> {
    const cardNumber = await nextCardNumber();
    const timestamp = now();
    const study: Study = {
      id: crypto.randomUUID(), cardNumber, title: sourceType === "vision" ? "Recognized position" : "Imported position",
      sourceType, sourceGameId: null, accountId: null, rootFen: fen, currentFen: fen,
      originalPgn: null, moveTree: [], notes: "", tags: [], createdAt: timestamp, updatedAt: timestamp,
    };
    await saveStudy(study);
    setStudies((items) => [study, ...items]);
    setCurrent(study);
    setSelectedPly(0);
    setImportOpen(false);
  }

  function choosePly(cursor: number): void {
    const nextCursor = clampAnalysisCursor(cursor, current.moveTree.length);
    setSelectedPly(nextCursor);
    persist({
      ...current,
      currentFen: fenAtCursor(current.rootFen, current.moveTree, nextCursor),
      updatedAt: now(),
    });
  }

  async function scanGame(): Promise<void> {
    if (!currentGame || scanProgress !== null) return;
    setEvaluations({});
    setScanProgress(0);
    const positions = [currentGame.startFen, ...currentGame.moves.map((move) => move.fenAfter)];
    const book: Record<string, OpeningRecord> = await loadOpeningBook().catch(() => ({}));
    const firstNonBook = positions.findIndex((fen) => !book[epdKey(fen)]);
    const analysisStart = Math.max(0, firstNonBook < 0 ? positions.length - 1 : firstNonBook - 1);
    const results: Array<AnalysisLine[] | null> = Array(positions.length).fill(null);
    for (let index = analysisStart; index < positions.length; index += 1) {
      const result = await analyzePosition({ fen: positions[index], profile: "scan", multiPv: 1, timeLimitMs: 350 });
      results[index] = result.lines;
      setScanProgress((index + 1) / positions.length);
    }
    const next: Record<number, MoveEvaluation> = {};
    currentGame.moves.forEach((move, index) => {
      const playerTag = current.tags.find((tag) => tag.startsWith("player:")) || "player:both";
      if (playerTag !== "player:both" && playerTag !== `player:${move.color}`) return;
      if (!results[index] || !results[index + 1]) return;
      const before = expectation(results[index]![0]);
      const after = 1 - expectation(results[index + 1]![0]);
      const loss = Math.max(0, before - after);
      next[move.ply] = {
        ply: move.ply,
        expectationBefore: before,
        expectationAfter: after,
        loss,
        severity: severity(loss, results[index + 1]![0]?.mateIn !== null && after === 0),
        bestMove: results[index]![0]?.pvUci[0] ?? null,
        lines: results[index]!,
      };
    });
    setEvaluations(next);
    setScanProgress(null);
    await runAnalysis(1_000, "quick");
  }

  async function makeCard(): Promise<void> {
    if (!best || current.id === "transient") return;
    const topExpectation = expectation(best);
    const acceptedMoves = lines.filter((line) => topExpectation - expectation(line) <= 0.02)
      .map((line) => line.pvUci[0]).filter(Boolean);
    const timestamp = now();
    const card: TrainingCard = {
      id: crypto.randomUUID(), studyId: current.id, promptFen: current.currentFen,
      acceptedMoves: acceptedMoves.length ? acceptedMoves : [best.pvUci[0]],
      forcingLine: best.pvUci.slice(0, 4), motifTags: [insight.motif], dueAt: timestamp,
      intervalDays: 0, lapses: 0, createdAt: timestamp, updatedAt: timestamp,
    };
    await saveCard(card);
    setCards((items) => [card, ...items]);
  }

  async function beginReview(): Promise<void> {
    setReviewCards(await dueCards());
  }

  async function applyGrade(card: TrainingCard, grade: ReviewGrade): Promise<void> {
    const updated = await gradeCard(card, grade);
    setCards((items) => items.map((item) => item.id === card.id ? updated : item));
  }

  function exportPgn(): void {
    if (!current.originalPgn) return;
    const blob = new Blob([current.originalPgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${current.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "study"}.pgn`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (reviewCards) return <ReviewView cards={reviewCards} studies={studies} onGrade={applyGrade} onExit={() => setReviewCards(null)} />;

  return <div className={inverted ? "app is-inverted" : "app"} ref={appRef}>
    <header className="app-header">
      <button type="button" className="mobile-index" onClick={() => setSidebarOpen((open) => !open)}>INDEX</button>
      <div className="brand"><LogoMark size={30} /><span>POSITION</span><strong>ZERO</strong></div>
      <nav aria-label="Application actions">
        <BackgroundMusic />
        <button type="button" onClick={() => setImportOpen(true)}>Import</button>
        <button type="button" onClick={beginReview}>Review <span className="count">{cards.filter((card) => new Date(card.dueAt) <= new Date()).length}</span></button>
        <button type="button" onClick={() => setOrientation((value) => value === "w" ? "b" : "w")}>Flip</button>
        <BoardStylePicker inverted={inverted} />
        <button type="button" onClick={() => setInverted((value) => !value)} aria-label="Toggle night mode" title="Toggle night mode">◐</button>
      </nav>
    </header>

    <div className="workspace">
      <aside className={`study-index ${sidebarOpen ? "is-open" : ""}`}>
        <div className="index-heading"><span className="eyebrow">POSITION FILE</span><strong>{studies.length.toString().padStart(2, "0")}</strong></div>
        <div className="study-list">
          {studies.length === 0 && <div className="empty-index">No filed positions.<br />Import material to begin.</div>}
          {studies.map((study) => <button type="button" key={study.id} className={study.id === current.id ? "study-card is-active" : "study-card"} onClick={() => { setCurrent(study); setSelectedPly(cursorForStudy(study)); setSidebarOpen(false); }}>
            <span className="card-number">{pz(study.cardNumber)}</span>
            <strong>{study.title}</strong>
            <small>{study.sourceType} · {study.tags[0] || "unclassified"}</small>
          </button>)}
        </div>
        <div className="index-footer"><button type="button" className="new-position" onClick={() => setImportOpen(true)}>＋ New material</button><button type="button" onClick={() => void clearAnalysisCache()}>Clear cache</button></div>
      </aside>

      <main className={`laboratory${boardMode === "3d" ? " has-3d-board" : ""}`}>
        <section className={`board-column${boardMode === "3d" ? " is-3d" : ""}`}>
          <div className="position-heading">
            <div><span className="card-stamp">{current.id === "transient" ? "PZ—ZERO" : pz(current.cardNumber)}</span><h1>{current.title}</h1>{opening && <small className="opening-name">{opening.eco} / {opening.name}</small>}</div>
            <div className="position-actions">
              {currentGame && <button type="button" onClick={scanGame} disabled={scanProgress !== null}>{scanProgress === null ? "Scan game" : `${Math.round(scanProgress * 100)}%`}</button>}
              {current.originalPgn && <button type="button" onClick={exportPgn}>Export PGN</button>}
            </div>
          </div>
          <div className="board-view-controls" role="group" aria-label="棋盘显示方式">
            <button type="button" aria-pressed={boardMode === "2d"} onClick={() => setBoardMode("2d")}>2D 棋盘</button>
            <button type="button" aria-pressed={boardMode === "3d"} onClick={() => setBoardMode("3d")}>3D 黑白</button>
            {boardMode === "3d" && <span>经典套装 · 本地模型</span>}
          </div>
          {boardMode === "3d" ? <Suspense fallback={<div className="board-3d-loading" role="status">正在准备 3D 棋盘…</div>}>
            <ChessBoard3D fen={current.currentFen} orientation={orientation} onMove={movePiece} arrows={arrows} evidenceSquares={insight.evidenceSquares} onFallback={() => setBoardMode("2d")} />
          </Suspense> : <ChessBoard fen={current.currentFen} orientation={orientation} onMove={movePiece} arrows={arrows} evidenceSquares={insight.evidenceSquares} />}
          <div className="board-turn" role="status">
            <strong>{new Chess(current.currentFen).turn() === "w" ? "WHITE TO MOVE" : "BLACK TO MOVE"}</strong>
            <span>{boardMode === "3d" ? "Click to move · Drag to orbit · Scroll to zoom" : "Click a piece, then a marked square — or drag it."}</span>
          </div>
          <AnalysisTimeline moves={current.moveTree} cursor={selectedPly} evaluations={evaluations} onNavigate={choosePly} />
          <div className="fen-strip"><span>FEN</span><code>{current.currentFen}</code><button type="button" onClick={() => navigator.clipboard.writeText(current.currentFen)}>Copy</button></div>
          {suggestions.length > 0 && <div className="card-suggestions">
            <span className="eyebrow">CARD CANDIDATES</span>
            {suggestions.map((candidate) => <button type="button" key={candidate.ply} onClick={() => {
              const moveIndex = current.moveTree.findIndex((move) => move.ply === candidate.ply);
              choosePly(Math.max(0, moveIndex >= 0 ? moveIndex : candidate.ply - 1));
            }}>
              <strong>PLY {candidate.ply}</strong><span>{candidate.severity} · −{Math.round(candidate.loss * 100)}% expectation</span><i>Open →</i>
            </button>)}
          </div>}
          <label className="study-notes"><span className="eyebrow">YOUR NOTE</span><textarea value={current.notes} onChange={(event) => persist({ ...current, notes: event.target.value, updatedAt: now() })} placeholder="What pattern should you recognize next time?" /></label>
        </section>

        <AnalysisPanel status={engine} lines={lines} insight={insight} activeProfile={profile} onDeepen={(time, settings) => runAnalysis(time, time <= 1_000 ? "quick" : "deep", settings)} onPlayMove={playEngineMove} onRestart={() => void restartEngine().then(setEngine)} onMakeCard={makeCard} canMakeCard={Boolean(best && current.id !== "transient")} />
      </main>
    </div>

    {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onGames={(games) => games.length === 1 ? void prepareGame(games[0]) : setPendingGames(games)} onPosition={createStudyFromPosition} />}
    {pendingGames.length > 1 && <div className="modal-backdrop"><section className="game-picker" role="dialog" aria-modal="true"><span className="eyebrow">MULTI-GAME PGN</span><h2>Choose a game</h2>{pendingGames.map((game) => <button type="button" key={game.id} onClick={() => prepareGame(game)}><strong>{game.title}</strong><span>{game.headers.Date || "Unknown date"} · {game.headers.Result || "*"}</span></button>)}</section></div>}
    {setupGame && <div className="modal-backdrop"><section className="side-picker" role="dialog" aria-modal="true">
      <span className="eyebrow">PLAYER IDENTITY</span><h2>Which moves are yours?</h2><p>This name will be remembered for later PGN imports.</p>
      <button type="button" onClick={() => createStudyFromGame(setupGame, "w")}><span>White</span><strong>{setupGame.headers.White || "White"}</strong></button>
      <button type="button" onClick={() => createStudyFromGame(setupGame, "b")}><span>Black</span><strong>{setupGame.headers.Black || "Black"}</strong></button>
      <button type="button" onClick={() => createStudyFromGame(setupGame, "both")}><span>Both sides</span><strong>Analyze every move</strong></button>
    </section></div>}
  </div>;
}
