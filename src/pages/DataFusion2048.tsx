import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  RotateCcw,
  Volume2,
  VolumeX,
  Trophy,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";

// Tier capacities and visual badges
const BUNDLE_TIERS: Record<number, { label: string; bg: string; text: string; glow: string }> = {
  2: { label: "1GB", bg: "from-amber-600 to-yellow-600", text: "text-amber-100", glow: "shadow-amber-500/20" },
  4: { label: "2GB", bg: "from-sky-600 to-blue-600", text: "text-sky-100", glow: "shadow-sky-500/25" },
  8: { label: "4GB", bg: "from-emerald-600 to-teal-600", text: "text-emerald-100", glow: "shadow-emerald-500/30" },
  16: { label: "8GB", bg: "from-indigo-600 to-purple-600", text: "text-indigo-100", glow: "shadow-purple-500/35" },
  32: { label: "15GB", bg: "from-fuchsia-600 to-pink-600", text: "text-pink-100", glow: "shadow-pink-500/40" },
  64: { label: "25GB", bg: "from-rose-600 to-orange-600", text: "text-rose-100", glow: "shadow-rose-500/45" },
  128: { label: "40GB", bg: "from-orange-500 to-amber-500", text: "text-slate-950 font-black", glow: "shadow-orange-500/50" },
  256: { label: "50GB", bg: "from-yellow-400 to-amber-400", text: "text-slate-950 font-black", glow: "shadow-yellow-400/60" },
  512: { label: "75GB", bg: "from-teal-400 to-cyan-400", text: "text-slate-950 font-black", glow: "shadow-cyan-400/70" },
  1024: { label: "100GB", bg: "from-cyan-300 via-sky-400 to-blue-500", text: "text-slate-950 font-black", glow: "shadow-cyan-300/80" },
  2048: { label: "1TB 👑", bg: "from-yellow-300 via-amber-400 to-yellow-500", text: "text-slate-950 font-black", glow: "shadow-yellow-300/90" },
};

type Grid = number[][];

const createEmptyGrid = (): Grid => [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
];

const addRandomTile = (grid: Grid): Grid => {
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) empty.push([r, c]);
    }
  }
  if (!empty.length) return grid;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = grid.map((row) => [...row]);
  next[r][c] = Math.random() < 0.85 ? 2 : 4;
  return next;
};

export default function DataFusion2048() {
  const [grid, setGrid] = useState<Grid>(() => {
    let g = createEmptyGrid();
    g = addRandomTile(g);
    g = addRandomTile(g);
    return g;
  });

  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("data2048_best") || 0));
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [muted, setMuted] = useState(() => gameAudio.getMuted());

  // Touch swipe handling
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const reset = () => {
    gameAudio.resume();
    let g = createEmptyGrid();
    g = addRandomTile(g);
    g = addRandomTile(g);
    setGrid(g);
    setScore(0);
    setGameOver(false);
    setWon(false);
  };

  // Slide & Merge Logic for a single row
  const slideRow = (row: number[]): { row: number[]; gained: number; mergedCount: number } => {
    let arr = row.filter((v) => v !== 0);
    let gained = 0;
    let mergedCount = 0;

    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        gained += arr[i];
        mergedCount++;
        arr.splice(i + 1, 1);
      }
    }

    while (arr.length < 4) arr.push(0);
    return { row: arr, gained, mergedCount };
  };

  // Move handler in any direction
  const move = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (gameOver) return;
      gameAudio.resume();

      let current = grid;
      let changed = false;
      let roundScore = 0;
      let maxMergeTier = 0;

      // Rotate grid so we always process as 'left' slide
      const rotate = (g: Grid): Grid => {
        const res = createEmptyGrid();
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            res[c][3 - r] = g[r][c];
          }
        }
        return res;
      };

      let working = current.map((r) => [...r]);

      if (dir === "up") working = rotate(rotate(rotate(working)));
      if (dir === "right") working = rotate(rotate(working));
      if (dir === "down") working = rotate(working);

      // Slide all rows
      for (let r = 0; r < 4; r++) {
        const { row, gained, mergedCount } = slideRow(working[r]);
        if (gained > 0) {
          roundScore += gained;
          maxMergeTier = Math.max(maxMergeTier, Math.log2(gained));
        }
        if (row.some((val, idx) => val !== working[r][idx])) {
          changed = true;
        }
        working[r] = row;
      }

      // Rotate back to original orientation
      if (dir === "up") working = rotate(working);
      if (dir === "right") working = rotate(rotate(working));
      if (dir === "down") working = rotate(rotate(rotate(working)));

      if (changed) {
        const nextGrid = addRandomTile(working);
        setGrid(nextGrid);

        if (roundScore > 0) {
          setScore((s) => {
            const nextScore = s + roundScore;
            if (nextScore > best) {
              setBest(nextScore);
              localStorage.setItem("data2048_best", String(nextScore));
            }
            return nextScore;
          });
          gameAudio.playMerge(maxMergeTier);
        } else {
          gameAudio.playSlide();
        }

        // Check for 2048 / 1TB Win
        let hasWon = false;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (nextGrid[r][c] >= 2048) hasWon = true;
          }
        }
        if (hasWon && !won) {
          setWon(true);
          gameAudio.playWinFanfare();
        }

        // Check Game Over (no empty cells and no adjacent equal tiles)
        let canMove = false;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (nextGrid[r][c] === 0) canMove = true;
            if (c < 3 && nextGrid[r][c] === nextGrid[r][c + 1]) canMove = true;
            if (r < 3 && nextGrid[r][c] === nextGrid[r + 1][c]) canMove = true;
          }
        }

        if (!canMove) {
          setGameOver(true);
          gameAudio.playGameOver();
        }
      }
    },
    [grid, gameOver, best, won]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "KeyW"].includes(e.code)) {
        e.preventDefault();
        move("up");
      } else if (["ArrowDown", "KeyS"].includes(e.code)) {
        e.preventDefault();
        move("down");
      } else if (["ArrowLeft", "KeyA"].includes(e.code)) {
        e.preventDefault();
        move("left");
      } else if (["ArrowRight", "KeyD"].includes(e.code)) {
        e.preventDefault();
        move("right");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  // Touch Swipe gestures
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 28) {
      if (absX > absY) {
        move(dx > 0 ? "right" : "left");
      } else {
        move(dy > 0 ? "down" : "up");
      }
    }
  };

  const toggleMute = () => {
    const next = gameAudio.toggleMute();
    setMuted(next);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-3 select-none touch-none">
      {/* Top Header Bar */}
      <div className="w-full max-w-[340px] flex items-center justify-between py-2 mb-2 px-1">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-white transition-colors bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10"
        >
          <ArrowLeft className="size-3.5" /> Back to Shop
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={reset}
            className="size-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
            title="Restart Game"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="size-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-cyan-400" />}
          </Button>
        </div>
      </div>

      {/* Main Game Card */}
      <div className="w-full max-w-[340px] rounded-3xl border-2 border-cyan-500/40 bg-slate-900/90 shadow-[0_10px_50px_rgba(6,182,212,0.2)] overflow-hidden flex flex-col items-center p-4">
        {/* Game Title & HUD */}
        <div className="w-full flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl">🧩</span>
              <h1 className="text-xl font-black text-white tracking-tight">Data 2048</h1>
            </div>
            <p className="text-[11px] text-cyan-300 font-semibold">Fuse Bundles to 1TB</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-950/80 border border-white/10 rounded-xl px-2.5 py-1 text-center min-w-[55px]">
              <div className="text-[9px] uppercase font-bold text-muted-foreground">Score</div>
              <div className="text-sm font-black text-white">{score}</div>
            </div>
            <div className="bg-slate-950/80 border border-white/10 rounded-xl px-2.5 py-1 text-center min-w-[55px]">
              <div className="text-[9px] uppercase font-bold text-cyan-400 flex items-center justify-center gap-0.5">
                <Trophy className="size-2.5" /> Best
              </div>
              <div className="text-sm font-black text-cyan-300">{best}</div>
            </div>
          </div>
        </div>

        {/* 4x4 Game Grid */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative w-[280px] h-[280px] sm:w-[290px] sm:h-[290px] p-2 rounded-2xl bg-slate-950 border border-white/10 grid grid-cols-4 grid-rows-4 gap-2 shadow-inner"
        >
          {grid.map((row, r) =>
            row.map((val, c) => {
              const tier = BUNDLE_TIERS[val];
              return (
                <div
                  key={`${r}-${c}`}
                  className={`rounded-xl flex flex-col items-center justify-center transition-all duration-150 relative overflow-hidden ${
                    val === 0
                      ? "bg-slate-900/40 border border-white/[0.04]"
                      : `bg-gradient-to-br ${tier?.bg || "from-blue-600 to-indigo-600"} shadow-md ${
                          tier?.glow || ""
                        } border border-white/20 animate-in zoom-in-75 duration-100`
                  }`}
                >
                  {val > 0 && (
                    <>
                      <span className={`text-xs sm:text-sm font-black tracking-tight ${tier?.text || "text-white"}`}>
                        {tier?.label || `${val}MB`}
                      </span>
                      <span className="text-[8px] font-bold opacity-70 leading-none mt-0.5">
                        {val >= 1024 ? "MAX" : "DATA"}
                      </span>
                    </>
                  )}
                </div>
              );
            })
          )}

          {/* Win Overlay */}
          {won && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 text-center z-20 animate-in zoom-in-95">
              <span className="text-4xl mb-1">👑</span>
              <h2 className="text-xl font-black text-yellow-300">1TB MASTER!</h2>
              <p className="text-xs text-muted-foreground mt-1">You fused the legendary 1TB bundle!</p>
              <Button
                type="button"
                onClick={() => setWon(false)}
                className="mt-3 h-9 px-5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-black text-xs"
              >
                Keep Playing
              </Button>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 text-center z-20 animate-in zoom-in-95">
              <span className="text-3xl mb-1">⚡</span>
              <h2 className="text-xl font-black text-rose-400">Out of Moves!</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Final Score: {score}</p>
              <Button
                type="button"
                onClick={reset}
                className="mt-3 h-9 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black text-xs gap-1.5"
              >
                <RotateCcw className="size-3.5" /> Play Again
              </Button>
            </div>
          )}
        </div>

        {/* On-screen Directional Touch Controls for mobile */}
        <div className="mt-4 flex flex-col items-center gap-1.5 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => move("up")}
            className="size-10 rounded-xl bg-slate-950/80 border-white/10 hover:border-cyan-400 active:scale-95 text-white p-0 shadow-sm"
            aria-label="Up"
          >
            <ChevronUp className="size-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => move("left")}
              className="size-10 rounded-xl bg-slate-950/80 border-white/10 hover:border-cyan-400 active:scale-95 text-white p-0 shadow-sm"
              aria-label="Left"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => move("down")}
              className="size-10 rounded-xl bg-slate-950/80 border-white/10 hover:border-cyan-400 active:scale-95 text-white p-0 shadow-sm"
              aria-label="Down"
            >
              <ChevronDown className="size-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => move("right")}
              className="size-10 rounded-xl bg-slate-950/80 border-white/10 hover:border-cyan-400 active:scale-95 text-white p-0 shadow-sm"
              aria-label="Right"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>

        {/* Footer Hint */}
        <p className="mt-3 text-[11px] text-muted-foreground text-center">
          Swipe or tap arrows to merge equal data bundles!
        </p>
      </div>
    </div>
  );
}

