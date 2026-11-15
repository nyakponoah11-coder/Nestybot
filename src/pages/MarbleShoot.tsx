import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Trophy, RefreshCw } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";

const MARBLE_COLORS = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#A855F7"];
const MARBLE_R = 12;

interface TrackPoint {
  x: number;
  y: number;
}

interface Marble {
  id: number;
  color: string;
  dist: number; // distance traveled along track
}

interface FiredMarble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

export default function MarbleShoot() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(1);
  const [highScore, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem("marble_shoot_highscore") || 0);
  });
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isWon, setIsWon] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Shooter colors
  const [currentColor, setCurrentColor] = useState<string>(() => MARBLE_COLORS[0]);
  const [nextColor, setNextColor] = useState<string>(() => MARBLE_COLORS[1]);
  const [aimAngle, setAimAngle] = useState<number>(-Math.PI / 2);

  // Track path generation (Curved Spiral toward center)
  const trackRef = useRef<TrackPoint[]>([]);
  const marblesRef = useRef<Marble[]>([]);
  const firedMarblesRef = useRef<FiredMarble[]>([]);
  const stateRef = useRef({
    isGameOver: false,
    isWon: false,
    score: 0,
    combo: 1,
    marbleSpeed: 0.65,
    marbleId: 0,
    currentColor: MARBLE_COLORS[0],
    nextColor: MARBLE_COLORS[1],
    aimAngle: -Math.PI / 2,
  });

  stateRef.current.currentColor = currentColor;
  stateRef.current.nextColor = nextColor;
  stateRef.current.aimAngle = aimAngle;

  // Build curved track coordinates
  const buildTrack = useCallback(() => {
    const pts: TrackPoint[] = [];
    const cx = 300;
    const cy = 300;
    // Spiral inward from outer radius 240 down to 40
    const totalSteps = 1200;
    for (let i = 0; i < totalSteps; i++) {
      const t = i / totalSteps;
      const angle = t * (Math.PI * 5.2);
      const r = 245 - t * 205;
      pts.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    }
    trackRef.current = pts;
  }, []);

  // Initialize Game
  const initGame = useCallback(() => {
    buildTrack();
    const list: Marble[] = [];
    // Spawn 28 starting marbles in a chain
    for (let i = 0; i < 28; i++) {
      const c = MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)];
      list.push({
        id: stateRef.current.marbleId++,
        color: c,
        dist: 28 * (MARBLE_R * 2 + 1) - i * (MARBLE_R * 2 + 1),
      });
    }
    marblesRef.current = list;
    firedMarblesRef.current = [];
    stateRef.current.isGameOver = false;
    stateRef.current.isWon = false;
    stateRef.current.score = 0;
    stateRef.current.combo = 1;
    stateRef.current.marbleSpeed = 0.65;
    setScore(0);
    setCombo(1);
    setIsGameOver(false);
    setIsWon(false);
    setCurrentColor(MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)]);
    setNextColor(MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)]);
  }, [buildTrack]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Swap current and next shooter marble
  const swapMarbles = () => {
    const temp = currentColor;
    setCurrentColor(nextColor);
    setNextColor(temp);
  };

  // Fire marble from center shooter
  const fireMarble = () => {
    if (stateRef.current.isGameOver || stateRef.current.isWon) return;

    const angle = stateRef.current.aimAngle;
    const speed = 14;
    firedMarblesRef.current.push({
      x: 300,
      y: 300,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: stateRef.current.currentColor,
    });

    gameAudio.playMarbleShoot();

    // Advance queue
    setCurrentColor(stateRef.current.nextColor);
    const newNext = MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)];
    setNextColor(newNext);
  };

  // Main Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 600;
    const H = 600;

    const loop = () => {
      const state = stateRef.current;
      const track = trackRef.current;
      const marbles = marblesRef.current;
      const fired = firedMarblesRef.current;

      if (!state.isGameOver && !state.isWon && track.length > 0) {
        // 1. Advance marbles along track
        for (let i = 0; i < marbles.length; i++) {
          marbles[i].dist += state.marbleSpeed;

          // Check if reached center vortex
          if (marbles[i].dist >= track.length - 15) {
            state.isGameOver = true;
            setIsGameOver(true);
            gameAudio.playGameOver();
            setHighScore(prev => {
              const best = Math.max(prev, state.score);
              localStorage.setItem("marble_shoot_highscore", String(best));
              return best;
            });
            break;
          }
        }

        // 2. Update fired projectiles & check collision with track marbles
        for (let fi = fired.length - 1; fi >= 0; fi--) {
          const fm = fired[fi];
          fm.x += fm.vx;
          fm.y += fm.vy;

          let hit = false;
          // Check collision with any marble in chain
          for (let mi = 0; mi < marbles.length; mi++) {
            const m = marbles[mi];
            const trackIdx = Math.min(track.length - 1, Math.max(0, Math.floor(m.dist)));
            const tp = track[trackIdx];
            const dist = Math.hypot(fm.x - tp.x, fm.y - tp.y);

            if (dist < MARBLE_R * 2) {
              // Insert into chain at this position!
              hit = true;
              const inserted: Marble = {
                id: state.marbleId++,
                color: fm.color,
                dist: m.dist + MARBLE_R,
              };
              marbles.splice(mi + 1, 0, inserted);

              // Check contiguous matching colors around insertion
              let start = mi + 1;
              let end = mi + 1;
              while (start > 0 && marbles[start - 1].color === fm.color) start--;
              while (end < marbles.length - 1 && marbles[end + 1].color === fm.color) end++;

              const matchCount = end - start + 1;
              if (matchCount >= 3) {
                // Explode match!
                marbles.splice(start, matchCount);
                state.score += matchCount * 25 * state.combo;
                state.combo++;
                setScore(state.score);
                setCombo(state.combo);
                gameAudio.playMarblePop(state.combo);

                // Pull remaining chain back together
                for (let k = start; k < marbles.length; k++) {
                  marbles[k].dist -= matchCount * (MARBLE_R * 2);
                }

                // Check victory if chain cleared!
                if (marbles.length === 0) {
                  state.isWon = true;
                  setIsWon(true);
                  state.score += 500;
                  setScore(state.score);
                  gameAudio.playWinFanfare();
                  setHighScore(prev => {
                    const best = Math.max(prev, state.score);
                    localStorage.setItem("marble_shoot_highscore", String(best));
                    return best;
                  });
                }
              } else {
                state.combo = 1;
                setCombo(1);
              }
              break;
            }
          }

          // Out of bounds check
          if (hit || fm.x < 0 || fm.x > W || fm.y < 0 || fm.y > H) {
            fired.splice(fi, 1);
          }
        }
      }

      // --- RENDER CANVAS ---
      ctx.clearRect(0, 0, W, H);

      // Ancient Sandstone Temple Tile Background
      const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 340);
      bgGrad.addColorStop(0, "#1E1B4B");
      bgGrad.addColorStop(1, "#09090B");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Draw Spiral Path
      if (track.length > 1) {
        ctx.strokeStyle = "rgba(147, 51, 234, 0.25)";
        ctx.lineWidth = MARBLE_R * 2 + 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(track[0].x, track[0].y);
        for (let i = 1; i < track.length; i += 4) {
          ctx.lineTo(track[i].x, track[i].y);
        }
        ctx.stroke();

        ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Center Vortex Hole (End of track)
      const lastPt = track[track.length - 1] || { x: 300, y: 300 };
      const holeGrad = ctx.createRadialGradient(lastPt.x, lastPt.y, 4, lastPt.x, lastPt.y, 28);
      holeGrad.addColorStop(0, "#EF4444");
      holeGrad.addColorStop(0.7, "#7F1D1D");
      holeGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 28, 0, Math.PI * 2);
      ctx.fill();

      // Draw Marbles along track
      for (const m of marbles) {
        const trackIdx = Math.min(track.length - 1, Math.max(0, Math.floor(m.dist)));
        const pt = track[trackIdx];
        if (!pt) continue;

        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.arc(pt.x + 2, pt.y + 2, MARBLE_R, 0, Math.PI * 2);
        ctx.fill();

        // 3D Marble Sphere
        const grad = ctx.createRadialGradient(
          pt.x - MARBLE_R * 0.35,
          pt.y - MARBLE_R * 0.35,
          MARBLE_R * 0.1,
          pt.x,
          pt.y,
          MARBLE_R
        );
        grad.addColorStop(0, "#FFFFFF");
        grad.addColorStop(0.4, m.color);
        grad.addColorStop(1, "rgba(0,0,0,0.6)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, MARBLE_R, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw Fired Projectile Marbles
      for (const fm of fired) {
        ctx.fillStyle = fm.color;
        ctx.beginPath();
        ctx.arc(fm.x, fm.y, MARBLE_R, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Center Frog/Cannon Shooter
      ctx.save();
      ctx.translate(300, 300);
      ctx.rotate(state.aimAngle);

      // Cannon barrel
      ctx.fillStyle = "#334155";
      ctx.fillRect(8, -8, 26, 16);
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2;
      ctx.strokeRect(8, -8, 26, 16);

      // Cannon base circle
      ctx.fillStyle = "#1E293B";
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Loaded Marble inside barrel
      ctx.fillStyle = state.currentColor;
      ctx.beginPath();
      ctx.arc(14, 0, MARBLE_R * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Aiming Pointer Handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = 600 / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const py = (e.clientY - rect.top) * scale;

    const angle = Math.atan2(py - 300, px - 300);
    setAimAngle(angle);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center select-none py-3 px-3">
      {/* Top Bar */}
      <div className="w-full max-w-xl flex items-center justify-between gap-2 mb-3">
        <Link to="/arcade">
          <Button variant="ghost" size="sm" className="h-9 px-3 gap-1.5 text-slate-300 hover:text-white">
            <ArrowLeft className="size-4" /> Arcade Hub
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-bold text-purple-400">
            🔮 Marble Shoot
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-slate-400 hover:text-white"
            onClick={() => setIsMuted(gameAudio.toggleMute())}
          >
            {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-slate-400 hover:text-white"
            onClick={initGame}
            title="Restart Wave"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Score & Combo Dashboard */}
      <div className="w-full max-w-xl grid grid-cols-3 gap-2 mb-2">
        <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Score</div>
          <div className="text-lg font-black text-amber-400">{score}</div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400">Combo</div>
          <div className="text-lg font-black text-purple-400">{combo}x</div>
        </div>
        <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-center">
          <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-center gap-1">
            <Trophy className="size-3 text-amber-400" /> Best
          </div>
          <div className="text-lg font-black text-white">{highScore}</div>
        </div>
      </div>

      {/* Marble Canvas */}
      <div
        ref={containerRef}
        className="w-full max-w-xl aspect-square relative rounded-2xl overflow-hidden shadow-2xl border-4 border-purple-950 bg-black touch-none"
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          onPointerMove={handlePointerMove}
          onClick={fireMarble}
          className="w-full h-full cursor-crosshair"
        />

        {/* Victory Screen */}
        {isWon && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <span className="text-6xl mb-2">🎉</span>
            <h2 className="text-3xl font-black text-emerald-400 mb-1">
              WAVE CLEARED!
            </h2>
            <p className="text-xs text-slate-300 mb-4">
              All marbles shattered with incredible accuracy! Final Score: {score}
            </p>
            <Button
              onClick={initGame}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 font-black px-8 py-2 rounded-xl text-white shadow-lg"
            >
              Play Next Wave
            </Button>
          </div>
        )}

        {/* Game Over Screen */}
        {isGameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <span className="text-5xl mb-2">💀</span>
            <h2 className="text-2xl sm:text-3xl font-black text-red-500 mb-1">
              MARBLES REACHED HOLE!
            </h2>
            <p className="text-xs text-slate-300 mb-4">
              Vortex consumed the chain. You scored {score} pts.
            </p>
            <Button
              onClick={initGame}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black px-8 py-2 rounded-xl shadow-lg"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Controls & Marble Queue */}
      <div className="w-full max-w-xl mt-3 p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
        {/* Next marble preview & Swap button */}
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold text-slate-400">Loaded / Next</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="size-5 rounded-full border-2 border-white shadow-sm inline-block" style={{ backgroundColor: currentColor }} />
              <span className="text-xs text-slate-400">→</span>
              <span className="size-4 rounded-full border border-slate-400 inline-block opacity-70" style={{ backgroundColor: nextColor }} />
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={swapMarbles}
            className="h-9 px-3 border-slate-700 bg-slate-800 text-xs font-bold gap-1 text-slate-200"
          >
            <RefreshCw className="size-3.5" /> Swap
          </Button>
        </div>

        {/* Shoot Button */}
        <Button
          onClick={fireMarble}
          disabled={isGameOver || isWon}
          className="px-8 h-10 font-black rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg active:scale-95 transition-all"
        >
          Shoot Marble 🔮
        </Button>
      </div>

      {/* Quick Play Instructions */}
      <div className="w-full max-w-xl mt-2 text-[11px] text-slate-400 text-center flex flex-wrap items-center justify-center gap-x-4">
        <span>• Aim with cursor or touch</span>
        <span>• Tap to shoot matching colors (match 3+ to explode)</span>
        <span>• Prevent marbles from reaching the center vortex</span>
      </div>
    </div>
  );
}

