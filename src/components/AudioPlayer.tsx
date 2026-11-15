import { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioPlayerProps {
  src: string;
  title?: string;
  transcript?: string;
  showTranscript?: boolean;
  durationSeconds?: number;
  className?: string;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export const AudioPlayer = ({
  src,
  title,
  transcript,
  showTranscript = false,
  durationSeconds,
  className = "",
  onDelete,
  isDeleting = false,
}: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [speed, setSpeed] = useState<number>(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.25 : speed === 1.25 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className={`p-3.5 rounded-2xl bg-zinc-950/90 border border-emerald-500/30 text-white shadow-lg flex flex-col gap-2.5 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {title && (
        <div className="flex items-center justify-between text-xs font-bold text-white">
          <span className="truncate">{title}</span>
          <span className="text-[11px] text-white font-mono font-bold bg-black/60 px-2 py-0.5 rounded-md drop-shadow-sm">
            {formatTime(currentTime)} / {formatTime(duration || durationSeconds || 0)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          size="icon"
          variant="default"
          onClick={togglePlay}
          className="size-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 shadow-md transition-transform active:scale-95"
          title={isPlaying ? "Pause" : "Play Voice Recording"}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
        </Button>

        {/* Progress scrub bar */}
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duration || durationSeconds || 10}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div className="flex items-center justify-between text-[11px] font-mono font-bold text-white">
            <span className="bg-black/60 px-1.5 py-0.5 rounded text-white">{formatTime(currentTime)}</span>
            <div className="flex items-center gap-1.5">
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
              <span className="bg-black/60 px-1.5 py-0.5 rounded text-white">{formatTime(duration || durationSeconds || 0)}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={cycleSpeed}
            className="h-7 px-1.5 text-[11px] font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            title="Playback Speed"
          >
            {speed}x
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            className="size-7 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </Button>

          {src && (
            <a
              href={src}
              download="customer-voice-note.webm"
              className="size-7 inline-flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              title="Download Voice Note"
            >
              <Download className="size-3.5" />
            </a>
          )}

          {onDelete && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting}
              className="size-7 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/50"
              title="Delete Voice Note"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {showTranscript && transcript && (
        <div className="mt-1 p-2 rounded-xl bg-black/40 border border-zinc-800 text-xs text-white leading-relaxed font-mono">
          "{transcript}"
        </div>
      )}
    </div>
  );
};
