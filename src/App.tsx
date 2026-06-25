/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Home, Search, Sparkles, Heart, Plus, Compass, Play, Pause, SkipForward, SkipBack, Music, Lock, Unlock } from "lucide-react";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import PlayerBar from "./components/PlayerBar";
import { Song, Playlist } from "./types";

// Default starting songs to populate mock Liked Tracks and starter library immediately
const STARTER_SONGS: Song[] = [
  {
    id: "6l4sN3n9E9M",
    title: "Asphalt 8",
    artist: "MACAN",
    duration: "2:54",
    thumbnail: "/api/music/thumbnail?v=6l4sN3n9E9M&title=Asphalt%208&artist=MACAN"
  },
  {
    id: "_lY70k0O_rY",
    title: "Спой",
    artist: "MACAN feat. A.V.G",
    duration: "3:01",
    thumbnail: "/api/music/thumbnail?v=_lY70k0O_rY&title=%D0%A1%D0%BF%D0%BE%D0%B9&artist=MACAN%20feat.%20A.V.G"
  },
  {
    id: "g75Iis110eI",
    title: "Giri",
    artist: "MACAN",
    duration: "2:51",
    thumbnail: "/api/music/thumbnail?v=g75Iis110eI&title=Giri&artist=MACAN"
  }
];

export default function App() {
  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<string>("home");

  // Playlists store (loaded from localStorage for durable user persistence)
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Playback States
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [isLooped, setIsLooped] = useState<boolean>(false);
  const [isHifiBoosted, setIsHifiBoosted] = useState<boolean>(true);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(0);

  const [isPocketLocked, setIsPocketLocked] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number>(0);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");

  // Live timer hook for lockscreen
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTimeStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Global listener for triple-tap pocket protection
  useEffect(() => {
    let tapCount = 0;
    let lastTapTime = 0;
    const clickThreshold = 400; // milliseconds between taps

    const handleGlobalClick = (e: any) => {
      const now = Date.now();
      if (now - lastTapTime < clickThreshold) {
        tapCount += 1;
      } else {
        tapCount = 1;
      }
      lastTapTime = now;

      if (tapCount === 3) {
        tapCount = 0;
        setIsPocketLocked((prev) => {
          const next = !prev;
          // Toggle full screen to guard system bars
          try {
            if (next) {
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else if ((document.documentElement as any).webkitRequestFullscreen) {
                (document.documentElement as any).webkitRequestFullscreen();
              }
            } else {
              if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
              } else if ((document as any).webkitExitFullscreen) {
                (document as any).webkitExitFullscreen();
              }
            }
          } catch (err) {}
          return next;
        });
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch (err) {}
        }
      }
    };

    window.addEventListener("pointerdown", handleGlobalClick, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", handleGlobalClick, { capture: true });
    };
  }, []);

  // Block back-button/swipe-back gestures when pocket-locked
  useEffect(() => {
    if (isPocketLocked) {
      window.history.pushState({ pocketLocked: true }, "");
      const handlePopState = (e: PopStateEvent) => {
        // Simple prevention: push state again to consume the back gesture
        window.history.pushState({ pocketLocked: true }, "");
      };
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }
  }, [isPocketLocked]);

  // Load playlists from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("spotify_clone_playlists");
    if (stored) {
      try {
        setPlaylists(JSON.parse(stored));
      } catch (e) {
        initializeDefaultPlaylists();
      }
    } else {
      initializeDefaultPlaylists();
    }
  }, []);

  // Save to localStorage whenever playlists array is updated
  const savePlaylists = (updated: Playlist[]) => {
    setPlaylists(updated);
    localStorage.setItem("spotify_clone_playlists", JSON.stringify(updated));
  };

  const initializeDefaultPlaylists = () => {
    const defaults: Playlist[] = [
      {
        id: "liked-songs",
        name: "Любимые треки",
        description: "Ваши любимые песни, собранные в одном месте.",
        coverUrl: "https://images.unsplash.com/photo-1513829096999-4978602297a7?w=100&q=80",
        songs: STARTER_SONGS,
        isCustom: false
      },
      {
        id: "chill-vibes",
        name: "Вайб Дороги",
        description: "Лучшая музыка для поездок на машине от Макана и других.",
        coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80",
        songs: STARTER_SONGS,
        isCustom: true
      }
    ];
    savePlaylists(defaults);
  };

  // Helper selectors
  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;
  const likedSongsPlaylist = playlists.find((p) => p.id === "liked-songs");
  const likedSongsIds = new Set<string>(likedSongsPlaylist?.songs.map((s) => s.id) || []);

  const handleSelectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylistId(playlist.id);
  };

  // Play a song in a selected context queue
  const handlePlaySong = (song: Song, contextSongs: Song[]) => {
    setCurrentSong(song);
    
    // Set custom queue
    setPlaybackQueue(contextSongs);
    const idx = contextSongs.findIndex((s) => s.id === song.id);
    setQueueIndex(idx >= 0 ? idx : 0);
    
    setIsPlaying(true);
  };

  // Skip Forward/Next
  const handleNext = () => {
    if (playbackQueue.length === 0) return;

    if (isShuffled) {
      const randomIdx = Math.floor(Math.random() * playbackQueue.length);
      setQueueIndex(randomIdx);
      setCurrentSong(playbackQueue[randomIdx]);
    } else {
      const nextIdx = (queueIndex + 1) % playbackQueue.length;
      setQueueIndex(nextIdx);
      setCurrentSong(playbackQueue[nextIdx]);
    }
    setIsPlaying(true);
  };

  // Skip Backward/Previous
  const handlePrevious = () => {
    if (playbackQueue.length === 0) return;

    if (isShuffled) {
      const randomIdx = Math.floor(Math.random() * playbackQueue.length);
      setQueueIndex(randomIdx);
      setCurrentSong(playbackQueue[randomIdx]);
    } else {
      const prevIdx = queueIndex === 0 ? playbackQueue.length - 1 : queueIndex - 1;
      setQueueIndex(prevIdx);
      setCurrentSong(playbackQueue[prevIdx]);
    }
    setIsPlaying(true);
  };

  // Toggles the Liked state of a song
  const handleToggleLike = (song: Song) => {
    const likedPlaylist = playlists.find((p) => p.id === "liked-songs");
    if (!likedPlaylist) return;

    const exists = likedPlaylist.songs.some((s) => s.id === song.id);
    let updatedSongs: Song[];

    if (exists) {
      updatedSongs = likedPlaylist.songs.filter((s) => s.id !== song.id);
    } else {
      updatedSongs = [...likedPlaylist.songs, song];
    }

    const updatedPlaylists = playlists.map((p) => {
      if (p.id === "liked-songs") {
        return { ...p, songs: updatedSongs };
      }
      return p;
    });

    savePlaylists(updatedPlaylists);
  };

  // Add search/recommended song to custom playlist
  const handleAddSongToPlaylist = (playlistId: string, song: Song) => {
    const updatedPlaylists = playlists.map((p) => {
      if (p.id === playlistId) {
        const contains = p.songs.some((s) => s.id === song.id);
        if (!contains) {
          return { ...p, songs: [...p.songs, song] };
        }
      }
      return p;
    });
    savePlaylists(updatedPlaylists);
  };

  // Remove track from custom playlist
  const handleRemoveSongFromPlaylist = (playlistId: string, songId: string) => {
    const updatedPlaylists = playlists.map((p) => {
      if (p.id === playlistId) {
        return { ...p, songs: p.songs.filter((s) => s.id !== songId) };
      }
      return p;
    });
    savePlaylists(updatedPlaylists);
  };

  // Manual creation of playlist
  const handleNewPlaylist = () => {
    const name = prompt("Введите имя нового плейлиста:", `Плейлист #${playlists.length}`);
    if (!name || !name.trim()) return;

    const newPl: Playlist = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: "Созданный пользователем плейлист музыки.",
      coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80",
      songs: [],
      isCustom: true
    };

    savePlaylists([...playlists, newPl]);
  };

  // Save DJ Generated recommendations as full playable playlists
  const handleSaveDJPlaylist = (name: string, description: string, songs: Song[]) => {
    const newPl: Playlist = {
      id: `ai-dj-${Date.now()}`,
      name,
      description,
      coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
      songs,
      isCustom: true
    };

    savePlaylists([...playlists, newPl]);
    setSelectedPlaylistId(newPl.id);
    setCurrentTab("playlist");
  };

  return (
    <div className="flex flex-col h-screen w-screen radio-ava-bg radio-ava-wave-lines font-sans text-white overflow-hidden relative">
      
      {/* Dynamic Ambient Blur Orb Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#fd3b6a]/15 rounded-full filter blur-[120px] pointer-events-none select-none z-0 animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#fe6846]/10 rounded-full filter blur-[120px] pointer-events-none select-none z-0 animate-pulse" style={{ animationDuration: '12s' }}></div>

      {/* Main Structural Body */}
      <div className="flex flex-1 overflow-hidden z-10 w-full mb-16 md:mb-0">
        {/* Left Sidebar Frame (Hidden on Mobile) */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            if (tab === "search") setCurrentTab("catalog");
            else setCurrentTab(tab);
          }}
          playlists={playlists}
          onSelectPlaylist={handleSelectPlaylist}
          selectedPlaylistId={selectedPlaylistId}
          onNewPlaylist={handleNewPlaylist}
        />

        {/* Central Content Panel */}
        <main className="flex-1 overflow-hidden h-full">
          <MainContent
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            playlists={playlists}
            selectedPlaylist={activePlaylist}
            onSelectPlaylist={handleSelectPlaylist}
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlaySong={handlePlaySong}
            onTogglePlayPause={() => setIsPlaying(!isPlaying)}
            onToggleLike={handleToggleLike}
            likedSongsIds={likedSongsIds}
            onAddSongToPlaylist={handleAddSongToPlaylist}
            onRemoveSongFromPlaylist={handleRemoveSongFromPlaylist}
            isHifiBoosted={isHifiBoosted}
            onToggleHifiBoost={() => setIsHifiBoosted(!isHifiBoosted)}
            onNewPlaylist={handleNewPlaylist}
          />
        </main>
      </div>

      {/* Persistent Continuous Playback Bottom Bar */}
      <PlayerBar
        currentSong={currentSong}
        isPlaying={isPlaying}
        onPlayPause={setIsPlaying}
        onNext={handleNext}
        onPrevious={handlePrevious}
        isLiked={currentSong ? likedSongsIds.has(currentSong.id) : false}
        onToggleLike={handleToggleLike}
        isShuffled={isShuffled}
        onToggleShuffle={() => setIsShuffled(!isShuffled)}
        isLooped={isLooped}
        onToggleLoop={() => setIsLooped(!isLooped)}
        isEnhanced={isHifiBoosted}
        setIsEnhanced={setIsHifiBoosted}
      />

      {/* MOBILE BOTTOM NAVIGATION BAR: Premium floating glass tab dock with an elevated pink orb */}
      <nav 
        id="mobile-bottom-nav" 
        className="fixed bottom-3 left-4 right-4 h-16 bg-[#121420]/90 border border-white/5 flex items-center justify-between z-50 md:hidden rounded-[1.5rem] shadow-[0_16px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl px-3"
      >
        <button
          onClick={() => {
            setCurrentTab("home");
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try { navigator.vibrate(10); } catch (err) {}
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            currentTab === "home" ? "text-[#fd3b6a] scale-110" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Home className="w-5.5 h-5.5" />
          <span className="text-[9px] mt-0.5 font-medium">Главная</span>
        </button>

        <button
          onClick={() => {
            setCurrentTab("search");
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try { navigator.vibrate(10); } catch (err) {}
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            currentTab === "search" || currentTab === "catalog" ? "text-[#fd3b6a] scale-110" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Search className="w-5.5 h-5.5" />
          <span className="text-[9px] mt-0.5 font-medium">Поиск</span>
        </button>

        {/* ELEVATED PINK BRAND ORB: Interactive play/pause shortcut & pocket safe entry */}
        <div className="relative -top-4 px-1 shrink-0">
          <button
            onClick={() => {
              if (currentSong) {
                setIsPlaying(!isPlaying);
              } else {
                // Play random popular track
                setCurrentTab("home");
              }
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try { navigator.vibrate([20, 15, 20]); } catch (err) {}
              }
            }}
            className={`w-15 h-15 rounded-full bg-gradient-to-tr from-[#fd3b6a] to-[#fe6846] flex items-center justify-center shadow-[0_6px_20px_rgba(253,59,106,0.4)] border-2 border-[#121420] active:scale-90 transition-all text-white ${
              isPlaying && currentSong ? "animate-pulse" : ""
            }`}
            title="Воспроизвести / Пауза"
          >
            <svg viewBox="0 0 100 100" className={`w-8 h-8 text-white fill-current ${isPlaying && currentSong ? "animate-[spin_10s_linear_infinite]" : ""}`}>
              <path d="M50,15 A25,25 0 0,0 25,40 L25,55 A5,5 0 0,0 30,60 L35,60 A5,5 0 0,0 40,55 L40,45 A5,5 0 0,0 35,40 L30,40 A20,20 0 0,1 50,20 A20,20 0 0,1 70,40 L65,40 A5,5 0 0,0 60,45 L60,55 A5,5 0 0,0 65,60 L70,60 A5,5 0 0,0 75,55 L75,40 A25,25 0 0,0 50,15 Z" />
              <polygon points="32,28 18,16 28,32" />
              <polygon points="68,28 82,16 72,32" />
              <circle cx="50" cy="50" r="10" className="opacity-35" />
              <path d="M44,49 Q50,53 56,49" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => {
            setCurrentTab("playlist");
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try { navigator.vibrate(10); } catch (err) {}
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            currentTab === "playlist" ? "text-[#fd3b6a] scale-110" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Compass className="w-5.5 h-5.5" />
          <span className="text-[9px] mt-0.5 font-medium">Обзор</span>
        </button>

        <button
          onClick={() => {
            setCurrentTab("my");
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try { navigator.vibrate(10); } catch (err) {}
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            currentTab === "my" ? "text-[#fd3b6a] scale-110" : "text-zinc-400 hover:text-white"
          }`}
        >
          <div className="relative">
            <Heart className={`w-5.5 h-5.5 ${currentTab === "my" ? "fill-current" : ""}`} />
            <span className="absolute -top-1.5 -right-1.5 bg-[#fd3b6a] text-white font-mono text-[8px] font-black h-3.5 px-1 rounded-full flex items-center justify-center border border-zinc-950">
              {likedSongsIds.size || "0"}
            </span>
          </div>
          <span className="text-[9px] mt-0.5 font-medium">Моё</span>
        </button>
      </nav>

      {/* Pocket lock overlay screen */}
      {isPocketLocked && (
        <div 
          className="fixed inset-0 bg-[#060608]/98 backdrop-blur-2xl z-[99999] flex flex-col items-center justify-between select-none text-center p-6 pb-12 transition-all duration-300 pointer-events-auto text-white overflow-hidden"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => setTouchStartX(e.clientX)}
          onPointerUp={(e) => {
            const diff = e.clientX - touchStartX;
            if (Math.abs(diff) > 55) {
              if (diff < 0) {
                handleNext();
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                  try { navigator.vibrate(60); } catch (err) {}
                }
              } else {
                handlePrevious();
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                  try { navigator.vibrate(60); } catch (err) {}
                }
              }
            }
          }}
        >
          {/* Custom style injection for premium animations */}
          <style>{`
            @keyframes bounce-equalizer {
              0% { height: 8px; }
              100% { height: 52px; }
            }
            @keyframes disk-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes ring-glow-pulse {
              0%, 100% { filter: drop-shadow(0 0 4px rgba(239,68,68,0.25)); opacity: 0.85; }
              50% { filter: drop-shadow(0 0 16px rgba(239,68,68,0.65)); opacity: 1; }
            }
          `}</style>

          {/* LOCKSCREEN HEADER TIME & STATUS */}
          <div className="w-full max-w-sm flex items-center justify-between border-b border-zinc-900/60 pb-3 mt-4">
            <span className="text-zinc-550 font-mono text-[10px] tracking-widest flex items-center gap-1.5 uppercase font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              POCKET ACTIVE
            </span>
            {currentTimeStr && (
              <span className="text-white font-mono text-base font-black tracking-wider bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-850">
                {currentTimeStr}
              </span>
            )}
            <div className="text-zinc-550 font-mono text-[10px] tracking-wider font-bold uppercase flex items-center gap-1">
              <span>СИСТЕМА: СЕЙФ</span>
            </div>
          </div>

          {/* MAIN VISUALIZER WORK OF ART */}
          <div className="flex-1 flex flex-col items-center justify-center py-6 w-full max-w-sm">
            
            {/* Pulsing Outer Lock Icon Container */}
            <div className="mb-4 flex items-center gap-1.5 justify-center">
              <div className="inline-flex items-center gap-1.5 py-1 px-3.5 rounded-full bg-red-500/10 border border-red-500/20 text-[9px] font-mono tracking-widest text-red-500 font-bold uppercase">
                <Lock className="w-3 h-3 text-red-500 stroke-[2.5]" />
                <span>ЭКРАН ЗАБЛОКИРОВАН</span>
              </div>
            </div>

            {/* ARTWORK SPINNING DISK PLATTER WITH AURAS */}
            {currentSong ? (
              <div className="relative my-4 flex items-center justify-center">
                {/* Neon outer glowing ring */}
                <div 
                  className="absolute w-56 h-56 rounded-full border border-red-500/15"
                  style={{ animation: 'ring-glow-pulse 3s ease-in-out infinite' }}
                ></div>
                <div className="absolute w-44 h-44 rounded-full border border-zinc-800/40"></div>
                
                {/* Rotational Disk Platter Wrap */}
                <div 
                  className="w-40 h-40 rounded-full relative p-1.5 bg-neutral-900 border-4 border-zinc-850 shadow-2xl shadow-black/80 flex items-center justify-center overflow-hidden shrink-0"
                  style={{
                    animation: isPlaying ? 'disk-spin 12s linear infinite' : 'none'
                  }}
                >
                  {/* Vinyl Grooves pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_rgba(0,0,0,0.85)_100%)] opacity-90 z-10 pointer-events-none"></div>
                  <div className="absolute inset-0 border border-white/5 rounded-full z-10 pointer-events-none"></div>
                  
                  {/* Song thumbnail center image */}
                  <img 
                    src={currentSong.thumbnail} 
                    className="w-full h-full object-cover rounded-full" 
                    alt="" 
                    referrerPolicy="no-referrer" 
                  />
                  
                  {/* Spindle head center point */}
                  <div className="absolute w-9 h-9 bg-zinc-950 border-4 border-zinc-900 rounded-full z-25 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-40 h-40 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center">
                <Music className="w-12 h-12 text-zinc-700 animate-pulse" />
              </div>
            )}

            {/* TRACK DETAILS WITH NEON ACCENTS */}
            {currentSong && (
              <div className="mt-4 text-center max-w-xs leading-tight">
                <p className="text-base font-black text-white truncate max-w-xs filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-2">
                  {currentSong.title}
                </p>
                <p className="text-xs font-semibold text-zinc-450 truncate mt-1 tracking-wide uppercase px-2">
                  {currentSong.artist}
                </p>
              </div>
            )}

            {/* REALTIME SOUNDBARS EQUALIZER SIMULATOR */}
            <div className="flex items-end justify-center gap-[4px] h-[58px] mt-6 select-none pointer-events-none">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[3px] bg-gradient-to-t from-red-600 via-amber-500 to-amber-300 rounded-full opacity-80"
                  style={{
                    height: isPlaying ? '100%' : '8px',
                    animation: isPlaying ? `bounce-equalizer ${0.4 + Math.random() * 0.8}s ease-in-out infinite alternate` : 'none',
                    animationDelay: `${i * 0.04}s`
                  }}
                />
              ))}
            </div>

            {/* SWIPE NAVIGATION LABELS CHUTE */}
            <div className="text-[10px] text-zinc-500 font-mono tracking-widest mt-6 uppercase font-bold flex items-center gap-2">
              <span>← КЛИКНИТЕ ИЛИ ПРОВЕДИТЕ ДЛЯ СКИПА →</span>
            </div>

            {/* SCREEN-SAFE INTERACTIVE MEDIA PLAYER CONTROLS */}
            <div className="flex items-center justify-center gap-8 mt-5 z-50 pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    try { navigator.vibrate(40); } catch (err) {}
                  }
                }}
                className="w-13 h-13 rounded-full bg-zinc-950/85 hover:bg-zinc-900 border border-zinc-850/60 active:scale-90 transition-all flex items-center justify-center text-zinc-300 hover:text-white"
                title="Предыдущий трек"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying(!isPlaying);
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    try { navigator.vibrate([30, 20, 30]); } catch (err) {}
                  }
                }}
                className="w-18 h-18 rounded-full bg-red-650 hover:bg-red-550 border border-red-500/45 shadow-xl shadow-red-950/40 text-white active:scale-95 transition-all flex items-center justify-center"
                title="Воспроизведение / Пауза"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current pl-1" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                    try { navigator.vibrate(40); } catch (err) {}
                  }
                }}
                className="w-13 h-13 rounded-full bg-zinc-950/85 hover:bg-zinc-900 border border-zinc-850/60 active:scale-90 transition-all flex items-center justify-center text-zinc-300 hover:text-white"
                title="Следующий трек"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
            </div>
          </div>

          {/* BOTTOM INTERACTIVE EXIT ACTION DRAWER */}
          <div className="w-full max-w-sm flex flex-col items-center gap-3">
            <div className="py-3 px-5 bg-zinc-950/90 border border-red-500/25 text-red-400 rounded-2xl text-[11px] font-black tracking-wide shadow-lg shadow-red-950/30 animate-pulse inline-flex items-center gap-2">
              <Unlock className="w-3.5 h-3.5 text-red-500 animate-bounce" />
              <span>БЫСТРО нажмите 3 раза в любом месте для РАЗБЛОКИРОВКИ</span>
            </div>
            
            <p className="text-zinc-550 text-[10px] leading-normal font-sans max-w-xs">
              Все случайные нажатия телефона в кармане заблокированы. Музыка продолжает беспрерывно играть в фоне.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
