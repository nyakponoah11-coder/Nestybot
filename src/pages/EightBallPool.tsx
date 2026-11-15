import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, User, Bot, Users, Trophy, Check, Lock, Unlock, Maximize2, Minimize2, Smartphone, HelpCircle, X } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";

interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isStripe: boolean;
  isCue: boolean;
  isEight: boolean;
  potted: boolean;
  opacity: number;
}

interface Pocket {
  x: number;
  y: number;
  radius: number;
}

type GameMode = "vs-ai" | "two-player";
type Difficulty = "normal" | "hard";
type BallGroup = "solids" | "stripes" | null;

// Official Aramith Tournament Billiard Colors
const BALL_COLORS: Record<number, string> = {
  1: "#EAB308", // Yellow
  2: "#2563EB", // Blue
  3: "#DC2626", // Red
  4: "#7C3AED", // Purple
  5: "#EA580C", // Orange
  6: "#16A34A", // Green
  7: "#7F1D1D", // Maroon/Burgundy
  8: "#0F172A", // 8-Ball Black
  9: "#EAB308",
  10: "#2563EB",
  11: "#DC2626",
  12: "#7C3AED",
  13: "#EA580C",
  14: "#16A34A",
  15: "#7F1D1D",
};

const SOLID_IDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPE_IDS = [9, 10, 11, 12, 13, 14, 15];

export default function EightBallPool() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cueStickTrackRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<GameMode>("vs-ai");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [isMuted, setIsMuted] = useState(false);

  // Match Wins Score
  const [p1Wins, setP1Wins] = useState<number>(0);
  const [p2Wins, setP2Wins] = useState<number>(0);

  const [currentTurn, setCurrentTurn] = useState<"player1" | "player2">("player1");
  const [p1Group, setP1Group] = useState<BallGroup>(null);
  const [p2Group, setP2Group] = useState<BallGroup>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>("Open Table: Break the rack to start!");
  const [aimAngle, setAimAngle] = useState<number>(0);
  const [power, setPower] = useState<number>(55);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [ballsMoving, setBallsMoving] = useState<boolean>(false);

  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth > window.innerHeight;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    document.addEventListener("fullscreenchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      document.removeEventListener("fullscreenchange", handleResize);
    };
  }, []);

  const handleToggleFullscreen = () => {
    const elem = document.documentElement as any;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
      if (screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock("landscape").catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  // Table Dimensions (860 x 440)
  const TABLE_W = 860;
  const TABLE_H = 440;
  const RAIL_THICK = 36;
  const BALL_R = 12.8;
  const POCKET_R = 26;

  const pockets: Pocket[] = [
    { x: RAIL_THICK + 2, y: RAIL_THICK + 2, radius: POCKET_R },
    { x: TABLE_W / 2, y: RAIL_THICK - 4, radius: POCKET_R - 2 },
    { x: TABLE_W - RAIL_THICK - 2, y: RAIL_THICK + 2, radius: POCKET_R },
    { x: RAIL_THICK + 2, y: TABLE_H - RAIL_THICK - 2, radius: POCKET_R },
    { x: TABLE_W / 2, y: TABLE_H - RAIL_THICK + 4, radius: POCKET_R - 2 },
    { x: TABLE_W - RAIL_THICK - 2, y: TABLE_H - RAIL_THICK - 2, radius: POCKET_R },
  ];

  const ballsRef = useRef<Ball[]>([]);
  const stateRef = useRef({
    currentTurn: "player1" as "player1" | "player2",
    p1Group: null as BallGroup,
    p2Group: null as BallGroup,
    mode: "vs-ai" as GameMode,
    difficulty: "normal" as Difficulty,
    ballsMoving: false,
    pottedThisTurn: [] as number[],
    cuePotted: false,
    firstHitBall: null as number | null,
    isAiThinking: false,
    aimAngle: 0,
    power: 55,
    isPulling: false,
    movingStartTime: 0,
    cueAnimationStrike: 0,
  });

  stateRef.current.currentTurn = currentTurn;
  stateRef.current.p1Group = p1Group;
  stateRef.current.p2Group = p2Group;
  stateRef.current.mode = mode;
  stateRef.current.difficulty = difficulty;
  stateRef.current.aimAngle = aimAngle;
  stateRef.current.power = power;
  stateRef.current.isPulling = isPulling;

  // Initialize & Rack 15 Balls
  const initBalls = useCallback(() => {
    const list: Ball[] = [];

    // White Cue Ball
    list.push({
      id: 0,
      x: TABLE_W * 0.28,
      y: TABLE_H / 2,
      vx: 0,
      vy: 0,
      radius: BALL_R,
      color: "#FFFFFF",
      isStripe: false,
      isCue: true,
      isEight: false,
      potted: false,
      opacity: 1,
    });

    // 15 racked balls in official triangular diamond formation
    const rackStartX = TABLE_W * 0.68;
    const rackCenterY = TABLE_H / 2;
    const d = BALL_R * 2 + 0.3;
    const sqrt3 = Math.sqrt(3);

    const rackOrder = [
      1,
      9, 2,
      3, 8, 10,
      11, 4, 12, 5,
      6, 13, 7, 14, 15
    ];

    let idx = 0;
    for (let row = 0; row < 5; row++) {
      const rx = rackStartX + row * (BALL_R * sqrt3);
      const startY = rackCenterY - (row * d) / 2;
      for (let col = 0; col <= row; col++) {
        const ballNum = rackOrder[idx++];
        list.push({
          id: ballNum,
          x: rx,
          y: startY + col * d,
          vx: 0,
          vy: 0,
          radius: BALL_R,
          color: BALL_COLORS[ballNum] || "#FFF",
          isStripe: ballNum > 8,
          isCue: false,
          isEight: ballNum === 8,
          potted: false,
          opacity: 1,
        });
      }
    }

    ballsRef.current = list;
    setP1Group(null);
    setP2Group(null);
    setWinner(null);
    setCurrentTurn("player1");
    setStatusText("Open Table: Aim at the rack, pull the cue stick & release!");
    setBallsMoving(false);
    setIsPulling(false);
    setPower(55);
  }, []);

  useEffect(() => {
    initBalls();
  }, [initBalls]);

  // AI Turn Logic
  const executeAiTurn = useCallback(() => {
    if (stateRef.current.isAiThinking || stateRef.current.ballsMoving) return;
    stateRef.current.isAiThinking = true;
    setStatusText("Computer is calculating best cut shot...");

    setTimeout(() => {
      try {
        const balls = ballsRef.current;
        let cue = balls.find(b => b.isCue && !b.potted);
        if (!cue) {
          const anyCue = balls.find(b => b.isCue);
          if (anyCue) {
            anyCue.potted = false;
            anyCue.x = TABLE_W * 0.28;
            anyCue.y = TABLE_H / 2;
            anyCue.vx = 0;
            anyCue.vy = 0;
            cue = anyCue;
          } else {
            stateRef.current.isAiThinking = false;
            return;
          }
        }

        const aiGroup = stateRef.current.p2Group;
        let targetCandidates = balls.filter(b => {
          if (b.isCue || b.potted) return false;
          if (!aiGroup) return !b.isEight;
          if (b.isEight) {
            const remainingGroup = balls.filter(x => !x.potted && !x.isCue && !x.isEight && (aiGroup === "solids" ? !x.isStripe : x.isStripe));
            return remainingGroup.length === 0;
          }
          return aiGroup === "solids" ? !b.isStripe : b.isStripe;
        });

        if (targetCandidates.length === 0) {
          targetCandidates = balls.filter(b => !b.isCue && !b.potted);
        }

        let bestAngle = 0;
        let bestScore = Infinity;

        for (const target of targetCandidates) {
          for (const p of pockets) {
            const tpDist = Math.hypot(p.x - target.x, p.y - target.y);
            const angleTargetPocket = Math.atan2(p.y - target.y, p.x - target.x);
            const ghostX = target.x - Math.cos(angleTargetPocket) * (BALL_R * 2);
            const ghostY = target.y - Math.sin(angleTargetPocket) * (BALL_R * 2);

            const cueGhostDist = Math.hypot(ghostX - cue.x, ghostY - cue.y);
            const cutAngle = Math.abs(angleTargetPocket - Math.atan2(ghostY - cue.y, ghostX - cue.x));
            const score = tpDist + cueGhostDist * 0.4 + cutAngle * 50;

            if (score < bestScore) {
              bestScore = score;
              bestAngle = Math.atan2(ghostY - cue.y, ghostX - cue.x);
            }
          }
        }

        const variance = stateRef.current.difficulty === "normal" ? (Math.random() - 0.5) * 0.04 : (Math.random() - 0.5) * 0.01;
        const finalAngle = bestAngle + variance;
        const shotPower = stateRef.current.difficulty === "normal" ? 50 + Math.random() * 25 : 65 + Math.random() * 20;

        setAimAngle(finalAngle);
        setPower(shotPower);

        setIsPulling(true);
        gameAudio.playCuePull(shotPower);

        setTimeout(() => {
          setIsPulling(false);
          shootBall(finalAngle, shotPower);
          stateRef.current.isAiThinking = false;
        }, 750);
      } catch (err) {
        console.error("AI turn error:", err);
        stateRef.current.isAiThinking = false;
      }
    }, 850);
  }, [pockets]);

  // Automated Watchdog: Guarantees Computer AI always takes its shot reliably (even when sinking a ball & shooting again)
  useEffect(() => {
    if (currentTurn === "player2" && mode === "vs-ai" && !ballsMoving && !winner) {
      const timer = setTimeout(() => {
        if (!stateRef.current.isAiThinking && !stateRef.current.ballsMoving && stateRef.current.currentTurn === "player2") {
          executeAiTurn();
        }
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [currentTurn, mode, ballsMoving, winner, executeAiTurn]);

  // Execute Shoot: Snaps Cue Forward & Launches Ball Straight along Aim Angle
  const shootBall = (angle: number, pwr: number) => {
    const cue = ballsRef.current.find(b => b.isCue && !b.potted);
    if (!cue || stateRef.current.ballsMoving) return;

    const clampedPower = Math.max(10, Math.min(100, pwr));
    // Energetic, high-speed cue ball strike impulse (GamePigeon calibrated)
    const impulse = (clampedPower / 100) * 36 + 6.0;

    stateRef.current.cueAnimationStrike = 1;
    cue.vx = Math.cos(angle) * impulse;
    cue.vy = Math.sin(angle) * impulse;

    gameAudio.playCueStrike(clampedPower);

    stateRef.current.pottedThisTurn = [];
    stateRef.current.cuePotted = false;
    stateRef.current.firstHitBall = null;
    stateRef.current.movingStartTime = Date.now();
    stateRef.current.ballsMoving = true;
    setBallsMoving(true);
    setIsPulling(false);
  };

  const adjustAim = (deltaRad: number) => {
    if (ballsMoving || winner) return;
    setAimAngle(prev => prev + deltaRad);
  };

  // Pure Elastic Billiard Physics Engine
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SUB_STEPS = 6;
    // Calibrated tournament felt friction: decays smoothly (0.992 per frame across 6 sub-steps)
    const FRICTION = Math.pow(0.992, 1 / SUB_STEPS);
    const RESTITUTION = 0.94; // Authentic phenolic Aramith ball bounce
    const CUSHION_RESTITUTION = 0.88; // Snappy rubber cushion rebound
    const STOP_THRESHOLD = 0.06; // Smooth, gradual rollout to a natural stop

    const loop = () => {
      let anyMoving = false;
      const balls = ballsRef.current;
      const isMoving = stateRef.current.ballsMoving;

      // 7-second safety cutoff to guarantee balls never roll forever
      if (isMoving && Date.now() - stateRef.current.movingStartTime > 7000) {
        for (const b of balls) {
          b.vx = 0;
          b.vy = 0;
        }
      }

      if (isMoving) {
        for (let step = 0; step < SUB_STEPS; step++) {
          // 1. Position update, felt friction & cushion bounces
          for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            if (b.potted) continue;

            b.x += b.vx / SUB_STEPS;
            b.y += b.vy / SUB_STEPS;
            b.vx *= FRICTION;
            b.vy *= FRICTION;

            if (Math.hypot(b.vx, b.vy) < STOP_THRESHOLD) {
              b.vx = 0;
              b.vy = 0;
            } else {
              anyMoving = true;
            }

            const minX = RAIL_THICK + b.radius;
            const maxX = TABLE_W - RAIL_THICK - b.radius;
            const minY = RAIL_THICK + b.radius;
            const maxY = TABLE_H - RAIL_THICK - b.radius;

            if (b.x < minX && b.vx < 0) {
              b.x = minX;
              b.vx = -b.vx * CUSHION_RESTITUTION;
              if (step === 0 && Math.abs(b.vx) > 0.4) gameAudio.playBallHit(Math.abs(b.vx) / 9);
            } else if (b.x > maxX && b.vx > 0) {
              b.x = maxX;
              b.vx = -b.vx * CUSHION_RESTITUTION;
              if (step === 0 && Math.abs(b.vx) > 0.4) gameAudio.playBallHit(Math.abs(b.vx) / 9);
            }

            if (b.y < minY && b.vy < 0) {
              b.y = minY;
              b.vy = -b.vy * CUSHION_RESTITUTION;
              if (step === 0 && Math.abs(b.vy) > 0.4) gameAudio.playBallHit(Math.abs(b.vy) / 9);
            } else if (b.y > maxY && b.vy > 0) {
              b.y = maxY;
              b.vy = -b.vy * CUSHION_RESTITUTION;
              if (step === 0 && Math.abs(b.vy) > 0.4) gameAudio.playBallHit(Math.abs(b.vy) / 9);
            }

            // Clean Pocket Sink
            for (const p of pockets) {
              const dist = Math.hypot(b.x - p.x, b.y - p.y);
              if (dist < p.radius) {
                b.potted = true;
                b.vx = 0;
                b.vy = 0;
                gameAudio.playPocket();
                if (b.isCue) {
                  stateRef.current.cuePotted = true;
                } else {
                  stateRef.current.pottedThisTurn.push(b.id);
                }
                break;
              }
            }
          }

          // 2. Ball to Ball Elastic Collisions
          for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
              const b1 = balls[i];
              const b2 = balls[j];
              if (b1.potted || b2.potted) continue;

              const dx = b2.x - b1.x;
              const dy = b2.y - b1.y;
              const dist = Math.hypot(dx, dy);
              const minDist = b1.radius + b2.radius;

              if (dist > 0 && dist < minDist) {
                const nx = dx / dist;
                const ny = dy / dist;

                const kx = b1.vx - b2.vx;
                const ky = b1.vy - b2.vy;
                const vn = kx * nx + ky * ny;

                if (vn > 0) {
                  const impulse = (1 + RESTITUTION) * vn * 0.5;
                  b1.vx -= impulse * nx;
                  b1.vy -= impulse * ny;
                  b2.vx += impulse * nx;
                  b2.vy += impulse * ny;

                  if (step === 0 && vn > 0.4) {
                    gameAudio.playBallHit(vn / 10);
                  }

                  if (b1.isCue && stateRef.current.firstHitBall === null) {
                    stateRef.current.firstHitBall = b2.id;
                  } else if (b2.isCue && stateRef.current.firstHitBall === null) {
                    stateRef.current.firstHitBall = b1.id;
                  }
                }

                const overlap = (minDist - dist) * 0.5;
                b1.x -= nx * overlap;
                b1.y -= ny * overlap;
                b2.x += nx * overlap;
                b2.y += ny * overlap;
              }
            }
          }
        }
      }

      if (stateRef.current.cueAnimationStrike > 0) {
        stateRef.current.cueAnimationStrike = Math.max(0, stateRef.current.cueAnimationStrike - 0.15);
      }

      // Turn Resolution
      if (!anyMoving && stateRef.current.ballsMoving) {
        stateRef.current.ballsMoving = false;
        setBallsMoving(false);

        const potted = stateRef.current.pottedThisTurn;
        const cueScratched = stateRef.current.cuePotted;
        const curTurn = stateRef.current.currentTurn;
        const p1Grp = stateRef.current.p1Group;
        const curPlayerGroup = curTurn === "player1" ? p1Grp : stateRef.current.p2Group;

        if (cueScratched) {
          const cue = balls.find(b => b.isCue);
          if (cue) {
            cue.potted = false;
            cue.x = TABLE_W * 0.28;
            cue.y = TABLE_H / 2;
            cue.vx = 0;
            cue.vy = 0;
          }
          setStatusText(`⚠️ Scratch! Cue ball sunk. Turn passes to ${curTurn === "player1" ? "Player 2" : "Player 1"}!`);
          switchTurn();
        } else if (potted.includes(8)) {
          const remainingOwnBalls = balls.filter(b =>
            !b.potted && !b.isCue && !b.isEight &&
            (curPlayerGroup === "solids" ? !b.isStripe : b.isStripe)
          );

          if (curPlayerGroup && remainingOwnBalls.length === 0) {
            const winName = curTurn === "player1" ? "Player 1" : (stateRef.current.mode === "vs-ai" ? "Computer" : "Player 2");
            setWinner(winName);
            if (curTurn === "player1") setP1Wins(w => w + 1);
            else setP2Wins(w => w + 1);
            setStatusText(`🎉 ${winName} pocketed the 8-ball and wins the match!`);
            gameAudio.playWinFanfare();
          } else {
            const winName = curTurn === "player1" ? (stateRef.current.mode === "vs-ai" ? "Computer" : "Player 2") : "Player 1";
            setWinner(winName);
            if (winName === "Player 1") setP1Wins(w => w + 1);
            else setP2Wins(w => w + 1);
            setStatusText(`💀 8-Ball pocketed early! ${winName} wins!`);
            gameAudio.playGameOver();
          }
        } else if (potted.length > 0) {
          if (!p1Grp) {
            const firstPottedId = potted[0];
            const isFirstStripe = firstPottedId > 8;
            const assignedP1: BallGroup = curTurn === "player1"
              ? (isFirstStripe ? "stripes" : "solids")
              : (isFirstStripe ? "solids" : "stripes");
            const assignedP2: BallGroup = assignedP1 === "solids" ? "stripes" : "solids";

            setP1Group(assignedP1);
            setP2Group(assignedP2);
            stateRef.current.p1Group = assignedP1;
            stateRef.current.p2Group = assignedP2;
            const shooterName = curTurn === "player1" ? "Player 1" : (stateRef.current.mode === "vs-ai" ? "Computer" : "Player 2");
            setStatusText(`🎯 Groups assigned! Player 1 is ${assignedP1.toUpperCase()}, ${stateRef.current.mode === "vs-ai" ? "Computer" : "Player 2"} is ${assignedP2.toUpperCase()}! ${shooterName} shoots again.`);
          } else {
            const hasOwn = potted.some(id => {
              const b = balls.find(x => x.id === id);
              if (!b || b.isEight) return false;
              return curPlayerGroup === "solids" ? !b.isStripe : b.isStripe;
            });

            if (hasOwn) {
              const shooterName = curTurn === "player1" ? "Player 1" : (stateRef.current.mode === "vs-ai" ? "Computer" : "Player 2");
              setStatusText(`🔥 Great shot! ${shooterName} pocketed a ball! Shoot again.`);
            } else {
              setStatusText(`Opponent's ball pocketed. Turn passes.`);
              switchTurn();
            }
          }
        } else {
          setStatusText(`No ball pocketed. Turn passes to ${curTurn === "player1" ? (stateRef.current.mode === "vs-ai" ? "Computer" : "Player 2") : "Player 1"}.`);
          switchTurn();
        }
      }

      // ==========================================================
      // CANVAS RENDERING
      // ==========================================================
      ctx.clearRect(0, 0, TABLE_W, TABLE_H);

      // Table Rails
      const woodGrad = ctx.createLinearGradient(0, 0, TABLE_W, TABLE_H);
      woodGrad.addColorStop(0, "#2D1810");
      woodGrad.addColorStop(0.3, "#422216");
      woodGrad.addColorStop(0.7, "#24130C");
      woodGrad.addColorStop(1, "#180A05");
      ctx.fillStyle = woodGrad;
      ctx.beginPath();
      ctx.roundRect(0, 0, TABLE_W, TABLE_H, 24);
      ctx.fill();

      ctx.strokeStyle = "rgba(217, 119, 6, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(8, 8, TABLE_W - 16, TABLE_H - 16, 18);
      ctx.stroke();

      // Diamond sights
      const drawDiamond = (x: number, y: number) => {
        ctx.fillStyle = "#E2E8F0";
        ctx.beginPath();
        ctx.moveTo(x, y - 3.5);
        ctx.lineTo(x + 3.5, y);
        ctx.lineTo(x, y + 3.5);
        ctx.lineTo(x - 3.5, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#94A3B8";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      };

      for (let i = 1; i <= 3; i++) {
        drawDiamond(RAIL_THICK + i * ((TABLE_W / 2 - RAIL_THICK) / 4), RAIL_THICK / 2);
        drawDiamond(TABLE_W / 2 + i * ((TABLE_W / 2 - RAIL_THICK) / 4), RAIL_THICK / 2);
        drawDiamond(RAIL_THICK + i * ((TABLE_W / 2 - RAIL_THICK) / 4), TABLE_H - RAIL_THICK / 2);
        drawDiamond(TABLE_W / 2 + i * ((TABLE_W / 2 - RAIL_THICK) / 4), TABLE_H - RAIL_THICK / 2);
      }
      for (let i = 1; i <= 3; i++) {
        drawDiamond(RAIL_THICK / 2, RAIL_THICK + i * ((TABLE_H - RAIL_THICK * 2) / 4));
        drawDiamond(TABLE_W - RAIL_THICK / 2, RAIL_THICK + i * ((TABLE_H - RAIL_THICK * 2) / 4));
      }

      // Green Felt Cloth
      const clothGrad = ctx.createRadialGradient(
        TABLE_W / 2, TABLE_H / 2, 40,
        TABLE_W / 2, TABLE_H / 2, TABLE_W * 0.6
      );
      clothGrad.addColorStop(0, "#0D6B42");
      clothGrad.addColorStop(0.7, "#094D2F");
      clothGrad.addColorStop(1, "#05331E");
      ctx.fillStyle = clothGrad;
      ctx.beginPath();
      ctx.roundRect(RAIL_THICK, RAIL_THICK, TABLE_W - RAIL_THICK * 2, TABLE_H - RAIL_THICK * 2, 8);
      ctx.fill();

      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 4;
      ctx.strokeRect(RAIL_THICK, RAIL_THICK, TABLE_W - RAIL_THICK * 2, TABLE_H - RAIL_THICK * 2);

      // Head string marker line
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(TABLE_W * 0.28, RAIL_THICK);
      ctx.lineTo(TABLE_W * 0.28, TABLE_H - RAIL_THICK);
      ctx.stroke();

      // Drop Pockets
      for (const p of pockets) {
        ctx.fillStyle = "#09090B";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#030712";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius - 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Aiming Lines & Ghost Ball
      const cue = balls.find(b => b.isCue && !b.potted);
      const isUserTurn = stateRef.current.currentTurn === "player1" || stateRef.current.mode === "two-player";

      if (cue && !stateRef.current.ballsMoving && isUserTurn && !winner) {
        const curAngle = stateRef.current.aimAngle;
        const curPower = stateRef.current.power;
        const dirX = Math.cos(curAngle);
        const dirY = Math.sin(curAngle);

        let closestHitBall: Ball | null = null;
        let minRayDist = Infinity;

        for (const target of balls) {
          if (target.isCue || target.potted) continue;
          const toTargetX = target.x - cue.x;
          const toTargetY = target.y - cue.y;
          const proj = toTargetX * dirX + toTargetY * dirY;

          if (proj > 0) {
            const perpDistSq = (toTargetX * toTargetX + toTargetY * toTargetY) - proj * proj;
            const collisionRadius = BALL_R * 2;
            if (perpDistSq < collisionRadius * collisionRadius) {
              const hitDist = proj - Math.sqrt(collisionRadius * collisionRadius - perpDistSq);
              if (hitDist > 0 && hitDist < minRayDist) {
                minRayDist = hitDist;
                closestHitBall = target;
              }
            }
          }
        }

        const ghostDist = closestHitBall ? minRayDist : 360;
        const ghostX = cue.x + dirX * ghostDist;
        const ghostY = cue.y + dirY * ghostDist;

        // Primary Aim Line
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = stateRef.current.isPulling ? "rgba(250, 204, 21, 0.95)" : "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cue.x, cue.y);
        ctx.lineTo(ghostX, ghostY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Ghost Cue Ball & Exact Target Path
        if (closestHitBall) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(ghostX, ghostY, BALL_R, 0, Math.PI * 2);
          ctx.stroke();

          const targetNormX = (closestHitBall.x - ghostX) / (BALL_R * 2);
          const targetNormY = (closestHitBall.y - ghostY) / (BALL_R * 2);
          const targetLineLen = 100 + (curPower / 100) * 120;

          ctx.strokeStyle = "#38BDF8";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(closestHitBall.x, closestHitBall.y);
          ctx.lineTo(closestHitBall.x + targetNormX * targetLineLen, closestHitBall.y + targetNormY * targetLineLen);
          ctx.stroke();

          ctx.fillStyle = "#38BDF8";
          ctx.beginPath();
          ctx.arc(closestHitBall.x + targetNormX * targetLineLen, closestHitBall.y + targetNormY * targetLineLen, 3.5, 0, Math.PI * 2);
          ctx.fill();

          const vn = dirX * targetNormX + dirY * targetNormY;
          const cueDeflectX = dirX - vn * targetNormX;
          const cueDeflectY = dirY - vn * targetNormY;
          const deflectLen = Math.hypot(cueDeflectX, cueDeflectY);

          if (deflectLen > 0.05) {
            const normDeflectX = cueDeflectX / deflectLen;
            const normDeflectY = cueDeflectY / deflectLen;
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(ghostX, ghostY);
            ctx.lineTo(ghostX + normDeflectX * 60, ghostY + normDeflectY * 60);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Cue Stick on Table
        const pullDistance = 22 + (curPower / 100) * 60 - stateRef.current.cueAnimationStrike * 35;
        const stickStartX = cue.x - dirX * pullDistance;
        const stickStartY = cue.y - dirY * pullDistance;
        const stickEndX = cue.x - dirX * (pullDistance + 210);
        const stickEndY = cue.y - dirY * (pullDistance + 210);

        if (stateRef.current.isPulling) {
          ctx.strokeStyle = curPower > 70 ? "rgba(239, 68, 68, 0.45)" : curPower > 40 ? "rgba(245, 158, 11, 0.45)" : "rgba(16, 185, 129, 0.45)";
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(stickStartX, stickStartY);
          ctx.lineTo(stickEndX, stickEndY);
          ctx.stroke();
        }

        const cueGrad = ctx.createLinearGradient(stickStartX, stickStartY, stickEndX, stickEndY);
        cueGrad.addColorStop(0, "#F59E0B");
        cueGrad.addColorStop(0.6, "#B45309");
        cueGrad.addColorStop(1, "#3E1E09");
        ctx.strokeStyle = cueGrad;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(stickStartX, stickStartY);
        ctx.lineTo(stickEndX, stickEndY);
        ctx.stroke();

        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(stickStartX, stickStartY);
        ctx.lineTo(stickStartX - dirX * 7, stickStartY - dirY * 7);
        ctx.stroke();
      }

      // Draw 3D Billiard Balls
      for (const b of balls) {
        if (b.potted) continue;

        const shadowGrad = ctx.createRadialGradient(
          b.x + 2.5, b.y + 3.5, 2,
          b.x + 2.5, b.y + 3.5, b.radius + 3
        );
        shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
        shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.arc(b.x + 2.5, b.y + 3.5, b.radius + 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = b.isStripe ? "#F8FAFC" : b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        if (b.isStripe) {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, -0.68, 0.68);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, Math.PI - 0.68, Math.PI + 0.68);
          ctx.fill();
        }

        // 3D Sphere Shading
        const sphereGloss = ctx.createRadialGradient(
          b.x - b.radius * 0.38, b.y - b.radius * 0.38, b.radius * 0.08,
          b.x, b.y, b.radius
        );
        sphereGloss.addColorStop(0, "rgba(255, 255, 255, 0.75)");
        sphereGloss.addColorStop(0.35, "rgba(255, 255, 255, 0.08)");
        sphereGloss.addColorStop(0.85, "rgba(0, 0, 0, 0.2)");
        sphereGloss.addColorStop(1, "rgba(0, 0, 0, 0.62)");
        ctx.fillStyle = sphereGloss;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();

        // Crisp White Number Badge & Bold Number ON TOP (always crystal clear & visible!)
        if (!b.isCue) {
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius * 0.54, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#09090B";
          ctx.font = `900 ${b.id > 9 ? "9.5px" : "11px"} sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(b.id), b.x, b.y + 0.5);
        } else {
          ctx.fillStyle = "#DC2626";
          ctx.beginPath();
          ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.2, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [pockets, winner]);

  const switchTurn = () => {
    setCurrentTurn(prev => {
      const next = prev === "player1" ? "player2" : "player1";
      stateRef.current.currentTurn = next;

      if (next === "player2" && stateRef.current.mode === "vs-ai") {
        setTimeout(() => executeAiTurn(), 500);
      }
      return next;
    });
  };

  // Canvas Mouse/Touch Aiming
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (ballsMoving || winner || (currentTurn === "player2" && mode === "vs-ai")) return;
    updateAngleFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons > 0 && !ballsMoving && !winner && (currentTurn === "player1" || mode === "two-player")) {
      updateAngleFromPointer(e);
    }
  };

  const updateAngleFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_W / rect.width;
    const scaleY = TABLE_H / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const cue = ballsRef.current.find(b => b.isCue && !b.potted);
    if (!cue) return;

    const angle = Math.atan2(py - cue.y, px - cue.x);
    setAimAngle(angle);
  };

  // Cue Stick Pull-Back Controller
  const handleCueStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (ballsMoving || winner || (currentTurn === "player2" && mode === "vs-ai")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPulling(true);
    calcCueStickPower(e);
  };

  const handleCueStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPulling) {
      calcCueStickPower(e);
    }
  };

  const handleCueStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPulling) {
      setIsPulling(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      shootBall(aimAngle, power);
    }
  };

  const calcCueStickPower = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = cueStickTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const clamped = Math.max(0.1, Math.min(1.0, ratio));
    const newPower = Math.round(clamped * 100);
    setPower(newPower);
    gameAudio.playCuePull(newPower);
  };

  // Helper to get ball status for each player rack
  const p1TargetIds = p1Group === "solids" ? SOLID_IDS : p1Group === "stripes" ? STRIPE_IDS : [];
  const p2TargetIds = p2Group === "solids" ? SOLID_IDS : p2Group === "stripes" ? STRIPE_IDS : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center select-none py-1.5 px-1 sm:px-3 sm:py-3">
      {/* Top Bar with Mode Controls */}
      <div className="w-full max-w-5xl flex items-center justify-between gap-2 mb-1.5">
        <Link to="/arcade">
          <Button variant="ghost" size="sm" className="h-8 px-2.5 gap-1 text-slate-300 hover:text-white text-xs">
            <ArrowLeft className="size-3.5" /> Arcade
          </Button>
        </Link>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] font-bold border-amber-500/40 bg-amber-500/10 text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 gap-1 shadow-sm"
            onClick={() => setShowRules(true)}
            title="How to Play & Win Rules"
          >
            <HelpCircle className="size-3 text-amber-400" />
            <span>Rules</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] font-bold border-slate-700 bg-slate-900"
            onClick={() => {
              setMode(m => (m === "vs-ai" ? "two-player" : "vs-ai"));
              initBalls();
            }}
          >
            {mode === "vs-ai" ? <Bot className="size-3 mr-1 text-emerald-400" /> : <Users className="size-3 mr-1 text-blue-400" />}
            {mode === "vs-ai" ? "vs Computer" : "2-Player"}
          </Button>
          {mode === "vs-ai" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-1.5 text-[11px] font-bold border-slate-700 bg-slate-900 capitalize text-amber-400"
              onClick={() => setDifficulty(d => (d === "normal" ? "hard" : "normal"))}
            >
              {difficulty}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-slate-400 hover:text-white"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Landscape"}
          >
            {isFullscreen ? <Minimize2 className="size-3.5 text-amber-400" /> : <Maximize2 className="size-3.5 text-amber-400" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-slate-400 hover:text-white"
            onClick={() => setIsMuted(gameAudio.toggleMute())}
          >
            {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-slate-400 hover:text-white"
            onClick={initBalls}
            title="Reset Game"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Landscape Orientation Hint (Mobile Portrait) */}
      {!isLandscape && (
        <div className="w-full max-w-5xl mb-1 px-0.5 sm:hidden">
          <div
            onClick={handleToggleFullscreen}
            className="flex items-center justify-between gap-1.5 bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/40 rounded-xl px-2.5 py-1 text-amber-300 text-xs shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-1.5">
              <Smartphone className="size-3.5 text-amber-400 rotate-90 shrink-0" />
              <span className="text-[11px] font-bold">
                Turn phone sideways (Landscape) for full-screen!
              </span>
            </div>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
              Fullscreen ⛶
            </span>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* COMPACT SIDE-BY-SIDE SCOREBOARD (100% VISIBLE ON EVERY PHONE) */}
      {/* ========================================================== */}
      <div className="w-full max-w-5xl mb-1.5 px-0.5">
        <div className="flex items-center justify-between gap-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 shadow-md">
          {/* PLAYER 1 (Left) */}
          <div
            className={`flex-1 min-w-0 flex flex-col gap-1 px-2 py-1 rounded-xl transition-all ${
              currentTurn === "player1"
                ? "bg-emerald-500/15 border border-emerald-500/50 shadow-sm"
                : "opacity-60 border border-transparent"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="size-4.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] shrink-0 font-bold">
                👤
              </span>
              <span className="text-[11px] font-bold text-white truncate">
                Player 1
              </span>
              {currentTurn === "player1" && (
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping ml-auto shrink-0" />
              )}
            </div>

            {/* 7 Balls Row - Sized to ALWAYS fit with NO overflow */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {(p1Group ? p1TargetIds : SOLID_IDS).map(id => {
                const b = ballsRef.current.find(x => x.id === id);
                const isSunk = b?.potted;
                return (
                  <div
                    key={id}
                    className={`size-3.5 sm:size-4.5 rounded-full flex items-center justify-center text-[7px] sm:text-[8px] font-black shrink-0 border transition-all ${
                      isSunk
                        ? "opacity-20 grayscale border-dashed border-slate-600 bg-slate-800"
                        : "border-white/50 shadow-sm text-white"
                    }`}
                    style={{ backgroundColor: isSunk ? undefined : BALL_COLORS[id] || "#FFF" }}
                  >
                    {!isSunk && id}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 8-BALL CENTER BADGE */}
          <div className="shrink-0 size-6 rounded-full bg-black border border-amber-500/40 flex items-center justify-center text-[10px] font-black text-white shadow">
            🎱
          </div>

          {/* PLAYER 2 / COMPUTER (Right) */}
          <div
            className={`flex-1 min-w-0 flex flex-col gap-1 px-2 py-1 rounded-xl transition-all text-right ${
              currentTurn === "player2"
                ? "bg-amber-500/15 border border-amber-500/50 shadow-sm"
                : "opacity-60 border border-transparent"
            }`}
          >
            <div className="flex items-center justify-end gap-1.5">
              {currentTurn === "player2" && (
                <span className="size-1.5 rounded-full bg-amber-400 animate-ping mr-auto shrink-0" />
              )}
              <span className="text-[11px] font-bold text-white truncate">
                {mode === "vs-ai" ? "Computer" : "Player 2"}
              </span>
              <span className="size-4.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] shrink-0 font-bold">
                {mode === "vs-ai" ? "🤖" : "👥"}
              </span>
            </div>

            {/* 7 Balls Row */}
            <div className="flex items-center justify-end gap-0.5 sm:gap-1">
              {(p2Group ? p2TargetIds : STRIPE_IDS).map(id => {
                const b = ballsRef.current.find(x => x.id === id);
                const isSunk = b?.potted;
                return (
                  <div
                    key={id}
                    className={`size-3.5 sm:size-4.5 rounded-full flex items-center justify-center text-[7px] sm:text-[8px] font-black shrink-0 border transition-all ${
                      isSunk
                        ? "opacity-20 grayscale border-dashed border-slate-600 bg-slate-800"
                        : "border-white/50 shadow-sm text-white"
                    }`}
                    style={{ backgroundColor: isSunk ? undefined : BALL_COLORS[id] || "#FFF" }}
                  >
                    {!isSunk && id}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* RULES MODAL */}
      {showRules && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-4 sm:p-6 max-w-md w-full shadow-2xl relative text-left">
            <button
              onClick={() => setShowRules(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🎱</span>
              <h3 className="text-lg font-black text-amber-400 tracking-wide">
                8-Ball Pool Rules
              </h3>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <span>1️⃣</span> Break & Teams (Solids vs Stripes)
                </p>
                <p className="text-slate-400 text-xs">
                  The first ball sunk determines your group:
                  <br />
                  • <strong className="text-amber-300">Solids</strong>: Balls 1 to 7
                  <br />
                  • <strong className="text-blue-300">Stripes</strong>: Balls 9 to 15
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <span>2️⃣</span> Clear All 7 of Your Balls First
                </p>
                <p className="text-slate-400 text-xs">
                  Each time you pot your own ball, <strong className="text-emerald-400">you shoot again</strong>. You must pocket all 7 before targeting the 8-ball.
                </p>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
                <p className="font-bold text-emerald-300 mb-0.5 flex items-center gap-1.5">
                  <span>3️⃣</span> Pocket the 8-Ball to WIN 🏆
                </p>
                <p className="text-slate-300 text-xs">
                  Once your 7 balls are sunk, pocket the <strong>Black 8-Ball</strong> into any pocket to <strong>win the match!</strong>
                </p>
              </div>

              <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-2.5">
                <p className="font-bold text-rose-300 mb-0.5 flex items-center gap-1.5">
                  <span>⚠️</span> Instant Loss (Early 8-Ball)
                </p>
                <p className="text-slate-300 text-xs">
                  Pocketing the 8-Ball <strong>before</strong> your 7 balls are cleared, or scratching the cue ball with the 8-ball, results in an <strong>instant loss</strong>!
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowRules(false)}
              className="w-full mt-4 bg-gradient-to-r from-amber-500 to-amber-600 font-black text-black rounded-xl hover:brightness-110"
            >
              Got It, Let's Play!
            </Button>
          </div>
        </div>
      )}

      {/* MAIN GAME AREA: TABLE + VERTICAL CUE STICK SIDE-BY-SIDE */}
      <div className="w-full max-w-5xl flex items-center justify-center gap-1.5 sm:gap-3 flex-1 min-h-0 px-0.5">
        {/* Table Canvas (MAXIMIZED & UNOBSTRUCTED) */}
        <div
          ref={containerRef}
          className="relative aspect-[860/440] flex-1 min-w-0 max-h-[76vh] sm:max-h-[82vh] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-[#1E100A] bg-black self-center"
        >
          <canvas
            ref={canvasRef}
            width={TABLE_W}
            height={TABLE_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            className="w-full h-full cursor-crosshair touch-none"
          />

          {/* Winner Rematch Modal */}
          {winner && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <span className="text-6xl mb-2">🏆</span>
              <h2 className="text-3xl font-black text-amber-400 mb-1">
                {winner} Wins the Game!
              </h2>
              <p className="text-xs text-slate-300 mb-4 max-w-xs">
                Score: Player 1 ({p1Wins}) — {mode === "vs-ai" ? "Computer" : "Player 2"} ({p2Wins})
              </p>
              <Button
                onClick={initBalls}
                className="bg-gradient-to-r from-amber-500 to-amber-600 font-black px-8 py-2 rounded-xl text-black shadow-lg"
              >
                Play Rematch
              </Button>
            </div>
          )}
        </div>

        {/* VERTICAL CUE STICK ON THE SIDE (PULL DOWN & RELEASE) */}
        <div className="flex flex-col items-center self-stretch justify-center shrink-0">
          <div
            ref={cueStickTrackRef}
            onPointerDown={handleCueStickPointerDown}
            onPointerMove={handleCueStickPointerMove}
            onPointerUp={handleCueStickPointerUp}
            onPointerCancel={() => setIsPulling(false)}
            className="relative w-9 sm:w-12 h-full max-h-[76vh] sm:max-h-[82vh] bg-gradient-to-b from-[#140a05] via-[#221208] to-[#140a05] rounded-xl sm:rounded-2xl border-2 border-amber-950/80 p-1 flex flex-col items-center cursor-ns-resize shadow-xl overflow-hidden active:border-amber-700/60 transition-colors select-none touch-none shrink-0"
            title="Drag cue stick down and release to shoot"
          >
            {/* Background Track Groove */}
            <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-1 rounded-full bg-black/60 border-x border-white/5 pointer-events-none" />

            {/* Glowing Power Strip on Edge */}
            <div
              className="absolute top-1 right-0.5 w-1 rounded-full bg-gradient-to-b from-emerald-400 via-amber-400 to-rose-500 transition-all pointer-events-none shadow"
              style={{ height: `${power}%` }}
            />

            {/* Draggable Vertical Wooden Pool Cue Stick */}
            <div
              className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing transition-transform pointer-events-none w-full"
              style={{
                top: `calc(4px + ${((power - 10) / 90) * 45}%)`,
                height: "90%",
              }}
            >
              {/* Cue Tip & Ferrule */}
              <div className="w-2.5 sm:w-3.5 h-2 rounded-t-sm bg-cyan-400 border-b border-slate-200 shrink-0 shadow" title="Chalked Tip" />
              <div className="w-3 sm:w-4 h-2.5 bg-slate-100 shrink-0 shadow-inner" title="Ferrule" />

              {/* Canadian Maple Shaft */}
              <div className="w-3 sm:w-3.5 flex-1 bg-gradient-to-b from-[#FDE68A] via-[#F59E0B] to-[#D97706] shrink-0 shadow min-h-[50px]" />

              {/* Steel Joint Collar */}
              <div className="w-3.5 sm:w-4.5 h-2 bg-slate-300 border-y border-slate-400 shrink-0" />

              {/* Irish Linen Butt Grip */}
              <div className="w-4 sm:w-5 h-20 sm:h-32 bg-gradient-to-b from-[#292524] via-[#44403C] to-[#1C1917] rounded-b-lg shadow-lg border-x border-amber-900/60 flex flex-col items-center justify-end pb-2 shrink-0">
                <span className="text-[7px] sm:text-[9px] font-mono font-bold text-amber-400/90 tracking-tighter [writing-mode:vertical-lr] rotate-180">
                  PULL ▼
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
