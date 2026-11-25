import { useEffect, useRef, useState } from "react";

type MusicMode = "practice" | "focus";

const TRACKS: Record<MusicMode, { label: string; shortLabel: string; src: string }> = {
  practice: {
    label: "Bach · Cello Suite No. 1 Prelude",
    shortLabel: "Practice",
    src: "/audio/bach-cello-suite-no-1-prelude-dark.mp3",
  },
  focus: {
    label: "Focus · 40 Hz",
    shortLabel: "40 Hz",
    src: "/audio/focus-40hz.mp3",
  },
};

function initialMode(): MusicMode {
  return window.localStorage.getItem("position-zero.music.mode") === "focus" ? "focus" : "practice";
}

function initialVolume(): number {
  const value = window.localStorage.getItem("position-zero.music.volume");
  if (value === null) return 0.35;
  const stored = Number(value);
  return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.35;
}

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [mode, setMode] = useState<MusicMode>(initialMode);
  const [volume, setVolume] = useState(initialVolume);
  const [muted, setMuted] = useState(() => window.localStorage.getItem("position-zero.music.muted") === "true");
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const track = TRACKS[mode];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
    window.localStorage.setItem("position-zero.music.volume", String(volume));
    window.localStorage.setItem("position-zero.music.muted", String(muted));
  }, [muted, volume]);

  useEffect(() => {
    window.localStorage.setItem("position-zero.music.mode", mode);
    setError(false);
    if (!playing) return;
    void audioRef.current?.play().catch(() => setPlaying(false));
  }, [mode]);

  useEffect(() => () => audioRef.current?.pause(), []);

  async function togglePlayback(): Promise<void> {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      setError(false);
      await audio.play();
      setPlaying(true);
    } catch {
      setError(true);
      setPlaying(false);
    }
  }

  function changeVolume(value: string): void {
    const next = Math.min(1, Math.max(0, Number(value)));
    setVolume(next);
    setMuted(next === 0);
  }

  return <section className={`music-player ${error ? "has-error" : ""}`} aria-label="Background music">
    <audio
      ref={audioRef}
      src={track.src}
      loop
      preload="metadata"
      onError={() => { setError(true); setPlaying(false); }}
    />
    <div className="music-now" title={track.label}>
      <span>{error ? "AUDIO ERROR" : "BGM · LOOP"}</span>
      <strong>{track.label}</strong>
    </div>
    <div className="music-modes" role="group" aria-label="Music mode">
      {(Object.keys(TRACKS) as MusicMode[]).map((key) => <button
        type="button"
        key={key}
        className={mode === key ? "is-active" : ""}
        aria-pressed={mode === key}
        onClick={() => setMode(key)}
      >{TRACKS[key].shortLabel}</button>)}
    </div>
    <button type="button" className="music-play" onClick={() => void togglePlayback()} aria-label={playing ? "Pause background music" : "Play background music"} title={playing ? "Pause" : "Play"}>
      <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
    </button>
    <button type="button" className={`music-mute ${muted ? "is-active" : ""}`} onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute background music" : "Mute background music"} aria-pressed={muted}>
      {muted ? "MUTED" : "SOUND"}
    </button>
    <label className="music-volume">
      <span className="visually-hidden">Background music volume</span>
      <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => changeVolume(event.target.value)} aria-label="Background music volume" />
      <output>{Math.round(volume * 100)}</output>
    </label>
  </section>;
}
