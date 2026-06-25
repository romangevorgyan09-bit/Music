import React, { useEffect, useRef, useState } from "react";
import { Sliders, Activity, Sparkles, Orbit, Volume2 } from "lucide-react";

interface RealtimeVisualizerProps {
  isPlaying: boolean;
  isEnhanced: boolean;
  volume: number;
  currentSongId?: string;
  height?: number;
  showControls?: boolean;
}

type VisualizerMode = "bars" | "wave" | "circle";

interface VisualizerParams {
  bpm: number;
  barColor: string;
  glowColor: string;
  energy: number;
  waveCount: number;
  particleCount: number;
}

// Pseudorandom helper based on song ID to ensure songs have persistent distinct beat characters
function getSongVisualizerParams(songId: string | undefined): VisualizerParams {
  if (!songId) {
    return {
      bpm: 122,
      barColor: "rgba(245, 158, 11, 0.85)", // Amber
      glowColor: "rgba(245, 158, 11, 0.4)",
      energy: 1.0,
      waveCount: 3,
      particleCount: 20
    };
  }

  let hash = 0;
  for (let i = 0; i < songId.length; i++) {
    hash = songId.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const bpm = 100 + (hash % 38); // 100 to 138 BPM
  const waveCount = 2 + (hash % 3); // 2 to 4 waves
  const particleCount = 15 + (hash % 20); // 15 to 35 particles
  const energy = 0.85 + ((hash % 4) / 10); // 0.85 to 1.25 energy multiplier

  // Beautiful high-fidelity Radio Ava neon palettes: Hot Pink, Sunset Orange, Glowing Coral, Deep Violet, Warm Rose
  const palettes = [
    { bar: "rgba(253, 59, 106, 0.9)", glow: "rgba(253, 59, 106, 0.45)" },   // Radio Ava Hot Pink
    { bar: "rgba(254, 104, 70, 0.9)", glow: "rgba(254, 104, 70, 0.45)" },   // Sunset Orange
    { bar: "rgba(253, 90, 90, 0.9)", glow: "rgba(253, 90, 90, 0.4)" },     // Glowing Coral
    { bar: "rgba(139, 92, 246, 0.9)", glow: "rgba(139, 92, 246, 0.45)" },   // Royal Violet
    { bar: "rgba(244, 63, 94, 0.9)", glow: "rgba(244, 63, 94, 0.4)" }       // Warm Rose
  ];

  const palette = palettes[hash % palettes.length];

  return {
    bpm,
    barColor: palette.bar,
    glowColor: palette.glow,
    energy,
    waveCount,
    particleCount
  };
}

export default function RealtimeVisualizer({
  isPlaying,
  isEnhanced,
  volume,
  currentSongId,
  height = 90,
  showControls = true,
}: RealtimeVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>("bars");
  const animationFrameRef = useRef<number | null>(null);
  
  // Audio state parameters computed on song change
  const params = getSongVisualizerParams(currentSongId);
  const beatIntervalMs = (60 / params.bpm) * 1000;

  // Sound particle class for "orbit" mode
  const particlesRef = useRef<{ x: number; y: number; angle: number; speed: number; size: number; alpha: number; color: string }[]>([]);

  // Trigger brief micro-vibration feedback for tactile controls
  const triggerHaptic = (ms = 12) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {}
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio);
    let heightVal = (canvas.height = canvas.offsetHeight * window.devicePixelRatio);
    
    // Initialize or resize coordinates
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      heightVal = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    window.addEventListener("resize", handleResize);

    // Initializing particles list for Circle Pulse mode
    const numParticles = params.particleCount;
    const initialParticles = [];
    for (let i = 0; i < numParticles; i++) {
      initialParticles.push({
        x: 0,
        y: 0,
        angle: Math.random() * Math.PI * 2,
        speed: 1 + Math.random() * 3,
        size: 1 + Math.random() * 3,
        alpha: Math.random() * 0.7 + 0.3,
        color: params.barColor,
      });
    }
    particlesRef.current = initialParticles;

    let phase = 0;
    let lastBeatTime = 0;
    let smoothBeatImpact = 0; // Decays over time, pulses on beat clock or progress

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, heightVal);

      // Sizing check
      if (canvas.width !== canvas.offsetWidth * window.devicePixelRatio) {
        width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        heightVal = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      }

      // Calculate beat pulses relative to time (BPM-synced)
      const isBeatPulse = isPlaying && (time - lastBeatTime >= beatIntervalMs);
      if (isBeatPulse) {
        lastBeatTime = time;
        smoothBeatImpact = 1.0; // Peak energy
      } else {
        smoothBeatImpact *= 0.92; // Decay factor per frame
      }

      // Phase changes based on BPM and high-res player state
      const speedCoeff = isPlaying ? (isEnhanced ? 0.08 : 0.045) : 0.005;
      phase += speedCoeff * params.energy;

      // Base scaling based on master volume & amplifier status
      const ampBase = isPlaying ? (isEnhanced ? 1.5 : 0.95) : 0.12;
      const volMultiplier = (volume / 100) * ampBase;

      // Draw different visualization patterns!
      if (mode === "bars") {
        // EQUALIZER PEAK COLS
        const barWidthCount = Math.floor(24 + (width > 600 ? 16 : 0)); // more bars on desktop
        const padding = 3 * window.devicePixelRatio;
        const totalPadding = padding * (barWidthCount - 1);
        const singlBarWidth = (width - totalPadding) / barWidthCount;

        ctx.shadowBlur = isEnhanced ? 18 : 8;
        ctx.shadowColor = params.glowColor;

        for (let i = 0; i < barWidthCount; i++) {
          const indexRatio = i / barWidthCount;
          // Symmetric distribution curve simulating bass of equalizers on left/center, treble on right
          const centerFactor = 1.0 - Math.abs(indexRatio - 0.4) * 1.5;
          const bassMidTrebleWave = Math.sin(phase * 1.8 + i * 0.6) * 0.35 + 
                                     Math.sin(phase * 0.7 - i * 0.3) * 0.45;
          
          let noiseSparkle = Math.sin(time * 0.01 + i * 2.5) * 0.08;
          if (!isPlaying) noiseSparkle = 0;

          // React to beat impact mainly on low frequencies (first 40% of bands)
          const beatResponse = (indexRatio < 0.45) ? (smoothBeatImpact * 0.5 * params.energy) : (smoothBeatImpact * 0.15);

          // Calculate height
          const rawHeight = Math.max(
            0.05, 
            (bassMidTrebleWave + 0.65 + noiseSparkle + beatResponse) * centerFactor
          );
          
          const finalHeight = rawHeight * (heightVal * 0.75) * volMultiplier;
          
          const rx = i * (singlBarWidth + padding);
          const ry = heightVal - finalHeight;

          // Draw double styling (LED blocks or solid glowing bars)
          const grad = ctx.createLinearGradient(rx, ry, rx, heightVal);
          grad.addColorStop(0, params.barColor);
          if (isEnhanced) {
            grad.addColorStop(0.5, "rgba(253, 224, 71, 0.95)"); // brighter hot core
          }
          grad.addColorStop(1, "rgba(24, 24, 27, 0.2)");
          ctx.fillStyle = grad;

          // Rounded bars for slick look
          ctx.beginPath();
          ctx.roundRect(rx, ry, singlBarWidth, Math.max(2, finalHeight), [4 * window.devicePixelRatio, 4 * window.devicePixelRatio, 0, 0]);
          ctx.fill();

          // Standard analog dot peak for hi-res look
          if (isEnhanced && finalHeight > 5) {
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = "#ffffff";
            ctx.shadowBlur = 10;
            ctx.fillRect(rx, Math.max(0, ry - 3 * window.devicePixelRatio), singlBarWidth, 1.5 * window.devicePixelRatio);
            ctx.shadowColor = params.glowColor; // restore shadow
          }
        }
      } else if (mode === "wave") {
        // FLUID HARMONIC SINE RIBBON
        ctx.shadowBlur = isEnhanced ? 24 : 12;
        ctx.shadowColor = params.glowColor;
        ctx.lineWidth = (isEnhanced ? 3.5 : 2) * window.devicePixelRatio;

        const numWaves = params.waveCount;
        for (let w = 0; w < numWaves; w++) {
          ctx.beginPath();
          const wavePhaseOffset = w * Math.PI * 0.4;
          const waveHeightCoeff = 1.0 - (w * 0.25);
          
          const grad = ctx.createLinearGradient(0, 0, width, 0);
          grad.addColorStop(0, "rgba(24, 24, 27, 0)");
          grad.addColorStop(0.3, params.barColor);
          grad.addColorStop(0.7, params.barColor);
          grad.addColorStop(1, "rgba(24, 24, 27, 0)");
          ctx.strokeStyle = grad;

          for (let x = 0; x < width; x += 4) {
            const rxRatio = x / width;
            const envelope = Math.sin(rxRatio * Math.PI); // Windowing keep boundaries at zero
            
            // Complex wave combination
            const f1 = Math.sin(rxRatio * Math.PI * (2 + w) + phase + wavePhaseOffset);
            const f2 = Math.cos(rxRatio * Math.PI * 4.5 - phase * 1.5) * 0.35;
            
            // Beat bump
            const beatKick = smoothBeatImpact * 0.45 * Math.sin(rxRatio * Math.PI * 2) * params.energy;

            const y = (heightVal / 2) + 
              (f1 + f2 + beatKick) * (heightVal * 0.38) * volMultiplier * waveHeightCoeff * envelope;

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (mode === "circle") {
        // ADVANCED POLAR DISK & ORBIT PARTICLES
        const centerX = width / 2;
        const centerY = heightVal / 2;
        const baseRadius = Math.min(width, heightVal) * 0.22;
        
        ctx.shadowBlur = isEnhanced ? 25 : 12;
        ctx.shadowColor = params.glowColor;

        // Draw radial glowing gradient backdrop
        const radialBg = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius * 2);
        radialBg.addColorStop(0, "rgba(24, 24, 27, 0.25)");
        radialBg.addColorStop(1, "rgba(9, 9, 11, 0)");
        ctx.fillStyle = radialBg;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Pulsating center ring
        const pulseRatio = 1.0 + (smoothBeatImpact * 0.22 * params.energy * (volume / 100));
        const activeRadius = baseRadius * pulseRatio * (volume > 0 ? 1 : 0.85);

        // Circular frequency spectrum (64 sample points)
        const totalPoints = 64;
        ctx.beginPath();
        ctx.lineWidth = 1.8 * window.devicePixelRatio;
        ctx.strokeStyle = params.barColor;

        for (let pIdx = 0; pIdx < totalPoints; pIdx++) {
          const angle = (pIdx / totalPoints) * Math.PI * 2;
          const sampleFactor = Math.sin(phase * 1.5 + pIdx * 0.23) * 0.2 + 
                               Math.cos(phase * 0.8 - pIdx * 0.1) * 0.15;
          const ampVal = Math.max(0, sampleFactor + 0.3);

          const r = activeRadius + (ampVal * 32 * window.devicePixelRatio * volMultiplier);
          const px = centerX + Math.cos(angle) * r;
          const py = centerY + Math.sin(angle) * r;

          if (pIdx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Radial bars projecting outwards
        ctx.beginPath();
        ctx.lineWidth = 2.5 * window.devicePixelRatio;
        for (let pIdx = 0; pIdx < totalPoints; pIdx += 2) {
          const angle = (pIdx / totalPoints) * Math.PI * 2;
          const sampleFactor = Math.sin(phase * 2.2 + pIdx * 0.45) * 0.25 + 
                               Math.sin(phase * 0.9 - pIdx * 0.1) * 0.15;
          const ampVal = Math.max(0, sampleFactor + 0.2);

          const rStart = activeRadius - 4 * window.devicePixelRatio;
          const rEnd = activeRadius + (ampVal * 36 * window.devicePixelRatio * volMultiplier);
          
          const sx = centerX + Math.cos(angle) * rStart;
          const sy = centerY + Math.sin(angle) * rStart;
          const ex = centerX + Math.cos(angle) * rEnd;
          const ey = centerY + Math.sin(angle) * rEnd;

          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
        }
        ctx.stroke();

        // Particle space animation
        ctx.shadowBlur = 4;
        particlesRef.current.forEach((p) => {
          // Adjust velocity based on music playback and beats
          const currentSpeed = p.speed * (isPlaying ? (isEnhanced ? 1.8 : 1.25) : 0.15) * (1 + smoothBeatImpact * 0.5);
          p.angle += 0.005; // tiny rotation
          
          // Move outward from center
          const distOffset = currentSpeed * 1.2;
          const currentDist = Math.sqrt(p.x * p.x + p.y * p.y) || activeRadius;
          const nextDistVal = currentDist + distOffset;

          p.x = Math.cos(p.angle) * nextDistVal;
          p.y = Math.sin(p.angle) * nextDistVal;

          // Wrap particles when they float beyond canvas dimensions
          const maxDim = Math.max(width, heightVal);
          if (nextDistVal > maxDim * 0.6) {
            p.angle = Math.random() * Math.PI * 2;
            p.x = Math.cos(p.angle) * activeRadius;
            p.y = Math.sin(p.angle) * activeRadius;
            p.speed = 1.2 + Math.random() * 3.5;
            p.size = 1 + Math.random() * 2.5;
          }

          // Draw the stars / bubbles
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha * (volume > 0 ? (volume / 100) : 0.1);
          ctx.beginPath();
          ctx.arc(centerX + p.x, centerY + p.y, p.size * window.devicePixelRatio, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1.0; // reset transparency
      }

      // Draw active mode display overlay
      ctx.shadowBlur = 0; // reset
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render(performance.now());

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isEnhanced, volume, currentSongId, mode, beatIntervalMs, params]);

  const modes: { id: VisualizerMode; label: string; icon: any }[] = [
    { id: "bars", label: "EQ Спектр", icon: Activity },
    { id: "wave", label: "Волна ПАВы", icon: Sparkles },
    { id: "circle", label: "Окно Орбиты", icon: Orbit },
  ];

  return (
    <div className="flex flex-col gap-2 w-full h-full relative" id="hifi-visualizer-widget">
      {/* Visualizer Area */}
      <div 
        className="w-full relative rounded-xl bg-zinc-950/80 border border-zinc-900 overflow-hidden shadow-inner flex items-center justify-center self-stretch"
        style={{ height: `${height}px` }}
      >
        {/* Subtle grid background to look like hardware */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none z-0"></div>
        <canvas ref={canvasRef} className="w-full h-full relative z-10" />

        {/* Ambient status indicators */}
        <div className="absolute bottom-1 right-2.5 z-20 flex items-center gap-1.5 pointer-events-none text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
          <span className={`w-1 h-1 rounded-full ${isPlaying ? "bg-amber-500 animate-pulse" : "bg-zinc-700"}`}></span>
          <span>{isPlaying ? "Sync-Active" : "Ready"}</span>
          <span>|</span>
          <span className="text-[7.5px] font-bold text-amber-500/80">{mode}</span>
        </div>
      </div>

      {/* Tactile Control Buttons */}
      {showControls && (
        <div className="flex items-center justify-between gap-1 border-t border-zinc-900/60 pt-1 text-[10px]" id="visualizer-toggle-pills">
          <div className="flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-zinc-500 stroke-[1.5]" />
            <span className="font-mono text-zinc-500 uppercase font-semibold text-[8px] tracking-wide">ВИЗ Режим:</span>
          </div>

          <div className="flex gap-1">
            {modes.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    triggerHaptic(20);
                    setMode(m.id);
                  }}
                  title={m.label}
                  className={`px-2 py-0.5 rounded cursor-pointer text-[9px] font-medium font-mono border transition-all duration-150 flex items-center gap-1.5 leading-none ${
                    active
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-transparent text-zinc-500 border-zinc-900 hover:text-zinc-350 hover:bg-zinc-900/40"
                  }`}
                >
                  <Icon className={`w-2.5 h-2.5 ${active ? "animate-pulse" : ""}`} />
                  <span>{m.id.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
