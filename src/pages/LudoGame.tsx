import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Volume2, VolumeX, RotateCcw, Bot, Users, Sparkles, HelpCircle, X, Maximize2, Minimize2, Smartphone, Trophy } from "lucide-react";
import { gameAudio } from "@/lib/gameAudio";

type PlayerColor = "green" | "yellow" | "blue" | "red";
type GameMode = "vs-ai" | "pass-and-play";

interface Pawn {
  id: number;
  color: PlayerColor;
  step: number; // -1 = base, 0-50 = track, 51-56 = home, 57 = finished
  animStep?: number; // for step-by-step walking animation
}

// 52 Main Path Grid Coordinates [col, row]
const MAIN_PATH: [number, number][] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6]
];

const START_OFFSETS: Record<PlayerColor, number> = {
  green: 0,
  yellow: 13,
  blue: 26,
  red: 39,
};

const HOME_PATHS: Record<PlayerColor, [number, number][]> = {
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
  red: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
};

const BASE_SLOTS: Record<PlayerColor, [number, number][]> = {
  green: [[2, 2], [3, 2], [2, 3], [3, 3]],
  yellow: [[11, 2], [12, 2], [11, 3], [12, 3]],
  blue: [[11, 11], [12, 11], [11, 12], [12, 12]],
  red: [[2, 11], [3, 11], [2, 12], [3, 12]],
};

const COLOR_HEX: Record<PlayerColor, { main: string; light: string; border: string }> = {
  green: { main: "#15803D", light: "#DCFCE7", border: "#14532D" },
  yellow: { main: "#CA8A04", light: "#FEF9C3", border: "#854D0E" },
  blue: { main: "#1D4ED8", light: "#DBEAFE", border: "#1E40AF" },
  red: { main: "#B91C1C", light: "#FEE2E2", border: "#991B1B" },
};

export default function LudoGame() {
  const [mode, setMode] = useState<GameMode>("vs-ai");
  const [playerCount, setPlayerCount] = useState<2 | 4>(2);
  const [isMuted, setIsMuted] = useState(false);
  const [diceValue, setDiceValue] = useState<number>(6);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [currentTurn, setCurrentTurn] = useState<PlayerColor>("green");
  const [hasRolled, setHasRolled] = useState<boolean>(false);
  const [winner, setWinner] = useState<PlayerColor | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("Roll the 3D dice to start!");
  const [selectablePawns, setSelectablePawns] = useState<number[]>([]);
  const [animatingPawnId, setAnimatingPawnId] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);

  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth > window.innerHeight;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const pawnsRef = useRef<Pawn[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isRollingRef = useRef<boolean>(false);
  const hasRolledRef = useRef<boolean>(false);
  const animatingRef = useRef<boolean>(false);
  const currentTurnRef = useRef<PlayerColor>("green");
  const turnStartTimeRef = useRef<number>(Date.now());
  const diceValueRef = useRef<number>(0);
  const rollFinishedTimeRef = useRef<number>(0);
  const aiMovingRef = useRef<boolean>(false);

  // Initialize Game
  const initGame = useCallback(() => {
    const list: Pawn[] = [];
    const activeColors: PlayerColor[] = playerCount === 2 ? ["green", "blue"] : ["green", "yellow", "blue", "red"];
    let idCounter = 0;
    for (const c of activeColors) {
      for (let i = 0; i < 4; i++) {
        list.push({
          id: idCounter++,
          color: c,
          step: -1,
        });
      }
    }
    pawnsRef.current = list;
    currentTurnRef.current = "green";
    turnStartTimeRef.current = Date.now();
    diceValueRef.current = 0;
    rollFinishedTimeRef.current = 0;
    isRollingRef.current = false;
    hasRolledRef.current = false;
    animatingRef.current = false;
    aiMovingRef.current = false;

    setCurrentTurn("green");
    setHasRolled(false);
    setIsRolling(false);
    setDiceValue(0);
    setWinner(null);
    setSelectablePawns([]);
    setAnimatingPawnId(null);
    setStatusMessage("🎯 It's YOUR TURN (Green)! Roll the dice to start.");
  }, [playerCount]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Dice Roll with Realistic 3D Tumbling Animation
  const rollDice = () => {
    if (mode === "vs-ai" && currentTurnRef.current !== "green") {
      return; // Do not allow manual roll when computer is playing
    }
    rollDiceForPlayer(currentTurnRef.current);
  };

  const rollDiceForPlayer = (player: PlayerColor) => {
    if (isRollingRef.current || hasRolledRef.current || winner || animatingRef.current) {
      return;
    }

    isRollingRef.current = true;
    hasRolledRef.current = false;
    setIsRolling(true);
    setHasRolled(false);
    gameAudio.playDiceRoll();

    let count = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 9) {
        clearInterval(interval);
        const finalVal = Math.floor(Math.random() * 6) + 1;
        diceValueRef.current = finalVal;
        rollFinishedTimeRef.current = Date.now();
        setDiceValue(finalVal);

        isRollingRef.current = false;
        hasRolledRef.current = true;
        setIsRolling(false);
        setHasRolled(true);

        handlePostRoll(finalVal, player);
      }
    }, 60);
  };

  // Evaluate Available Moves
  const handlePostRoll = (roll: number, player: PlayerColor) => {
    diceValueRef.current = roll;
    rollFinishedTimeRef.current = Date.now();

    const pawns = pawnsRef.current.filter(p => p.color === player);
    const valid: number[] = [];

    for (const p of pawns) {
      if (p.step === -1 && roll === 6) {
        valid.push(p.id);
      } else if (p.step >= 0 && p.step + roll <= 57) {
        valid.push(p.id);
      }
    }

    const isAi = mode === "vs-ai" && player !== "green";

    if (valid.length === 0) {
      const msg = isAi
        ? `🤖 Computer (${player.toUpperCase()}) rolled ${roll} (needs 6). Passing turn...`
        : `⚠️ You rolled ${roll} (need 6 to start). Passing turn...`;
      setStatusMessage(msg);
      if (!isAi) {
        setTimeout(() => {
          nextPlayer(player);
        }, 1100);
      }
    } else if (isAi) {
      // AI Move: Heartbeat interval will pick up and execute smoothly
      setStatusMessage(`🤖 Computer (${player.toUpperCase()}) rolled ${roll} and is moving token...`);
    } else {
      // Human Turn: Show selectable pawns, let user move!
      setSelectablePawns(valid);
      setStatusMessage(`🎯 You rolled ${roll}! Tap your glowing pawn to move ${roll} step${roll > 1 ? "s" : ""}.`);
    }
  };

  // AI Move Decision
  const pickAiMove = (validIds: number[], roll: number): number => {
    const pawns = pawnsRef.current;
    // 1. Capture opponent
    for (const id of validIds) {
      const p = pawns.find(x => x.id === id);
      if (!p) continue;
      const targetStep = p.step === -1 ? 0 : p.step + roll;
      if (targetStep < 51) {
        const targetTile = (START_OFFSETS[p.color] + targetStep) % 52;
        const opponent = pawns.find(x => x.color !== p.color && x.step >= 0 && x.step < 51 && (START_OFFSETS[x.color] + x.step) % 52 === targetTile);
        if (opponent) return id;
      }
    }

    // 2. Reach center
    const winMove = validIds.find(id => {
      const p = pawns.find(x => x.id === id);
      return p && p.step + roll === 57;
    });
    if (winMove !== undefined) return winMove;

    // 3. Move out of base on 6
    if (roll === 6) {
      const basePawn = validIds.find(id => {
        const p = pawns.find(x => x.id === id);
        return p && p.step === -1;
      });
      if (basePawn !== undefined) return basePawn;
    }

    // 4. Furthest pawn
    let furthestId = validIds[0];
    let maxStep = -2;
    for (const id of validIds) {
      const p = pawns.find(x => x.id === id);
      if (p && p.step > maxStep) {
        maxStep = p.step;
        furthestId = id;
      }
    }
    return furthestId;
  };

  // Realistic Step-by-Step Walking Animation
  const animatePawnWalk = (pawnId: number, roll: number, player: PlayerColor = currentTurnRef.current) => {
    const pawn = pawnsRef.current.find(p => p.id === pawnId);
    if (!pawn) {
      aiMovingRef.current = false;
      return;
    }

    setSelectablePawns([]);
    setAnimatingPawnId(pawnId);
    animatingRef.current = true;

    if (pawn.step === -1) {
      // Step out of base directly
      pawn.step = 0;
      gameAudio.playPawnMove();
      finalizePawnMove(pawn, roll, player);
    } else {
      // Walk tile by tile with hop animation
      let stepCount = 0;
      const walkInterval = setInterval(() => {
        pawn.step++;
        stepCount++;
        gameAudio.playPawnMove();

        if (stepCount >= roll || pawn.step >= 57) {
          clearInterval(walkInterval);
          finalizePawnMove(pawn, roll, player);
        }
      }, 150);
    }
  };

  const finalizePawnMove = (pawn: Pawn, roll: number, player: PlayerColor = currentTurnRef.current) => {
    setAnimatingPawnId(null);
    animatingRef.current = false;
    aiMovingRef.current = false;

    // Capture (Kicking / Killing) detection
    let didCapture = false;
    let victimName = "";
    if (pawn.step < 51) {
      const myTileIndex = (START_OFFSETS[pawn.color] + pawn.step) % 52;
      const safeIndices = [0, 8, 13, 21, 26, 34, 39, 47];

      if (!safeIndices.includes(myTileIndex)) {
        const victim = pawnsRef.current.find(other =>
          other.color !== pawn.color &&
          other.step >= 0 &&
          other.step < 51 &&
          (START_OFFSETS[other.color] + other.step) % 52 === myTileIndex
        );

        if (victim) {
          victim.step = -1;
          didCapture = true;
          victimName = victim.color.toUpperCase();
          gameAudio.playCapture();
        }
      }
    }

    // Check Victory
    const myFinished = pawnsRef.current.filter(p => p.color === player && p.step === 57).length;
    if (myFinished === 4) {
      setWinner(player);
      setStatusMessage(`🏆 ${player.toUpperCase()} wins the championship!`);
      gameAudio.playWinFanfare();
      return;
    }

    // Bonus roll on: Rolling a 6 OR Kicking/Killing an opponent OR Reaching Home!
    const reachedHome = pawn.step === 57;
    const hasBonus = roll === 6 || didCapture || reachedHome;

    if (hasBonus) {
      hasRolledRef.current = false;
      isRollingRef.current = false;
      diceValueRef.current = 0;
      turnStartTimeRef.current = Date.now();

      setHasRolled(false);
      setIsRolling(false);
      setDiceValue(0);

      const isCurAi = mode === "vs-ai" && player !== "green";
      const bonusLabel = didCapture
        ? `💥 KICKED ${victimName}! EXTRA ROLL BONUS`
        : reachedHome
        ? "🏠 TOKEN HOME! EXTRA ROLL BONUS"
        : "🎉 ROLLED A 6! EXTRA ROLL BONUS";

      if (isCurAi) {
        setStatusMessage(`🤖 Computer (${player.toUpperCase()}): ${bonusLabel}! Rolling extra turn...`);
      } else {
        setStatusMessage(`🎉 ${bonusLabel}! Roll the dice again!`);
      }
    } else {
      nextPlayer(player);
    }
  };

  const nextPlayer = (fromPlayer: PlayerColor = currentTurnRef.current) => {
    const activeOrder: PlayerColor[] = playerCount === 2 ? ["green", "blue"] : ["green", "yellow", "blue", "red"];
    const nextIdx = (activeOrder.indexOf(fromPlayer) + 1) % activeOrder.length;
    const nextCol = activeOrder[nextIdx];

    currentTurnRef.current = nextCol;
    turnStartTimeRef.current = Date.now();
    hasRolledRef.current = false;
    isRollingRef.current = false;
    animatingRef.current = false;
    aiMovingRef.current = false;
    diceValueRef.current = 0;

    setHasRolled(false);
    setIsRolling(false);
    setSelectablePawns([]);
    setDiceValue(0);
    setCurrentTurn(nextCol);

    const isNextAi = mode === "vs-ai" && nextCol !== "green";
    if (isNextAi) {
      setStatusMessage(`🤖 Computer (${nextCol.toUpperCase()}) is rolling...`);
    } else {
      setStatusMessage(`🎯 YOUR TURN (GREEN)! Roll the dice.`);
    }
  };

  // UNBREAKABLE AI HEARTBEAT: Checks every 200ms with monotonic timestamps to guarantee computer moves
  useEffect(() => {
    const heartbeat = setInterval(() => {
      if (mode !== "vs-ai" || winner) return;

      const activeCol = currentTurnRef.current;
      if (activeCol === "green") return; // Player turn, wait for human

      if (animatingRef.current || isRollingRef.current || aiMovingRef.current) {
        return; // In middle of animation or physical dice tumble
      }

      const now = Date.now();
      const turnElapsed = now - turnStartTimeRef.current;

      // 1. AI Needs to roll dice
      if (!hasRolledRef.current) {
        if (turnElapsed >= 650) {
          rollDiceForPlayer(activeCol);
        }
        return;
      }

      // 2. AI Has rolled dice: Evaluate moves or pass
      if (hasRolledRef.current) {
        const roll = diceValueRef.current;
        if (roll <= 0) return;

        const timeSinceRoll = now - rollFinishedTimeRef.current;
        const pawns = pawnsRef.current.filter(p => p.color === activeCol);
        const valid: number[] = [];

        for (const p of pawns) {
          if (p.step === -1 && roll === 6) {
            valid.push(p.id);
          } else if (p.step >= 0 && p.step + roll <= 57) {
            valid.push(p.id);
          }
        }

        if (valid.length === 0) {
          // No valid moves (e.g. rolled 5 with all in base): pass turn after 750ms
          if (timeSinceRoll >= 750) {
            nextPlayer(activeCol);
          }
        } else {
          // Valid moves exist: execute best move after 650ms
          if (timeSinceRoll >= 650) {
            aiMovingRef.current = true;
            const chosen = pickAiMove(valid, roll);
            animatePawnWalk(chosen, roll, activeCol);
          }
        }
      }

      // 3. FAILSAFE RECOVERY: If AI turn stays idle for > 4.5 seconds for ANY unexpected reason, unstick!
      if (turnElapsed > 4500) {
        console.warn("[Ludo Engine] AI Turn unstick triggered for:", activeCol);
        isRollingRef.current = false;
        animatingRef.current = false;
        aiMovingRef.current = false;
        hasRolledRef.current = false;
        setAnimatingPawnId(null);
        nextPlayer(activeCol);
      }
    }, 200);

    return () => clearInterval(heartbeat);
  }, [mode, playerCount, winner]);

  // Render High-Fidelity Wooden Ludo Board on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 620;
    const cellSize = size / 15;

    ctx.clearRect(0, 0, size, size);

    // 1. Board Outer Wooden Edge
    ctx.fillStyle = "#3E2723";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "#FDFBF7"; // Fine Ivory Linen Board Base
    ctx.fillRect(8, 8, size - 16, size - 16);

    // 2. 4 Base Yards
    const drawBase = (col: number, row: number, color: PlayerColor) => {
      const bx = col * cellSize;
      const by = row * cellSize;
      const bw = 6 * cellSize;

      ctx.fillStyle = COLOR_HEX[color].main;
      ctx.fillRect(bx, by, bw, bw);

      // Inner Cream Yard
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(bx + cellSize, by + cellSize, 4 * cellSize, 4 * cellSize);
      ctx.strokeStyle = COLOR_HEX[color].border;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + cellSize, by + cellSize, 4 * cellSize, 4 * cellSize);

      // 4 circular recessed token holding slots
      const slots = BASE_SLOTS[color];
      for (const [sc, sr] of slots) {
        ctx.fillStyle = COLOR_HEX[color].light;
        ctx.beginPath();
        ctx.arc((sc + 0.5) * cellSize, (sr + 0.5) * cellSize, cellSize * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLOR_HEX[color].main;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    drawBase(0, 0, "green");
    drawBase(9, 0, "yellow");
    drawBase(9, 9, "blue");
    drawBase(0, 9, "red");

    // 3. Track Cells
    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1.2;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (
          (r < 6 && c < 6) ||
          (r < 6 && c >= 9) ||
          (r >= 9 && c < 6) ||
          (r >= 9 && c >= 9) ||
          (r >= 6 && r <= 8 && c >= 6 && c <= 8)
        ) {
          continue;
        }
        ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    const fillCell = (c: number, r: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      ctx.strokeStyle = "#94A3B8";
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
    };

    // Colored Start Arrows & Columns
    fillCell(1, 6, COLOR_HEX.green.main);
    fillCell(8, 1, COLOR_HEX.yellow.main);
    fillCell(13, 8, COLOR_HEX.blue.main);
    fillCell(6, 13, COLOR_HEX.red.main);

    for (let i = 1; i <= 5; i++) fillCell(i, 7, COLOR_HEX.green.main);
    for (let i = 1; i <= 5; i++) fillCell(7, i, COLOR_HEX.yellow.main);
    for (let i = 9; i <= 13; i++) fillCell(i, 7, COLOR_HEX.blue.main);
    for (let i = 9; i <= 13; i++) fillCell(7, i, COLOR_HEX.red.main);

    // Golden Safe Stars
    const drawStar = (c: number, r: number) => {
      ctx.fillStyle = "#F59E0B";
      ctx.font = `bold ${cellSize * 0.72}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("★", (c + 0.5) * cellSize, (r + 0.5) * cellSize);
    };
    drawStar(1, 6);
    drawStar(8, 2);
    drawStar(8, 1);
    drawStar(12, 8);
    drawStar(13, 8);
    drawStar(6, 12);
    drawStar(6, 13);
    drawStar(2, 6);

    // 4. Center Home Triangles
    ctx.beginPath();
    ctx.moveTo(6 * cellSize, 6 * cellSize);
    ctx.lineTo(7.5 * cellSize, 7.5 * cellSize);
    ctx.lineTo(6 * cellSize, 9 * cellSize);
    ctx.fillStyle = COLOR_HEX.green.main;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(6 * cellSize, 6 * cellSize);
    ctx.lineTo(7.5 * cellSize, 7.5 * cellSize);
    ctx.lineTo(9 * cellSize, 6 * cellSize);
    ctx.fillStyle = COLOR_HEX.yellow.main;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(9 * cellSize, 6 * cellSize);
    ctx.lineTo(7.5 * cellSize, 7.5 * cellSize);
    ctx.lineTo(9 * cellSize, 9 * cellSize);
    ctx.fillStyle = COLOR_HEX.blue.main;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(6 * cellSize, 9 * cellSize);
    ctx.lineTo(7.5 * cellSize, 7.5 * cellSize);
    ctx.lineTo(9 * cellSize, 9 * cellSize);
    ctx.fillStyle = COLOR_HEX.red.main;
    ctx.fill();

    // 5. Draw 3D Molded Pawn Tokens with Depth & Collar
    const pawns = pawnsRef.current;
    for (const p of pawns) {
      let x = 0;
      let y = 0;

      if (p.step === -1) {
        const [bc, br] = BASE_SLOTS[p.color][p.id % 4];
        x = (bc + 0.5) * cellSize;
        y = (br + 0.5) * cellSize;
      } else if (p.step <= 50) {
        const pathIndex = (START_OFFSETS[p.color] + p.step) % 52;
        const [mc, mr] = MAIN_PATH[pathIndex];
        x = (mc + 0.5) * cellSize;
        y = (mr + 0.5) * cellSize;
      } else if (p.step <= 56) {
        const [hc, hr] = HOME_PATHS[p.color][p.step - 51];
        x = (hc + 0.5) * cellSize;
        y = (hr + 0.5) * cellSize;
      } else {
        x = 7.5 * cellSize;
        y = 7.5 * cellSize;
      }

      const isSelectable = selectablePawns.includes(p.id);

      // Selection pulse ring
      if (isSelectable) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.45)";
        ctx.beginPath();
        ctx.arc(x, y, cellSize * 0.48, 0, Math.PI * 2);
        ctx.fill();
      }

      // Drop Shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + 1.5, y + 2.5, cellSize * 0.32, cellSize * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pawn Flared Base
      const baseGrad = ctx.createRadialGradient(x, y + 2, 2, x, y + 2, cellSize * 0.32);
      baseGrad.addColorStop(0, COLOR_HEX[p.color].light);
      baseGrad.addColorStop(0.7, COLOR_HEX[p.color].main);
      baseGrad.addColorStop(1, COLOR_HEX[p.color].border);
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.arc(x, y + 2, cellSize * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // Pawn Spherical Crown Head
      const headGrad = ctx.createRadialGradient(x - 2, y - 4, 1, x, y - 2, cellSize * 0.2);
      headGrad.addColorStop(0, "#FFFFFF");
      headGrad.addColorStop(0.4, COLOR_HEX[p.color].main);
      headGrad.addColorStop(1, COLOR_HEX[p.color].border);
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(x, y - 2, cellSize * 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }, [diceValue, currentTurn, selectablePawns]);

  // Click on Canvas to Select Pawn
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectablePawns.length === 0 || !hasRolled || winner || animatingPawnId !== null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = 620 / rect.width;
    const clickX = (e.clientX - rect.left) * scale;
    const clickY = (e.clientY - rect.top) * scale;
    const cellSize = 620 / 15;

    for (const id of selectablePawns) {
      const p = pawnsRef.current.find(x => x.id === id);
      if (!p) continue;

      let px = 0;
      let py = 0;
      if (p.step === -1) {
        const [bc, br] = BASE_SLOTS[p.color][p.id % 4];
        px = (bc + 0.5) * cellSize;
        py = (br + 0.5) * cellSize;
      } else if (p.step <= 50) {
        const pathIndex = (START_OFFSETS[p.color] + p.step) % 52;
        const [mc, mr] = MAIN_PATH[pathIndex];
        px = (mc + 0.5) * cellSize;
        py = (mr + 0.5) * cellSize;
      } else {
        const [hc, hr] = HOME_PATHS[p.color][p.step - 51];
        px = (hc + 0.5) * cellSize;
        py = (hr + 0.5) * cellSize;
      }

      if (Math.hypot(clickX - px, clickY - py) < cellSize * 0.9) {
        animatePawnWalk(id, diceValue);
        break;
      }
    }
  };

  // Helper to render Authentic Dice Pips
  const renderDicePips = (val: number) => {
    if (!val || val < 1 || val > 6) {
      return (
        <div className="flex items-center justify-center size-8 text-xl select-none">
          🎲
        </div>
      );
    }

    const pips: Record<number, string[]> = {
      1: ["col-start-2 row-start-2"],
      2: ["col-start-1 row-start-1", "col-start-3 row-start-3"],
      3: ["col-start-1 row-start-1", "col-start-2 row-start-2", "col-start-3 row-start-3"],
      4: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-1 row-start-3", "col-start-3 row-start-3"],
      5: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-2 row-start-2", "col-start-1 row-start-3", "col-start-3 row-start-3"],
      6: ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-1 row-start-2", "col-start-3 row-start-2", "col-start-1 row-start-3", "col-start-3 row-start-3"],
    };

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-1 size-8 p-1">
        {(pips[val] || []).map((pos, i) => (
          <span key={i} className={`size-2 rounded-full bg-slate-900 ${pos}`} />
        ))}
      </div>
    );
  };

  const playerList: PlayerColor[] = playerCount === 2 ? ["green", "blue"] : ["green", "yellow", "blue", "red"];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center select-none py-1.5 px-1 sm:px-3 sm:py-2.5">
      {/* Top Header */}
      <div className="w-full max-w-5xl flex items-center justify-between gap-1.5 mb-1.5">
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
            className="h-7 px-2 text-[11px] font-bold border-blue-500/40 bg-blue-500/10 text-blue-300 hover:text-blue-200"
            onClick={() => {
              setPlayerCount(c => (c === 2 ? 4 : 2));
            }}
            title="Toggle 1v1 or 4-Player"
          >
            <Users className="size-3 mr-1 text-blue-400" />
            {playerCount === 2 ? "1v1 (Fast)" : "4-Player"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px] font-bold border-slate-700 bg-slate-900"
            onClick={() => {
              setMode(m => (m === "vs-ai" ? "pass-and-play" : "vs-ai"));
              initGame();
            }}
          >
            {mode === "vs-ai" ? <Bot className="size-3 mr-1 text-emerald-400" /> : <Users className="size-3 mr-1 text-blue-400" />}
            {mode === "vs-ai" ? "vs AI" : "Pass & Play"}
          </Button>
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
            onClick={initGame}
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

      {/* COMPACT 4-PLAYER STATUS STRIP */}
      <div className="w-full max-w-5xl mb-1.5 px-0.5">
        <div className={`grid ${playerCount === 2 ? "grid-cols-2" : "grid-cols-4"} gap-1 sm:gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-1 shadow-md`}>
          {playerList.map(color => {
            const isTurn = currentTurn === color;
            const finished = pawnsRef.current.filter(p => p.color === color && p.step === 57).length;
            const isAi = mode === "vs-ai" && color !== "green";
            return (
              <div
                key={color}
                className={`flex flex-col sm:flex-row items-center justify-between gap-0.5 sm:gap-1 px-1.5 py-1 rounded-xl transition-all ${
                  isTurn
                    ? "border shadow-sm scale-[1.02]"
                    : "opacity-60 border border-transparent"
                }`}
                style={{
                  backgroundColor: isTurn ? `${COLOR_HEX[color].main}20` : undefined,
                  borderColor: isTurn ? COLOR_HEX[color].main : "transparent",
                }}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <span
                    className="size-3.5 sm:size-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0 shadow"
                    style={{ backgroundColor: COLOR_HEX[color].main }}
                  >
                    {isAi ? "🤖" : "👤"}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-white capitalize truncate">
                    {color}
                  </span>
                  {isTurn && (
                    <span
                      className="size-1.5 rounded-full animate-ping shrink-0"
                      style={{ backgroundColor: COLOR_HEX[color].main }}
                    />
                  )}
                </div>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-300 shrink-0">
                  {finished}/4 🏠
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* PROMINENT HIGH-VISIBILITY TURN BANNER */}
      <div className="w-full max-w-5xl mb-2 px-0.5">
        {currentTurn === "green" ? (
          <div className="bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-emerald-600/30 border-2 border-emerald-400 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-lg shadow-emerald-500/20 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="size-3 sm:size-3.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-black text-xs sm:text-sm text-white tracking-wide">
                🎯 YOUR TURN (YOU ARE GREEN 🟢) — {!hasRolled ? "ROLL THE DICE!" : "CHOOSE A PAWN TO MOVE!"}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs font-black bg-emerald-400 text-slate-950 px-2.5 py-0.5 rounded-full uppercase shrink-0 shadow">
              YOUR MOVE
            </span>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-2 sm:p-2.5 flex items-center justify-between text-slate-300 shadow">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: COLOR_HEX[currentTurn].main }}
              />
              <span className="font-bold text-xs sm:text-sm text-slate-200 capitalize">
                🤖 Computer is playing ({currentTurn.toUpperCase()})...
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
              Please wait...
            </span>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="w-full max-w-5xl py-1 px-2 mb-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5">
        <span className="text-amber-400 font-bold">●</span>
        <span>{statusMessage}</span>
      </div>

      {/* MAIN GAME CONTAINER: BOARD + DICE CONTROLS (RESPONSIVE FLEX ROW IN LANDSCAPE) */}
      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-2 sm:gap-4 flex-1 min-h-0 px-0.5">
        {/* Ludo Canvas Board */}
        <div className="relative aspect-square w-full max-w-[calc(68vh)] md:max-w-none md:flex-1 max-h-[66vh] md:max-h-[76vh] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-[#2D1810] bg-white self-center">
          <canvas
            ref={canvasRef}
            width={620}
            height={620}
            onClick={handleCanvasClick}
            className="w-full h-full cursor-pointer"
          />

          {/* Victory Modal */}
          {winner && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <span className="text-6xl mb-2">👑</span>
              <h2 className="text-3xl font-black mb-1 capitalize" style={{ color: COLOR_HEX[winner].main }}>
                {winner} Wins the Crown!
              </h2>
              <p className="text-xs text-slate-300 mb-4 max-w-xs">
                All 4 tokens conquered the home quadrant!
              </p>
              <Button
                onClick={initGame}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 font-black px-7 py-2 rounded-xl text-white shadow-lg"
              >
                Play Again
              </Button>
            </div>
          )}
        </div>

        {/* Dice & Controls Panel */}
        <div className="w-full md:w-64 p-2.5 sm:p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex md:flex-col items-center justify-between md:justify-center gap-2.5 sm:gap-4 shadow-xl shrink-0">
          {/* Authentic Pipped Dice Cube */}
          <div className="flex items-center md:flex-col gap-2.5 md:gap-2">
            <div
              onClick={rollDice}
              className={`size-13 sm:size-16 rounded-2xl bg-gradient-to-br from-white via-slate-100 to-slate-200 border-2 border-slate-300 flex items-center justify-center shadow-xl cursor-pointer select-none transition-transform ${
                isRolling ? "scale-90 rotate-45 shadow-amber-500/40" : "hover:scale-105 active:scale-95"
              }`}
              title="Click to Roll Dice"
            >
              {renderDicePips(diceValue)}
            </div>
            <div className="text-left md:text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400">Dice Result</div>
              <div className="text-sm sm:text-base font-black text-amber-400">
                {isRolling
                  ? "Rolling..."
                  : diceValue === 0
                  ? (mode === "vs-ai" && currentTurn !== "green" ? "Computer Rolling..." : "Ready to Roll")
                  : `Rolled ${diceValue}`}
              </div>
            </div>
          </div>

          {/* Action Button: Move Pawn OR Roll Dice */}
          {selectablePawns.length > 0 && currentTurn === "green" ? (
            <Button
              onClick={() => {
                animatePawnWalk(selectablePawns[0], diceValue, currentTurn);
              }}
              className="px-5 sm:px-7 h-10 sm:h-12 font-black rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black shadow-lg shadow-amber-500/30 animate-bounce transition-transform active:scale-95 text-xs sm:text-sm"
              title="Click to automatically move your pawn, or tap it on the board"
            >
              👉 Move Pawn ♟️
            </Button>
          ) : (
            <Button
              onClick={rollDice}
              disabled={isRolling || hasRolled || Boolean(winner) || animatingPawnId !== null || (mode === "vs-ai" && currentTurn !== "green")}
              className={`px-5 sm:px-7 h-10 sm:h-12 font-black rounded-xl transition-all active:scale-95 text-xs sm:text-sm shadow-lg ${
                currentTurn === "green" && !hasRolled && !isRolling
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black ring-4 ring-emerald-400/50 animate-pulse hover:brightness-110"
                  : "bg-slate-800 text-slate-400 border border-slate-700 disabled:opacity-40"
              }`}
            >
              {isRolling
                ? "Rolling..."
                : (mode === "vs-ai" && currentTurn !== "green")
                ? `🤖 ${currentTurn.toUpperCase()} Playing...`
                : "Roll Dice 🎲 (Your Turn)"}
            </Button>
          )}
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
              <span className="text-2xl">🎲</span>
              <h3 className="text-lg font-black text-amber-400 tracking-wide">
                Classic Ludo Rules
              </h3>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-300">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <span>1️⃣</span> Getting Out of Base (Roll a 6)
                </p>
                <p className="text-slate-400 text-xs">
                  All 4 pawns start inside your corner base. You <strong>must roll a 6</strong> to move a pawn out onto your start tile.
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <span>2️⃣</span> Bonus Turn on 6
                </p>
                <p className="text-slate-400 text-xs">
                  Rolling a <strong>6</strong> grants you an <strong className="text-emerald-400">immediate extra roll</strong>!
                </p>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                <p className="font-bold text-white mb-0.5 flex items-center gap-1.5">
                  <span>3️⃣</span> Kicking / Killing (Capture & Bonus Roll)
                </p>
                <p className="text-slate-400 text-xs">
                  Landing on an opponent's token <strong>KICKS / KILLS IT</strong> all the way back to their yard, and rewards you with an <strong>EXTRA BONUS ROLL</strong>! Tokens on <strong>Star tiles (⭐)</strong> are in safe zones and cannot be killed.
                </p>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
                <p className="font-bold text-emerald-300 mb-0.5 flex items-center gap-1.5">
                  <span>4️⃣</span> How to WIN 👑
                </p>
                <p className="text-slate-300 text-xs">
                  Navigate around the board and into your home column. The first player to bring all <strong>4 pawns into the Home Center</strong> wins the championship!
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
    </div>
  );
}
