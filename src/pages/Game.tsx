import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Crown, Volume2, VolumeX } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";

const SIZE = 8;
const GEMS = ["👑", "💎", "🍎", "⭐", "🍀", "🔷"];
const MOVES = 25;
const levelTarget = (lvl: number) => 1000 + (lvl - 1) * 600;

type Board = (number | null)[];
const rnd = () => Math.floor(Math.random() * GEMS.length);

function findMatches(b: Board): Set<number> {
  const m = new Set<number>();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE - 2; c++) {
      const i = r * SIZE + c, v = b[i];
      if (v !== null && v === b[i + 1] && v === b[i + 2]) {
        let k = c; while (k < SIZE && b[r * SIZE + k] === v) { m.add(r * SIZE + k); k++; }
      }
    }
  for (let c = 0; c < SIZE; c++)
    for (let r = 0; r < SIZE - 2; r++) {
      const i = r * SIZE + c, v = b[i];
      if (v !== null && v === b[i + SIZE] && v === b[i + 2 * SIZE]) {
        let k = r; while (k < SIZE && b[k * SIZE + c] === v) { m.add(k * SIZE + c); k++; }
      }
    }
  return m;
}

function newBoard(): Board {
  let b: Board;
  do { b = Array.from({ length: SIZE * SIZE }, rnd); } while (findMatches(b).size);
  return b;
}

function collapse(b: Board): Board {
  const out = [...b];
  for (let c = 0; c < SIZE; c++) {
    const col: number[] = [];
    for (let r = SIZE - 1; r >= 0; r--) { const v = out[r * SIZE + c]; if (v !== null) col.push(v); }
    for (let r = SIZE - 1, k = 0; r >= 0; r--, k++) out[r * SIZE + c] = k < col.length ? col[k] : rnd();
  }
  return out;
}

const adjacent = (a: number, b: number) =>
  (Math.abs(a - b) === 1 && Math.floor(a / SIZE) === Math.floor(b / SIZE)) || Math.abs(a - b) === SIZE;

export default function Game() {
  const [board, setBoard] = useState<Board>(newBoard);
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MOVES);
  const [level, setLevel] = useState(() => Number(localStorage.getItem("m3_level") || 1));
  const [busy, setBusy] = useState(false);
  const [popping, setPopping] = useState<Set<number>>(new Set());
  const [muted, setMuted] = useState(() => gameAudio.getMuted());
  const target = levelTarget(level);
  const won = score >= target;
  const lost = !won && moves <= 0 && !busy;

  // Background music management
  useEffect(() => {
    gameAudio.startGemsMusic();
    return () => {
      gameAudio.stopMusic();
    };
  }, []);

  // Play win/lose jingles
  useEffect(() => {
    if (won) {
      gameAudio.playWinFanfare();
    } else if (lost) {
      gameAudio.playGameOver();
    }
  }, [won, lost]);

  const toggleSound = () => {
    const nextMuted = gameAudio.toggleMute();
    setMuted(nextMuted);
    if (!nextMuted) {
      gameAudio.startGemsMusic();
    }
  };

  const resolve = useCallback(async (b: Board) => {
    let cur = b, combo = 1;
    for (;;) {
      const m = findMatches(cur);
      if (!m.size) break;
      setPopping(m);
      gameAudio.playGemMatch(combo);
      await new Promise(r => setTimeout(r, 250));
      setScore(s => s + m.size * 20 * combo);
      cur = cur.map((v, i) => (m.has(i) ? null : v));
      cur = collapse(cur);
      setPopping(new Set());
      setBoard(cur);
      combo++;
      await new Promise(r => setTimeout(r, 180));
    }
    setBusy(false);
  }, []);

  const dragStartRef = useRef<{ x: number; y: number; index: number; moved: boolean } | null>(null);
  const [activeDragIdx, setActiveDragIdx] = useState<number | null>(null);

  const trySwap = (a: number, b: number) => {
    gameAudio.resume();
    gameAudio.startGemsMusic();
    if (busy || won || moves <= 0) return;
    if (!adjacent(a, b)) return;

    const nb = [...board];
    [nb[a], nb[b]] = [nb[b], nb[a]];
    setSel(null);
    setActiveDragIdx(null);
    setBoard(nb);
    setMoves(m => m - 1);

    const matches = findMatches(nb);
    if (matches.size > 0) {
      setBusy(true);
      resolve(nb);
    } else {
      // Swiped and arranged without an immediate match
      gameAudio.playGemSelect();
    }
  };

  const tap = (i: number) => {
    gameAudio.resume();
    gameAudio.startGemsMusic();
    if (busy || won || moves <= 0) return;
    if (sel === null) {
      gameAudio.playGemSelect();
      return setSel(i);
    }
    if (sel === i) return setSel(null);
    if (!adjacent(sel, i)) {
      gameAudio.playGemSelect();
      return setSel(i);
    }
    trySwap(sel, i);
  };

  const executeSwipe = (startIdx: number, dx: number, dy: number) => {
    const r = Math.floor(startIdx / SIZE);
    const c = startIdx % SIZE;
    let targetIdx: number | null = null;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && c < SIZE - 1) targetIdx = startIdx + 1; // swipe right
      else if (dx < 0 && c > 0) targetIdx = startIdx - 1; // swipe left
    } else {
      if (dy > 0 && r < SIZE - 1) targetIdx = startIdx + SIZE; // swipe down
      else if (dy < 0 && r > 0) targetIdx = startIdx - SIZE; // swipe up
    }

    if (targetIdx !== null) {
      trySwap(startIdx, targetIdx);
      return true;
    }
    return false;
  };

  // Touch event handlers for mobile devices
  const handleTouchStart = (i: number, e: React.TouchEvent) => {
    if (busy || won || moves <= 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    dragStartRef.current = { x: touch.clientX, y: touch.clientY, index: i, moved: false };
    setActiveDragIdx(i);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragStartRef.current || busy || won || moves <= 0) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;

    if (Math.hypot(dx, dy) >= 16) {
      const startIdx = dragStartRef.current.index;
      dragStartRef.current.moved = true;
      const handled = executeSwipe(startIdx, dx, dy);
      if (handled) {
        dragStartRef.current = null;
        setActiveDragIdx(null);
      }
    }
  };

  const handleTouchEnd = (i: number) => {
    setActiveDragIdx(null);
    if (dragStartRef.current && !dragStartRef.current.moved && dragStartRef.current.index === i) {
      dragStartRef.current = null;
      tap(i);
    } else {
      dragStartRef.current = null;
    }
  };

  // Pointer / Mouse drag event handlers
  const handlePointerDown = (i: number, e: React.PointerEvent) => {
    if (busy || won || moves <= 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (_) {}
    dragStartRef.current = { x: e.clientX, y: e.clientY, index: i, moved: false };
    setActiveDragIdx(i);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || busy || won || moves <= 0) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist >= 16) {
      const startIdx = dragStartRef.current.index;
      dragStartRef.current.moved = true;
      const handled = executeSwipe(startIdx, dx, dy);
      if (handled) {
        dragStartRef.current = null;
        setActiveDragIdx(null);
      }
    }
  };

  const handlePointerUp = (i: number, e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    setActiveDragIdx(null);
    if (dragStartRef.current && !dragStartRef.current.moved && dragStartRef.current.index === i) {
      dragStartRef.current = null;
      tap(i);
    } else {
      dragStartRef.current = null;
    }
  };

  const restart = (lvl = level) => {
    gameAudio.startGemsMusic();
    setBoard(newBoard()); setScore(0); setMoves(MOVES); setSel(null); setLevel(lvl);
  };

  useEffect(() => { localStorage.setItem("m3_level", String(level)); }, [level]);

  return (
    <div className="dark min-h-screen bg-background text-foreground px-3 py-4">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between mb-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4 mr-1" />Shop</Link></Button>
          <div className="flex items-center gap-1 font-black text-lg"><Crown className="size-5 text-accent" /> Royal Gems</div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSound}
              title={muted ? "Unmute game music" : "Mute game music"}
              className={muted ? "text-muted-foreground" : "text-accent"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => restart()}><RotateCcw className="size-4" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          {[["Level", level], ["Moves", moves], ["Score", `${score}/${target}`]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-card border border-accent/30 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="font-black text-sm">{v}</div>
            </div>
          ))}
        </div>
        <div className="h-2 rounded-full bg-muted mb-3 overflow-hidden">
          <div className="h-full bg-gradient-gold transition-all" style={{ width: `${Math.min(100, (score / target) * 100)}%` }} />
        </div>
        <div
          onTouchMove={handleTouchMove}
          onTouchCancel={() => { dragStartRef.current = null; setActiveDragIdx(null); }}
          onPointerMove={handlePointerMove}
          onPointerCancel={() => { dragStartRef.current = null; setActiveDragIdx(null); }}
          className="relative grid grid-cols-8 gap-1 p-2 rounded-2xl bg-card border-2 border-accent/40 shadow-glow select-none touch-none"
        >
          {board.map((v, i) => (
            <button
              key={i}
              onTouchStart={(e) => handleTouchStart(i, e)}
              onTouchEnd={() => handleTouchEnd(i)}
              onPointerDown={(e) => handlePointerDown(i, e)}
              onPointerUp={(e) => handlePointerUp(i, e)}
              className={`aspect-square rounded-lg grid place-items-center text-2xl sm:text-3xl transition-all duration-200 select-none touch-none
                ${(Math.floor(i / SIZE) + i) % 2 ? "bg-muted/60" : "bg-muted/30"}
                ${sel === i || activeDragIdx === i ? "ring-2 ring-accent scale-110 shadow-lg z-10 bg-accent/20" : "hover:scale-105 active:scale-95"}
                ${popping.has(i) ? "scale-0 opacity-0" : ""}`}
            >
              {v !== null && GEMS[v]}
            </button>
          ))}
          {(won || lost) && (
            <div className="absolute inset-0 rounded-2xl bg-background/85 backdrop-blur grid place-items-center text-center p-6 z-20">
              <div className="space-y-3">
                <div className="text-5xl">{won ? "🏆" : "😢"}</div>
                <div className="text-2xl font-black">{won ? `Level ${level} complete!` : "Out of moves"}</div>
                <div className="text-sm text-muted-foreground">Score: {score}</div>
                <Button className="bg-gradient-gold text-accent-foreground font-bold w-full" onClick={() => restart(won ? level + 1 : level)}>
                  {won ? "Next level" : "Play again"}
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Swipe any gem to swap and arrange, or tap adjacent gems! Match 3 or more.
        </p>
      </div>
    </div>
  );
}
