/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Song {
  id: string; // YouTube Video ID
  title: string;
  artist: string;
  duration: string; // e.g. "3:45"
  thumbnail: string;
  url?: string;
  isLiked?: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  songs: Song[];
  isCustom?: boolean;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentSong: Song | null;
  progress: number; // in seconds
  duration: number; // in seconds
  volume: number; // 0 to 100
  queue: Song[];
  history: Song[];
  isShuffled: boolean;
  isLooped: boolean;
}

export interface AIRecommendation {
  title: string;
  artist: string;
  searchQuery: string;
  rationale: string;
}
