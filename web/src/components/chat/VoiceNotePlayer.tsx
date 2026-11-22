import React, { useState, useRef, useEffect } from 'react';

interface VoiceNotePlayerProps {
  audioUrl: string;
  durationMs: number;
  waveform?: number[];
  isOutgoing?: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  audioUrl,
  durationMs,
  waveform = Array(24).fill(0.4),
  isOutgoing = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = speed;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const cycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 py-1 min-w-[210px] max-w-[260px]">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform active:scale-95 ${
          isOutgoing
            ? 'bg-white text-vault-terracotta'
            : 'bg-vault-terracotta text-white'
        }`}
      >
        {isPlaying ? (
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform Bars */}
      <div className="flex-1 flex items-center gap-0.5 h-7">
        {waveform.map((amp, idx) => {
          const barProgress = idx / waveform.length;
          const isPlayed = barProgress <= progress;

          return (
            <div
              key={idx}
              style={{ height: `${Math.max(amp * 100, 20)}%` }}
              className={`w-1 rounded-full transition-colors ${
                isPlayed
                  ? isOutgoing
                    ? 'bg-white'
                    : 'bg-vault-terracotta'
                  : isOutgoing
                  ? 'bg-white/40'
                  : 'bg-stone-300 dark:bg-vault-dark-border'
              }`}
            />
          );
        })}
      </div>

      {/* Playback Speed Pill */}
      <button
        type="button"
        onClick={cycleSpeed}
        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
          isOutgoing
            ? 'border-white/40 text-white hover:bg-white/20'
            : 'border-stone-300 dark:border-vault-dark-border text-stone-600 dark:text-vault-dark-muted hover:border-vault-terracotta'
        }`}
      >
        {speed}x
      </button>
    </div>
  );
};
