/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import axios from "axios";
import ytdl from "@distube/ytdl-core";

dotenv.config();

// Create master Express server
const app = express();
app.use(express.json());

const PORT = 3000;

// Lazy initialization of GoogleGenAI to ensure it never crashes on boot if the key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: key || "dummy_key",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// ----------------------------------------------------
// API ENDPOINT: Search Songs via YouTube Scraper
// ----------------------------------------------------
app.get("/api/music/search", async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ error: "Missing search query parameter 'q'" });
  }

  try {
    // Append auto keywords to get high-quality audio recordings / audio-lyric tracks if possible
    const searchQuery = query;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}&sp=EgIQAQ%253D%253D`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });
    
    const html = await response.text();
    
    // Find initial data payloads
    const match = html.match(/ytInitialData\s*=\s*({.+?});/);
    const windowMatch = html.match(/window\["ytInitialData"\]\s*=\s*({.+?});/);
    const activeMatch = match || windowMatch;

    let songs: any[] = [];

    if (activeMatch) {
      try {
        const rawJsonString = activeMatch[1];
        const json = JSON.parse(rawJsonString);
        
        const shelf = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        const itemSection = shelf?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer;
        const contents = itemSection?.contents || [];

        for (const item of contents) {
          const video = item.videoRenderer;
          if (video) {
            const videoId = video.videoId;
            if (!videoId) continue;
            
            // Extract and clean raw components safely
            const rawTitle = video.title?.runs?.[0]?.text || video.title?.accessibility?.accessibilityData?.label || "Unknown Song";
            const artist = video.ownerText?.runs?.[0]?.text || video.shortBylineText?.runs?.[0]?.text || "Unknown Artist";
            const duration = video.lengthText?.simpleText || "3:30";
            const thumbnail = `/api/music/thumbnail?v=${videoId}&title=${encodeURIComponent(rawTitle)}&artist=${encodeURIComponent(artist)}`;

            // Deduplicate short clips or vertical shorts
            if (duration.includes(":") && duration.split(":").length <= 2) {
              const seconds = parseInt(duration.split(":")[1]);
              const minutes = parseInt(duration.split(":")[0]);
              if (minutes === 0 && seconds < 30) {
                // Skip very short clips
                continue;
              }
            }

            songs.push({
              id: videoId,
              title: rawTitle,
              artist: artist,
              duration: duration,
              thumbnail: thumbnail,
            });
          }
        }
      } catch (jsonErr) {
        console.error("Failed to parse YouTube initial payload, falling back to regex scraping", jsonErr);
      }
    }

    // Direct fallback scraping if the YT window payload changed/failed
    if (songs.length === 0) {
      const regex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
      let m;
      const ids = new Set<string>();
      while ((m = regex.exec(html)) !== null && ids.size < 12) {
        ids.add(m[1]);
      }
      
      const parts = query.split(" - ");
      const fallbackTitle = parts[1] || query;
      const fallbackArtist = parts[0] || "Музыкальный Артист";

      songs = Array.from(ids).map((id, index) => {
        const title = index === 0 ? fallbackTitle : `${fallbackTitle} (версия ${index + 1})`;
        return {
          id,
          title,
          artist: fallbackArtist,
          duration: "3:45",
          thumbnail: `/api/music/thumbnail?v=${id}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(fallbackArtist)}`
        };
      });
    }

    // Return search songs
    res.json(songs.slice(0, 15));
  } catch (err: any) {
    console.error("API search failed:", err);
    res.status(500).json({ error: "Failed to execute search query against streaming system", details: err.message });
  }
});

// ----------------------------------------------------
// API ENDPOINT: Thumbnail Proxy bypass for VPN/ISP blocks & iTunes official artwork matcher
// ----------------------------------------------------
app.get("/api/music/thumbnail", async (req, res) => {
  const videoId = req.query.v as string;
  const title = req.query.title as string;
  const artist = req.query.artist as string;

  // Step 1: Attempt to fetch pristine, original official cover art from iTunes Search API (extremely fast & unblocked)
  if (title || artist) {
    try {
      const cleanArtist = (artist || "")
        .replace(/feat\..*$/i, "")
        .replace(/&.*$/i, "")
        .replace(/f\..*$/i, "")
        .replace(/х.*$/i, "") // Cyrillic "feat" often used as "х" or "x"
        .replace(/x.*$/i, "")
        .trim();
      const cleanTitle = (title || "")
        .replace(/\(feat\..*?\)/i, "")
        .replace(/\[feat\..*?\]/i, "")
        .trim();
        
      const searchTerm = `${cleanArtist} ${cleanTitle}`.trim();
      if (searchTerm.length > 2) {
        const response = await axios.get(`https://itunes.apple.com/search`, {
          params: {
            term: searchTerm,
            entity: "song",
            limit: 1
          },
          timeout: 2000
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
          const art100 = response.data.results[0].artworkUrl100;
          if (art100) {
            // Replace 100x100bb with a gorgeous high-res 500x500bb version
            const finalArt = art100
              .replace("100x100bb.jpg", "500x500bb.jpg")
              .replace("100x100bb.png", "500x500bb.png")
              .replace("100x100bb", "500x500bb");
              
            // Cache in the browser for 7 days
            res.setHeader("Cache-Control", "public, max-age=604800");
            return res.redirect(finalArt);
          }
        }
      }
    } catch (itunesErr) {
      console.warn(`iTunes artwork match failed for "${artist} - ${title}", falling back to YouTube:`, itunesErr);
    }
  }

  if (!videoId || videoId.length !== 11) {
    // If no valid video id, redirect to standard high-quality music fallback
    return res.redirect("https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80");
  }

  // Step 2: Fall back to YouTube's standard CDN thumbnail streams (processed via server to bypass blocklists)
  const urls = [
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/default.jpg`
  ];

  for (const url of urls) {
    try {
      const response = await axios({
        method: "get",
        url: url,
        responseType: "stream",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 2500
      });

      // Browser caches this for 1 day for extreme speed
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Content-Type", "image/jpeg");
      response.data.pipe(res);
      return;
    } catch (err) {
      // Continue to next thumbnail format resolution
    }
  }

  // Fallback to high-quality Unsplash music theme image if YouTube completely failed or is inaccessible
  res.redirect("https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=320&q=80");
});

// ----------------------------------------------------
// API ENDPOINT: Stream Audio from YouTube with PIPED and Invidious Robust Bypass Dual-Engine (Option 2)
// ----------------------------------------------------

// List of highly reliable PIPED API instances
const PIPED_INSTANCES = [
  "https://piped-api.us.projectsegfau.lt",
  "https://pipedapi.lunar.icu",
  "https://pipedapi.kavin.rocks",
  "https://piped-api.privacydev.net",
  "https://pipedapi.nomadic.one",
  "https://piped-api.bah.im",
  "https://api-piped.mha.fi",
  "https://piped-api.hostux.net",
  "https://pipedapi.r4the.com",
  "https://piped-api.drgns.space",
  "https://pipedapi.syncis.org",
  "https://piped-api.garudalinux.org",
  "https://piped-api.astart.ca"
];

// List of Invidious backup instances
const INVIDIOUS_INSTANCES = [
  "https://invidious.projectsegfau.lt",
  "https://yewtu.be",
  "https://invidious.nerdvpn.de",
  "https://invidious.privacydev.net",
  "https://iv.melmac.space",
  "https://iv.ggtyler.dev",
  "https://inv.tux.im",
  "https://invidious.lunar.icu",
  "https://invidious.flokinet.to",
  "https://invidious.no-logs.com",
  "https://invidious.perennialte.ch"
];

// Helper to race promises cleanly
const promiseFirstSuccess = (promises: Promise<any>[]) => {
  return new Promise((resolve, reject) => {
    let rejectedCount = 0;
    let resolved = false;
    promises.forEach((p) => {
      p.then((val) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      }).catch((e) => {
        rejectedCount++;
        if (rejectedCount === promises.length && !resolved) {
          reject(new Error("All parallel requests failed"));
        }
      });
    });
  });
};

// Helper to scrape dynamic fallback videos and rescue failed static streams with proxy fallback
async function getAlternativeVideoIds(query: string, excludeId?: string): Promise<string[]> {
  console.log(`[getAlternativeVideoIds] Searching alternatives using robust proxy searching for: "${query}"`);
  const ids = new Set<string>();

  // PHASE 1: Try PIPED search endpoints (runs through residential proxies, completely bypasses GCP data center bans)
  const pipedSearchCandidates = PIPED_INSTANCES.slice(0, 5);
  for (const instance of pipedSearchCandidates) {
    try {
      const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&filter=all`;
      const response = await axios.get(searchUrl, { timeout: 2500 });
      if (response.data && Array.isArray(response.data.items)) {
        for (const item of response.data.items) {
          if (item.type === "stream" && item.url) {
            const vMatch = item.url.match(/v=([a-zA-Z0-9_-]{11})/);
            const id = vMatch ? vMatch[1] : item.url.split("/watch?v=")[1];
            if (id && id !== excludeId) {
              ids.add(id);
            }
          }
        }
        if (ids.size > 0) {
          console.log(`[getAlternativeVideoIds] Successfully found alternative(s) from PIPED search proxy: ${instance}`);
          break;
        }
      }
    } catch (err: any) {
      console.log(`[getAlternativeVideoIds] PIPED search proxy skipped for ${instance}: ${err.message}`);
    }
  }

  // PHASE 2: Fallback to Invidious search endpoints
  if (ids.size === 0) {
    const invSearchCandidates = INVIDIOUS_INSTANCES.slice(0, 4);
    for (const instance of invSearchCandidates) {
      try {
        const searchUrl = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
        const response = await axios.get(searchUrl, { timeout: 2500 });
        if (Array.isArray(response.data)) {
          for (const item of response.data) {
            if (item.videoId && item.videoId !== excludeId) {
              ids.add(item.videoId);
            }
          }
          if (ids.size > 0) {
            console.log(`[getAlternativeVideoIds] Successfully found alternative(s) from Invidious search proxy: ${instance}`);
            break;
          }
        }
      } catch (err: any) {
        console.log(`[getAlternativeVideoIds] Invidious search proxy skipped for ${instance}: ${err.message}`);
      }
    }
  }

  // PHASE 3: Last-resort scraped YouTube search (subject to GCP IP block but included for compliance)
  if (ids.size === 0) {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        timeout: 3000
      });
      const html = response.data;
      const match = html.match(/ytInitialData\s*=\s*({.+?});/);
      const windowMatch = html.match(/window\["ytInitialData"\]\s*=\s*({.+?});/);
      const activeMatch = match || windowMatch;
      
      if (activeMatch) {
        const json = JSON.parse(activeMatch[1]);
        const shelf = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
        const itemSection = shelf?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer;
        const contents = itemSection?.contents || [];
        for (const item of contents) {
          const video = item.videoRenderer;
          if (video && video.videoId) {
            if (video.videoId !== excludeId) {
              ids.add(video.videoId);
            }
          }
        }
      }
      
      if (ids.size === 0) {
        const regex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
        let m;
        while ((m = regex.exec(html)) !== null && ids.size < 5) {
          if (m[1] !== excludeId) {
            ids.add(m[1]);
          }
        }
      }
    } catch (err) {
      console.log("[getAlternativeVideoIds] Scraper fallback skipped or bypassed:", err);
    }
  }

  return Array.from(ids);
}

// Highly reliable, community Cobalt.tools API instances
const COBALT_INSTANCES = [
  "https://api.cobalt.tools",
  "https://co.wuk.sh",
  "https://cobalt.kavin.rocks",
  "https://cobalt.perennialte.ch",
  "https://cobalt-api.lunar.icu",
  "https://api-cobalt.mha.fi",
  "https://cobalt.ajay.app"
];

// Cobalt high-quality direct streaming proxy bypass (Option 1 - Super Low Latency)
async function serviceCobaltStream(videoId: string, req: express.Request, res: express.Response): Promise<boolean> {
  console.log(`[Cobalt Engine] Resolving direct audio stream for video: ${videoId}`);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const promiseList: Promise<any>[] = [];
  COBALT_INSTANCES.forEach((instance) => {
    // Attempt standard root endpoint (Cobalt v10+) AND older /api/json endpoint (Cobalt v7-)
    const endpoints = [instance, `${instance}/api/json`];
    endpoints.forEach((endpoint) => {
      promiseList.push(
        (async () => {
          const response = await axios.post(
            endpoint,
            {
              url: videoUrl,
              downloadMode: "audio",
              isAudioOnly: true,
              audioFormat: "mp3",
              audioQuality: "128"
            },
            {
              headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Origin": "https://cobalt.tools",
                "Referer": "https://cobalt.tools/",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              },
              timeout: 4000 // fast timeout for racer
            }
          );
          if (response.data && response.data.url) {
            return { url: response.data.url, endpoint };
          }
          throw new Error("Invalid cobalt response");
        })()
      );
    });
  });

  try {
    const winner = await promiseFirstSuccess(promiseList) as any;
    if (winner && winner.url) {
      console.log(`[Cobalt Engine] Found direct audio stream from ${winner.endpoint}: ${winner.url}. Proxying stream...`);
      
      const streamHeaders: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      };
      if (req.headers.range) {
        streamHeaders["Range"] = req.headers.range as string;
      }

      const streamResponse = await axios({
        method: "get",
        url: winner.url,
        responseType: "stream",
        headers: streamHeaders,
        timeout: 10000,
      });

      const headersToForward: Record<string, string> = {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes"
      };

      if (streamResponse.headers["content-type"]) {
        headersToForward["Content-Type"] = String(streamResponse.headers["content-type"]);
      }
      if (streamResponse.headers["content-range"]) {
        headersToForward["Content-Range"] = String(streamResponse.headers["content-range"]);
      }
      if (streamResponse.headers["content-length"]) {
        headersToForward["Content-Length"] = String(streamResponse.headers["content-length"]);
      }

      res.writeHead(streamResponse.status || 200, headersToForward);
      streamResponse.data.pipe(res);

      req.on("close", () => {
        if (!streamResponse.data.destroyed) {
          streamResponse.data.destroy();
        }
      });
      return true;
    }
  } catch (err: any) {
    console.log(`[Cobalt Engine] Cobalt parallel requests skipped or completed: ${err.message}`);
  }
  return false;
}

// Local YTDL high-quality direct streaming proxy bypass (Option 0 - Primary Engine)
async function serviceYtdlStream(videoId: string, req: express.Request, res: express.Response): Promise<boolean> {
  console.log(`[YTDL Engine] Attempting direct resolution for: ${videoId}`);
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Attempt standard Node readable-stream resolution
    const streamOptions = {
      filter: "audioonly",
      quality: "highestaudio",
      highWaterMark: 1 << 25, // 32MB buffer for extremely smooth streaming
      requestOptions: {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      }
    };

    const stream = ytdl(videoUrl, streamOptions as any);
    
    // Listen for error once to let it fail early if blocked / restricted (with a strict 1.5s timeout safety-valve)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { stream.destroy(); } catch (e) {}
        reject(new Error("YTDL resolution timed out (1500ms limit)"));
      }, 1500);

      stream.once("info", () => {
        clearTimeout(timeout);
        resolve();
      });
      stream.once("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });

    console.log(`[YTDL Engine] Successfully resolved audio stream. Piping content...`);
    res.setHeader("Content-Type", "audio/webm");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    stream.pipe(res);

    req.on("close", () => {
      try { stream.destroy(); } catch (e) {}
    });
    return true;
  } catch (err: any) {
    console.log(`[YTDL Engine] Local YTDL resolver skipped / redirecting to next: ${err.message}`);
  }
  return false;
}

async function serviceStream(videoId: string, req: express.Request, res: express.Response): Promise<boolean> {
  console.log(`[Streaming Engine] Servicing stream request for video: ${videoId}`);

  // STAGE 0: Try local YTDL resolver first
  try {
    const ytdlSuccess = await serviceYtdlStream(videoId, req, res);
    if (ytdlSuccess) return true;
  } catch (err: any) {
    console.log(`[Streaming Engine] YTDL engine bypassed: ${err.message}`);
  }

  // STAGE 1: Try Cobalt engine next
  try {
    const cobaltSuccess = await serviceCobaltStream(videoId, req, res);
    if (cobaltSuccess) return true;
  } catch (err: any) {
    console.log(`[Streaming Engine] Cobalt engine bypassed: ${err.message}`);
  }

  // STAGE 2: Parallel Race top 6 PIPED instances
  const topPipedToRace = PIPED_INSTANCES.slice(0, 6);
  let winner: any = null;

  try {
    const racePromises = topPipedToRace.map(async (instance) => {
      const infoUrl = `${instance}/streams/${videoId}`;
      const response = await axios.get(infoUrl, { 
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 4500 // fast but permissive racing timeout
      });

      if (response.data && response.data.audioStreams && response.data.audioStreams.length > 0) {
        return { audioStreams: response.data.audioStreams, instance };
      }
      throw new Error("No streams");
    });

    winner = await promiseFirstSuccess(racePromises);
  } catch (raceErr) {
    console.log(`[Piped Racer] Initial race skipped. Checking fallback parallel items...`);
  }

  // STAGE 3: Race remaining PIPED instances in parallel
  if (!winner) {
    const remainingPipedList = PIPED_INSTANCES.slice(6);
    try {
      const backupPromises = remainingPipedList.map(async (instance) => {
        const infoUrl = `${instance}/streams/${videoId}`;
        const response = await axios.get(infoUrl, { 
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          timeout: 4500
        });
        if (response.data && response.data.audioStreams && response.data.audioStreams.length > 0) {
          return { audioStreams: response.data.audioStreams, instance };
        }
        throw new Error("No streams");
      });
      winner = await promiseFirstSuccess(backupPromises);
    } catch (err) {
      console.log(`[Piped Racer] All PIPED backup parallel instances skipped.`);
    }
  }

  // If we got a PIPED stream, serve it
  if (winner) {
    try {
      const audioStreams = winner.audioStreams;
      
      // Sort: Prioritize mp4/m4a/mpeg files first, then high bitrate
      audioStreams.sort((a: any, b: any) => {
        const isA_Preferable = a.mimeType && (a.mimeType.includes("mp4") || a.mimeType.includes("m4a") || a.mimeType.includes("mpeg") || a.mimeType.includes("mp3"));
        const isB_Preferable = b.mimeType && (b.mimeType.includes("mp4") || b.mimeType.includes("m4a") || b.mimeType.includes("mpeg") || b.mimeType.includes("mp3"));
        
        if (isA_Preferable && !isB_Preferable) return -1;
        if (!isA_Preferable && isB_Preferable) return 1;
        
        const bitrateA = parseInt(a.bitrate) || 0;
        const bitrateB = parseInt(b.bitrate) || 0;
        return bitrateB - bitrateA;
      });

      const bestStream = audioStreams[0];
      const streamUrl = bestStream.url;

      if (streamUrl) {
        console.log(`[Streaming Engine] Serving Piped stream (${bestStream.mimeType}) from winner: ${winner.instance}`);
        const streamHeaders: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        };
        if (req.headers.range) {
          streamHeaders["Range"] = req.headers.range as string;
        }

        const streamResponse = await axios({
          method: "get",
          url: streamUrl,
          responseType: "stream",
          headers: streamHeaders,
          timeout: 10000,
        });

        const headersToForward: Record<string, string> = {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": bestStream.mimeType || "audio/mp4",
          "Accept-Ranges": "bytes"
        };

        if (streamResponse.headers["content-type"]) {
          headersToForward["Content-Type"] = String(streamResponse.headers["content-type"]);
        }
        if (streamResponse.headers["content-range"]) {
          headersToForward["Content-Range"] = String(streamResponse.headers["content-range"]);
        }
        if (streamResponse.headers["content-length"]) {
          headersToForward["Content-Length"] = String(streamResponse.headers["content-length"]);
        }

        res.writeHead(streamResponse.status || 200, headersToForward);
        streamResponse.data.pipe(res);

        req.on("close", () => {
          if (!streamResponse.data.destroyed) {
            streamResponse.data.destroy();
          }
        });
        return true;
      }
    } catch (streamErr: any) {
      console.log(`[Streaming Engine] Stream pipe bypassed from raced PIPED item: ${streamErr.message}`);
    }
  }

  // STAGE 4: Fallback Race across top INVIDIOUS instances
  console.log(`[Streaming Engine] PIPED skipped or completed. Initiating Invidious Parallel Race...`);
  
  let currentInvidious = [...INVIDIOUS_INSTANCES];
  try {
    const invResponse = await axios.get("https://api.invidious.io/instances.json", { timeout: 2500 });
    if (Array.isArray(invResponse.data)) {
      const dynamicInstances: string[] = [];
      for (const item of invResponse.data) {
        if (Array.isArray(item) && item.length >= 2) {
          const domain = item[0];
          const info = item[1];
          if (info && info.api === true && info.type === "https") {
            dynamicInstances.push(info.uri || `https://${domain}`);
          }
        }
      }
      if (dynamicInstances.length > 0) {
        currentInvidious = Array.from(new Set([...dynamicInstances, ...INVIDIOUS_INSTANCES]));
      }
    }
  } catch (invErr) {
    // Fail silently, use static ones
  }

  // Race top 10 Invidious instances in parallel
  const invToRace = currentInvidious.slice(0, 10);
  let invWinner: any = null;
  try {
    const invPromises = invToRace.map(async (instance) => {
      const infoUrl = `${instance}/api/v1/videos/${videoId}`;
      const response = await axios.get(infoUrl, { timeout: 5000 }); // Boost timeout to 5000ms
      
      // Fallback format resolving (both adaptiveFormats and formatStreams formats)
      let audioFormats = [];
      if (response.data) {
        if (Array.isArray(response.data.adaptiveFormats)) {
          audioFormats = response.data.adaptiveFormats.filter((f: any) => 
            f.type && f.type.startsWith("audio/")
          );
        }
        if (audioFormats.length === 0 && Array.isArray(response.data.formatStreams)) {
          // If no audioonly tracks, fallback to video+audio formats
          audioFormats = response.data.formatStreams.filter((f: any) => 
            f.type && (f.type.startsWith("audio/") || f.type.startsWith("video/"))
          );
        }
      }
      
      if (audioFormats.length > 0) {
        return { audioFormats, instance };
      }
      throw new Error("No audio formats found");
    });
    invWinner = await promiseFirstSuccess(invPromises);
  } catch (err) {
    console.log(`[Streaming Engine] All Invidious parallel races skipped.`);
  }

  if (invWinner) {
    try {
      const audioFormats = invWinner.audioFormats;
      
      // Sort: Prioritize mp4/m4a/mpeg files first, then high bitrate
      audioFormats.sort((a: any, b: any) => {
        const typeA = a.type || "";
        const typeB = b.type || "";
        const isA_Preferable = typeA.includes("mp4") || typeA.includes("m4a") || typeA.includes("mpeg") || typeA.includes("mp3");
        const isB_Preferable = typeB.includes("mp4") || typeB.includes("m4a") || typeB.includes("mpeg") || typeB.includes("mp3");
        
        if (isA_Preferable && !isB_Preferable) return -1;
        if (!isA_Preferable && isB_Preferable) return 1;

        const bitrateA = parseInt(a.bitrate) || 0;
        const bitrateB = parseInt(b.bitrate) || 0;
        return bitrateB - bitrateA;
      });

      const bestAudio = audioFormats[0];
      let streamUrl = bestAudio.url;
      if (streamUrl && streamUrl.startsWith("/")) {
        streamUrl = `${invWinner.instance}${streamUrl}`;
      }

      if (streamUrl) {
        console.log(`[Streaming Engine] Serving Invidious stream (${bestAudio.type || "audio/mp4"}) from winner: ${invWinner.instance}`);
        const streamHeaders: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        };
        if (req.headers.range) {
          streamHeaders["Range"] = req.headers.range as string;
        }

        const streamResponse = await axios({
          method: "get",
          url: streamUrl,
          responseType: "stream",
          headers: streamHeaders,
          timeout: 10000,
        });

        const headersToForward: Record<string, string> = {
          "Content-Type": bestAudio.type ? bestAudio.type.split(";")[0] : "audio/mp4",
          "Accept-Ranges": "bytes"
        };

        if (streamResponse.headers["content-type"]) {
          headersToForward["Content-Type"] = String(streamResponse.headers["content-type"]);
        }
        if (streamResponse.headers["content-range"]) {
          headersToForward["Content-Range"] = String(streamResponse.headers["content-range"]);
        }
        if (streamResponse.headers["content-length"]) {
          headersToForward["Content-Length"] = String(streamResponse.headers["content-length"]);
        }

        res.writeHead(streamResponse.status || 200, headersToForward);
        streamResponse.data.pipe(res);

        req.on("close", () => {
          if (!streamResponse.data.destroyed) {
            streamResponse.data.destroy();
          }
        });
        return true;
      }
    } catch (err: any) {
      console.log(`[Streaming Engine] Invidious stream pipe skipped: ${err.message}`);
    }
  }

  return false;
}

app.get("/api/music/stream", async (req, res) => {
  const videoId = req.query.v as string;
  const title = req.query.title as string;
  const artist = req.query.artist as string;

  if (!videoId || videoId.length !== 11) {
    return res.status(400).json({ error: "Missing or invalid video ID parameter 'v'" });
  }

  console.log(`[Streaming Audio] Fetching robust proxy stream for video ID: ${videoId}`);

  // Try streaming primary video ID first
  let success = await serviceStream(videoId, req, res);
  if (success) return;

  // If primary stream is skipped, perform self-healing with search fallback
  if (title || artist) {
    const searchQuery = `${artist} ${title} audio lyrics`.trim();
    console.log(`[Stream Self-Healing] Primary stream completed for ${videoId}. Searching alternative uploads for: "${searchQuery}"`);
    const alternatives = await getAlternativeVideoIds(searchQuery, videoId);
    if (alternatives.length > 0) {
      for (const altId of alternatives.slice(0, 3)) {
        console.log(`[Stream Self-Healing] Trying alternative video ID fallback: ${altId}`);
        success = await serviceStream(altId, req, res);
        if (success) {
          console.log(`[Stream Self-Healing] Successfully self-healed and proxy streamed lyric/audio track: ${altId}`);
          return;
        }
      }
    }
  }

  // Final last-resort redirect to avoid player stall
  console.log(`[Streaming Status] All bypass routes and self-healing complete for video ${videoId}. Executing failsafe.`);
  res.redirect("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
});

// ----------------------------------------------------
// API ENDPOINT: Gemini AI Personalized Recommendation
// ----------------------------------------------------
app.post("/api/gemini/recommend", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing body prompt parameter" });
  }

  // If no API key exists, return a rich, curated response of modern popular Russian tracks (Macan, Miyagi, Jony)
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not defined, sending curated Russian hits mockup.");
    return res.json({
      recommendations: [
        { title: "Asphalt 8", artist: "MACAN", searchQuery: "MACAN Asphalt 8", rationale: "Один из его знаковых хитов с глубоким лиричным битом и ночной автоэстетикой." },
        { title: "Спой", artist: "MACAN feat. A.V.G", searchQuery: "MACAN feat. A.V.G Спой", rationale: "Свежий драйвовый трек с шикарным припевом и качающим басом." },
        { title: "Giri", artist: "MACAN", searchQuery: "MACAN Giri", rationale: "Новый сильный сингл певца о дружбе, верности и жизненных путях." },
        { title: "Капитан", artist: "Miyagi & Эндшпиль", searchQuery: "Miyagi Эндшпиль Капитан", rationale: "Невероятно глубокий регги-рэп шедевр от владикавказского дуэта." },
        { title: "Комета", artist: "JONY", searchQuery: "JONY Комета", rationale: "Суперпопулярный романтичный поп-хит с парящей мелодией." }
      ]
    });
  }

  try {
    const client = getGeminiClient();
    const systemInstruction = 
      "You are a music recommendations assistant inside a modern Spotify-like music server. " +
      "The user will describe their mood, vibe, or preferred music style (often involving modern Russian artists like Macan, Miyagi, Xcho, Instasamka, or western pop/hip-hop/synthwave). " +
      "Analyze their prompt and generate exactly 5-6 superb fitting tracks that actually exist. " +
      "For each song, provide: title, artist name, exact searchQuery (format: 'Artist - Song Title'), and a brief 1-sentence rationale in Russian explaining why this track is perfect for their request. " +
      "You must strictly return JSON matching the required schema.";

    const schema = {
      type: Type.OBJECT,
      properties: {
        recommendations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              artist: { type: Type.STRING },
              searchQuery: { type: Type.STRING },
              rationale: { type: Type.STRING }
            },
            required: ["title", "artist", "searchQuery", "rationale"]
          }
        }
      },
      required: ["recommendations"]
    };

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text?.trim() || "{}";
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err: any) {
    console.error("Gemini music endpoint error:", err);
    res.status(500).json({ error: "Failed to generate AI advice", details: err.message });
  }
});

// ----------------------------------------------------
// VITE SETUP & STATIC SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
