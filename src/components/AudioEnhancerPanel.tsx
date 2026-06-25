/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Sliders, Zap, Sparkles, Volume2, ShieldCheck, Flame, Cpu, Eye, Info, X } from "lucide-react";

interface AudioEnhancerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  volume: number;
  setVolume: (val: number) => void;
  isEnhanced: boolean;
  setIsEnhanced: (val: boolean) => void;
  forceBackgroundPlayback: boolean;
  setForceBackgroundPlayback: (val: boolean) => void;
}

type AudioPreset = "tubewarm" | "spatial" | "bassboost" | "audiophile";

export default function AudioEnhancerPanel({
  isOpen,
  onClose,
  isPlaying,
  volume,
  setVolume,
  isEnhanced,
  setIsEnhanced,
  forceBackgroundPlayback,
  setForceBackgroundPlayback,
}: AudioEnhancerPanelProps) {
  const [preset, setPreset] = useState<AudioPreset>("tubewarm");
  const [analogGain, setAnalogGain] = useState<number>(6.5); // in dB
  const [vacuumWarmth, setVacuumWarmth] = useState<number>(75); // 0 - 100%
  const [acousticWidth, setAcousticWidth] = useState<number>(60); // 3D Spatial Width %
  const [systemSafety, setSystemSafety] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Small haptic pulse for Android
  const triggerHaptic = (ms = 15) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  };

  // Preset quick templates
  const applyPreset = (selected: AudioPreset) => {
    triggerHaptic(25);
    setPreset(selected);
    if (!isEnhanced) setIsEnhanced(true);

    switch (selected) {
      case "tubewarm":
        setAnalogGain(4.8);
        setVacuumWarmth(90);
        setAcousticWidth(40);
        break;
      case "spatial":
        setAnalogGain(5.5);
        setVacuumWarmth(55);
        setAcousticWidth(95);
        break;
      case "bassboost":
        setAnalogGain(9.2);
        setVacuumWarmth(80);
        setAcousticWidth(50);
        break;
      case "audiophile":
        setAnalogGain(3.1);
        setVacuumWarmth(45);
        setAcousticWidth(70);
        break;
    }
  };

  // Draw simulated hardware visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio);
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Sizing responsiveness
      if (canvas.width !== canvas.offsetWidth * window.devicePixelRatio) {
        width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      }

      // Base line styling
      ctx.lineWidth = 2.5 * window.devicePixelRatio;
      ctx.shadowBlur = 15;
      
      const lines = 3;
      const amplitudeFactor = isPlaying ? (isEnhanced ? 0.45 : 0.18) : 0.02;
      const waveSpeed = isEnhanced ? 0.08 : 0.03;
      phase += waveSpeed;

      for (let i = 0; i < lines; i++) {
        // Sophisticated multi-harmonic curves simulating premium tube sound frequencies
        ctx.beginPath();
        
        // Gradient assignment
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        if (isEnhanced) {
          if (preset === "tubewarm") {
            grad.addColorStop(0, "rgba(253, 59, 106, 0.15)"); // Radio Ava Pink warmth
            grad.addColorStop(0.5, "rgba(253, 59, 106, 0.9)");
            grad.addColorStop(1, "rgba(253, 59, 106, 0.15)");
            ctx.strokeStyle = grad;
            ctx.shadowColor = "rgba(253, 59, 106, 0.45)";
          } else if (preset === "bassboost") {
            grad.addColorStop(0, "rgba(254, 104, 70, 0.15)"); // Sunset Orange bass power
            grad.addColorStop(0.5, "rgba(254, 104, 70, 0.95)");
            grad.addColorStop(1, "rgba(254, 104, 70, 0.15)");
            ctx.strokeStyle = grad;
            ctx.shadowColor = "rgba(254, 104, 70, 0.45)";
          } else {
            grad.addColorStop(0, "rgba(139, 92, 246, 0.15)"); // Purple/Teal spatial
            grad.addColorStop(0.5, "rgba(139, 92, 246, 0.9)");
            grad.addColorStop(1, "rgba(139, 92, 246, 0.15)");
            ctx.strokeStyle = grad;
            ctx.shadowColor = "rgba(139, 92, 246, 0.45)";
          }
        } else {
          grad.addColorStop(0, "rgba(82, 82, 91, 0.15)"); // Zinc neutral
          grad.addColorStop(0.5, "rgba(161, 161, 170, 0.6)");
          grad.addColorStop(1, "rgba(82, 82, 91, 0.15)");
          ctx.strokeStyle = grad;
          ctx.shadowColor = "rgba(161, 161, 175, 0.15)";
        }

        for (let x = 0; x < width; x += 3) {
          const relativeX = x / width;
          // Clean windowing function to keep waves within visual boundary gracefully
          const envelope = Math.sin(relativeX * Math.PI);
          
          // Harmonic combination
          const harmonic1 = Math.sin(relativeX * Math.PI * 2.5 + phase + i * 1.5);
          const harmonic2 = Math.cos(relativeX * Math.PI * 5 - phase * 1.2 + i * 0.8) * 0.4;
          const harmonic3 = Math.sin(relativeX * Math.PI * 8.5 + phase * 2.1) * 0.15;
          
          const y = (height / 2) + 
            (harmonic1 + harmonic2 + harmonic3) * 
            (height * amplitudeFactor) * 
            envelope * 
            (1 + analogGain / 15);

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isEnhanced, preset, analogGain]);

  if (!isOpen) return null;

  // Handle outside click dismissal
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      triggerHaptic(20);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn select-none overflow-y-auto"
      onClick={handleOverlayClick}
    >
      <div 
        className="w-full max-w-lg rounded-2xl hifi-brushed-metal border border-zinc-800/80 p-6 md:p-8 flex flex-col gap-6 relative shadow-2xl scale-100 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#fd3b6a]/10 border border-[#fd3b6a]/20 text-[#fd3b6a] shadow-inner">
              <Sliders className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight font-display text-zinc-100">Hi-Fi Preamp</h2>
                <span className="text-[10px] bg-[#fd3b6a]/20 text-[#fd3b6a] font-mono font-bold px-1.5 py-0.5 rounded-full uppercase border border-[#fd3b6a]/40 tracking-wider">
                  LD-Class А
                </span>
              </div>
              <p className="text-xs text-zinc-400">Аналоговый усилитель звука в реальном времени</p>
            </div>
          </div>

          <button 
            onClick={() => {
              triggerHaptic(20);
              onClose();
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-900/80 hover:bg-zinc-850 hover:text-white text-zinc-400 transition-colors border border-zinc-800"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Oscilloscope Visualizer Card */}
        <div className="w-full h-24 bg-black/90 rounded-xl border border-zinc-900 relative overflow-hidden flex flex-col select-none">
          {/* Hardware grid overlay */}
          <div className="absolute inset-0 hifi-carbon-pattern opacity-10 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-950/20 via-transparent to-black pointer-events-none"></div>
          
          <canvas ref={canvasRef} className="w-full h-full relative z-10" />

          {/* Oscilloscope Grid Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
            <div className="w-full border-b border-dashed border-zinc-800"></div>
            <div className="w-full border-b border-dashed border-zinc-800"></div>
            <div className="w-full border-b border-dashed border-zinc-800"></div>
          </div>

          {/* Decibel Level Indicators */}
          <div className="absolute top-1 right-2 z-20 font-mono text-[8px] text-zinc-500 flex gap-2">
            <span>PEAK LEVEL: {(analogGain + 1.2).toFixed(1)} dB</span>
            <span className={isEnhanced ? "text-[#fd3b6a] font-bold" : "text-zinc-650"}>
              {isEnhanced ? "ENHANCED" : "BYPASS"}
            </span>
          </div>
        </div>

        {/* Master Power Lever Button */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 shadow-inner">
          <div className="flex items-center gap-3">
            <Zap className={`w-5 h-5 ${isEnhanced ? "text-[#fd3b6a] animate-pulse fill-[#fd3b6a]" : "text-zinc-600"}`} />
            <div>
              <p className="text-sm font-semibold text-zinc-200">Аппаратное улучшение</p>
              <p className="text-[11px] text-zinc-500">Повышение кристальности звука и ламповые гармоники</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              triggerHaptic(40);
              setIsEnhanced(!isEnhanced);
            }}
            className={`w-14 h-8 rounded-full transition-all duration-300 relative flex items-center p-1 cursor-pointer ${
              isEnhanced ? "bg-[#fd3b6a] shadow shadow-[#fd3b6a]/50" : "bg-zinc-800"
            }`}
          >
            <div className={`w-6 h-6 rounded-full bg-zinc-950 shadow-md transform transition-transform duration-300 flex items-center justify-center ${
              isEnhanced ? "translate-x-6" : "translate-x-0"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isEnhanced ? "bg-[#fd3b6a]" : "bg-zinc-650"}`} />
            </div>
          </button>
        </div>

        {/* Background Playback & Lock Screen Controls (APK/WebView/PWA) */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/60 border border-zinc-900 shadow-inner">
          <div className="flex items-center gap-3">
            <span className="p-1 rounded bg-zinc-900 text-zinc-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-200">Фоновый режим (APK/WebView)</p>
              <p className="text-[11px] text-zinc-500">Позволяет играть музыку на заблокированном экране</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              triggerHaptic(40);
              setForceBackgroundPlayback(!forceBackgroundPlayback);
            }}
            className={`w-14 h-8 rounded-full transition-all duration-300 relative flex items-center p-1 cursor-pointer ${
              forceBackgroundPlayback ? "bg-[#fd3b6a] shadow shadow-zinc-950/50" : "bg-zinc-800"
            }`}
          >
            <div className={`w-6 h-6 rounded-full bg-zinc-950 shadow-md transform transition-transform duration-300 flex items-center justify-center ${
              forceBackgroundPlayback ? "translate-x-6" : "translate-x-0"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${forceBackgroundPlayback ? "bg-[#fd3b6a]" : "bg-zinc-650"}`} />
            </div>
          </button>
        </div>

        {/* Physical Presets Grid: Radiogram style */}
        <div className="space-y-2.5">
          <label className="text-xs font-mono font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-[#fd3b6a]" />
            Улучшенные Пресеты Звука
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: "tubewarm", name: "Теплый Ламповый", desc: "Гармоники 2-го порядка", icon: Flame, color: "hover:border-[#fd3b6a]/30 text-[#fd3b6a] bg-[#fd3b6a]/5 border-[#fd3b6a]/10" },
              { id: "spatial", name: "3D Окружение", desc: "Расширенная стерео база", icon: Sparkles, color: "hover:border-cyan-500/30 text-cyan-400 bg-cyan-500/5 border-cyan-950" },
              { id: "bassboost", name: "Супер Бас Pro", desc: "Ударные низкие частоты", icon: Volume2, color: "hover:border-rose-500/30 text-rose-400 bg-rose-500/5 border-rose-950" },
              { id: "audiophile", name: "Аудиофил Мастер", desc: "Ровная кривая АЧХ", icon: Sliders, color: "hover:border-[#fd3b6a]/30 text-pink-400 bg-[#fd3b6a]/5 border-[#fd3b6a]/10" },
            ].map((p) => {
              const active = preset === p.id && isEnhanced;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id as AudioPreset)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    active 
                      ? "bg-zinc-900 border-[#fd3b6a] shadow-md radio-card-glow" 
                      : "bg-zinc-900/30 border-zinc-850 hover:bg-zinc-900/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p.icon className={`w-4 h-4 ${active ? "text-[#fd3b6a]" : "text-zinc-450"}`} />
                    <span className={`text-xs font-bold leading-tight ${active ? "text-zinc-100" : "text-zinc-400"}`}>
                       {p.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1 truncate">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Vacuum Tubes glow display */}
        {isEnhanced && (
          <div className="p-3.5 rounded-xl border border-[#fd3b6a]/10 bg-[#fd3b6a]/5 flex flex-col gap-2.5 items-center justify-center">
            <p className="text-[10px] font-mono font-bold text-zinc-400 tracking-wider text-center uppercase">
              Ламповый Тракт (Analog Tube Stage)
            </p>
            <div className="flex gap-6 items-end py-2">
              {/* Vacuum Valve tube Left */}
              <div className="flex flex-col items-center">
                <div className="relative w-10 h-16 border-2 border-zinc-800 rounded-t-full flex justify-center bg-zinc-950/80 shadow-md">
                  {/* Glowing core filament */}
                  <div 
                    style={{ 
                      opacity: isPlaying ? 0.3 + (vacuumWarmth / 140) : 0.25,
                      filter: `blur(${11 - (vacuumWarmth / 10)}px)`
                    }}
                    className="absolute bottom-2 top-3 w-5 bg-[#fd3b6a] rounded-full animate-tubeHeat"
                  />
                  {/* Grid wire inside tube */}
                  <div className="absolute top-5 h-7 w-4 border border-zinc-700/60 border-t-0 rounded-b opacity-50"></div>
                  <div className="absolute top-2 w-0.5 h-10 bg-zinc-650 opacity-40"></div>
                </div>
                <span className="text-[8px] font-mono text-zinc-500 mt-1">ТРАКТ L</span>
              </div>

              {/* Vacuum Valve tube Right */}
              <div className="flex flex-col items-center">
                <div className="relative w-10 h-16 border-2 border-zinc-800 rounded-t-full flex justify-center bg-zinc-950/80 shadow-md">
                  {/* Glowing core filament */}
                  <div 
                    style={{ 
                      opacity: isPlaying ? 0.3 + (vacuumWarmth / 140) : 0.25,
                      filter: `blur(${11 - (vacuumWarmth / 10)}px)`
                    }}
                    className="absolute bottom-2 top-3 w-5 bg-[#fd3b6a] rounded-full animate-tubeHeat"
                  />
                  {/* Grid wire inside tube */}
                  <div className="absolute top-5 h-7 w-4 border border-zinc-700/60 border-t-0 rounded-b opacity-50"></div>
                  <div className="absolute top-2 w-0.5 h-10 bg-zinc-650 opacity-40"></div>
                </div>
                <span className="text-[8px] font-mono text-zinc-500 mt-1">ТРАКТ R</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 italic text-center">
              Стабилизация тока покоя: <span className="text-[#fd3b6a] font-mono">1.25А</span> • Насыщение: <span className="text-[#fd3b6a] font-mono">{(vacuumWarmth * 0.45).toFixed(1)}%</span>
            </p>
          </div>
        )}

        {/* Faders / Regulators Section */}
        <div className="space-y-4">
          {/* Fader 1: Dynamic Gain db */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400 uppercase">Усиление (Volume Boost)</span>
              <span className="text-[#fd3b6a] font-black font-mono">+{analogGain.toFixed(1)} dB</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="15"
              step="0.1"
              value={analogGain}
              onChange={(e) => {
                triggerHaptic(10);
                setAnalogGain(parseFloat(e.target.value));
                if (!isEnhanced) setIsEnhanced(true);
              }}
              className="w-full h-1 bg-zinc-850 accent-[#fd3b6a] rounded"
            />
          </div>

          {/* Fader 2: Tube warmth */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400 uppercase">Теплота Насыщения</span>
              <span className="text-[#fd3b6a] font-black font-mono">{vacuumWarmth}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={vacuumWarmth}
              onChange={(e) => {
                triggerHaptic(10);
                setVacuumWarmth(parseInt(e.target.value));
                if (!isEnhanced) setIsEnhanced(true);
              }}
              className="w-full h-1 bg-zinc-850 accent-[#fd3b6a] rounded"
            />
          </div>

          {/* Fader 3: Space width */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400 uppercase">Пространственная База</span>
              <span className="text-[#fd3b6a] font-black font-mono">{acousticWidth}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={acousticWidth}
              onChange={(e) => {
                triggerHaptic(10);
                setAcousticWidth(parseInt(e.target.value));
                if (!isEnhanced) setIsEnhanced(true);
              }}
              className="w-full h-1 bg-zinc-850 accent-[#fd3b6a] rounded"
            />
          </div>
        </div>

        {/* Safety / Compliance footer */}
        <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#fd3b6a] shrink-0 animate-pulse" />
            <span>Защита слуха: <strong className="text-zinc-350">АКТИВНА</strong> (Ограничение до 95dB)</span>
          </div>
          <span className="font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
            AUDIO-DEC 24bit
          </span>
        </div>
      </div>
    </div>
  );
}
