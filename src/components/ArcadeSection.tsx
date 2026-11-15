import { Link } from "react-router-dom";
import { Gamepad2, Sparkles, ChevronRight, Trophy, Users } from "lucide-react";

interface ArcadeSectionProps {
  className?: string;
}

export default function ArcadeSection({ className = "" }: ArcadeSectionProps) {
  return (
    <div className={`mb-5 ${className}`}>
      <Link
        to="/arcade"
        className="group relative block p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-blue-600/20 border-2 border-amber-500/40 hover:border-amber-400 shadow-lg hover:shadow-amber-500/10 transition-all duration-300 overflow-hidden hover:-translate-y-0.5"
      >
        {/* Subtle animated background glow */}
        <div className="absolute -right-8 -top-8 size-32 bg-amber-500/15 rounded-full blur-2xl group-hover:scale-125 transition-transform" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left / Info */}
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black flex items-center justify-center font-black text-2xl shadow-md shrink-0 group-hover:rotate-6 transition-transform">
              🎮
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="size-3" /> Free Games
                </span>
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Users className="size-3 text-emerald-400" /> vs Computer or 2P
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-1.5">
                Play & Win <Trophy className="size-4 text-amber-400 inline" />
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                8-Ball Pool, Ludo, Temple Sprint, Marble Shoot & more!
              </p>
            </div>
          </div>

          {/* Right / CTA Button */}
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10 shrink-0">
            {/* Quick Emoji Preview Icons */}
            <div className="flex items-center -space-x-1 text-base filter drop-shadow">
              <span className="group-hover:scale-110 transition-transform">🎱</span>
              <span className="group-hover:scale-110 transition-transform">🎲</span>
              <span className="group-hover:scale-110 transition-transform">🏃</span>
              <span className="group-hover:scale-110 transition-transform">🔮</span>
            </div>

            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 group-hover:from-amber-400 group-hover:to-amber-500 text-black font-black text-xs shadow-md group-hover:translate-x-0.5 transition-all">
              Play Now <ChevronRight className="size-4" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
