/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Home, Search, Library, Sparkles, PlusCircle, Heart, Music2 } from "lucide-react";
import { Playlist } from "../types";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  playlists: Playlist[];
  onSelectPlaylist: (playlist: Playlist) => void;
  selectedPlaylistId: string | null;
  onNewPlaylist: () => void;
}

export default function Sidebar({
  currentTab,
  setCurrentTab,
  playlists,
  onSelectPlaylist,
  selectedPlaylistId,
  onNewPlaylist,
}: SidebarProps) {
  return (
    <aside 
      id="spotify-sidebar" 
      className="w-64 bg-zinc-950 flex flex-col p-4 border-r border-zinc-900 h-full select-none hidden md:flex"
    >
      {/* App Logo */}
      <div className="flex items-center gap-3 px-2 py-4 mb-3 cursor-pointer" onClick={() => setCurrentTab("home")}>
        <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-[#fd3b6a] to-[#fe6846] flex items-center justify-center shadow-lg shadow-[#fd3b6a]/30 relative overflow-hidden group">
          {/* Smiling Headphones Cat Logo representation */}
          <svg viewBox="0 0 100 100" className="w-7 h-7 text-white fill-current">
            <path d="M50,15 A25,25 0 0,0 25,40 L25,55 A5,5 0 0,0 30,60 L35,60 A5,5 0 0,0 40,55 L40,45 A5,5 0 0,0 35,40 L30,40 A20,20 0 0,1 50,20 A20,20 0 0,1 70,40 L65,40 A5,5 0 0,0 60,45 L60,55 A5,5 0 0,0 65,60 L70,60 A5,5 0 0,0 75,55 L75,40 A25,25 0 0,0 50,15 Z" />
            <circle cx="50" cy="50" r="15" className="opacity-20" />
            {/* Cute cat ears */}
            <polygon points="32,28 18,16 28,32" />
            <polygon points="68,28 82,16 72,32" />
            {/* Eyes and smile */}
            <path d="M42,48 Q45,45 48,48" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M52,48 Q55,45 58,48" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M46,54 Q50,58 54,54" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </div>
        <div>
          <h1 className="font-display font-black text-base tracking-widest text-white leading-none">RADIO AVA</h1>
          <span className="font-mono text-[8px] text-[#fd3b6a] font-bold tracking-widest uppercase">Persian Music Portal</span>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex flex-col gap-1.5 mb-6">
        <button
          id="btn-nav-home"
          onClick={() => setCurrentTab("home")}
          className={`flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
            currentTab === "home"
              ? "bg-[#fd3b6a]/10 text-[#fd3b6a] border border-[#fd3b6a]/20 font-bold shadow-sm"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
          }`}
        >
          <Home className="w-5 h-5" />
          <span>Главная</span>
        </button>

        <button
          id="btn-nav-search"
          onClick={() => setCurrentTab("search")}
          className={`flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
            currentTab === "search"
              ? "bg-[#fd3b6a]/10 text-[#fd3b6a] border border-[#fd3b6a]/20 font-bold shadow-sm"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
          }`}
        >
          <Search className="w-5 h-5" />
          <span>Поиск треков</span>
        </button>

      </div>

      {/* Playlists & Library Divider */}
      <div className="border-t border-zinc-900/50 my-2"></div>

      {/* Library Title & Action */}
      <div className="flex items-center justify-between px-2 py-3 mb-2 text-zinc-400">
        <div className="flex items-center gap-2.5">
          <Library className="w-5 h-5" />
          <span className="text-xs font-bold tracking-widest uppercase">Медиатека</span>
        </div>
        <button 
          id="btn-create-playlist"
          onClick={onNewPlaylist}
          title="Создать плейлист"
          className="text-zinc-450 hover:text-[#fd3b6a] hover:scale-105 transition-all text-xs cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Playlist Items */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {playlists.map((playlist) => {
          const isSelected = selectedPlaylistId === playlist.id;
          const isLiked = playlist.id === "liked-songs";
          return (
            <div
              id={`sidebar-playlist-${playlist.id}`}
              key={playlist.id}
              onClick={() => {
                onSelectPlaylist(playlist);
                setCurrentTab("playlist");
              }}
              className={`flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-all ${
                isSelected
                  ? "bg-zinc-900 border-l-2 border-[#fd3b6a] text-[#fd3b6a] font-bold"
                  : "text-zinc-450 hover:text-zinc-100 hover:bg-zinc-900/40"
              }`}
            >
              {isLiked ? (
                <div className="w-9 h-9 rounded-md bg-gradient-to-br from-[#fd3b6a] to-[#fe6846] flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-zinc-950 fill-zinc-950" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-md overflow-hidden shrink-0 bg-zinc-800 relative">
                  <img
                    src={playlist.coverUrl || undefined}
                    alt={playlist.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.src = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&q=80";
                    }}
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate leading-snug">{playlist.name}</p>
                <p className="text-xs text-zinc-550 truncate leading-none mt-0.5">
                  {playlist.songs.length} треков
                </p>
              </div>
            </div>
          );
        })}

        {playlists.length === 0 && (
          <div className="text-center py-6 px-4">
            <p className="text-xs text-zinc-550">Плейлистов пока нет</p>
          </div>
        )}
      </div>

      {/* Visual Creator Disclaimer */}
      <div className="mt-auto pt-4 border-t border-zinc-900/50 flex flex-col gap-1.5 px-2 text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-[#fd3b6a] animate-ping"></div>
          <span>Система готова</span>
        </div>
        <p className="leading-tight text-zinc-650">Язык вещания: RUS & GLOBAL</p>
      </div>
    </aside>
  );
}
