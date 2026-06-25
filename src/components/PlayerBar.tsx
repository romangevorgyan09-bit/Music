/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Volume2, VolumeX, Heart, Music2, Maximize2, Sliders } from "lucide-react";
import { Song } from "../types";
import AudioEnhancerPanel from "./AudioEnhancerPanel";
import RealtimeVisualizer from "./RealtimeVisualizer";

// Extend global Window interface for YT API
declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT: any;
  }
}

interface PlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  isLiked: boolean;
  onToggleLike: (song: Song) => void;
  isShuffled: boolean;
  onToggleShuffle: () => void;
  isLooped: boolean;
  onToggleLoop: () => void;
  isEnhanced: boolean;
  setIsEnhanced: (val: boolean) => void;
}

export default function PlayerBar({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  isLiked,
  onToggleLike,
  isShuffled,
  onToggleShuffle,
  isLooped,
  onToggleLoop,
  isEnhanced,
  setIsEnhanced,
}: PlayerBarProps) {
  const [volume, setVolume] = useState<number>(75);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(1);
  const [showCanvas, setShowCanvas] = useState<boolean>(true);
  const [isEnhancerOpen, setIsEnhancerOpen] = useState<boolean>(false);
  
  const [isPlayerReady, setIsPlayerReady] = useState<boolean>(false);
  const ytPlayerRef = useRef<any>(null);
  const isFirstRender = useRef<boolean>(true);

  const [useAudioEngine, setUseAudioEngine] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("forceBackgroundPlay");
      return saved === null ? true : saved === "true";
    }
    return true;
  });
  const [forceBackgroundPlayback, setForceBackgroundPlayback] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("forceBackgroundPlay");
      return saved === null ? true : saved === "true";
    }
    return true;
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unlockAudioEngine = () => {
    if (audioRef.current) {
      const originalSrc = audioRef.current.src;
      // If no src is set or is placeholder, set a quick 1-second silent WAV base64 to unlock the element safely
      if (!originalSrc || originalSrc === "" || originalSrc.startsWith("data:")) {
        audioRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAD";
      }
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            audioRef.current?.pause();
            // Restore actual src if it had one
            if (originalSrc && originalSrc !== "" && !originalSrc.startsWith("data:")) {
              audioRef.current!.src = originalSrc;
            }
          })
          .catch((e) => {
            console.log("[Audio Engine] Audio context unlock trace:", e);
          });
      }
    }
  };

  const handleToggleBackgroundPlayback = (val: boolean) => {
    setForceBackgroundPlayback(val);
    if (val) {
      setTimeout(() => {
        unlockAudioEngine();
      }, 50);
    }
  };

  // Sync forceBackgroundPlayback state to useAudioEngine and localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("forceBackgroundPlay", String(forceBackgroundPlayback));
    }
    setUseAudioEngine(forceBackgroundPlayback);
  }, [forceBackgroundPlayback]);

  // Sync with Media Session API for Lock Screen & Notification Center background actions (APK support)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentSong) return;

    try {
      // Set metadata
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: "Музыкальный Стример",
        artwork: [
          { src: currentSong.thumbnail, sizes: "96x96", type: "image/jpeg" },
          { src: currentSong.thumbnail, sizes: "128x128", type: "image/jpeg" },
          { src: currentSong.thumbnail, sizes: "192x192", type: "image/jpeg" },
          { src: currentSong.thumbnail, sizes: "256x256", type: "image/jpeg" },
          { src: currentSong.thumbnail, sizes: "384x384", type: "image/jpeg" },
          { src: currentSong.thumbnail, sizes: "512x512", type: "image/jpeg" },
        ],
      });
    } catch (e) {
      console.warn("MediaSession metadata config failed:", e);
    }
  }, [currentSong]);

  // Sync playbackState
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch (e) {
      console.warn("MediaSession playbackState config failed:", e);
    }
  }, [isPlaying]);

  // Sync position state
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentSong || !totalDuration) return;
    try {
      if (typeof navigator.mediaSession.setPositionState === "function") {
        navigator.mediaSession.setPositionState({
          duration: Math.max(1, totalDuration),
          playbackRate: 1.0,
          position: Math.max(0, Math.min(progress, totalDuration)),
        });
      }
    } catch (e) {
      console.warn("MediaSession position state update failed:", e);
    }
  }, [progress, totalDuration, currentSong]);

  // Sync actions (prev track, next track, play, pause, seek)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        onPlayPause(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        onPlayPause(false);
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        onPrevious();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        onNext();
      });
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) {
          setProgress(Math.floor(details.seekTime));
          if (useAudioEngine && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
          } else {
            if (ytPlayerRef.current && isPlayerReady && typeof ytPlayerRef.current.seekTo === "function") {
              try { ytPlayerRef.current.seekTo(details.seekTime, true); } catch (err) {}
            }
          }
        }
      });
    } catch (e) {
      console.warn("MediaSession actions configuration failed:", e);
    }

    // Clean up handlers on unmount
    return () => {
      if (typeof window !== "undefined" && "mediaSession" in navigator) {
        try {
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
          navigator.mediaSession.setActionHandler("seekto", null);
        } catch (e) {}
      }
    };
  }, [onPlayPause, onPrevious, onNext, isPlayerReady, useAudioEngine]);

  // Initialize YouTube Iframe Player on mount or wait for the API
  useEffect(() => {
    const initYT = () => {
      if (ytPlayerRef.current) return;

      try {
        ytPlayerRef.current = new window.YT.Player("yt-player-frame", {
          height: "1",
          width: "1",
          videoId: currentSong ? currentSong.id : "",
          playerVars: {
            autoplay: isPlaying ? 1 : 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            origin: window.location.origin
          },
          events: {
            onReady: (event: any) => {
              setIsPlayerReady(true);
              event.target.setVolume(isMuted ? 0 : volume);
              // Handle immediate video play if playstate was triggered before load
              if (currentSong && isPlaying) {
                event.target.playVideo();
              }
            },
            onStateChange: (event: any) => {
              // 0 means ENDED
              if (event.data === 0) {
                if (isLooped) {
                  event.target.seekTo(0, true);
                  event.target.playVideo();
                } else {
                  onNext();
                }
              }
              // Update isPlaying state if user interacts with media controls
              if (event.data === 1 && !isPlaying) {
                onPlayPause(true);
              } else if (event.data === 2 && isPlaying) {
                onPlayPause(false);
              }
            },
            onError: (event: any) => {
              console.warn("YouTube player encountered error:", event.data, "- Swapping to self-healing streaming proxy");
              setUseAudioEngine(true);
            }
          }
        });
      } catch (err) {
        console.error("Failed to initialize YT instance:", err);
      }
    };

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = () => {
        initYT();
      };
    } else {
      initYT();
    }
  }, []);

  // Monitor elapsed playback progress and duration
  useEffect(() => {
    if (!isPlaying || !ytPlayerRef.current || !isPlayerReady || !currentSong || useAudioEngine) return;

    const interval = setInterval(() => {
      try {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
          const currentTime = ytPlayerRef.current.getCurrentTime();
          const duration = ytPlayerRef.current.getDuration();

          if (currentTime !== undefined && !isNaN(currentTime)) {
            setProgress(Math.floor(currentTime));
          }
          if (duration !== undefined && !isNaN(duration) && duration > 0) {
            setTotalDuration(Math.floor(duration));
          }
        }
      } catch (err) {
        console.warn("Failed querying elapsed tracking:", err);
      }
    }, 450);

    return () => clearInterval(interval);
  }, [isPlaying, isPlayerReady, currentSong, useAudioEngine]);

  // Sync volume state transitions
  useEffect(() => {
    const activeVolume = isMuted ? 0 : volume;
    if (useAudioEngine) {
      if (audioRef.current) {
        audioRef.current.volume = activeVolume / 100;
        audioRef.current.muted = isMuted;
      }
    } else {
      if (!ytPlayerRef.current || !isPlayerReady) return;
      try {
        if (typeof ytPlayerRef.current.setVolume === "function") {
          ytPlayerRef.current.setVolume(activeVolume);
        }
      } catch (e) {
        console.warn("Volume state sync failed:", e);
      }
    }
  }, [volume, isMuted, isPlayerReady, useAudioEngine]);

  // Sync HiFi Boost audio filters
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (isEnhanced) {
      setVolume((prev) => {
        const boosted = Math.min(prev + 30, 100);
        if (useAudioEngine) {
          if (audioRef.current) {
            audioRef.current.volume = (isMuted ? 0 : boosted) / 100;
          }
        } else {
          if (ytPlayerRef.current && isPlayerReady && typeof ytPlayerRef.current.setVolume === "function") {
            ytPlayerRef.current.setVolume(isMuted ? 0 : boosted);
          }
        }
        return boosted;
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate([25, 15, 30]); } catch (e) {}
      }
    } else {
      setVolume((prev) => {
        const neutral = Math.max(prev - 30, 40);
        if (useAudioEngine) {
          if (audioRef.current) {
            audioRef.current.volume = (isMuted ? 0 : neutral) / 100;
          }
        } else {
          if (ytPlayerRef.current && isPlayerReady && typeof ytPlayerRef.current.setVolume === "function") {
            ytPlayerRef.current.setVolume(isMuted ? 0 : neutral);
          }
        }
        return neutral;
      });
    }
  }, [isEnhanced]);

  // Manage stopping/pausing the other engine when useAudioEngine transitions
  useEffect(() => {
    if (useAudioEngine) {
      // Pause YouTube if switching to audio engine fallback
      if (ytPlayerRef.current && isPlayerReady) {
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
      }
    } else {
      // Pause Audio engine if playing on YouTube
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    }
  }, [useAudioEngine, isPlayerReady]);

  // Sync Song Playback when currentSong changes
  useEffect(() => {
    if (!currentSong) {
      if (ytPlayerRef.current && isPlayerReady) {
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      return;
    }

    setProgress(0);

    // Dynamic reset to YouTube Player engine on song change to conserve server resources
    setUseAudioEngine(forceBackgroundPlayback);

    if (forceBackgroundPlayback) {
      if (audioRef.current) {
        audioRef.current.src = `/api/music/stream?v=${currentSong.id}&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`;
        if (isPlaying) {
          audioRef.current.play().catch((e) => console.log("Audio engine start failed:", e));
        }
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (!ytPlayerRef.current || !isPlayerReady) return;
      try {
        if (typeof ytPlayerRef.current.loadVideoById === "function") {
          if (isPlaying) {
            ytPlayerRef.current.loadVideoById({ videoId: currentSong.id, startSeconds: 0 });
          } else {
            ytPlayerRef.current.cueVideoById({ videoId: currentSong.id, startSeconds: 0 });
          }
        }
      } catch (error) {
        console.warn("Playback transition failed:", error);
      }
    }
  }, [currentSong, isPlayerReady]);

  // Effect to handle useAudioEngine activation during current song playback
  useEffect(() => {
    if (useAudioEngine && currentSong && audioRef.current) {
      const activeSrc = `/api/music/stream?v=${currentSong.id}&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}`;
      if (audioRef.current.src !== activeSrc && !audioRef.current.src.includes(currentSong.id)) {
        audioRef.current.src = activeSrc;
        const activeVolume = isMuted ? 0 : volume;
        audioRef.current.volume = activeVolume / 100;
        audioRef.current.muted = isMuted;
        if (isPlaying) {
          audioRef.current.play().catch((e) => console.log("Audio Engine switch play fail:", e));
        }
      }
    }
  }, [useAudioEngine, currentSong]);

  // Sync Pause/Play Actions
  useEffect(() => {
    if (useAudioEngine) {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.play().catch((e) => console.log("Audio play failed:", e));
      } else {
        audioRef.current.pause();
      }
    } else {
      if (!ytPlayerRef.current || !isPlayerReady || !currentSong) return;
      try {
        const playerState = typeof ytPlayerRef.current.getPlayerState === "function" 
          ? ytPlayerRef.current.getPlayerState() 
          : -1;

        if (isPlaying) {
          if (playerState !== 1) { // 1 means PLAYING
            ytPlayerRef.current.playVideo();
          }
        } else {
          if (playerState === 1) { // 1 means PLAYING
            ytPlayerRef.current.pauseVideo();
          }
        }
      } catch (e) {
        console.log("Play state sync blocked:", e);
      }
    }
  }, [isPlaying, isPlayerReady, useAudioEngine, currentSong]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseInt(e.target.value);
    setProgress(newProgress);
    if (useAudioEngine) {
      if (audioRef.current) {
        audioRef.current.currentTime = newProgress;
      }
    } else {
      if (ytPlayerRef.current && isPlayerReady && typeof ytPlayerRef.current.seekTo === "function") {
        try {
          ytPlayerRef.current.seekTo(newProgress, true);
        } catch (err) {
          console.warn("Error seeking video timeline:", err);
        }
      }
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === Infinity) return "0:00";
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      id="spotify-player-bar" 
      className="bg-zinc-950 border-t border-zinc-900 px-4 py-2 md:p-4 flex items-center justify-between gap-4 select-none fixed bottom-16 md:bottom-0 left-0 right-0 h-20 md:h-24 z-40 text-white shadow-2xl"
    >
      {/* Real-time sound reactive strip & progress slider on the top edge of PlayerBar for easy scrub/seek on mobile & desktop */}
      <div className="absolute top-0 left-0 right-0 h-1 z-50 group hover:h-2 transition-all">
        {/* Floating background tracker */}
        <div className="absolute inset-0 bg-zinc-900 pointer-events-none opacity-30"></div>
        {/* Fill representing song progression */}
        <div 
          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 absolute left-0 top-0 pointer-events-none shadow-[0_0_8px_rgba(242,158,11,0.6)]"
          style={{ width: `${(progress / (totalDuration || 1)) * 100}%` }}
        />
        {/* Invisible range element that is easily swipe/click targetable */}
        <input
          id="player-seek-slider-top"
          type="range"
          min="0"
          max={totalDuration}
          value={progress}
          onChange={handleProgressChange}
          disabled={!currentSong}
          className="absolute inset-x-0 -top-1.5 h-4 w-full opacity-0 hover:opacity-100 cursor-pointer accent-amber-500 z-50"
        />
        {/* Real-time sound reactive strip background */}
        <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden pointer-events-none opacity-40 mix-blend-screen">
          <RealtimeVisualizer
            isPlaying={isPlaying}
            isEnhanced={isEnhanced}
            volume={isMuted ? 0 : volume}
            currentSongId={currentSong ? currentSong.id : undefined}
            height={4}
            showControls={false}
          />
        </div>
      </div>

      {/* Hidden YouTube player container */}
      <div className="absolute overflow-hidden w-px h-px opacity-0 pointer-events-none">
        <div id="yt-player-frame"></div>
        <audio
          ref={audioRef}
          id="fallback-audio-player"
          className="hidden"
          onTimeUpdate={() => {
            if (useAudioEngine && audioRef.current) {
              setProgress(Math.floor(audioRef.current.currentTime));
            }
          }}
          onLoadedMetadata={() => {
            if (useAudioEngine && audioRef.current) {
              setTotalDuration(Math.floor(audioRef.current.duration || 1));
            }
          }}
          onEnded={() => {
            if (useAudioEngine) {
              if (isLooped) {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(e => console.warn(e));
                }
              } else {
                onNext();
              }
            }
          }}
        />
      </div>

      {/* FULL-SCREEN/EXPANDED MOBILE PLAYER OVERLAY (Only visible on mobile when showCanvas is true) */}
      {currentSong && showCanvas && (
        <div id="mobile-player-expanded" className="fixed inset-0 bg-zinc-950/98 backdrop-blur-xl z-50 flex flex-col justify-between p-6 animate-fadeIn text-white lg:hidden overflow-y-auto">
          {/* Consolidated Modal Header */}
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setShowCanvas(false)}
              className="p-2 -ml-2 rounded-full bg-zinc-900/40 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all active:scale-90"
            >
              <svg className="w-6 h-6 stroke-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-[10px] font-mono font-black text-[#fd3b6a] uppercase tracking-widest leading-none">NOW PLAYING</p>
              <p className="text-[11px] font-sans font-black text-white uppercase tracking-wider mt-1">RADIO AVA</p>
            </div>
            <button 
              onClick={() => setIsEnhancerOpen(true)}
              className="p-2 -mr-2 rounded-full bg-zinc-900/40 hover:bg-zinc-900 text-zinc-300 hover:text-[#fd3b6a] transition-all active:scale-90"
              title="Настройки звука"
            >
              <Sliders className="w-5 h-5" />
            </button>
          </div>

          {/* Vinyl record disc turntable section */}
          <div className="flex-1 flex flex-col items-center justify-center py-4 select-none relative w-full">
            
            {/* Ambient colorful glow backing the disc */}
            <div className="absolute w-64 h-64 rounded-full bg-gradient-to-tr from-[#fd3b6a]/15 to-transparent filter blur-3xl pointer-events-none -z-10 animate-pulse"></div>

            <div className="relative flex items-center justify-center">
              {/* Outer Glowing Concentric Ring matching progress percentage as degrees */}
              <div 
                className="absolute w-56 h-56 rounded-full border border-dashed transition-all duration-300"
                style={{
                  borderColor: isPlaying ? 'rgba(253,59,106,0.35)' : 'rgba(255,255,255,0.05)',
                  transform: `rotate(${(progress / totalDuration) * 360}deg)`,
                  boxShadow: isPlaying ? '0 0 25px rgba(253,59,106,0.15)' : 'none'
                }}
              ></div>
              <div className="absolute w-50 h-50 rounded-full border border-zinc-800/30"></div>

              {/* Master Platter Vinyl wrapping cover artwork */}
              <div 
                className={`w-44 h-44 sm:w-48 sm:h-48 rounded-full p-2 bg-neutral-950 border-4 border-[#1c1f2e] shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center justify-center relative overflow-hidden shrink-0 ${isPlaying ? "animate-spin" : ""}`}
                style={{ animationDuration: "14s" }}
              >
                {/* Vinyl grooved sound tracks texture overlays */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_35%,_rgba(0,0,0,0.92)_100%)] opacity-95 z-10 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,_transparent_0,_transparent_4px,_rgba(255,255,255,0.012)_5px,_rgba(255,255,255,0.012)_6px)] z-10 pointer-events-none"></div>
                
                {/* Center Thumbnail */}
                <img 
                  src={currentSong.thumbnail} 
                  alt="Track Cover"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover rounded-full" 
                />

                {/* Spindle gold dot core */}
                <div className="absolute w-10 h-10 bg-zinc-950 rounded-full border-4 border-zinc-900 z-20 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-[#fe6846] rounded-full shadow-lg"></div>
                </div>
              </div>
            </div>

            {/* Micro details panel below vinyl */}
            <div className="mt-5 text-center max-w-xs px-4">
              <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase">
                🎧 {Math.floor(12500 + (progress * 13) % 4322)} Plays
              </span>
              <h2 className="text-xl font-extrabold font-sans text-white truncate mt-1 leading-tight">{currentSong.title}</h2>
              <p className="text-xs font-semibold text-[#fd3b6a] mt-1.5 uppercase tracking-wider">{currentSong.artist}</p>
            </div>
          </div>

          {/* SENSATIONAL WAVEFORM & SEEK BAR GRID */}
          <div className="w-full max-w-sm px-6 pb-2 select-none">
            {/* Visual sound spectrum bars */}
            <div className="flex items-end justify-center gap-[3px] h-10 w-full mb-3 opacity-80 overflow-hidden pointer-events-none">
              {Array.from({ length: 32 }).map((_, i) => {
                // Determine active state of the visualizer bar based on song progress
                const barRatio = i / 32;
                const playRatio = progress / totalDuration;
                const isActive = barRatio <= playRatio;
                return (
                  <div
                    key={i}
                    className={`w-[3px] rounded-full transition-all duration-300 ${
                      isActive 
                        ? "bg-gradient-to-t from-[#fd3b6a] to-[#fe6846] opacity-100" 
                        : "bg-zinc-850 opacity-40"
                    }`}
                    style={{
                      height: isPlaying ? `${15 + Math.sin(progress * 1.5 + i * 0.4) * 15 + Math.random() * 8}px` : '8px',
                    }}
                  />
                );
              })}
            </div>

            {/* Slider track overlap */}
            <div className="relative">
              <input
                id="mobile-player-seek-slider"
                type="range"
                min="0"
                max={totalDuration}
                value={progress}
                onChange={handleProgressChange}
                disabled={!currentSong}
                className="w-full accent-[#fd3b6a] bg-zinc-900 h-1 rounded-full appearance-none cursor-pointer focus:outline-none"
              />
            </div>

            <div className="w-full flex items-center justify-between text-[10px] text-zinc-450 font-mono mt-1.5 px-0.5">
              <span>{formatTime(progress)}</span>
              <span className="text-[9px] font-bold text-[#fd3b6a]/60 uppercase tracking-widest">{isEnhanced ? "HiFi Equalizer active" : "Radio Ava"}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* MOBILE EXPANDED PLAYER BUTTONS PANE */}
          <div className="w-full max-w-sm px-8 pb-8 pt-2 select-none">
            <div className="flex items-center justify-between">
              
              {/* Shuffle Button */}
              <button
                onClick={onToggleShuffle}
                className={`p-2 transition-all active:scale-90 rounded-full ${
                  isShuffled ? "text-[#fd3b6a] bg-[#fd3b6a]/10" : "text-zinc-500 hover:text-zinc-350"
                }`}
                title="Перемешать"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Prev Button */}
              <button
                onClick={onPrevious}
                disabled={!currentSong}
                className="p-3 text-zinc-400 hover:text-white active:scale-90 disabled:opacity-20 transition-all cursor-pointer rounded-full bg-zinc-950/20 border border-zinc-900/40"
                title="Предыдущий трек"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              {/* Glowing Pink Central Play Button */}
              <button
                onClick={() => {
                  unlockAudioEngine();
                  onPlayPause(!isPlaying);
                }}
                disabled={!currentSong}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#fd3b6a] to-[#fe6846] text-white flex items-center justify-center active:scale-95 transition-all shadow-xl shadow-[#fd3b6a]/30 shrink-0 cursor-pointer"
                title="Воспроизведение / Пауза"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current stroke-[2.5]" />
                ) : (
                  <Play className="w-7 h-7 fill-current stroke-[2.5] pl-1" />
                )}
              </button>

              {/* Next Button */}
              <button
                onClick={onNext}
                disabled={!currentSong}
                className="p-3 text-zinc-400 hover:text-white active:scale-90 disabled:opacity-20 transition-all cursor-pointer rounded-full bg-zinc-950/20 border border-zinc-900/40"
                title="Следующий трек"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>

              {/* Repeat Button */}
              <button
                onClick={onToggleLoop}
                className={`p-2 transition-all active:scale-90 rounded-full ${
                  isLooped ? "text-[#fd3b6a] bg-[#fd3b6a]/10" : "text-zinc-500 hover:text-zinc-350"
                }`}
                title="Повтор"
              >
                <Repeat className="w-5 h-5" />
              </button>

            </div>

            {/* Quick Actions Footer Card */}
            <div className="mt-6 flex items-center justify-between bg-[#121420]/60 border border-white/5 p-3 rounded-2xl">
              <button
                onClick={() => onToggleLike(currentSong)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 ${
                  isLiked ? "text-[#fd3b6a]" : "text-zinc-450 hover:text-zinc-200"
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? "fill-[#fd3b6a] text-[#fd3b6a]" : ""}`} />
                <span>Избранное</span>
              </button>

              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate(20);
                  }
                  setIsEnhanced(!isEnhanced);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs active:scale-95 transition-all select-none ${
                  isEnhanced 
                    ? "border-[#fd3b6a] text-[#fd3b6a] bg-[#fd3b6a]/10 shadow-lg shadow-[#fd3b6a]/10" 
                    : "border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>ЛАМПОВЫЙ БУСТ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Sound Analyzer Canvas & Player Shell - (Only visible on desktop lg screen sizes and wider) */}
      <div 
        className={`transition-all duration-300 overflow-hidden rounded-lg shadow-lg bg-zinc-950 z-50 ease-out hidden lg:block ${
          !currentSong 
            ? "w-0 h-0 opacity-0 pointer-events-none border-0" 
            : showCanvas 
              ? "fixed bottom-38 lg:bottom-28 right-4 w-72 h-44 border border-[#fd3b6a]/20 shadow-black/80 shadow-2xl" 
              : "relative w-23 h-12 border border-zinc-800 shrink-0 mr-1"
        }`}
      >
        {showCanvas && (
          <div className="absolute top-1 left-1.5 right-1.5 z-20 flex items-center justify-between pointer-events-none">
            <span className="text-[9px] font-black text-[#fd3b6a] tracking-wider bg-zinc-950/90 px-1.5 py-0.5 rounded shadow">
              HIFI MONITOR
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowCanvas(false);
              }}
              className="pointer-events-auto text-[9px] font-bold text-zinc-400 hover:text-white bg-zinc-900/95 hover:bg-zinc-850 px-1.5 py-0.5 rounded shadow transition-all active:scale-90"
            >
              Свернуть
            </button>
          </div>
        )}

        {!showCanvas && (
          <button
            onClick={() => setShowCanvas(true)}
            className="absolute inset-0 z-20 bg-black/75 hover:bg-black/45 flex flex-col items-center justify-center transition-all cursor-pointer group"
            title="Развернуть монитор"
          >
            <span className="text-[8px] font-black text-zinc-400 group-hover:text-[#fd3b6a] font-mono tracking-widest leading-none">
              MONITOR ON
            </span>
          </button>
        )}

        <div className="w-full h-full relative bg-zinc-950 flex flex-col justify-between p-3 select-none">
          {showCanvas ? (
            <>
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#fd3b6a]/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-center gap-3 relative z-10 mt-3">
                <div className={`w-11 h-11 rounded-full border border-[#fd3b6a]/30 relative flex items-center justify-center shrink-0 ${isPlaying ? "animate-spin" : ""}`} style={{ animationDuration: "12s" }}>
                  <img 
                    src={currentSong ? currentSong.thumbnail : undefined} 
                    alt="Cover Art"  
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover" 
                  />
                  <div className="absolute w-2.5 h-2.5 bg-zinc-950 rounded-full border border-zinc-805 flex items-center justify-center">
                    <div className="w-0.5 h-0.5 bg-[#fd3b6a] rounded-full"></div>
                  </div>
                </div>
                
                <div className="min-w-0 flex-1">
                  <span className="text-[8px] font-mono font-black uppercase text-[#fd3b6a] tracking-wider block leading-none">
                    {isEnhanced ? "VACUUM TUBE ACTIVE" : "PURE DIRECT STREAM"}
                  </span>
                  <p className="text-xs font-bold text-zinc-100 truncate mt-1 leading-none">{currentSong?.title}</p>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5 leading-none">{currentSong?.artist}</p>
                </div>
              </div>

              <div className="flex-1 mt-2.5 flex items-end relative z-10 h-14 overflow-hidden">
                <RealtimeVisualizer
                  isPlaying={isPlaying}
                  isEnhanced={isEnhanced}
                  volume={isMuted ? 0 : volume}
                  currentSongId={currentSong ? currentSong.id : undefined}
                  height={45}
                  showControls={false}
                />
              </div>

              <div className="pt-1.5 border-t border-zinc-900/80 flex justify-between font-mono text-[7.5px] text-zinc-500 relative z-10">
                <span>STEREO PROXY</span>
                <span>Bitrate: 1411kbps</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900/40">
              <div className="text-center font-mono text-[8px] text-zinc-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto mb-1 animate-pulse" />
                <span>HIFI ON</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TRACK INFORMATION CONTAINER: Left Pane */}
      <div 
        onClick={() => setShowCanvas(true)}
        className="flex items-center gap-3 w-1/2 md:w-[30%] md:min-w-[180px] min-w-0 cursor-pointer hover:opacity-95 transition-opacity"
        title="Развернуть плеер"
      >
        {currentSong ? (
          <>
            <div 
              className="w-11 h-11 md:w-13 md:h-13 rounded-md overflow-hidden bg-zinc-900 border border-zinc-805 shadow shrink-0 relative group"
            >
              <img
                src={currentSong.thumbnail}
                alt={currentSong.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-all animate-none"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&q=85";
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Maximize2 className="w-4 h-4 text-[#fd3b6a]" />
              </div>
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="text-xs md:text-sm font-bold text-zinc-100 truncate">
                {currentSong.title}
              </p>
              <p className="text-[10px] md:text-xs text-zinc-400 truncate">
                {currentSong.artist}
              </p>
            </div>

            <button
              id={`player-btn-like-${currentSong.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike(currentSong);
              }}
              className="text-zinc-400 hover:text-[#fd3b6a] active:scale-90 transition-all cursor-pointer shrink-0"
            >
              <Heart className={`w-4 h-4 md:w-5 md:h-5 ${isLiked ? "text-[#fd3b6a] fill-[#fd3b6a] hover:text-[#fd3b6a]" : ""}`} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 md:w-13 md:h-13 rounded-md bg-zinc-900 border border-zinc-850/60 flex items-center justify-center text-zinc-650 shadow">
              <Music2 className="w-5 h-5 md:w-6 md:h-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-medium text-zinc-550 truncate">Выберите трек</p>
            </div>
          </div>
        )}
      </div>

      {/* PLAYBACK CONTROLS & SEEK BAR: Center Pane */}
      <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl">
        {/* Buttons Pane */}
        <div className="flex items-center gap-3.5 md:gap-5">
          <button
            id="player-btn-shuffle"
            onClick={onToggleShuffle}
            title="Перемешать"
            className={`cursor-pointer pb-0.5 transition-colors hidden sm:block ${
              isShuffled ? "text-[#fd3b6a] hover:text-[#fd3b6a]/80" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            id="player-btn-prev"
            onClick={onPrevious}
            disabled={!currentSong}
            className="text-zinc-400 hover:text-white disabled:text-zinc-800 disabled:opacity-20 transition-all cursor-pointer"
          >
            <SkipBack className="w-4.5 h-4.5 md:w-5 md:h-5 fill-current" />
          </button>

          <button
            id="player-btn-play-pause"
            onClick={() => {
              unlockAudioEngine();
              onPlayPause(!isPlaying);
            }}
            disabled={!currentSong}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white hover:bg-neutral-100 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-650 flex items-center justify-center active:scale-95 disabled:scale-100 disabled:cursor-not-allowed transition-all shadow shadow-black shrink-0 cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 md:w-5 md:h-5 fill-zinc-950 stroke-[2.5]" />
            ) : (
              <Play className="w-4 h-4 md:w-5 md:h-5 fill-zinc-950 stroke-[2.5] pl-0.5" />
            )}
          </button>

          <button
            id="player-btn-next"
            onClick={onNext}
            disabled={!currentSong}
            className="text-zinc-400 hover:text-white disabled:text-zinc-800 disabled:opacity-20 transition-all cursor-pointer"
          >
            <SkipForward className="w-4.5 h-4.5 md:w-5 md:h-5 fill-current" />
          </button>

          <button
            id="player-btn-loop"
            onClick={onToggleLoop}
            title="Повтор песни"
            className={`cursor-pointer pb-0.5 transition-colors hidden sm:block ${
              isLooped ? "text-[#fd3b6a] hover:text-[#fd3b6a]/80" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Seek Time Monitor (only on mobile/tablet) */}
        {currentSong && (
          <div className="text-[9px] text-[#fd3b6a]/80 font-mono md:hidden select-none tracking-wider text-center flex items-center gap-1 leading-none mt-0.5">
            <span className="text-zinc-300">{formatTime(progress)}</span>
            <span className="text-zinc-650 font-bold">/</span>
            <span className="text-zinc-500">{formatTime(totalDuration)}</span>
          </div>
        )}

        {/* Dynamic Seek Slider (Visible in inline player bar only on medium screens and larger) */}
        <div className="w-full hidden md:flex items-center gap-3 text-xs text-zinc-500 font-mono">
          <span className="w-8 text-right shrink-0">{formatTime(progress)}</span>
          
          <input
            id="player-seek-slider"
            type="range"
            min="0"
            max={totalDuration}
            value={progress}
            onChange={handleProgressChange}
            disabled={!currentSong}
            className="flex-1 accent-[#fd3b6a] bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none disabled:cursor-not-allowed"
          />
          
          <span className="w-8 shrink-0">{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* VOLUME PANEL & STREAM UTILITIES: Right Pane */}
      <div className="flex items-center justify-end gap-2 md:gap-3.5 w-auto md:w-[30%] shrink-0">
        {/* Muted controls */}
        <button
          id="player-btn-mute"
          onClick={toggleMute}
          className="text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors hidden lg:block"
        >
          {isMuted || volume === 0 ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
        </button>

        <input
          id="player-volume-slider"
          type="range"
          min="0"
          max="100"
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            setVolume(val);
            setIsMuted(false);
          }}
          className="w-16 lg:w-20 accent-[#fd3b6a] bg-zinc-800 h-1 rounded-lg appearance-none cursor-pointer focus:outline-none hidden lg:block"
        />

        <div className="border-l border-zinc-800 h-5.5 my-1 mx-1.5 hidden lg:block"></div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate(20);
            }
            setIsEnhancerOpen(true);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#fd3b6a]/40 hover:border-[#fd3b6a] text-[#fd3b6a] font-bold text-[10px] md:text-xs shadow-lg hover:shadow-[#fd3b6a]/10 cursor-pointer active:scale-95 transition-all bg-[#fd3b6a]/5 select-none relative shrink-0"
          title="Открыть эквалайзер и ламповый усилитель"
        >
          <Sliders className="w-3.5 h-3.5 animate-pulse text-[#fd3b6a]" />
          <span className="font-sans font-bold tracking-tight hidden sm:inline">HI-FI BOOST</span>
          <span className="font-sans font-bold tracking-tight sm:hidden text-[9px]">BOOST</span>
        </button>
      </div>

      <AudioEnhancerPanel 
        isOpen={isEnhancerOpen}
        onClose={() => setIsEnhancerOpen(false)}
        isPlaying={isPlaying}
        volume={volume}
        setVolume={setVolume}
        isEnhanced={isEnhanced}
        setIsEnhanced={setIsEnhanced}
        forceBackgroundPlayback={forceBackgroundPlayback}
        setForceBackgroundPlayback={handleToggleBackgroundPlayback}
      />
    </div>
  );
}

