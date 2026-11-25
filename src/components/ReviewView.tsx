import { useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { ReviewGrade, Study, TrainingCard } from "../types";
import { ChessBoard } from "./ChessBoard";

interface ReviewViewProps {
  cards: TrainingCard[];
  studies: Study[];
  onGrade: (card: TrainingCard, grade: ReviewGrade) => void;
  onExit: () => void;
}

export function ReviewView({ cards, studies, onGrade, onExit }: ReviewViewProps) {
  const [index, setIndex] = useState(0);
  const card = cards[index];
  const study = studies.find((item) => item.id === card?.studyId);
  const [fen, setFen] = useState(card?.promptFen || new Chess().fen());
  const [lineIndex, setLineIndex] = useState(0);
  const [result, setResult] = useState<"correct" | "wrong" | "revealed" | null>(null);

  useEffect(() => {
    if (!card) return;
    setFen(card.promptFen);
    setLineIndex(0);
    setResult(null);
  }, [card]);

  const arrow = useMemo(() => result && card?.forcingLine[0]
    ? [{ from: card.forcingLine[0].slice(0, 2), to: card.forcingLine[0].slice(2, 4) }]
    : [], [card, result]);

  if (!card) {
    return <main className="review-complete"><span className="card-stamp">PZ—ZERO</span><h1>Queue complete.</h1><p>No position is due right now.</p><button type="button" className="primary-action" onClick={onExit}>Return to laboratory</button></main>;
  }

  function play(from: Square, to: Square): boolean {
    if (result) return false;
    const uci = `${from}${to}`;
    const expected = card.forcingLine[lineIndex];
    const accepted = lineIndex === 0 ? card.acceptedMoves : [expected];
    if (!accepted.some((move) => move.startsWith(uci))) {
      setResult("wrong");
      return false;
    }
    const chess = new Chess(fen);
    try {
      chess.move({ from, to, promotion: (expected?.[4] || "q") as "q" | "r" | "b" | "n" });
    } catch {
      setResult("wrong");
      return false;
    }
    setFen(chess.fen());
    const nextIndex = lineIndex + 1;
    if (nextIndex >= Math.min(4, card.forcingLine.length)) {
      setResult("correct");
      return true;
    }
    setLineIndex(nextIndex);
    const reply = card.forcingLine[nextIndex];
    if (reply) {
      window.setTimeout(() => {
        const replyChess = new Chess(chess.fen());
        replyChess.move({
          from: reply.slice(0, 2) as Square,
          to: reply.slice(2, 4) as Square,
          promotion: (reply[4] || "q") as "q" | "r" | "b" | "n",
        });
        setFen(replyChess.fen());
        const userIndex = nextIndex + 1;
        setLineIndex(userIndex);
        if (userIndex >= Math.min(4, card.forcingLine.length)) setResult("correct");
      }, 420);
    }
    return true;
  }

  function grade(value: ReviewGrade): void {
    onGrade(card, value);
    setIndex((current) => current + 1);
  }

  return <main className="review-layout">
    <header className="review-header">
      <button type="button" onClick={onExit}>← Laboratory</button>
      <span>{index + 1} / {cards.length}</span>
    </header>
    <section className="review-copy">
      <span className="card-stamp">PZ—{study?.cardNumber.toString().padStart(4, "0") || "----"}</span>
      <span className="eyebrow">ACTIVE RECALL</span>
      <h1>{study?.title || "Find the move"}</h1>
      <p>Find the first move, then calculate the forcing reply before you continue.</p>
      {result && <div className={`review-result is-${result}`}><strong>{result === "correct" ? "Pattern found." : "Pattern missed."}</strong><span>{card.forcingLine.slice(0, 4).join("  ")}</span></div>}
      {!result && <button type="button" className="text-action" onClick={() => setResult("revealed")}>Reveal line</button>}
      {result && <div className="grade-actions"><button type="button" onClick={() => grade("again")}>Again<small>10 min</small></button><button type="button" onClick={() => grade("hard")}>Hard<small>≥ 1 day</small></button><button type="button" className="is-good" onClick={() => grade("good")}>Good<small>× 2.5</small></button></div>}
    </section>
    <section className="review-board"><ChessBoard fen={fen} onMove={play} arrows={arrow} disabled={Boolean(result)} /></section>
  </main>;
}
