import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2, Sparkles, Users, Trophy, Play, Zap } from "lucide-react";

interface GameInfo {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  path: string;
  gradient: string;
  badge: string;
  badgeColor: string;
  multiplayer: boolean;
  category: "all" | "multiplayer" | "action" | "puzzle";
}

const ARCADE_GAMES: GameInfo[] = [
  {
    id: "pool",
    title: "8-Ball Pool",
    subtitle: "Classic Billiards table with real ball physics, cue aiming & power meter",
    emoji: "🎱",
    path: "/8ball",
    gradient: "from-amber-600 via-amber-700 to-yellow-800",
    badge: "vs Computer & 2P",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    multiplayer: true,
    category: "multiplayer",
  },
  {
    id: "ludo",
    title: "Ludo Master",
    subtitle: "Authentic 4-color board, animated rolling dice & token captures",
    emoji: "🎲",
    path: "/ludo",
    gradient: "from-emerald-600 via-teal-700 to-green-800",
    badge: "vs AI or Friends",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    multiplayer: true,
    category: "multiplayer",
  },
  {
    id: "football",
    title: "Football Champions",
    subtitle: "World Cup & Tournament Championship: Penalty Shooters 2, A Small World Cup & Football Legends",
    emoji: "⚽",
    path: "/football",
    gradient: "from-emerald-600 via-green-700 to-teal-900",
    badge: "World Cup & Leagues",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    multiplayer: true,
    category: "action",
  },
  {
    id: "temple",
    title: "Temple Run 2 (3D)",
    subtitle: "Official 3D endless runner: sprint along ancient sky cliffs, jump chasms & dodge obstacles",
    emoji: "🏃",
    path: "/templerun",
    gradient: "from-orange-600 via-amber-700 to-red-800",
    badge: "Official 3D Runner",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    multiplayer: false,
    category: "action",
  },
  {
    id: "marble",
    title: "Marble Shoot",
    subtitle: "Aim & shoot rotating cannon to pop matching colored marble chains",
    emoji: "🔮",
    path: "/marbleshoot",
    gradient: "from-purple-600 via-indigo-700 to-violet-900",
    badge: "Zuma Marble Blast",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    multiplayer: false,
    category: "action",
  },
  {
    id: "flappy",
    title: "Cyber Flap",
    subtitle: "Tap to flap, weave between telecom towers & gather +1GB data tokens",
    emoji: "🕊️",
    path: "/flappy",
    gradient: "from-teal-600 via-emerald-700 to-cyan-800",
    badge: "Data Bird",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    multiplayer: false,
    category: "action",
  },
  {
    id: "2048",
    title: "Data 2048",
    subtitle: "Swipe to merge data bundles (1GB → 2GB → 4GB up to 1TB Master!)",
    emoji: "🧩",
    path: "/2048",
    gradient: "from-violet-600 via-purple-700 to-fuchsia-900",
    badge: "Bundle Fusion",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    multiplayer: false,
    category: "puzzle",
  },
  {
    id: "gems",
    title: "Royal Gems",
    subtitle: "Match-3 jewel cascades, glowing bonus clears & high-score rush",
    emoji: "👑",
    path: "/game",
    gradient: "from-yellow-600 via-amber-600 to-amber-800",
    badge: "Match-3",
    badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    multiplayer: false,
    category: "puzzle",
  },
  {
    id: "race",
    title: "RaceTrack 3D",
    subtitle: "Grand Prix with rotating steering wheel, pedals, AI rival cars & Gamepad support on phone & laptop",
    emoji: "🏎️",
    path: "/race",
    gradient: "from-blue-600 via-indigo-700 to-slate-900",
    badge: "Steering Wheel & Rivals 3D",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    multiplayer: false,
    category: "action",
  },
];

export default function ArcadeHub() {
  const [activeTab, setActiveTab] = useState<"all" | "multiplayer" | "action" | "puzzle">("all");

  const filteredGames = activeTab === "all"
    ? ARCADE_GAMES
    : ARCADE_GAMES.filter(g => g.category === activeTab);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-4xl">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="h-9 px-3 gap-1.5 text-slate-300 hover:text-white">
              <ArrowLeft className="size-4" /> Back to Store
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> {ARCADE_GAMES.length} Free Arcade Games
            </span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20 mb-3">
            <Gamepad2 className="size-8" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
            Play & Win Games 🎮
          </h1>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Play solo, challenge the Computer AI, or pass-and-play with friends while waiting for your data bundle delivery!
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
          <Button
            size="sm"
            variant={activeTab === "all" ? "default" : "outline"}
            onClick={() => setActiveTab("all")}
            className={`h-8 px-3 rounded-xl text-xs font-bold ${activeTab === "all" ? "bg-amber-500 text-black hover:bg-amber-400" : "border-slate-800 text-slate-300 bg-slate-900"}`}
          >
            All Games ({ARCADE_GAMES.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === "multiplayer" ? "default" : "outline"}
            onClick={() => setActiveTab("multiplayer")}
            className={`h-8 px-3 rounded-xl text-xs font-bold ${activeTab === "multiplayer" ? "bg-amber-500 text-black hover:bg-amber-400" : "border-slate-800 text-slate-300 bg-slate-900"}`}
          >
            👥 vs AI & 2-Player (2)
          </Button>
          <Button
            size="sm"
            variant={activeTab === "action" ? "default" : "outline"}
            onClick={() => setActiveTab("action")}
            className={`h-8 px-3 rounded-xl text-xs font-bold ${activeTab === "action" ? "bg-amber-500 text-black hover:bg-amber-400" : "border-slate-800 text-slate-300 bg-slate-900"}`}
          >
            ⚡ 3D & Action (4)
          </Button>
          <Button
            size="sm"
            variant={activeTab === "puzzle" ? "default" : "outline"}
            onClick={() => setActiveTab("puzzle")}
            className={`h-8 px-3 rounded-xl text-xs font-bold ${activeTab === "puzzle" ? "bg-amber-500 text-black hover:bg-amber-400" : "border-slate-800 text-slate-300 bg-slate-900"}`}
          >
            🧩 Puzzles & Brain (2)
          </Button>
        </div>

        {/* Games Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {filteredGames.map(game => (
            <Link
              key={game.id}
              to={game.path}
              className="group relative flex flex-col justify-between p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all overflow-hidden"
            >
              {/* Glow Accent */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${game.gradient} opacity-15 group-hover:opacity-25 transition-opacity`}
              />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-4xl filter drop-shadow">{game.emoji}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${game.badgeColor}`}
                  >
                    {game.badge}
                  </span>
                </div>

                <h3 className="text-lg font-black text-white group-hover:text-amber-400 transition-colors">
                  {game.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {game.subtitle}
                </p>
              </div>

              <div className="relative z-10 mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  {game.multiplayer ? (
                    <>
                      <Users className="size-3 text-emerald-400" /> vs Computer or 2P
                    </>
                  ) : (
                    <>
                      <Trophy className="size-3 text-amber-400" /> High Score
                    </>
                  )}
                </span>
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Play <Play className="size-3 fill-amber-400" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-purple-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <div>
              <div className="text-sm font-bold text-white">All Games Run Instantly In-Browser</div>
              <div className="text-xs text-slate-400">Zero downloads required • High-fidelity audio synth • Offline friendly</div>
            </div>
          </div>
          <Link to="/">
            <Button className="bg-gradient-gold text-slate-950 font-black px-5 rounded-xl">
              Buy Data Bundles
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
