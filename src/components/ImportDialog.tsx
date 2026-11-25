import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";
import { ChessBoard, PieceGlyph } from "./ChessBoard";
import { localPgnProvider, validateFen } from "../lib/pgn";
import { recognizeBoard } from "../lib/vision";
import type { ImportedGame } from "../types";

type Tab = "pgn" | "fen" | "image";
const PIECES: Array<{ color: Color; type: PieceSymbol }> = [
  { color: "w", type: "k" }, { color: "w", type: "q" },
  { color: "w", type: "r" }, { color: "w", type: "b" },
  { color: "w", type: "n" }, { color: "w", type: "p" },
  { color: "b", type: "k" }, { color: "b", type: "q" },
  { color: "b", type: "r" }, { color: "b", type: "b" },
  { color: "b", type: "n" }, { color: "b", type: "p" },
];

interface ImportDialogProps {
  onClose: () => void;
  onGames: (games: ImportedGame[]) => void;
  onPosition: (fen: string, source: "fen" | "vision") => void;
}

function placementToBoardFen(placement: string, turn: Color, castling: string): string {
  return `${placement} ${turn} ${castling || "-"} - 0 1`;
}

export function ImportDialog({ onClose, onGames, onPosition }: ImportDialogProps) {
  const [tab, setTab] = useState<Tab>("pgn");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [placement, setPlacement] = useState("");
  const [confidence, setConfidence] = useState<number[] | undefined>();
  const [turn, setTurn] = useState<Color>("w");
  const [castling, setCastling] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<(typeof PIECES)[number] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pgnFileRef = useRef<HTMLInputElement>(null);
  const visionFen = useMemo(() => placement ? placementToBoardFen(placement, turn, castling) : "", [placement, turn, castling]);

  useEffect(() => {
    if (tab !== "image") return;
    const onPaste = (event: ClipboardEvent) => {
      const image = [...(event.clipboardData?.files ?? [])].find((file) => file.type.startsWith("image/"));
      if (image) void loadImage(image);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [tab]);

  async function submitPgn(): Promise<void> {
    try {
      const games = await localPgnProvider.importText(text);
      if (!games.length) throw new Error("No games were found in this PGN.");
      onGames(games);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not parse this PGN.");
    }
  }

  function submitFen(): void {
    const result = validateFen(text.trim());
    if (!result.valid) return setError(result.message);
    onPosition(text.trim(), "fen");
  }

  async function loadImage(file: File): Promise<void> {
    setRecognizing(true);
    setError("");
    setImageUrl(URL.createObjectURL(file));
    try {
      const result = await recognizeBoard(file);
      setPlacement(result.placement);
      setConfidence(result.confidences);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image recognition failed.");
    } finally {
      setRecognizing(false);
    }
  }

  function editSquare(from: Square, to: Square): boolean {
    if (!visionFen) return false;
    const chess = new Chess(visionFen);
    const piece = chess.remove(from);
    if (piece) chess.put(piece, to);
    setPlacement(chess.fen().split(" ")[0]);
    return true;
  }

  function paintSquare(square: Square): void {
    if (!visionFen) return;
    const chess = new Chess(visionFen);
    chess.remove(square);
    if (selectedPiece) chess.put({ color: selectedPiece.color, type: selectedPiece.type }, square);
    setPlacement(chess.fen().split(" ")[0]);
  }

  function submitVision(): void {
    const result = validateFen(visionFen);
    if (!result.valid) return setError(result.message);
    onPosition(visionFen, "vision");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header>
          <div><span className="eyebrow">NEW MATERIAL</span><h2 id="import-title">Import a position</h2></div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <nav className="dialog-tabs">
          {(["pgn", "fen", "image"] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? "is-active" : ""} onClick={() => { setTab(item); setError(""); }}>{item}</button>
          ))}
        </nav>

        {tab === "pgn" && <div className="dialog-body text-import">
          <label htmlFor="pgn-input">Paste one game or a multi-game PGN</label>
          <textarea id="pgn-input" value={text} onChange={(event) => setText(event.target.value)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void file.text().then(setText); }} placeholder={'[White "You"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 …'} autoFocus />
          <input ref={pgnFileRef} hidden type="file" accept=".pgn,application/x-chess-pgn,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setText); }} />
          <div className="dialog-actions"><button type="button" onClick={() => pgnFileRef.current?.click()}>Choose .pgn</button><button type="button" className="primary-action" onClick={submitPgn} disabled={!text.trim()}>Read PGN</button></div>
        </div>}

        {tab === "fen" && <div className="dialog-body text-import">
          <label htmlFor="fen-input">Full FEN, including turn and castling rights</label>
          <textarea id="fen-input" className="fen-input" value={text} onChange={(event) => setText(event.target.value)} placeholder="r1bq1rk1/ppp2ppp/2np1n2/… w - - 0 1" autoFocus />
          <div className="dialog-actions"><button type="button" className="primary-action" onClick={submitFen} disabled={!text.trim()}>Open position</button></div>
        </div>}

        {tab === "image" && <div className="dialog-body vision-import">
          {!placement ? <button type="button" className="image-drop" onClick={() => fileRef.current?.click()}>
            <strong>{recognizing ? "READING 64 SQUARES…" : "CHOOSE A CHESSBOARD SCREENSHOT"}</strong>
            <span>chess.com · Lichess · video · printed diagram</span>
          </button> : <div className="vision-review">
            <div className="vision-source">{imageUrl && <img src={imageUrl} alt="Imported chessboard source" />}</div>
            <div className="vision-board" onClick={(event) => {
              const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[aria-label]");
              const square = target?.getAttribute("aria-label")?.slice(0, 2) as Square | undefined;
              if (square && selectedPiece !== undefined) paintSquare(square);
            }}>
              <ChessBoard fen={visionFen} confidence={confidence} onMove={editSquare} />
            </div>
            <div className="piece-palette">
              <button type="button" className={selectedPiece === null ? "is-active" : ""} onClick={() => setSelectedPiece(null)}>×</button>
              {PIECES.map((piece) => <button
                type="button"
                key={`${piece.color}${piece.type}`}
                className={selectedPiece === piece ? "is-active" : ""}
                aria-label={`${piece.color === "w" ? "White" : "Black"} ${piece.type}`}
                onClick={() => setSelectedPiece(piece)}
              >
                <span className={`piece-palette-glyph piece-${piece.color}`}><PieceGlyph type={piece.type} color={piece.color} /></span>
              </button>)}
            </div>
            <div className="fen-metadata">
              <label>To move<select value={turn} onChange={(event) => setTurn(event.target.value as Color)}><option value="w">White</option><option value="b">Black</option></select></label>
              <label>Castling<input value={castling} onChange={(event) => setCastling(event.target.value.replace(/[^KQkq]/g, ""))} placeholder="KQkq or blank" /></label>
            </div>
            <p className="metadata-warning">A screenshot cannot prove turn, castling or en-passant rights. Confirm them before analysis.</p>
            <div className="dialog-actions"><button type="button" onClick={() => fileRef.current?.click()}>Choose another</button><button type="button" className="primary-action" onClick={submitVision}>Confirm position</button></div>
          </div>}
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && loadImage(event.target.files[0])} />
        </div>}
        {error && <div className="dialog-error" role="alert">{error}</div>}
      </section>
    </div>
  );
}
