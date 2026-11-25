import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw, AlertCircle } from 'lucide-react';

interface PodcastPlayerProps {
  title: string;
  host?: string;
  audioUrl?: string;
  episodeNumber?: number;
  durationString?: string;
  artworkUrl?: string;
}

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({
  title,
  host,
  audioUrl,
  episodeNumber,
  durationString,
  artworkUrl,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setHasError(false);
    };
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const skipSeconds = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val === 0) setIsMuted(true);
    else setIsMuted(false);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div dir="rtl" className="w-full bg-[#1F211C] border border-[#2F332C] rounded-2xl p-5 shadow-lg text-right">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Cover Artwork */}
        {artworkUrl && (
          <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#343831] bg-black">
            <img src={artworkUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Track Metadata & Controls */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center justify-between">
            <div>
              {episodeNumber && (
                <span className="text-[11px] font-mono text-[#D7FF38] uppercase tracking-wider block">
                  الحلقة {episodeNumber}
                </span>
              )}
              <h4 className="font-bold text-sm text-[#F2EBDD] font-mono line-clamp-1">{title}</h4>
              {host && <p className="text-xs text-[#F2EBDD]/50">تقديم: {host}</p>}
            </div>

            {hasError && (
              <span className="text-xs text-[#FF5A1F] flex items-center gap-1 font-mono">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>البث الصوتي غير متاح حالياً</span>
              </span>
            )}
          </div>

          {/* Progress Timeline Slider */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={Number.isFinite(currentTime) ? currentTime : 0}
              onChange={handleSeek}
              className="w-full h-1.5 bg-[#2E312B] rounded-lg appearance-none cursor-pointer accent-[#FF5A1F]"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-[#F2EBDD]/50 tabular-nums">
              <span>{formatTime(currentTime)}</span>
              <span>{durationString || formatTime(duration)}</span>
            </div>
          </div>

          {/* Buttons Strip */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              <button
                onClick={() => skipSeconds(-15)}
                className="p-1.5 text-[#F2EBDD]/60 hover:text-white transition-colors cursor-pointer"
                title="ترجيع 15 ثانية"
              >
                <RotateCcw className="w-4 h-4 rtl-flip" />
              </button>

              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-[#FF5A1F] hover:bg-[#FF3300] text-white flex items-center justify-center transition-all shadow-md shadow-[#FF5A1F]/30 cursor-pointer"
                title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current mr-0.5" />}
              </button>

              <button
                onClick={() => skipSeconds(15)}
                className="p-1.5 text-[#F2EBDD]/60 hover:text-white transition-colors cursor-pointer"
                title="تقديم 15 ثانية"
              >
                <RotateCw className="w-4 h-4 rtl-flip" />
              </button>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-[#F2EBDD]/60 hover:text-white cursor-pointer"
                title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : (Number.isFinite(volume) ? volume : 0.85)}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-[#2E312B] rounded appearance-none cursor-pointer accent-[#FF5A1F]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
