export interface OpeningRecord { eco: string; name: string }

let bookPromise: Promise<Record<string, OpeningRecord>> | null = null;

export function epdKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export async function loadOpeningBook(): Promise<Record<string, OpeningRecord>> {
  bookPromise ??= fetch("/data/openings.json").then((response) => {
    if (!response.ok) throw new Error("Offline opening index is unavailable.");
    return response.json() as Promise<Record<string, OpeningRecord>>;
  });
  return bookPromise;
}

export async function findOpening(fen: string): Promise<OpeningRecord | null> {
  const book = await loadOpeningBook();
  return book[epdKey(fen)] ?? null;
}
