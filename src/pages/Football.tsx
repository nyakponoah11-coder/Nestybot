import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Maximize2, Minimize2, RotateCcw, Trophy, Zap, Shield, Sparkles } from "lucide-react";

interface FootballOption {
  id: string;
  name: string;
  badge: string;
  url: string;
  description: string;
  controls: string;
}

const FOOTBALL_GAMES: FootballOption[] = [
  {
    id: "penaltyshooters2",
    name: "Penalty Shooters 2",
    badge: "🏆 World Cup & Top Leagues",
    url: "https://77pen.github.io/p6/penalty-shooters-2/",
    description: "The #1 Football Championship game! Choose from World Cup national teams or premier leagues (England, Spain, Italy, Germany, France). Score precision curve shots as striker and dive as goalkeeper to save match-winning penalties! (0 MB Vercel bandwidth)",
    controls: "📱 Phone: Tap & Hold to aim & shoot / dive • 💻 PC: Click & Hold"
  },
  {
    id: "smallworldcup",
    name: "A Small World Cup",
    badge: "⚡ 32-Team World Cup",
    url: "https://77pen.github.io/p2/a-small-world-cup/",
    description: "Hilarious and competitive ragdoll soccer tournament with 32 national teams! Drag and slam your player into the ball for headers, bicycle kicks, and epic goals through knockout stages to lift the trophy.",
    controls: "📱 Phone: Drag & Release to launch player • 💻 PC: Mouse Drag"
  },
  {
    id: "footballlegends",
    name: "Football Legends",
    badge: "⭐ Superstar Tournament",
    url: "https://77pen.github.io/p4/football-legends/",
    description: "Tournament battles with soccer superstars! Execute fire shots, super headers, and bicycle kicks in tournament championship, quick match, and 2-player modes.",
    controls: "📱 Phone: Touch on-screen buttons • 💻 PC: Arrows / WASD & Z/X/K/L to shoot & super shot"
  }
];

export default function Football() {
  const [selectedGameId, setSelectedGameId] = useState<string>("penaltyshooters2");
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [hasGamepad, setHasGamepad] = useState(false);

  useEffect(() => {
    const focusIframe = () => {
      try {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.focus();
        }
      } catch (e) {}
    };

    const checkGamepads = () => {
      if (typeof navigator === "undefined" || !navigator.getGamepads) return;
      const gps = navigator.getGamepads();
      let found = false;
      for (let i = 0; i < gps.length; i++) {
        if (gps[i] && gps[i].connected) {
          found = true;
          if (gps[i]?.buttons.some((b: any) => b?.pressed)) {
            focusIframe();
          }
          break;
        }
      }
      setHasGamepad(found);
    };

    window.addEventListener("gamepadconnected", () => {
      setHasGamepad(true);
      focusIframe();
    });
    window.addEventListener("gamepaddisconnected", checkGamepads);
    window.addEventListener("click", focusIframe);

    const interval = setInterval(checkGamepads, 400);
    return () => {
      clearInterval(interval);
      window.removeEventListener("gamepaddisconnected", checkGamepads);
      window.removeEventListener("click", focusIframe);
    };
  }, []);

  const currentGame = FOOTBALL_GAMES.find(g => g.id === selectedGameId) || FOOTBALL_GAMES[0];

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [selectedGameId, iframeKey]);

  const handleSelectGame = (id: string) => {
    if (id === selectedGameId) return;
    setIsLoading(true);
    setSelectedGameId(id);
    setIframeKey(k => k + 1);
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(k => k + 1);
  };

  const handleToggleFullscreen = () => {
    const elem = containerRef.current || document.documentElement;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-black text-slate-100 flex flex-col select-none overflow-hidden">
      {/* Top Header - Ultra-compact 40px bar */}
      <div className="w-full h-10 px-2 sm:px-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
          <Link to="/arcade" className="shrink-0">
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-slate-300 hover:text-white text-xs">
              <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">Arcade</span>
            </Button>
          </Link>

          {/* Game Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 shrink-0">
            {FOOTBALL_GAMES.map(game => {
              const active = game.id === currentGame.id;
              return (
                <button
                  key={game.id}
                  onClick={() => handleSelectGame(game.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                    active
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={game.description}
                >
                  {game.id === "penaltyshooters2" && <Trophy className="size-3 text-amber-400" />}
                  {game.id === "smallworldcup" && <Zap className="size-3 text-cyan-400" />}
                  {game.id === "footballlegends" && <Sparkles className="size-3 text-purple-400" />}
                  <span>{game.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {hasGamepad && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] animate-pulse">
              🎮 Pad Active
            </span>
          )}
          <Button
            size="sm"
            onClick={handleToggleFullscreen}
            className="h-7 px-2 sm:px-2.5 text-xs font-bold rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-black hover:brightness-110 shadow-sm gap-1"
            title="Fill 100% of your monitor/phone screen"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fill Screen (100%)"}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-slate-400 hover:text-white"
            onClick={handleReload}
            title="Reload Game"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 100% Full-Viewport Football Game Area */}
      <div
        ref={containerRef}
        className="relative w-full flex-1 h-[calc(100vh-40px)] bg-black overflow-hidden flex items-center justify-center"
      >
        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute top-2 inset-x-2 z-20 pointer-events-none flex justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900/95 border border-emerald-500/40 rounded-full px-4 py-1.5 shadow-2xl flex items-center gap-2 backdrop-blur-md">
              <div className="size-3 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              <span className="text-xs font-bold text-emerald-400">
                Loading {currentGame.name}...
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                {currentGame.controls}
              </span>
            </div>
          </div>
        )}

        {/* Game Viewport */}
        <iframe
          ref={iframeRef}
          key={`${currentGame.id}-${iframeKey}`}
          src={currentGame.url}
          title={currentGame.name}
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0 select-none bg-black block"
          style={{ width: "100%", height: "100%", border: "none" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock"
          allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
          allowFullScreen
        />
      </div>
    </div>
  );
}
