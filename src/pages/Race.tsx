import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Flame, Maximize2, Minimize2, RotateCcw, Sparkles, Trophy, Zap, Smartphone, Monitor } from "lucide-react";

interface GameOption {
  id: string;
  name: string;
  badge: string;
  url: string;
  description: string;
  controls: string;
}

const RACING_GAMES: GameOption[] = [
  {
    id: "racetrack",
    name: "RaceTrack 3D",
    badge: "🏎️ Steering Wheel & Rivals",
    url: "/games/racetrack/index.html",
    description: "Official 3D Grand Prix competition! Race against AI rival cars with an interactive rotating steering wheel, accelerator gas pedal, brake pedal, and lap timer. Plays smoothly on BOTH phone and laptop!",
    controls: "📱 Phone: Turn on-screen Steering Wheel & Pedals • 💻 PC: Arrows / WASD • C: Change Camera"
  },
  {
    id: "carrush",
    name: "Car Rush",
    badge: "📱 Highway Rivals",
    url: "https://77pen.github.io/p/car-rush/",
    description: "3D highway racer with on-screen steering controls, gas accelerator, and brake pedals. Overtake opponent cars on scenic highway tracks!",
    controls: "📱 Phone: Touch steering buttons & pedals • 💻 PC: Arrows / WASD"
  },
  {
    id: "crazycars",
    name: "Crazy Cars 3D",
    badge: "⚡ Stunts & Pedals",
    url: "https://77pen.github.io/p4/crazy-cars/",
    description: "3D stunt driving with on-screen steering arrows, gas pedal, and brake pedal for phones.",
    controls: "📱 Phone: On-screen touch arrows & pedals • 💻 PC: WASD / Arrows"
  },
  {
    id: "superstar",
    name: "Super Star Car 3D",
    badge: "💻 Formula Sim",
    url: "https://77pen.github.io/p3/super-star-car/",
    description: "Official Formula Championship with full grid of opponent cars. Best on laptop/desktop with keyboard.",
    controls: "💻 WASD / Arrows: Steer & Gas • Space: Nitro • C: Camera"
  },
  {
    id: "burninrubber",
    name: "Burnin' Rubber 5 3D",
    badge: "💻 Combat 3D",
    url: "https://77pen.github.io/p2/burnin-rubber-5-xs/",
    description: "Tournament combat racing against rival cars with intense nitro boosts. Best on laptop with keyboard.",
    controls: "💻 WASD / Arrows: Steer & Gas • Shift: Nitro Boost"
  }
];

export default function Race() {
  // Default to RaceTrack 3D which works on BOTH laptop and phone with real steering wheel and AI rivals!
  const [selectedGameId, setSelectedGameId] = useState<string>("racetrack");
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

  const currentGame = RACING_GAMES.find(g => g.id === selectedGameId) || RACING_GAMES[0];

  // Auto-dismiss loading indicator in 2s
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
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
      {/* Top Header - Ultra-compact 40px bar with clean scrollbar hiding */}
      <div className="w-full h-10 px-2 sm:px-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
          <Link to="/arcade" className="shrink-0">
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-slate-300 hover:text-white text-xs">
              <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">Arcade</span>
            </Button>
          </Link>

          {/* Game Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 shrink-0">
            {RACING_GAMES.map(game => {
              const active = game.id === currentGame.id;
              return (
                <button
                  key={game.id}
                  onClick={() => handleSelectGame(game.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                    active
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title={game.description}
                >
                  {game.id === "racetrack" && <Trophy className="size-3" />}
                  {game.id === "carrush" && <Smartphone className="size-3 text-emerald-400" />}
                  {game.id === "crazycars" && <Zap className="size-3" />}
                  {game.id === "superstar" && <Sparkles className="size-3" />}
                  {game.id === "burninrubber" && <Flame className="size-3" />}
                  <span>{game.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {hasGamepad && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-[10px] animate-pulse">
              🎮 Pad Active
            </span>
          )}
          <Button
            size="sm"
            onClick={handleToggleFullscreen}
            className="h-7 px-2 sm:px-2.5 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-sm gap-1"
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

      {/* 100% Full-Viewport 3D Game Area */}
      <div
        ref={containerRef}
        className="relative w-full flex-1 h-[calc(100vh-40px)] bg-black overflow-hidden flex items-center justify-center"
      >
        {/* Non-blocking Status Pill */}
        {isLoading && (
          <div className="absolute top-2 inset-x-2 z-20 pointer-events-none flex justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900/95 border border-amber-500/40 rounded-full px-4 py-1.5 shadow-2xl flex items-center gap-2 backdrop-blur-md">
              <div className="size-3 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
              <span className="text-xs font-bold text-amber-400">
                Starting {currentGame.name}...
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
          allow="fullscreen; autoplay; gamepad; accelerometer; gyroscope"
          allowFullScreen
        />
      </div>
    </div>
  );
}
