import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Sparkles, Trophy } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";

const W = 320;
const H = 480;
const GRAVITY = 0.38;
const JUMP = -6.5;
const PIPE_WIDTH = 52;
const PIPE_GAP = 125;
const PIPE_SPEED = 2.2;

interface Pipe {
  x: number;
  top: number;
  bottom: number;
  passed: boolean;
  hasCoin?: boolean;
  coinCollected?: boolean;
}

export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "play" | "over">("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("flappy_best") || 0));
  const [coins, setCoins] = useState(0);
  const [muted, setMuted] = useState(() => gameAudio.getMuted());

  // Game internal state ref
  const gameState = useRef({
    birdY: H / 2,
    velocity: 0,
    pipes: [] as Pipe[],
    score: 0,
    coins: 0,
    running: false,
    frame: 0,
  });

  const jump = () => {
    const s = gameState.current;
    if (phase === "ready" || phase === "over") {
      start();
      return;
    }
    if (!s.running) return;
    s.velocity = JUMP;
    gameAudio.playFlap();
  };

  const start = () => {
    gameAudio.resume();
    gameAudio.startGemsMusic();
    gameState.current = {
      birdY: H / 2 - 20,
      velocity: JUMP,
      pipes: [
        {
          x: W + 60,
          top: 110,
          bottom: H - 110 - PIPE_GAP,
          passed: false,
          hasCoin: true,
          coinCollected: false,
        },
      ],
      score: 0,
      coins: 0,
      running: true,
      frame: 0,
    };
    setScore(0);
    setCoins(0);
    setPhase("play");
  };

  const gameOver = () => {
    const s = gameState.current;
    s.running = false;
    setPhase("over");
    gameAudio.stopMusic();
    gameAudio.playCrash();

    if (s.score > best) {
      setBest(s.score);
      localStorage.setItem("flappy_best", String(s.score));
      gameAudio.playWinFanfare();
    }
  };

  // Main Loop
  useEffect(() => {
    let animId: number;
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const s = gameState.current;

      // ── UPDATE LOGIC ──
      if (s.running) {
        s.frame++;
        s.velocity += GRAVITY;
        s.birdY += s.velocity;

        // Ground & Ceiling collision
        if (s.birdY + 14 >= H - 24) {
          s.birdY = H - 24 - 14;
          gameOver();
        }
        if (s.birdY - 14 <= 0) {
          s.birdY = 14;
          s.velocity = 0;
        }

        // Move & Spawn Pipes
        for (let i = s.pipes.length - 1; i >= 0; i--) {
          const p = s.pipes[i];
          p.x -= PIPE_SPEED;

          // Check Score
          if (!p.passed && p.x + PIPE_WIDTH < 70) {
            p.passed = true;
            s.score += 1;
            setScore(s.score);
            gameAudio.playPoint();
          }

          // Check Coin Collection
          if (p.hasCoin && !p.coinCollected) {
            const coinX = p.x + PIPE_WIDTH / 2;
            const coinY = p.top + PIPE_GAP / 2;
            const dist = Math.hypot(70 - coinX, s.birdY - coinY);
            if (dist < 26) {
              p.coinCollected = true;
              s.coins += 1;
              s.score += 2;
              setScore(s.score);
              setCoins(s.coins);
              gameAudio.playGemMatch(2);
            }
          }

          // Check Collision with Pipe
          const birdLeft = 70 - 12;
          const birdRight = 70 + 12;
          const birdTop = s.birdY - 12;
          const birdBottom = s.birdY + 12;

          if (birdRight > p.x && birdLeft < p.x + PIPE_WIDTH) {
            if (birdTop < p.top || birdBottom > H - p.bottom) {
              gameOver();
            }
          }

          // Remove off-screen pipes
          if (p.x + PIPE_WIDTH < -10) {
            s.pipes.splice(i, 1);
          }
        }

        // Spawn new pipes
        const lastPipe = s.pipes[s.pipes.length - 1];
        if (!lastPipe || lastPipe.x < W - 140) {
          const minH = 60;
          const maxH = H - PIPE_GAP - minH - 30;
          const top = Math.floor(minH + Math.random() * (maxH - minH));
          const bottom = H - top - PIPE_GAP;
          s.pipes.push({
            x: W + 10,
            top,
            bottom,
            passed: false,
            hasCoin: Math.random() > 0.4,
            coinCollected: false,
          });
        }
      }

      // ── DRAWING ──
      // 1. Digital Cyber Sky background
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#090d16");
      grad.addColorStop(0.65, "#0f172a");
      grad.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Subtle cyber grid lines
      ctx.strokeStyle = "rgba(147, 51, 234, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // 2. Draw Pipes (Telecom Signal Towers)
      for (const p of s.pipes) {
        // Top Pipe
        const topGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_WIDTH, 0);
        topGrad.addColorStop(0, "#059669");
        topGrad.addColorStop(0.5, "#10b981");
        topGrad.addColorStop(1, "#047857");
        ctx.fillStyle = topGrad;
        ctx.fillRect(p.x, 0, PIPE_WIDTH, p.top);

        // Top Pipe Cap
        ctx.fillStyle = "#34d399";
        ctx.fillRect(p.x - 3, p.top - 14, PIPE_WIDTH + 6, 14);

        // Bottom Pipe
        const btmY = H - p.bottom;
        ctx.fillStyle = topGrad;
        ctx.fillRect(p.x, btmY, PIPE_WIDTH, p.bottom);

        // Bottom Pipe Cap
        ctx.fillStyle = "#34d399";
        ctx.fillRect(p.x - 3, btmY, PIPE_WIDTH + 6, 14);

        // Neon Glow details on pipes
        ctx.strokeStyle = "rgba(52, 211, 153, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 8, 0);
        ctx.lineTo(p.x + 8, p.top - 14);
        ctx.moveTo(p.x + 8, btmY + 14);
        ctx.lineTo(p.x + 8, H);
        ctx.stroke();

        // 3. Floating Data Coin / 1GB Token
        if (p.hasCoin && !p.coinCollected) {
          const coinX = p.x + PIPE_WIDTH / 2;
          const coinY = p.top + PIPE_GAP / 2 + Math.sin(s.frame * 0.08) * 6;

          // Glow ring
          ctx.beginPath();
          ctx.arc(coinX, coinY, 13, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
          ctx.fill();

          // Coin disc
          ctx.beginPath();
          ctx.arc(coinX, coinY, 9, 0, Math.PI * 2);
          ctx.fillStyle = "#fbbf24";
          ctx.fill();
          ctx.strokeStyle = "#d97706";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Text label
          ctx.fillStyle = "#78350f";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("1G", coinX, coinY);
        }
      }

      // 4. Ground Line
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, H - 24, W, 24);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(0, H - 24, W, 3);

      // 5. Draw Cyber Bird (Data Drone)
      const birdX = 70;
      const birdY = s.birdY;
      const angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (s.velocity * 4 * Math.PI) / 180));

      ctx.save();
      ctx.translate(birdX, birdY);
      ctx.rotate(angle);

      // Jet Thruster Particle Trail
      if (s.running) {
        ctx.fillStyle = s.velocity < 0 ? "#38bdf8" : "#f97316";
        ctx.beginPath();
        ctx.arc(-16 - Math.random() * 4, (Math.random() - 0.5) * 6, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Drone Body
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wing
      ctx.fillStyle = "#fde68a";
      const wingFlap = Math.sin(s.frame * 0.3) * 4;
      ctx.beginPath();
      ctx.ellipse(-4, wingFlap, 7, 5, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Eye & Visor
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(6, -3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(7, -3, 2, 0, Math.PI * 2);
      ctx.fill();

      // Beak / Sensor
      ctx.fillStyle = "#ea580c";
      ctx.beginPath();
      ctx.moveTo(12, -1);
      ctx.lineTo(19, 2);
      ctx.lineTo(12, 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [phase, best]);

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
          onClick={() => gameAudio.stopMusic()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-white transition-colors bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10"
        >
          <ArrowLeft className="size-3.5" /> Back to Shop
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="size-8 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-emerald-400" />}
          </Button>
        </div>
      </div>

      {/* Game Card Container */}
      <div className="relative w-full max-w-[340px] rounded-3xl border-2 border-emerald-500/40 bg-slate-900/90 shadow-[0_10px_50px_rgba(16,185,129,0.2)] overflow-hidden flex flex-col items-center">
        {/* Score Header HUD */}
        <div className="w-full px-4 py-3 flex items-center justify-between border-b border-white/10 bg-slate-950/60 z-10">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Score</div>
              <div className="text-xl font-black text-white leading-none mt-0.5">{score}</div>
            </div>
            <div className="border-l border-white/10 pl-3">
              <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                <Sparkles className="size-2.5" /> Data Coins
              </div>
              <div className="text-xl font-black text-amber-300 leading-none mt-0.5">{coins}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1 justify-end">
              <Trophy className="size-2.5" /> Best
            </div>
            <div className="text-xl font-black text-emerald-300 leading-none mt-0.5">{best}</div>
          </div>
        </div>

        {/* Canvas Touch Area */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Tap to flap and fly"
          onClick={jump}
          onKeyDown={(e) => {
            if (e.code === "Space" || e.code === "ArrowUp") {
              e.preventDefault();
              jump();
            }
          }}
          className="relative w-[320px] h-[480px] cursor-pointer focus:outline-none"
        >
          <canvas ref={canvasRef} width={W} height={H} className="w-[320px] h-[480px] block" />

          {/* Ready Overlay */}
          {phase === "ready" && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <span className="text-5xl animate-bounce mb-3">🕊️</span>
              <h2 className="text-2xl font-black text-white tracking-tight">Cyber Flap</h2>
              <p className="text-xs text-emerald-300 font-semibold mt-1">Data Flight Edition</p>
              <p className="text-xs text-muted-foreground mt-3 max-w-[200px]">
                Tap anywhere or press Space to fly through the network towers &amp; collect data coins!
              </p>
              <Button
                type="button"
                onClick={start}
                className="mt-5 h-11 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25"
              >
                Tap to Fly 🚀
              </Button>
            </div>
          )}

          {/* Game Over Overlay */}
          {phase === "over" && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
              <span className="text-5xl mb-2">💥</span>
              <h2 className="text-2xl font-black text-red-400 tracking-tight">Connection Lost!</h2>
              <div className="mt-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 w-full max-w-[220px] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Score</span>
                  <span className="font-black text-lg text-white">{score}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-400">Coins Collected</span>
                  <span className="font-black text-amber-300">+{coins}</span>
                </div>
                <div className="border-t border-white/10 pt-1.5 flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-bold">Personal Best</span>
                  <span className="font-black text-emerald-300">{best}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-5">
                <Button
                  type="button"
                  onClick={start}
                  className="h-11 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-md gap-1.5"
                >
                  <RotateCcw className="size-4" /> Try Again
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Helper Bar */}
        <div className="w-full px-4 py-2.5 text-center bg-slate-950/70 border-t border-white/5 text-[11px] text-muted-foreground">
          {phase === "play" ? "Tap anywhere or press Space to flap" : "Play & beat your high score!"}
        </div>
      </div>
    </div>
  );
}

