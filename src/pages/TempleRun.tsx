import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Flame, Maximize2, Minimize2, RotateCcw, Sparkles, Zap } from "lucide-react";

interface RunnerOption {
  id: string;
  name: string;
  badge: string;
  url: string;
  description: string;
  controls: string;
}

const RUNNER_GAMES: RunnerOption[] = [
  {
    id: "templerun2",
    name: "Temple Run 2",
    badge: "Official 3D",
    url: "https://y2k04.github.io/templerun2/4399swf/upload_swf/ftp35/gamehwq/20210119/11/index.html",
    description: "Official 3D endless runner. Sprint along ancient sky cliffs, jump over chasms, slide under stone traps, and tilt/turn around corners.",
    controls: "Swipe Up: Jump • Swipe Down: Slide • Swipe Left/Right: Turn • WASD on PC"
  },
  {
    id: "tombrunner",
    name: "Tomb Runner 3D",
    badge: "⚡ Fast iPhone",
    url: "https://ubg365.github.io/tomb-runner/",
    description: "Ultra-fast mobile 3D runner built specifically for iPhone & touch screens. Collect ancient coins, dodge flame traps, and sprint through ancient ruins.",
    controls: "Swipe Up/Down to Jump/Slide • Swipe Left/Right to Steer"
  }
];

export default function TempleRun() {
  const [selectedGameId, setSelectedGameId] = useState<string>("templerun2");
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentGame = RUNNER_GAMES.find(g => g.id === selectedGameId) || RUNNER_GAMES[0];

  // Auto-dismiss loading indicator in 2s so mobile Safari/iPhone users are never blocked
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

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(k => k + 1);
  };

  return (
    <div className="h-screen w-screen bg-black text-slate-100 flex flex-col select-none overflow-hidden">
      {/* Sleek Ultra-Compact Top Header (Takes only 40px, giving 100% of the screen to the game) */}
      <div className="w-full h-10 px-2 sm:px-4 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0 z-10">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link to="/arcade" className="shrink-0">
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-slate-300 hover:text-white text-xs">
              <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">Arcade</span>
            </Button>
          </Link>

          {/* Game Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 shrink-0">
            {RUNNER_GAMES.map(game => {
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
                >
                  {game.id === "templerun2" ? <Sparkles className="size-3" /> : <Zap className="size-3" />}
                  <span>{game.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            onClick={handleToggleFullscreen}
            className="h-7 px-2.5 text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-sm gap-1"
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

      {/* 100% Screen Full-Width & Full-Height Game Viewport (Zero Borders, Zero Margins, Zero Clamping) */}
      <div
        ref={containerRef}
        className="relative w-full flex-1 h-[calc(100vh-40px)] bg-black overflow-hidden flex items-center justify-center"
      >
        {/* Non-blocking Floating Status Pill: pointer-events-none lets touches pass directly into game canvas for iOS gesture activation */}
        {isLoading && (
          <div className="absolute top-2 inset-x-2 z-20 pointer-events-none flex justify-center animate-in fade-in duration-200">
            <div className="bg-slate-900/95 border border-amber-500/40 rounded-full px-4 py-1.5 shadow-2xl flex items-center gap-2 backdrop-blur-md">
              <div className="size-3 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
              <span className="text-xs font-bold text-amber-400">
                Starting {currentGame.name}...
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Swipe up to jump, swipe down to slide
              </span>
            </div>
          </div>
        )}

        <iframe
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
