/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { CloudRain, Flame, Waves, Disc, Radio, Sliders, Volume2, Sparkles, AlertCircle, HelpCircle } from "lucide-react";

interface SoundscapeChannel {
  id: string;
  name: string;
  russianName: string;
  icon: React.ComponentType<any>;
  colorClass: string;
  accentColor: string;
  accentBg: string;
  synthType: "rain" | "fire" | "waves" | "vinyl" | "drone";
  active: boolean;
  volume: number; // 0 - 100
}

export default function SoundscapeMixer() {
  const [channels, setChannels] = useState<SoundscapeChannel[]>([
    {
      id: "rain",
      name: "Cozy Rain",
      russianName: "Дождь за окном",
      icon: CloudRain,
      colorClass: "text-sky-400",
      accentColor: "#38bdf8",
      accentBg: "rgba(56, 189, 248, 0.15)",
      synthType: "rain",
      active: false,
      volume: 40,
    },
    {
      id: "fire",
      name: "Campfire Crackle",
      russianName: "Потрескивание костра",
      icon: Flame,
      colorClass: "text-amber-500",
      accentColor: "#f59e0b",
      accentBg: "rgba(245, 158, 11, 0.15)",
      synthType: "fire",
      active: false,
      volume: 35,
    },
    {
      id: "waves",
      name: "Ocean Waves",
      russianName: "Шум океана",
      icon: Waves,
      colorClass: "text-teal-400",
      accentColor: "#2dd4bf",
      accentBg: "rgba(45, 212, 191, 0.15)",
      synthType: "waves",
      active: false,
      volume: 45,
    },
    {
      id: "vinyl",
      name: "Vinyl Crackle",
      russianName: "Виниловый треск",
      icon: Disc,
      colorClass: "text-rose-400",
      accentColor: "#f43f5e",
      accentBg: "rgba(244, 63, 94, 0.15)",
      synthType: "vinyl",
      active: false,
      volume: 25,
    },
    {
      id: "drone",
      name: "Cosmic Drone",
      russianName: "Космический гул",
      icon: Radio,
      colorClass: "text-violet-400",
      accentColor: "#a78bfa",
      accentBg: "rgba(167, 139, 250, 0.15)",
      synthType: "drone",
      active: false,
      volume: 30,
    }
  ]);

  const [masterVolume, setMasterVolume] = useState<number>(70); // 0 - 100
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Audio Graph Web Audio Web References
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Active nodes lookup by channel id
  const activeNodesRef = useRef<{
    [key: string]: {
      gainNode: GainNode;
      sources: (AudioScheduledSourceNode | IntervalRefContainer)[];
    };
  }>({});

  interface IntervalRefContainer {
    isInterval: boolean;
    intervalId: NodeJS.Timeout | number;
  }

  // Pre-generate white, pink, brown buffers
  const pinkBufferRef = useRef<AudioBuffer | null>(null);
  const brownBufferRef = useRef<AudioBuffer | null>(null);
  const clickBufferRef = useRef<AudioBuffer | null>(null);

  // Trigger haptic pulses for native-like feel
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  };

  // Noise generators
  const getPinkNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    if (pinkBufferRef.current) return pinkBufferRef.current;
    
    const bufferSize = ctx.sampleRate * 4; // 4 seconds loop
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11; // scaling factor
    }
    pinkBufferRef.current = buffer;
    return buffer;
  };

  const getBrownNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
    if (brownBufferRef.current) return brownBufferRef.current;
    
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // restore amplitude
    }
    brownBufferRef.current = buffer;
    return buffer;
  };

  const getClickBuffer = (ctx: AudioContext): AudioBuffer => {
    if (clickBufferRef.current) return clickBufferRef.current;
    
    // Very short highpass noise burst for crackling wood/dust sparks
    const sampleRate = ctx.sampleRate;
    const duration = 0.03; // 30ms click
    const bufferSize = sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.exp(-i / (bufferSize * 0.25)); // exponential decay
      const white = Math.random() * 2 - 1;
      data[i] = white * envelope * 0.6;
    }
    clickBufferRef.current = buffer;
    return buffer;
  };

  // Launch initial Web Audio Context
  const initAudioCtx = (): AudioContext | null => {
    if (audioCtxRef.current) return audioCtxRef.current;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(masterVolume / 100, ctx.currentTime);
      masterGain.connect(ctx.destination);
      
      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
      setAudioInitialized(true);
      return ctx;
    } catch (err: any) {
      console.error("Web Audio API not supported or blocked: ", err);
      setErrorMsg("Синтезатор звука не поддерживается вашим браузером");
      return null;
    }
  };

  // Update channel volumes
  const handleVolumeChange = (id: string, newVolume: number) => {
    triggerHaptic(5);
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, volume: newVolume } : c))
    );

    const activeNode = activeNodesRef.current[id];
    if (activeNode) {
      const dbMultiplier = newVolume / 100;
      // Exponential feeling mapping
      activeNode.gainNode.gain.setTargetAtTime(dbMultiplier * dbMultiplier, audioCtxRef.current!.currentTime, 0.1);
    }
  };

  // Master Volume update
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      const targetVol = masterVolume / 100;
      masterGainRef.current.gain.setTargetAtTime(targetVol, audioCtxRef.current.currentTime, 0.15);
    }
  }, [masterVolume]);

  // Clean elements and stop synthesizer nodes safely
  const stopChannelNode = (channelId: string) => {
    const nodeData = activeNodesRef.current[channelId];
    if (!nodeData) return;

    try {
      nodeData.sources.forEach((src) => {
        if ("isInterval" in src) {
          clearInterval(src.intervalId as any);
        } else {
          try {
            src.stop();
            src.disconnect();
          } catch(e) {}
        }
      });
      nodeData.gainNode.disconnect();
    } catch (e) {
      console.warn("Error stopping nodes on channel cleanup: ", e);
    }

    delete activeNodesRef.current[channelId];
  };

  // Start synthesis nodes in real-time
  const startChannelNode = (ctx: AudioContext, channel: SoundscapeChannel) => {
    stopChannelNode(channel.id); // Guard against duplicates

    const chanGain = ctx.createGain();
    const dbMultiplier = channel.volume / 100;
    chanGain.gain.setValueAtTime(dbMultiplier * dbMultiplier, ctx.currentTime);
    chanGain.connect(masterGainRef.current!);

    const sources: (AudioScheduledSourceNode | IntervalRefContainer)[] = [];

    if (channel.synthType === "rain") {
      // Pink noise + moderate lowpass filtering mapping
      const pinkBuffer = getPinkNoiseBuffer(ctx);
      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = pinkBuffer;
      sourceNode.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(950, ctx.currentTime);

      // Connect: Buffer -> Filter -> Gain node
      sourceNode.connect(filter);
      filter.connect(chanGain);
      
      sourceNode.start(0);
      sources.push(sourceNode);

    } else if (channel.synthType === "fire") {
      // Fire requires a base rumbling brownian hum plus rapid cracking click bursts
      const brownBuffer = getBrownNoiseBuffer(ctx);
      const rumbleSource = ctx.createBufferSource();
      rumbleSource.buffer = brownBuffer;
      rumbleSource.loop = true;

      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = "lowpass";
      rumbleFilter.frequency.setValueAtTime(140, ctx.currentTime);

      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(chanGain);
      rumbleSource.start(0);
      sources.push(rumbleSource);

      // Sparkles trigger interval schedules
      const clickBuf = getClickBuffer(ctx);
      const crackleInterval = setInterval(() => {
        // Randomly skip clicks to make it sound organic and non-repetitive
        if (Math.random() > 0.45) {
          try {
            if (ctx.state === "closed" || ctx.state === "suspended") return;
            const clickSrc = ctx.createBufferSource();
            clickSrc.buffer = clickBuf;

            // Random pitch adjustment to simulate wood of different sizes
            clickSrc.playbackRate.setValueAtTime(0.75 + Math.random() * 0.9, ctx.currentTime);

            const clickFilter = ctx.createBiquadFilter();
            clickFilter.type = "bandpass";
            clickFilter.frequency.setValueAtTime(1200 + Math.random() * 2500, ctx.currentTime);
            clickFilter.Q.setValueAtTime(1.5, ctx.currentTime);

            // Click specific mini gain with fluctuating random velocity
            const clickGain = ctx.createGain();
            const strength = 0.05 + Math.random() * 0.35;
            clickGain.gain.setValueAtTime(strength, ctx.currentTime);

            clickSrc.connect(clickFilter);
            clickFilter.connect(clickGain);
            clickGain.connect(chanGain);

            clickSrc.start(0);
          } catch (err) {}
        }
      }, 160);

      sources.push({ isInterval: true, intervalId: crackleInterval });

    } else if (channel.synthType === "waves") {
      // Lowpass brownian noise sweeped slowly by an LFO to simulate rolling water
      const brownBuffer = getBrownNoiseBuffer(ctx);
      const waveSource = ctx.createBufferSource();
      waveSource.buffer = brownBuffer;
      waveSource.loop = true;

      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = "lowpass";
      waveFilter.frequency.setValueAtTime(250, ctx.currentTime);

      // Slow sweeping LFO
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.setValueAtTime(0.08, ctx.currentTime); // 12-second wave period

      // LFO Gain to sweep frequency around a center point
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(450, ctx.currentTime); // sweep width: +/-450Hz

      // Connections: Web Audio automation parameter connects
      lfo.connect(lfoGain);
      lfoGain.connect(waveFilter.frequency); // connect LFO to filter frequency parameter!

      waveSource.connect(waveFilter);
      waveFilter.connect(chanGain);

      lfo.start(0);
      waveSource.start(0);

      sources.push(lfo);
      sources.push(waveSource);

    } else if (channel.synthType === "vinyl") {
      // Vintage background hiss (bandpassed pink noise) + periodic dust scratch clicks
      const pinkBuffer = getPinkNoiseBuffer(ctx);
      const hissSource = ctx.createBufferSource();
      hissSource.buffer = pinkBuffer;
      hissSource.loop = true;

      const hissFilter = ctx.createBiquadFilter();
      hissFilter.type = "bandpass";
      hissFilter.frequency.setValueAtTime(1900, ctx.currentTime);
      hissFilter.Q.setValueAtTime(0.8, ctx.currentTime);

      const hissGain = ctx.createGain();
      hissGain.gain.setValueAtTime(0.08, ctx.currentTime); // very subtle constant hiss

      hissSource.connect(hissFilter);
      hissFilter.connect(hissGain);
      hissGain.connect(chanGain);

      hissSource.start(0);
      sources.push(hissSource);

      // vinyl groove crackle intervals (runs about once per rotation cycle -> ~1.8s)
      const crackleBuf = getClickBuffer(ctx);
      const vinylInterval = setInterval(() => {
        try {
          // Subtle dust scratches
          const rotationPopsCount = Math.floor(Math.random() * 3) + 1;
          for (let p = 0; p < rotationPopsCount; p++) {
            const delayOffset = Math.random() * 400; // staggering offsets
            setTimeout(() => {
              try {
                if (audioCtxRef.current && audioCtxRef.current.state !== "closed" && audioCtxRef.current.state !== "suspended" && activeNodesRef.current["vinyl"]) {
                  const clickSrc = audioCtxRef.current.createBufferSource();
                  clickSrc.buffer = crackleBuf;
                  clickSrc.playbackRate.setValueAtTime(0.45 + Math.random() * 0.45, audioCtxRef.current.currentTime);

                  const clickFilter = audioCtxRef.current.createBiquadFilter();
                  clickFilter.type = "lowpass";
                  clickFilter.frequency.setValueAtTime(800 + Math.random() * 1200, audioCtxRef.current.currentTime);

                  const clickGain = audioCtxRef.current.createGain();
                  clickGain.gain.setValueAtTime(0.02 + Math.random() * 0.08, audioCtxRef.current.currentTime);

                  clickSrc.connect(clickFilter);
                  clickFilter.connect(clickGain);
                  // Connect back to the channel gain
                  clickGain.connect(chanGain);

                  clickSrc.start(0);
                }
              } catch (err) {
                console.warn("Subtle dust scratch failed", err);
              }
            }, delayOffset);
          }
        } catch(e) {}
      }, 1800);

      sources.push({ isInterval: true, intervalId: vinylInterval });

    } else if (channel.synthType === "drone") {
      // Cosmic celestial deep organ-like sine drone
      const frequencies = [55, 110, 165]; // Ground G chord
      const droneGains: GainNode[] = [];

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 2 ? "triangle" : "sine"; // triangle adds richer warm harmonics
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const oscGain = ctx.createGain();
        // Base low level scaling
        const baseLevel = idx === 0 ? 0.35 : idx === 1 ? 0.25 : 0.15;
        oscGain.gain.setValueAtTime(baseLevel, ctx.currentTime);

        // Connect oscillator -> osc gain -> channel main gain
        osc.connect(oscGain);
        oscGain.connect(chanGain);

        osc.start(0);
        sources.push(osc);
        droneGains.push(oscGain);
      });

      // Slowly sweep oscillation volumes to make the celestial drone move over time
      const droneInterval = setInterval(() => {
        if (audioCtxRef.current) {
          const now = audioCtxRef.current.currentTime;
          // Slowly automate gains up and down
          try {
            droneGains.forEach((gNode, idx) => {
              const modulationVal = (idx === 0 ? 0.35 : idx === 1 ? 0.25 : 0.15) * (0.6 + Math.sin(now * (0.05 * (idx + 1))) * 0.4);
              gNode.gain.setTargetAtTime(modulationVal, now, 1.2);
            });
          } catch(e) {}
        }
      }, 1000);

      sources.push({ isInterval: true, intervalId: droneInterval });
    }

    // Save so we can adjust properties on the fly or stop properly
    activeNodesRef.current[channel.id] = {
      gainNode: chanGain,
      sources,
    };
  };

  // Toggle channel button
  const handleToggleChannel = (id: string) => {
    triggerHaptic(20);

    // Initialise audio on very first user interaction
    let currentCtx = audioCtxRef.current;
    if (!currentCtx) {
      currentCtx = initAudioCtx();
    }

    // Resume if suspended by browser security policy
    if (currentCtx && currentCtx.state === "suspended") {
      currentCtx.resume();
    }

    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const targetActive = !c.active;
          if (targetActive && currentCtx) {
            startChannelNode(currentCtx, c);
          } else {
            stopChannelNode(c.id);
          }
          return { ...c, active: targetActive };
        }
        return c;
      })
    );
  };

  // Trigger specific environment preset configurations (presets of ambient fields)
  const applyMacroPreset = (presetType: "rainy_evening" | "stars_camp" | "deep_focus" | "pure_zen") => {
    triggerHaptic(30);

    let currentCtx = audioCtxRef.current;
    if (!currentCtx) {
      currentCtx = initAudioCtx();
    }

    if (currentCtx && currentCtx.state === "suspended") {
      currentCtx.resume();
    }

    // Clean all actively playing elements first
    channels.forEach((c) => stopChannelNode(c.id));

    // Preset mapping
    const presetValues: { [key: string]: { active: boolean; volume: number } } = {};
    
    switch (presetType) {
      case "rainy_evening":
        presetValues["rain"] = { active: true, volume: 55 };
        presetValues["vinyl"] = { active: true, volume: 40 };
        presetValues["fire"] = { active: false, volume: 30 };
        presetValues["waves"] = { active: false, volume: 45 };
        presetValues["drone"] = { active: false, volume: 20 };
        break;
      case "stars_camp":
        presetValues["fire"] = { active: true, volume: 50 };
        presetValues["drone"] = { active: true, volume: 35 };
        presetValues["waves"] = { active: false, volume: 45 };
        presetValues["rain"] = { active: false, volume: 40 };
        presetValues["vinyl"] = { active: false, volume: 25 };
        break;
      case "deep_focus":
        presetValues["rain"] = { active: true, volume: 40 };
        presetValues["drone"] = { active: true, volume: 45 };
        presetValues["waves"] = { active: false, volume: 45 };
        presetValues["fire"] = { active: false, volume: 30 };
        presetValues["vinyl"] = { active: false, volume: 25 };
        break;
      case "pure_zen":
        presetValues["waves"] = { active: true, volume: 50 };
        presetValues["rain"] = { active: true, volume: 25 };
        presetValues["drone"] = { active: true, volume: 25 };
        presetValues["fire"] = { active: false, volume: 30 };
        presetValues["vinyl"] = { active: false, volume: 20 };
        break;
    }

    setChannels((prev) =>
      prev.map((c) => {
        const setVal = presetValues[c.id];
        if (setVal) {
          const updatedChannel = { ...c, active: setVal.active, volume: setVal.volume };
          if (setVal.active && currentCtx) {
            startChannelNode(currentCtx, updatedChannel);
          }
          return updatedChannel;
        }
        return c;
      })
    );
  };

  // Clean-up synthesis nodes on unmount to prevent leaks and clipping
  useEffect(() => {
    return () => {
      // Loop objects and stop everything
      Object.keys(activeNodesRef.current).forEach((key) => {
        try {
          stopChannelNode(key);
        } catch(e) {}
      });
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  return (
    <div id="soundscape-mixer-card" className="bg-zinc-900/35 border border-zinc-850/70 p-4 md:p-6 rounded-2xl flex flex-col gap-5 relative overflow-hidden shadow-xl">
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-amber-500/5 to-purple-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header section with active light indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-mono font-bold text-zinc-300 tracking-wider uppercase flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${audioInitialized ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${audioInitialized ? "bg-emerald-500" : "bg-amber-500"}`}></span>
              </span>
              Атмосферный Микшер Звуков
            </h3>
            <span className="text-[9px] bg-zinc-950 text-zinc-400 font-mono font-black border border-zinc-850 px-1.5 py-0.5 rounded tracking-widest uppercase">
              100% OFF-LINE
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug max-w-xl">
            Смешивайте процедурные фоновые текстуры природы с любимой музыкой! Фильтры и колебания синтезируются прямо в вашем браузере, без нагрузки на интернет.
          </p>
        </div>

        {/* Preset quick buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => applyMacroPreset("rainy_evening")}
            className="text-[10px] bg-zinc-950/70 hover:bg-zinc-950 text-zinc-300 hover:text-sky-400 border border-zinc-850 px-2.5 py-1.5 rounded-full transition-all active:scale-95"
          >
            🌧️ Вечерний дожд
          </button>
          <button
            onClick={() => applyMacroPreset("stars_camp")}
            className="text-[10px] bg-zinc-950/70 hover:bg-zinc-950 text-zinc-300 hover:text-amber-400 border border-zinc-850 px-2.5 py-1.5 rounded-full transition-all active:scale-95"
          >
            🔥 У костра
          </button>
          <button
            onClick={() => applyMacroPreset("deep_focus")}
            className="text-[10px] bg-zinc-950/70 hover:bg-zinc-950 text-zinc-300 hover:text-violet-400 border border-zinc-850 px-2.5 py-1.5 rounded-full transition-all active:scale-95"
          >
            🧘 Глубокий фокус
          </button>
          <button
            onClick={() => applyMacroPreset("pure_zen")}
            className="text-[10px] bg-zinc-950/70 hover:bg-zinc-950 text-zinc-300 hover:text-teal-400 border border-zinc-850 px-2.5 py-1.5 rounded-full transition-all active:scale-95"
          >
            🌊 Чистый дзен
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="p-3 bg-red-950/30 border border-red-900/30 rounded-xl text-xs text-red-400 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {/* Main Channel Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative z-10">
        {channels.map((chan) => {
          const IconComponent = chan.icon;
          return (
            <div
              key={chan.id}
              className={`p-3 bg-zinc-950/30 rounded-xl border border-zinc-900 flex md:flex-col justify-between md:justify-center items-center gap-3.5 transition-all relative overflow-hidden group ${
                chan.active ? "border-zinc-800/80 bg-zinc-900/20" : "hover:border-zinc-850"
              }`}
            >
              <div className="flex items-center gap-3 md:flex-col md:text-center w-full md:w-auto">
                <button
                  onClick={() => handleToggleChannel(chan.id)}
                  style={{
                    backgroundColor: chan.active ? chan.accentBg : undefined,
                    color: chan.active ? chan.accentColor : undefined,
                  }}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all shrink-0 active:scale-90 relative ${
                    chan.active
                      ? "border-current shadow-sm"
                      : "bg-zinc-900/60 border-zinc-850 text-zinc-400 hover:text-zinc-200 group-hover:border-zinc-800"
                  }`}
                  title={chan.active ? "Выключить" : "Включить"}
                >
                  <IconComponent className={`w-5 h-5 ${chan.active && chan.id === "vinyl" ? "animate-spin [animation-duration:4s]" : chan.active ? "animate-pulse" : ""}`} />
                  {chan.active && (
                    <span 
                      style={{ backgroundColor: chan.accentColor }}
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" 
                    />
                  )}
                </button>
                <div className="text-left md:text-center min-w-0 flex-1 md:flex-initial">
                  <p className="text-[12px] font-bold text-zinc-200 truncate">{chan.russianName}</p>
                  <p className="text-[10px] text-zinc-500 font-mono truncate lowercase">{chan.name}</p>
                </div>
              </div>

              {/* Slider for volume mixing */}
              <div className="flex items-center gap-2 w-1/2 md:w-full shrink-0">
                <Sliders className="w-3 h-3 text-zinc-650 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={chan.volume}
                  disabled={!chan.active}
                  onChange={(e) => handleVolumeChange(chan.id, parseInt(e.target.value))}
                  style={{
                    accentColor: chan.active ? chan.accentColor : "#4b5563",
                  }}
                  className={`w-full h-1 rounded cursor-pointer transition-opacity ${
                    chan.active ? "opacity-100" : "opacity-30 cursor-not-allowed"
                  }`}
                />
                <span className="text-[9px] font-mono font-bold text-zinc-550 w-6 text-right">
                  {chan.volume}%
                </span>
              </div>
              
              {/* Active channel soundscape glowing progress underline */}
              {chan.active && (
                <div 
                  style={{ backgroundColor: chan.accentColor }}
                  className="absolute bottom-0 left-0 right-0 h-0.5 opacity-60 animate-pulse"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Master Volume Controller section */}
      <div className="pt-3 border-t border-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-zinc-500 relative z-10">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-zinc-400" />
          <span className="font-mono uppercase font-semibold">Громкость эмбиента (Master):</span>
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={(e) => {
              triggerHaptic(5);
              setMasterVolume(parseInt(e.target.value));
            }}
            className="w-32 h-1 bg-zinc-850 accent-amber-500 rounded cursor-pointer"
          />
          <span className="font-mono font-bold text-amber-500 text-xs w-8">{masterVolume}%</span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 text-right bg-zinc-950/40 px-3 py-1.5 rounded-full border border-zinc-900/40 w-fit self-end sm:self-auto">
          <span>Синтез: <strong>Web Audio API Stereo Oscillators</strong></span>
          <span>•</span>
          <span>Эффекты: <strong>24bit LPF/BPF Sweep</strong></span>
        </div>
      </div>
    </div>
  );
}
