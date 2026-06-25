/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Search, Play, Pause, Heart, Clock, Music, ChevronRight, PlusCircle, CheckCircle, Trash2, ListPlus, Sliders, Radio, Sparkles as SparkleIcon, Music2, Compass, Download, Mic, Bell, BookOpen, Smile, Plus } from "lucide-react";
import { Song, Playlist } from "../types";
import RealtimeVisualizer from "./RealtimeVisualizer";
import SoundscapeMixer from "./SoundscapeMixer";

interface MainContentProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  playlists: Playlist[];
  selectedPlaylist: Playlist | null;
  onSelectPlaylist: (playlist: Playlist) => void;
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (song: Song, contextSongs: Song[]) => void;
  onTogglePlayPause: () => void;
  onToggleLike: (song: Song) => void;
  likedSongsIds: Set<string>;
  onAddSongToPlaylist: (playlistId: string, song: Song) => void;
  onRemoveSongFromPlaylist: (playlistId: string, songId: string) => void;
  isHifiBoosted: boolean;
  onToggleHifiBoost: () => void;
  onNewPlaylist?: () => void;
}

// Curated top-trending tracks as starting points (with tested, high-quality YouTube IDs)
const TOP_TRENDING_TRACKS: Song[] = [
  {
    id: "6l4sN3n9E9M", // MACAN - Asphalt 8 (Official)
    title: "Asphalt 8",
    artist: "MACAN",
    duration: "2:54",
    thumbnail: "/api/music/thumbnail?v=6l4sN3n9E9M&title=Asphalt%208&artist=MACAN"
  },
  {
    id: "_lY70k0O_rY", // MACAN feat. A.V.G - Спой (Official Clip)
    title: "Спой",
    artist: "MACAN feat. A.V.G",
    duration: "3:01",
    thumbnail: "/api/music/thumbnail?v=_lY70k0O_rY&title=%D0%A1%D0%BF%D0%BE%D0%B9&artist=MACAN%20feat.%20A.V.G"
  },
  {
    id: "g75Iis110eI", // MACAN - Giri (Official Audio)
    title: "Giri",
    artist: "MACAN",
    duration: "2:51",
    thumbnail: "/api/music/thumbnail?v=g75Iis110eI&title=Giri&artist=MACAN"
  },
  {
    id: "17Msc8c_v-4", // Miyagi & Эндшпиль — I Got Love (Lyric Video)
    title: "I Got Love",
    artist: "Miyagi & Эндшпиль feat. Рем Дигга",
    duration: "4:36",
    thumbnail: "/api/music/thumbnail?v=17Msc8c_v-4&title=I%20Got%20Love&artist=Miyagi%20%26%20%D0%AD%D0%BD%D0%B4%D1%88%D0%BF%D0%B8%D0%BB%D1%8C"
  },
  {
    id: "vL7I5g0rVvI", // Miyagi & Эндшпиль - Там ревели горы (Official)
    title: "Там ревели горы",
    artist: "Miyagi & Эндшпиль",
    duration: "3:10",
    thumbnail: "/api/music/thumbnail?v=vL7I5g0rVvI&title=%D0%A2%D0%B0%D0%BC%20%D1%80%D0%B5%D0%B2%D0%B5%D0%BB%D0%B8%20%D0%B3%D0%BE%D1%80%D1%8B&artist=Miyagi%20%26%20%D0%AD%D0%BD%D0%B4%D1%88%D0%BF%D0%B8%D0%BB%D1%8C"
  },
  {
    id: "t_4Xv_Xw-E4", // JONY - Комета (Official)
    title: "Комета",
    artist: "JONY",
    duration: "2:58",
    thumbnail: "/api/music/thumbnail?v=t_4Xv_Xw-E4&title=%D0%9A%D0%BE%D0%BC%D0%B5%D1%82%D0%B0&artist=JONY"
  },
  {
    id: "jInxNf7fH_0", // Xcho - Вороны (Official)
    title: "Вороны",
    artist: "Xcho",
    duration: "3:11",
    thumbnail: "/api/music/thumbnail?v=jInxNf7fH_0&title=%D0%92%D0%BE%D1%80%D0%BE%D0%BD%D1%8B&artist=Xcho"
  },
  {
    id: "4vYy70Ivk8g", // INSTASAMKA - За деньги да (Official Video)
    title: "За деньги да",
    artist: "INSTASAMKA",
    duration: "2:02",
    thumbnail: "/api/music/thumbnail?v=4vYy70Ivk8g&title=%D0%97%D0%B0%20%D0%B4%D0%B5%D0%BD%D1%8C%D0%B3%D0%B8%20%D0%B4%D0%B0&artist=INSTASAMKA"
  }
];

export default function MainContent({
  currentTab,
  setCurrentTab,
  playlists,
  selectedPlaylist,
  onSelectPlaylist,
  currentSong,
  isPlaying,
  onPlaySong,
  onTogglePlayPause,
  onToggleLike,
  likedSongsIds,
  onAddSongToPlaylist,
  onRemoveSongFromPlaylist,
  isHifiBoosted,
  onToggleHifiBoost,
  onNewPlaylist,
}: MainContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("Привет!");
  const [activeCatalogPill, setActiveCatalogPill] = useState("Музыка");
  const [activeFlowFilter, setActiveFlowFilter] = useState("ЖАНРЫ");
  
  // Voice input and search suggestion states
  const [isListening, setIsListening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Genre and Situation interactive streaming states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryTracks, setCategoryTracks] = useState<Song[]>([]);
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);

  const selectCategoryAndFetch = async (catName: string, query: string) => {
    setSelectedCategory(catName);
    setIsLoadingCategory(true);
    setCategoryTracks([]); // reset list
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setCategoryTracks(data || []);
      // Automatically play the first song in the category to delight the user instantly!
      if (data && data.length > 0) {
        onPlaySong(data[0], data);
      }
    } catch (err) {
      console.error("[Category Fetch] Failed:", err);
      setCategoryTracks([]);
    } finally {
      setIsLoadingCategory(false);
    }
  };

  // Curated hint predictions for smart suggestions
  const getSuggestions = () => {
    if (!searchQuery.trim()) return [];
    const curatedHints = [
      { text: "MACAN - Asphalt 8", type: "track" },
      { text: "MACAN feat. A.V.G - Спой", type: "track" },
      { text: "MACAN - Giri", type: "track" },
      { text: "Miyagi & Эндшпиль - I Got Love", type: "track" },
      { text: "Miyagi & Эндшпиль - Там ревели горы", type: "track" },
      { text: "JONY - Комета", type: "track" },
      { text: "Xcho - Вороны", type: "track" },
      { text: "INSTASAMKA - За деньги да", type: "track" },
      { text: "MACAN (Исполнитель)", type: "artist", query: "MACAN" },
      { text: "Miyagi & Эндшпиль (Исполнители)", type: "artist", query: "Miyagi & Эндшпиль" },
      { text: "JONY (Исполнитель)", type: "artist", query: "JONY" },
      { text: "Xcho (Исполнитель)", type: "artist", query: "Xcho" }
    ];
    const queryLower = searchQuery.toLowerCase();
    return curatedHints.filter(hint => hint.text.toLowerCase().includes(queryLower)).slice(0, 4);
  };

  // Voice Search triggers
  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Голосовой поиск не поддерживается в вашем браузере. Пожалуйста, попробуйте Google Chrome или другой совместимый браузер.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setSearchQuery(text);
          setShowSuggestions(true);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn("Speech error starting recognition:", err);
      setIsListening(false);
    }
  };

  // Compute greeting hour
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) {
      setGreeting("Доброй ночи");
    } else if (hour < 12) {
      setGreeting("Доброе утро");
    } else if (hour < 18) {
      setGreeting("Добрый день");
    } else {
      setGreeting("Добрый вечер");
    }
  }, []);

  // INSTANT AUTOCOMPLETE DEBUNCED SEARCH EFFECT:
  // Detects input changing in real-time, queries after 250ms, merges with offline trend results
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) throw new Error();
        const data: Song[] = await res.json();
        
        // Find fast local trend matches to instantly prioritize
        const localMatches = TOP_TRENDING_TRACKS.filter(s => 
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.artist.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Merge and deduplicate
        const uniqueResults = [...localMatches];
        data.forEach((item) => {
          if (!uniqueResults.some(r => r.id === item.id)) {
            uniqueResults.push(item);
          }
        });

        setSearchResults(uniqueResults);
      } catch (err) {
        console.warn("Autocomplete scan error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle manual / backup search submission
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error();
      const data: Song[] = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPrecuratedPlaylist = (index: number) => {
    // Generate precurated playlist contexts
    let name = "Вайб Скорости";
    let desc = "Мощный русский рэп и скоростная лирика в лучших традициях Макана.";
    let cover = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80";
    let filterSongs = TOP_TRENDING_TRACKS.filter(s => s.artist.includes("MACAN"));

    if (index === 1) {
      name = "Легендарные Сказания Miyagi";
      desc = "Качающие кавказские ритмы, глубочайшие соуловые текста и невероятный вайб.";
      cover = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80";
      filterSongs = TOP_TRENDING_TRACKS.filter(s => s.artist.includes("Miyagi"));
    } else if (index === 2) {
      name = "Современный Топ Чарт 2026";
      desc = "Громкие русские и западные поп-хиты, которые звучат из каждой машины.";
      cover = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80";
      filterSongs = TOP_TRENDING_TRACKS;
    }

    const playlistObj: Playlist = {
      id: `precurated-${index}`,
      name,
      description: desc,
      coverUrl: cover,
      songs: filterSongs
    };

    onSelectPlaylist(playlistObj);
    setCurrentTab("playlist");
  };

  return (
    <div id="main-content-flow" className="flex-1 overflow-y-auto pb-44 md:pb-32 p-4 md:p-6 bg-black text-white flex flex-col h-full custom-scrollbar select-none z-10 relative">
      
      {/* Top Preamp Status & Quick Boost Bar */}
      <div className="relative z-10 bg-[#09090b]/90 border border-zinc-800/60 p-3 md:p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 shadow-xl shadow-black/80">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-rose-500 to-purple-600 flex items-center justify-center border border-white/10 shadow">
            <Sliders className="text-white w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-mono text-xs font-black text-zinc-300 uppercase tracking-wider leading-none">Система Сверхвысокого Давления Класса А</h4>
              <span className={`h-2 w-2 rounded-full ${isHifiBoosted ? "bg-red-500 animate-ping" : "bg-zinc-650"}`}></span>
            </div>
            <p className="text-[10px] text-zinc-450 font-mono mt-1">
              {isHifiBoosted ? "HiFi Улучшитель Звука : +12dB Richness Boost" : "Стандартное качество без частотной коррекции"}
            </p>
          </div>
        </div>

        {/* Master Power Lever Button */}
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              try { navigator.vibrate([40, 20]); } catch (e) {}
            }
            onToggleHifiBoost();
          }}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl border font-sans font-black tracking-widest text-xs uppercase shadow-lg active:scale-98 transition-all relative select-none shrink-0 cursor-pointer ${
            isHifiBoosted
              ? "bg-[#18181b] border-purple-550 text-red-500 font-bold animate-pulse"
              : "bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-purple-400"
          }`}
        >
          <span>{isHifiBoosted ? "АКТИВНО 🔥" : "УЛУЧШИТЬ ЗВУК ⚡"}</span>
        </button>
      </div>

      {/* HOME VIEW */}
      {currentTab === "home" && (
        <div id="view-home" className="space-y-6 animate-fadeIn">
          
          {/* Pocket lock informational panel */}
          <div className="relative z-10 bg-gradient-to-r from-red-950/20 to-[#12070a]/80 border border-red-900/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-black/40">
            <div className="flex items-start gap-3 w-full">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 font-mono">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5.5 h-5.5 text-red-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
                  <path d="M12 15v3" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
              <div className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-sans text-xs font-black text-red-400 uppercase tracking-wider leading-none">Режим прослушивания в кармане (Блокировка экрана)</h4>
                  <span className="bg-red-500/20 text-red-450 font-mono text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse">ЭКСКЛЮЗИВ</span>
                </div>
                <p className="text-[11px] text-zinc-350 mt-1.5 leading-relaxed">
                  Хотите убрать устройство в карман? Быстро нажмите <span className="text-red-500 font-extrabold pr-0.5 pl-0.5">3 РАЗА в любом месте</span> приложения. 
                  Это переведет плеер в <span className="text-white font-bold">интеллектуальный полноэкранный режим (Fullscreen)</span>, который временно скроет системную панель Назад/Домой и отключит случайные жесты вашего телефона в кармане. Повторные 3 нажатия вернут все назад!
                </p>
              </div>
            </div>
          </div>
          
          {/* Screenshot 3: Atmospheric Flow Backdrop "Ваша персональная Сила Звука" */}
          <div className="relative p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[#0c3a20]/90 via-[#04140a] to-[#010103] border border-emerald-950/30 overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-555/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 left-10 w-64 h-64 bg-purple-550/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4">
                <span className="bg-emerald-550/15 text-emerald-400 font-extrabold uppercase px-2.5 py-1 rounded-full text-[10px] border border-emerald-500/20 tracking-widest font-mono">
                  ПРЕМИУМ ЗВУК БЕЗ ПОДПИСКИ
                </span>

                <h2 className="text-3xl md:text-4xl font-sans font-black tracking-tight leading-none text-white max-w-lg">
                  Любимая музыка <br />
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-lime-400 bg-clip-text text-transparent animate-pulse">100% Бесплатно</span>
                </h2>

                <p className="text-zinc-400 text-xs md:text-sm max-w-sm">
                  Слушайте треки в высоком качестве абсолютно бесплатно. Тысячи исполнителей и бесконечный поток музыки без ограничений.
                </p>

                {/* Sub-Filters: "ЖАНРЫ", "ДЛЯ ВАС", "СИТУАЦИИ" from Screenshot 3 */}
                <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 border-b border-zinc-900/65 pb-1 w-fit">
                  {["ЖАНРЫ", "ДЛЯ ВАС", "СИТУАЦИИ"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFlowFilter(filter)}
                      className={`pb-1.5 px-1 relative transition-colors ${
                        activeFlowFilter === filter ? "text-white font-bold" : "hover:text-zinc-300"
                      }`}
                    >
                      {filter}
                      {activeFlowFilter === filter && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full animate-pulse"></span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Secondary pills from Screenshot 3 */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <button 
                    onClick={() => { setSearchQuery("Весёлая популярная музыка"); setCurrentTab("catalog"); }}
                    className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 px-3.5 py-2 rounded-full border border-zinc-850/60 transition-all font-medium"
                  >
                    Весёлое • Популярное
                  </button>
                  <button 
                    onClick={() => { setSearchQuery("Популярная русская музыка"); setCurrentTab("catalog"); }}
                    className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 px-3.5 py-2 rounded-full border border-zinc-850/60 transition-all font-medium"
                  >
                    Популярное • Русское
                  </button>
                  <button 
                    onClick={() => { setSearchQuery("Лирика дорог"); setCurrentTab("catalog"); }}
                    className="bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 px-3.5 py-2 rounded-full border border-zinc-850/60 transition-all font-medium"
                  >
                    Вайб Машины
                  </button>
                </div>
              </div>

              {/* Action Buttons: Giant play button + Настроить from Screenshot 3 */}
              <div className="flex items-center gap-4 shrink-0">
                <button
                  onClick={() => {
                    const flowTrack = TOP_TRENDING_TRACKS[Math.floor(Math.random() * TOP_TRENDING_TRACKS.length)];
                    onPlaySong(flowTrack, TOP_TRENDING_TRACKS);
                  }}
                  className="bg-white hover:bg-zinc-100 text-black p-5 md:p-6 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
                  title="Играть Мою Волну"
                >
                  <Play className="w-8 h-8 fill-black stroke-[1.5] pl-1 text-black" />
                </button>

                <button 
                  onClick={() => setActiveFlowFilter("ЖАНРЫ")}
                  className="bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-805 px-5 h-12 rounded-full text-xs font-bold tracking-wider uppercase text-zinc-200 hover:text-white transition-all duration-200 cursor-pointer"
                >
                  Настроить
                </button>
              </div>
            </div>
          </div>
          {activeFlowFilter === "ДЛЯ ВАС" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Quick Choice Grid */}
              <div>
                <h3 className="text-sm font-mono font-bold text-zinc-400 tracking-wider uppercase mb-4 flex items-center gap-1.5">
                  <span>●</span> Рекомендуемые Альбомы & Сцены
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div 
                    onClick={() => selectPrecuratedPlaylist(0)}
                    className="flex items-center gap-4 bg-zinc-900/30 hover:bg-zinc-900/80 border border-zinc-850/60 rounded-xl overflow-hidden cursor-pointer hover:border-amber-500/20 transition-all group shadow shadow-black"
                  >
                    <div className="w-20 h-20 bg-zinc-800 shrink-0 relative overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80" alt="Vibe" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-sm font-bold truncate text-zinc-200 group-hover:text-amber-400 transition-colors">Вайб Скорости</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">Лирика дорог и MACAN</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 hidden group-hover:flex items-center justify-center text-zinc-950 shadow-md shrink-0 mr-4 active:scale-95 transition-all">
                      <Play className="w-4 h-4 fill-current ml-0.5 text-zinc-950" />
                    </div>
                  </div>

                  <div 
                    onClick={() => selectPrecuratedPlaylist(1)}
                    className="flex items-center gap-4 bg-zinc-900/30 hover:bg-zinc-900/80 border border-zinc-850/60 rounded-xl overflow-hidden cursor-pointer hover:border-amber-500/20 transition-all group shadow shadow-black"
                  >
                    <div className="w-20 h-20 bg-zinc-800 shrink-0 relative overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&q=80" alt="Vibe" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-sm font-bold truncate text-zinc-200 group-hover:text-amber-400 transition-colors">Мудрость Miyagi</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">Вайб Miyagi & Эндшпиль</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 hidden group-hover:flex items-center justify-center text-zinc-950 shadow-md shrink-0 mr-4 active:scale-95 transition-all">
                      <Play className="w-4 h-4 fill-current ml-0.5 text-zinc-950" />
                    </div>
                  </div>

                  <div 
                    onClick={() => selectPrecuratedPlaylist(2)}
                    className="flex items-center gap-4 bg-zinc-900/30 hover:bg-zinc-900/80 border border-zinc-850/60 rounded-xl overflow-hidden cursor-pointer hover:border-amber-500/20 transition-all group shadow shadow-black"
                  >
                    <div className="w-20 h-20 bg-zinc-800 shrink-0 relative overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80" alt="Vibe" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-sm font-bold truncate text-zinc-200 group-hover:text-amber-400 transition-colors">Топ Чарт 2026</p>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">Качающий звук улиц</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 hidden group-hover:flex items-center justify-center text-zinc-950 shadow-md shrink-0 mr-4 active:scale-95 transition-all">
                      <Play className="w-4 h-4 fill-current ml-0.5 text-zinc-950" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Atmospheric Soundscapes Procedural Synth Mixer */}
              <SoundscapeMixer />
            </div>
          )}

          {activeFlowFilter === "ЖАНРЫ" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-mono font-bold text-zinc-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                  <span>●</span> Выберите жанр
                </h3>
                <p className="text-xs text-zinc-500 mb-4 font-normal">Нажмите на любой жанр, чтобы мгновенно сгенерировать и запустить персональный эфир.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                  {[
                    { name: "Рэп & Хип-Хоп", query: "MACAN Miyagi Xcho рэп", emoji: "🥑", color: "from-purple-950/40 to-[#0e0a16] hover:border-purple-500/30", iconColor: "text-purple-400" },
                    { name: "Поп & Лирика", query: "JONY ANNA ASTI поп лирика", emoji: "💗", color: "from-rose-950/40 to-[#160a0f] hover:border-rose-500/30", iconColor: "text-rose-400" },
                    { name: "Клубная & Электроника", query: "deep house club dance электроника", emoji: "⚡", color: "from-[#0a1622] to-[#010a12] hover:border-blue-500/30", iconColor: "text-blue-400" },
                    { name: "Кайфовый Вайб Дорог", query: "Macan Asphalt 8 Giri веселое", emoji: "🏁", color: "from-emerald-950/40 to-[#0a160f] hover:border-emerald-500/30", iconColor: "text-emerald-400" },
                    { name: "Атмосферный Рок", query: "КИШ рок панк король и шут альтернатива", emoji: "🎸", color: "from-[#22160a] to-[#120a01] hover:border-amber-500/30", iconColor: "text-amber-400" },
                    { name: "Релакс & Лоуфаи", query: "Lofi Study Relax спокойный чилаут", emoji: "🌌", color: "from-[#0a221f] to-[#011210] hover:border-teal-500/30", iconColor: "text-teal-400" }
                  ].map((cat, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectCategoryAndFetch(cat.name, cat.query)}
                      className={`p-4 bg-gradient-to-br ${cat.color} border border-zinc-850 rounded-2xl cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-md group relative overflow-hidden`}
                    >
                      <div className="absolute top-1/2 right-1/2 translate-x-2/3 translate-y-1/3 bg-white/5 w-24 h-24 rounded-full blur-xl group-hover:scale-125 transition-all"></div>
                      <div className="relative z-10 space-y-1.5 text-left">
                        <span className="text-3xl filter drop-shadow block mb-1">{cat.emoji}</span>
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">{cat.name}</h4>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block">Запустить поток ⚡</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Category Track Selection */}
              {(selectedCategory || isLoadingCategory) && (
                <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-4 bg-amber-500 rounded-full animate-pulse"></span>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                        Поток: {selectedCategory || "Подготовка..."}
                      </h4>
                    </div>
                    {isLoadingCategory ? (
                      <span className="text-[10px] font-mono text-zinc-500 animate-pulse">ПОДБИРАЕМ ТРЕКИ...</span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">{categoryTracks.length} треков в эфире</span>
                    )}
                  </div>

                  {isLoadingCategory ? (
                    <div className="py-8 text-center space-y-3">
                      <span className="animate-spin inline-block border-2 border-amber-500 border-t-transparent rounded-full w-8 h-8"></span>
                      <p className="text-xs text-zinc-400 font-mono">Анализируем эфир и загружаем аудиопоток...</p>
                    </div>
                  ) : categoryTracks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">Не удалось загрузить треки из потока. Попробуйте нажать на другой жанр.</div>
                  ) : (
                    <div className="space-y-1">
                      {categoryTracks.map((song, idx) => {
                        const isSelected = currentSong?.id === song.id;
                        const activeAndPlaying = isSelected && isPlaying;
                        return (
                          <div
                            key={`cat-song-${song.id}-${idx}`}
                            onClick={() => onPlaySong(song, categoryTracks)}
                            className={`flex items-center justify-between p-2 rounded-xl border border-transparent ${isSelected ? "bg-zinc-900/80 border-[#fd3b6a]/20" : "bg-zinc-950/30 hover:bg-zinc-900/60"} cursor-pointer group transition-all`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-5 text-center text-xs font-mono text-zinc-500 group-hover:text-[#fd3b6a] transition-colors">
                                {idx + 1}
                              </span>
                              <div className="w-9 h-9 rounded bg-zinc-800 overflow-hidden shrink-0 relative">
                                <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                  {activeAndPlaying ? <Pause className="w-4 h-4 fill-[#fd3b6a] text-[#fd3b6a]" /> : <Play className="w-4 h-4 fill-[#fd3b6a] text-[#fd3b6a]" />}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-bold truncate ${isSelected ? "text-[#fd3b6a]" : "text-zinc-200 font-medium"}`}>{song.title}</p>
                                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{song.artist}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {isSelected && <span className="text-[9px] font-mono text-[#fd3b6a] tracking-wider bg-[#fd3b6a]/10 px-1.5 py-0.5 rounded">В ЭФИРЕ</span>}
                              <span className="text-[10px] text-zinc-500 font-mono pr-2">{song.duration}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeFlowFilter === "СИТУАЦИИ" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-sm font-mono font-bold text-zinc-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
                  <span>●</span> Музыка под ситуацию
                </h3>
                <p className="text-xs text-zinc-500 mb-4 font-normal">Выберите моментальный сценарий, чтобы робот DJ собрал мгновенный музыкальный поток.</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {[
                    { name: "Спортивный кач", query: "активная тренировка спорт качалка жесткий фонк", emoji: "💪", color: "from-red-950/40 to-[#1c0707] hover:border-red-500/30", iconColor: "text-red-400" },
                    { name: "В дорогу за рулем", query: "музыка в машину дорога дорожный кайф лирика", emoji: "🚗", color: "from-cyan-950/40 to-[#07191c] hover:border-cyan-500/30", iconColor: "text-cyan-400" },
                    { name: "Учеба & Работа", query: "Lofi study work beats фоновая", emoji: "💻", color: "from-indigo-950/40 to-[#0c071c] hover:border-indigo-500/30", iconColor: "text-indigo-400" },
                    { name: "Вечерний Релакс", query: "спокойная акустическая лаундж чай релакс", emoji: "🍵", color: "from-orange-950/40 to-[#1c0f07] hover:border-orange-500/30", iconColor: "text-orange-450" },
                    { name: "Романтические Чувства", query: "любовь романтика грустные песни лирика", emoji: "❤️", color: "from-rose-950/40 to-[#1c070f] hover:border-rose-500/30", iconColor: "text-rose-400" },
                    { name: "Ночной драйв", query: "ночная дорога лирика грустный рэп", emoji: "🌌", color: "from-violet-950/40 to-[#13071c] hover:border-violet-500/30", iconColor: "text-violet-400" }
                  ].map((cat, idx) => (
                    <div
                      key={idx}
                      onClick={() => selectCategoryAndFetch(cat.name, cat.query)}
                      className={`p-4 bg-gradient-to-br ${cat.color} border border-zinc-850 rounded-2xl cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-md group relative overflow-hidden`}
                    >
                      <div className="absolute top-1/2 right-1/2 translate-x-2/3 translate-y-1/3 bg-white/5 w-24 h-24 rounded-full blur-xl group-hover:scale-125 transition-all"></div>
                      <div className="relative z-10 space-y-1.5 text-left">
                        <span className="text-3xl filter drop-shadow block mb-1">{cat.emoji}</span>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#fd3b6a] transition-colors">{cat.name}</h4>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest block">Запустить поток ⚡</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Category Track Selection */}
              {(selectedCategory || isLoadingCategory) && (
                <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-4 bg-[#fd3b6a] rounded-full animate-pulse"></span>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                        Сценарий: {selectedCategory || "Подготовка..."}
                      </h4>
                    </div>
                    {isLoadingCategory ? (
                      <span className="text-[10px] font-mono text-zinc-500 animate-pulse">ПОДБИРАЕМ ТРЕКИ...</span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">{categoryTracks.length} треков в эфире</span>
                    )}
                  </div>

                  {isLoadingCategory ? (
                    <div className="py-8 text-center space-y-3">
                      <span className="animate-spin inline-block border-2 border-[#fd3b6a] border-t-transparent rounded-full w-8 h-8"></span>
                      <p className="text-xs text-zinc-400 font-mono">Анализируем сцену и генерируем плейлист...</p>
                    </div>
                  ) : categoryTracks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">Не удалось загрузить треки из потока. Попробуйте нажать на другой сценарий.</div>
                  ) : (
                    <div className="space-y-1">
                      {categoryTracks.map((song, idx) => {
                        const isSelected = currentSong?.id === song.id;
                        const activeAndPlaying = isSelected && isPlaying;
                        return (
                          <div
                            key={`cat-song-${song.id}-${idx}`}
                            onClick={() => onPlaySong(song, categoryTracks)}
                            className={`flex items-center justify-between p-2 rounded-xl border border-transparent ${isSelected ? "bg-zinc-900/80 border-[#fd3b6a]/20" : "bg-zinc-950/30 hover:bg-zinc-900/60"} cursor-pointer group transition-all`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-5 text-center text-xs font-mono text-zinc-500 group-hover:text-[#fd3b6a] transition-colors">
                                {idx + 1}
                              </span>
                              <div className="w-9 h-9 rounded bg-zinc-800 overflow-hidden shrink-0 relative">
                                <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                  {activeAndPlaying ? <Pause className="w-4 h-4 fill-[#fd3b6a] text-[#fd3b6a]" /> : <Play className="w-4 h-4 fill-[#fd3b6a] text-[#fd3b6a]" />}
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-bold truncate ${isSelected ? "text-[#fd3b6a]" : "text-zinc-200 font-medium"}`}>{song.title}</p>
                                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{song.artist}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {isSelected && <span className="text-[9px] font-mono text-[#fd3b6a] tracking-wider bg-[#fd3b6a]/10 px-1.5 py-0.5 rounded">В ЭФИРЕ</span>}
                              <span className="text-[10px] text-zinc-500 font-mono pr-2">{song.duration}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CATALOG VIEW */}
      {currentTab === "catalog" && (
        <div id="view-catalog" className="space-y-6 animate-fadeIn pb-12">
          <div>
            <h2 className="text-2xl font-sans font-black tracking-tight mb-2 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-purple-500 rounded-full"></span>
              Каталог Музыки
            </h2>
            <p className="text-xs text-zinc-400">Находите горячий рэп, лирические треки, зарубежный поп и новые синглы Макана за секунды.</p>
          </div>

          {/* Search Box inside Catalog tab for easy access */}
          <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-2xl space-y-3 relative">
            <label className="text-xs font-bold text-purple-400 uppercase tracking-wider font-mono">Быстрый поиск</label>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 pointer-events-none" />
                <input
                  id="catalog-search-field"
                  type="text"
                  placeholder="Введите Macan, Asphalt 8, лирика или название..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-purple-500 focus:outline-none rounded-xl pl-12 pr-12 py-3 text-sm placeholder-zinc-500 transition-all text-white"
                />
                
                {/* Voice Input Button Inside Search Input */}
                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  title="Голосовой поиск"
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${isListening ? "bg-red-500 text-white animate-pulse" : "text-zinc-500 hover:text-purple-400 hover:bg-zinc-900"}`}
                >
                  <Mic className="w-4.5 h-4.5" />
                </button>
              </div>
              
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSuggestions(false);
                  }}
                  className="bg-zinc-850 hover:bg-zinc-805 text-xs text-zinc-350 px-4 rounded-xl transition-all"
                >
                  Очистить
                </button>
              )}
            </div>

            {/* FLOATING SUGGESTIONS DROPDOWN WITH INSTANT-PLAY */}
            {showSuggestions && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#0c0c12]/98 border border-zinc-800 rounded-2xl p-4 shadow-2xl max-h-[380px] overflow-y-auto backdrop-blur-xl animate-fadeIn space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900/40 text-[10px] font-mono font-bold text-zinc-400">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span> ПОДСКАЗКИ И БЫСТРЫЙ ЗАПУСК</span>
                  <button onClick={() => setShowSuggestions(false)} className="hover:text-purple-400 transition-colors uppercase text-[9px] font-bold">Закрыть ✕</button>
                </div>

                {getSuggestions().length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-purple-400/80 uppercase tracking-widest block font-mono">Уточнить поиск</span>
                    <div className="flex flex-wrap gap-1.5">
                      {getSuggestions().map((hint, idx) => (
                        <button
                          key={`hint-cat-${idx}`}
                          type="button"
                          onClick={() => {
                            const queryVal = hint.query || hint.text.replace(/ \(.*\)/, "");
                            setSearchQuery(queryVal);
                            setShowSuggestions(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-zinc-950 hover:bg-zinc-900 hover:text-white border border-zinc-855 hover:border-purple-500/30 text-zinc-300 rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <Search className="w-3 h-3 text-purple-450" />
                          <span>{hint.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-purple-400/80 uppercase tracking-widest block font-mono">Запустить трек кликом</span>
                  
                  {isSearching && searchResults.length === 0 ? (
                    <div className="text-center py-4 text-xs text-zinc-500 animate-pulse">Ищем трек...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.slice(0, 5).map((song) => {
                        const isSelected = currentSong?.id === song.id;
                        return (
                          <div
                            key={`suggest-raw-${song.id}`}
                            onClick={() => {
                              onPlaySong(song, searchResults);
                              setShowSuggestions(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-xl bg-zinc-955 hover:bg-zinc-900 border border-transparent hover:border-zinc-850 cursor-pointer group transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded bg-zinc-800 overflow-hidden relative shrink-0">
                                <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                  <Play className="w-4 h-4 fill-purple-500 text-purple-500" />
                                </div>
                              </div>
                              <div className="min-w-0 leading-tight">
                                <p className={`text-xs font-bold truncate ${isSelected ? "text-purple-400" : "text-zinc-100"}`}>{song.title}</p>
                                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{song.artist}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-500 shrink-0">
                              <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-purple-400 group-hover:border-purple-400 transition-all text-[8px]">ВКЛЮЧИТЬ ТРЕК</span>
                              <span>{song.duration}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-zinc-500">Ничего не найдено. Начните писать точное имя, например "Macan".</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Search Results in Catalog View */}
          {searchQuery.trim() ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">АВТОНАХОЖДЕНИЕ В РЕАЛЬНОМ ВРЕМЕНИ</span>
                {isSearching && <span className="text-[10px] text-purple-400 animate-pulse">поиск...</span>}
              </div>
              
              {searchResults.length > 0 ? (
                <div className="space-y-1 bg-[#09090c]/40 border border-zinc-900 rounded-2xl p-3.5 shadow-xl">
                  {searchResults.slice(0, 8).map((song, idx) => {
                    const isSelected = currentSong?.id === song.id;
                    const activeAndPlaying = isSelected && isPlaying;
                    return (
                      <div
                        key={`cat-search-${song.id}`}
                        onClick={() => {
                          if (isSelected) onTogglePlayPause();
                          else onPlaySong(song, searchResults);
                        }}
                        className={`flex items-center gap-3.5 p-2 hover:bg-zinc-900/60 rounded-xl transition-all cursor-pointer ${isSelected ? "bg-purple-500/10 border-l-2 border-purple-500 text-purple-400 pl-2" : ""}`}
                      >
                        <div className="w-5 text-center text-[10px] text-zinc-550 font-mono font-bold shrink-0">
                          {idx + 1}
                        </div>
                        <img src={song.thumbnail || undefined} className="w-10 h-10 rounded-md object-cover shrink-0" referrerPolicy="no-referrer" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-150 truncate">{song.title}</p>
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5">{song.artist}</p>
                        </div>
                        <div className="text-xs text-zinc-400 font-mono">{song.duration}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-zinc-505 shadow p-4 rounded-xl">
                  Пока ничего не найдено... Наберите точное или частичное название (например: "asphalt").
                </div>
              )}
            </div>
          ) : (
            /* Curated colorful Bento categories */
            <div className="space-y-4">
              <h3 className="text-xs font-mono font-bold text-zinc-550 uppercase tracking-widest">Категории и Жанры</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { name: "Новые Релизы", desc: "Хиты этой недели", color: "from-rose-600/20 to-red-900/30", border: "border-rose-500/20", iconColor: "text-rose-400" },
                  { name: "Рэп и Хип-хоп", desc: "MACAN, Баста, Miyagi", color: "from-purple-650/30 to-indigo-900/30", border: "border-purple-500/25", iconColor: "text-purple-400", artist: "MACAN" },
                  { name: "Глубокая Лирика", desc: "Грустные треки под вайб", color: "from-emerald-650/20 to-teal-900/30", border: "border-emerald-500/20", iconColor: "text-emerald-300", artist: "Спой" },
                  { name: "Топ Поп хиты", desc: "Популярные радио треки", color: "from-blue-655/20 to-sky-900/40", border: "border-blue-500/20", iconColor: "text-blue-400", artist: "За деньги да" },
                  { name: "Энергичный Спорт", desc: "Качает в наушниках", color: "from-[#fd3b6a]/20 to-orange-950/30", border: "border-[#fd3b6a]/20", iconColor: "text-[#fd3b6a]", artist: "Giri" },
                  { name: "Вечерний Фокус", desc: "Lofi и электронный лоуфай", color: "from-zinc-800 to-zinc-950", border: "border-zinc-800", iconColor: "text-zinc-400" }
                ].map((category, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      if (category.artist) {
                        setSearchQuery(category.artist);
                      } else {
                        // Play a random trending song
                        const trend = TOP_TRENDING_TRACKS[index % TOP_TRENDING_TRACKS.length];
                        onPlaySong(trend, TOP_TRENDING_TRACKS);
                      }
                    }}
                    className={`p-4 bg-gradient-to-br ${category.color} border ${category.border} rounded-2xl cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 transition-all shadow-md group relative overflow-hidden`}
                  >
                    <div className="absolute top-1/2 right-1/2 translate-x-2/3 translate-y-1/3 bg-white/5 w-24 h-24 rounded-full blur-xl group-hover:scale-125 transition-all"></div>
                    <div className="relative z-10 space-y-1.5 text-left">
                      <span className={`text-[10px] font-mono font-black uppercase ${category.iconColor}`}>0{index + 1}</span>
                      <h4 className="text-sm font-bold text-white group-hover:text-[#fd3b6a] transition-colors">{category.name}</h4>
                      <p className="text-[10px] text-zinc-400 leading-snug">{category.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MY / COLLECTION VIEW */}
      {currentTab === "my" && (
        <div id="view-my" className="space-y-6 animate-fadeIn pb-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-sans font-black tracking-tight mb-2 flex items-center gap-2">
                <span className="w-2.5 h-6 bg-rose-500 rounded-full"></span>
                Моя Коллекция
              </h2>
              <p className="text-xs text-zinc-400">Все плейлисты, любимые аудиозаписи и персонализированные компиляции.</p>
            </div>
            
            <button
              onClick={() => {
                if (onNewPlaylist) {
                  onNewPlaylist();
                }
              }}
              className="bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-xs text-zinc-200 hover:text-white py-2 px-3.5 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all text-[11px] font-mono tracking-wider uppercase font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4 text-rose-500" />
              <span>Создать список</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => {
              const count = playlist.songs.length;
              const isLiked = playlist.id === "liked-songs";
              return (
                <div
                  key={playlist.id}
                  onClick={() => {
                    onSelectPlaylist(playlist);
                    setCurrentTab("playlist");
                  }}
                  className="bg-zinc-900/30 hover:bg-zinc-900/80 border border-zinc-850 hover:border-rose-500/20 p-4 rounded-2xl flex gap-4 cursor-pointer transition-all items-center group relative overflow-hidden shadow shadow-black"
                >
                  <div className="w-16 h-16 rounded-xl bg-zinc-850 shrink-0 overflow-hidden relative shadow-md">
                    {isLiked ? (
                      <div className="w-full h-full bg-gradient-to-br from-rose-600 to-[#fe6846] flex items-center justify-center">
                        <Heart className="w-7 h-7 text-white fill-white" />
                      </div>
                    ) : (
                      <img src={playlist.coverUrl || undefined} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-rose-400 transition-colors leading-tight">{playlist.name}</h4>
                    <p className="text-[10px] text-zinc-405 truncate leading-none">{playlist.description}</p>
                    <span className="inline-block text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 bg-zinc-950/60 px-1.5 py-0.5 rounded-md mt-1 border border-zinc-900">
                      {count} треков
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SEARCH VIEW */}
      {currentTab === "search" && (
        <div id="view-search" className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-2xl font-sans font-black tracking-tight mb-2">Глобальный поиск музыки</h2>
            <p className="text-xs text-zinc-400">Введи имя исполнителя или название песни. Мы найдем актуальные треки, включая новые синглы Макана.</p>
          </div>

          {/* Large Search Box */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2.5 max-w-2xl relative">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5 pointer-events-none" />
              <input
                id="search-input-field"
                type="text"
                placeholder="Искать Macan, Asphalt 8, Miyagi, JONY, новые треки..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-[#fd3b6a] focus:outline-none rounded-2xl pl-12 pr-12 py-3.5 text-sm placeholder-zinc-500 transition-all text-white"
              />

              {/* Voice input mic button */}
              <button
                type="button"
                onClick={handleVoiceSearch}
                title="Голосовой поиск"
                className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${isListening ? "bg-red-500 text-white animate-pulse" : "text-zinc-500 hover:text-[#fd3b6a] hover:bg-zinc-800"}`}
              >
                <Mic className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <button
              id="search-btn-trigger"
              type="submit"
              disabled={isSearching}
              className="bg-[#fd3b6a] hover:bg-[#fd3b6a]/90 text-white font-bold px-7 h-12.5 rounded-2xl text-sm transition-all flex items-center gap-2 active:scale-95 cursor-pointer shrink-0"
            >
              {isSearching ? <span className="animate-spin shrink-0 block border-2 border-zinc-950 border-t-transparent rounded-full w-4 h-4"></span> : "Найти"}
            </button>

            {/* FLOATING INTUITIVE SUGGESTIONS BLOCK FOR GLOBAL SEARCH */}
            {showSuggestions && searchQuery.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#0c0c12]/98 border border-zinc-800 rounded-2xl p-4 shadow-2xl max-h-[380px] overflow-y-auto backdrop-blur-xl animate-fadeIn space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-900/40 text-[10px] font-mono font-bold text-zinc-400">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#fd3b6a] animate-pulse"></span> ПОДСКАЗКИ И БЫСТРЫЙ ЗАПУСК</span>
                  <button type="button" onClick={() => setShowSuggestions(false)} className="hover:text-[#fd3b6a] transition-colors uppercase text-[9px] font-bold">Закрыть ✕</button>
                </div>

                {getSuggestions().length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#fd3b6a]/80 uppercase tracking-widest block font-mono">Уточнить поиск</span>
                    <div className="flex flex-wrap gap-1.5">
                      {getSuggestions().map((hint, idx) => (
                        <button
                          key={`hint-global-${idx}`}
                          type="button"
                          onClick={() => {
                            const queryVal = hint.query || hint.text.replace(/ \(.*\)/, "");
                            setSearchQuery(queryVal);
                            setShowSuggestions(true);
                          }}
                          className="px-2.5 py-1 text-xs bg-zinc-950 hover:bg-zinc-900 hover:text-white border border-zinc-855 hover:border-[#fd3b6a]/30 text-zinc-300 rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <Search className="w-3 h-3 text-[#fd3b6a]" />
                          <span>{hint.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#fd3b6a]/80 uppercase tracking-widest block font-mono">Запустить трек кликом</span>
                  
                  {isSearching && searchResults.length === 0 ? (
                    <div className="text-center py-4 text-xs text-zinc-500 animate-pulse">Ищем трек...</div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.slice(0, 5).map((song) => {
                        const isSelected = currentSong?.id === song.id;
                        return (
                          <div
                            key={`suggest-g-${song.id}`}
                            onClick={() => {
                              onPlaySong(song, searchResults);
                              setShowSuggestions(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-transparent hover:border-zinc-850 cursor-pointer group transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded bg-zinc-800 overflow-hidden relative shrink-0">
                                <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                  <Play className="w-4 h-4 fill-[#fd3b6a] text-[#fd3b6a]" />
                                </div>
                              </div>
                              <div className="min-w-0 leading-tight">
                                <p className={`text-xs font-bold truncate ${isSelected ? "text-[#fd3b6a]" : "text-zinc-100"}`}>{song.title}</p>
                                <p className="text-[10px] text-zinc-500 truncate mt-0.5">{song.artist}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-500 shrink-0">
                              <span className="px-1.5 py-0.5 bg-[#fd3b6a]/10 border border-[#fd3b6a]/20 rounded text-[#fd3b6a] group-hover:border-[#fd3b6a] transition-all text-[8px]">ВКЛЮЧИТЬ ТРЕК</span>
                              <span>{song.duration}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-zinc-500">Ничего не найдено. Начните писать точное имя, например "Macan".</div>
                  )}
                </div>
              </div>
            )}
          </form>

          {/* Suggested searches if query is empty */}
          {searchResults.length === 0 && !isSearching && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-550 uppercase tracking-widest font-mono">Часто ищут</h4>
              <div className="flex flex-wrap gap-2.5">
                {["MACAN Asphalt 8", "Макан новинки", "Miyagi Эндшпиль", "Xcho Вороны", "Мода макан", "Анна Асти", "Были бы крылья MACAN"].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      setSearchQuery(preset);
                      // Trigger search immediately
                      setTimeout(() => {
                        const form = (e.target as HTMLElement).closest("form");
                        if (form) form.requestSubmit();
                        else {
                          // Manually call API search
                          fetch(`/api/music/search?q=${encodeURIComponent(preset)}`)
                            .then(r => r.json())
                            .then(d => setSearchResults(d))
                            .catch(console.error);
                        }
                      }, 50);
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-350 hover:text-white px-3 py-2 rounded-xl transition-all border border-zinc-850"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Result List */}
          {searchResults.length > 0 && (
            <div className="space-y-4 bg-zinc-900/20 border border-zinc-850/60 p-4 rounded-2xl">
              <div className="flex items-center justify-between border-b border-zinc-850/60 pb-3 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-450 font-mono">Найдено треков: {searchResults.length}</span>
                <button onClick={() => setSearchResults([])} className="text-xs text-zinc-500 hover:text-white">Очистить</button>
              </div>

              <div id="search-results-list" className="space-y-1">
                {searchResults.map((song, index) => {
                  const isSelected = currentSong?.id === song.id;
                  const activeAndPlaying = isSelected && isPlaying;
                  const isLiked = likedSongsIds.has(song.id);
                  return (
                    <div
                      key={song.id}
                      onClick={() => {
                        if (isSelected) onTogglePlayPause();
                        else onPlaySong(song, searchResults);
                      }}
                      className={`flex items-center gap-4 p-2.5 hover:bg-zinc-900/60 rounded-xl group transition-all cursor-pointer ${isSelected ? "bg-[#fd3b6a]/10 border-l-2 border-[#fd3b6a] pl-2 text-[#fd3b6a]" : ""}`}
                    >
                      {/* Left Play button index */}
                      <div className="w-6 text-center text-zinc-550 font-mono text-sm shrink-0 flex items-center justify-center">
                        <span className="group-hover:hidden">{index + 1}</span>
                        <div className="hidden group-hover:block text-[#fd3b6a]">
                          {activeAndPlaying ? <Pause className="w-4 h-4 fill-current animate-pulse" /> : <Play className="w-4 h-4 fill-current pl-0.5" />}
                        </div>
                      </div>

                      {/* Cover Thumbnail */}
                      <div className="w-11 h-11 rounded bg-zinc-850 overflow-hidden shrink-0">
                        <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${isSelected ? "text-[#fd3b6a] font-bold" : "text-zinc-150"}`}>
                          {song.title}
                        </p>
                        <p className="text-xs text-zinc-555 truncate mt-0.5">{song.artist}</p>
                      </div>

                      {/* Right icons: Duration, Like, Add to playlist dropdown */}
                      <div className="flex items-center gap-3.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleLike(song);
                          }}
                          className="text-zinc-500 hover:text-[#fd3b6a] transition-colors p-1"
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? "text-[#fd3b6a] fill-[#fd3b6a]" : ""}`} />
                        </button>

                        <div className="text-xs text-zinc-500 font-mono max-sm:hidden w-10 text-right">{song.duration}</div>

                        {/* Add to Playlist button dropdown */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDropdownOpenId(dropdownOpenId === song.id ? null : song.id);
                            }}
                            className="text-zinc-500 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors"
                            title="В плейлист"
                          >
                            <ListPlus className="w-4.5 h-4.5" />
                          </button>

                          {/* Dropdown Box */}
                          {dropdownOpenId === song.id && (
                            <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl z-50 p-1.5 space-y-0.5 py-2">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold px-2 py-1 border-b border-zinc-850/60 mb-1.5">В плейлист...</p>
                              {playlists.filter(p => p.id !== "liked-songs").map((p) => {
                                const songAlreadyExists = p.songs.some(s => s.id === song.id);
                                return (
                                  <button
                                    key={p.id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (!songAlreadyExists) {
                                        onAddSongToPlaylist(p.id, song);
                                      }
                                      setDropdownOpenId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-850 transition-colors flex items-center justify-between"
                                  >
                                    <span className="truncate pr-2">{p.name}</span>
                                    {songAlreadyExists ? <CheckCircle className="w-3.5 h-3.5 text-[#fd3b6a] shrink-0" /> : <PlusCircle className="w-3.5 h-3.5 text-zinc-650 shrink-0 animate-pulse" />}
                                  </button>
                                );
                              })}
                              {playlists.filter(p => p.id !== "liked-songs").length === 0 && (
                                <p className="text-[10px] px-2 py-1 text-zinc-600 italic">Сначала создайте плейлист в Медиатеке</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PLAYLIST DETAILS VIEW */}
      {currentTab === "playlist" && selectedPlaylist && (
        <div id="view-playlist" className="space-y-6 animate-fadeIn">
          {/* Header Banner info */}
          <div className="flex flex-col sm:flex-row gap-5 items-end bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 rounded-2xl border border-zinc-850/60 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#fd3b6a]/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Cover art block */}
            <div className="w-36 h-36 rounded-xl bg-zinc-850 overflow-hidden shrink-0 shadow-2xl relative shadow-black/40">
              {selectedPlaylist.id === "liked-songs" ? (
                <div className="w-full h-full bg-gradient-to-br from-rose-600 via-[#fe6846] to-pink-500 flex items-center justify-center">
                  <Heart className="w-16 h-16 text-white fill-white" />
                </div>
              ) : (
                <img src={selectedPlaylist.coverUrl || undefined} alt={selectedPlaylist.name} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Title / stats */}
            <div className="flex-1 space-y-1.5 z-10">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#fd3b6a] font-mono">Плейлист</span>
              <h2 className="text-3xl font-sans font-black tracking-tight leading-none text-white">{selectedPlaylist.name}</h2>
              <p className="text-xs text-zinc-450 leading-relaxed font-sans">{selectedPlaylist.description}</p>
              
              <div className="pt-1.5 flex items-center gap-2 text-xs text-zinc-500 font-medium">
                <span className="font-bold text-zinc-300">Владелец: Мой Стример</span>
                <span>•</span>
                <span>{selectedPlaylist.songs.length} песен</span>
              </div>
            </div>

            {/* Giant Play/Shuffle row actions */}
            {selectedPlaylist.songs.length > 0 && (
              <div className="shrink-0 z-10 pt-4 sm:pt-0">
                <button
                  id="playlist-btn-play-all"
                  onClick={() => onPlaySong(selectedPlaylist.songs[0], selectedPlaylist.songs)}
                  className="bg-[#fd3b6a] hover:bg-[#fd3b6a]/90 text-white font-bold p-4 h-13 rounded-full flex items-center justify-center gap-2 shadow-xl shadow-[#fd3b6a]/10 active:scale-95 transition-all text-sm shrink-0 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                  <span>Слушать списком</span>
                </button>
              </div>
            )}
          </div>

          {/* Songs List of Playlist */}
          <div className="bg-zinc-900/20 border border-zinc-850/60 p-4 rounded-2xl">
            <div className="flex items-center text-xs text-zinc-500 uppercase font-bold tracking-wider px-2.5 pb-2.5 border-b border-zinc-850/60 mb-2">
              <span className="w-6 text-center font-mono">#</span>
              <span className="flex-1 px-4 text-left">Название трека / Автор</span>
              <span className="w-24 text-right max-sm:hidden mr-4"><Clock className="w-3.5 h-3.5 inline mr-1" /> Длина</span>
              <span className="w-16 text-center">Опции</span>
            </div>

            <div className="space-y-1">
              {selectedPlaylist.songs.map((song, songIdx) => {
                const isSelected = currentSong?.id === song.id;
                const activeAndPlaying = isSelected && isPlaying;
                const isLiked = likedSongsIds.has(song.id);
                return (
                  <div
                    key={`${song.id}-${songIdx}`}
                    onClick={() => {
                      if (isSelected) onTogglePlayPause();
                      else onPlaySong(song, selectedPlaylist.songs);
                    }}
                    className={`flex items-center gap-4 p-2.5 hover:bg-zinc-900/60 rounded-xl group transition-all cursor-pointer ${isSelected ? "bg-amber-500/10 border-l-2 border-amber-550 pl-2 text-amber-400" : ""}`}
                  >
                    {/* Index play button */}
                    <div className="w-6 text-center text-zinc-550 font-mono text-sm shrink-0 flex items-center justify-center">
                      <span className="group-hover:hidden">{songIdx + 1}</span>
                      <div className="hidden group-hover:block text-amber-405">
                        {activeAndPlaying ? <Pause className="w-4 h-4 fill-current animate-pulse" /> : <Play className="w-4 h-4 fill-current pl-0.5" />}
                      </div>
                    </div>

                    {/* Thumbnail */}
                    <div className="w-11 h-11 rounded bg-zinc-850 overflow-hidden shrink-0 border border-zinc-800">
                      <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>

                    {/* Title Details */}
                    <div className="min-w-0 flex-1 px-4">
                      <p className={`text-sm font-semibold truncate ${isSelected ? "text-emerald-400 font-bold" : "text-zinc-150"}`}>
                        {song.title}
                      </p>
                      <p className="text-xs text-zinc-550 truncate mt-0.5">{song.artist}</p>
                    </div>

                    {/* Duration / Options */}
                    <div className="w-24 text-right text-xs font-mono text-zinc-550 max-sm:hidden mr-4">{song.duration}</div>

                    <div className="w-16 flex items-center justify-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(song);
                        }}
                        className="text-zinc-[505] hover:text-amber-400 transition-colors p-1"
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? "text-amber-500 fill-amber-500" : ""}`} />
                      </button>

                      {selectedPlaylist.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSongFromPlaylist(selectedPlaylist.id, song.id);
                          }}
                          className="text-zinc-650 hover:text-red-400 hover:scale-105 active:scale-95 transition-transform shrink-0 p-1"
                          title="Удалить из плейлиста"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {selectedPlaylist.songs.length === 0 && (
                <div className="text-center py-12 px-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-600 mx-auto">
                    <Music className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-500">Плейлист пока пуст</p>
                    <p className="text-xs text-zinc-650 mt-1">Используйте раздел «Поиск» для наполнения треками!</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
