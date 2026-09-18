import React, { useRef, useEffect } from 'react';
import { DeckID, TrackMetadata } from '../types/discdj';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

interface WaveformDisplayProps {
  deckId: DeckID;
  accentColor: string;
  label: string;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  deckId,
  accentColor,
  label,
}) => {
  const overviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null);

  // Static overview waveform drawing
  useEffect(() => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderOverview = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const track = discDjEngine.getDeckTrack(deckId);
      const transport = discDjEngine.getTransport(deckId);
      const loop = discDjEngine.getLoop(deckId);
      const cues = discDjEngine.getHotCues(deckId);
      const currentPos = discDjEngine.getCurrentPosition(deckId);
      const duration = transport.duration || 1;

      // Draw background
      ctx.fillStyle = '#0f1118';
      ctx.fillRect(0, 0, width, height);

      // Draw Waveform peaks if available
      if (track?.analysis) {
        const peaks = track.analysis.peaks;
        const low = track.analysis.lowPeaks;
        const mid = track.analysis.midPeaks;
        const high = track.analysis.highPeaks;
        const barWidth = width / peaks.length;

        for (let i = 0; i < peaks.length; i++) {
          const x = i * barWidth;
          const hTotal = peaks[i] * (height * 0.85);
          const yStart = (height - hTotal) / 2;

          // Multi-color frequency layers (Red Bass, Green Mids, Blue Highs)
          const hLow = low[i] * (height * 0.45);
          const hMid = mid[i] * (height * 0.35);
          const hHigh = high[i] * (height * 0.25);

          // Background mid/high
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, yStart, Math.max(1, barWidth - 0.5), hTotal);

          // Sub bass / kick in red/amber
          ctx.fillStyle = '#ef444499';
          ctx.fillRect(x, (height - hLow) / 2, Math.max(1, barWidth - 0.5), hLow);

          // Mids in green
          ctx.fillStyle = '#10b98188';
          ctx.fillRect(x, (height - hMid) / 2, Math.max(1, barWidth - 0.5), hMid);

          // Highs in cyan
          ctx.fillStyle = `${accentColor}cc`;
          ctx.fillRect(x, (height - hHigh) / 2, Math.max(1, barWidth - 0.5), hHigh);
        }
      } else {
        // Placeholder centerline
        ctx.strokeStyle = '#27272a';
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      // Draw Loop Region highlight
      if (loop.active && loop.loopIn !== null && loop.loopOut !== null) {
        const loopX1 = (loop.loopIn / duration) * width;
        const loopX2 = (loop.loopOut / duration) * width;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fillRect(loopX1, 0, Math.max(2, loopX2 - loopX1), height);
        ctx.strokeStyle = '#f59e0b';
        ctx.strokeRect(loopX1, 0, Math.max(2, loopX2 - loopX1), height);
      }

      // Draw Hot Cues markers
      cues.forEach((pos, idx) => {
        const cueX = (pos / duration) * width;
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(cueX - 1, 0, 2, height);
        ctx.fillStyle = '#818cf8';
        ctx.beginPath();
        ctx.moveTo(cueX - 4, 0);
        ctx.lineTo(cueX + 4, 0);
        ctx.lineTo(cueX, 6);
        ctx.fill();
      });

      // Draw Playhead line
      const playheadX = (currentPos / duration) * width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playheadX - 1, 0, 2, height);

      // Playhead top triangle
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 7);
      ctx.fill();

      animId = requestAnimationFrame(renderOverview);
    };

    animId = requestAnimationFrame(renderOverview);
    return () => cancelAnimationFrame(animId);
  }, [deckId, accentColor]);

  // Dynamic High-Speed Zoom Waveform drawing (Center Playhead)
  useEffect(() => {
    const canvas = zoomCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderZoom = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;

      ctx.clearRect(0, 0, width, height);

      const track = discDjEngine.getDeckTrack(deckId);
      const transport = discDjEngine.getTransport(deckId);
      const tempo = discDjEngine.getTempo(deckId);
      const loop = discDjEngine.getLoop(deckId);
      const currentPos = discDjEngine.getCurrentPosition(deckId);
      const duration = transport.duration || 1;

      // Dark background
      ctx.fillStyle = '#0b0c10';
      ctx.fillRect(0, 0, width, height);

      // 4 seconds visible across zoom window
      const visibleWindowSec = 4.0;
      const pxPerSec = width / visibleWindowSec;

      // Draw Beat Grid markers & Bars
      const bpm = tempo.effectiveBpm || 120;
      const beatSec = 60 / bpm;
      const firstVisibleSec = currentPos - (centerX / pxPerSec);
      const lastVisibleSec = currentPos + ((width - centerX) / pxPerSec);

      const firstBeatIndex = Math.floor(firstVisibleSec / beatSec);
      const lastBeatIndex = Math.ceil(lastVisibleSec / beatSec);

      for (let b = firstBeatIndex; b <= lastBeatIndex; b++) {
        const beatTime = b * beatSec;
        const x = centerX + (beatTime - currentPos) * pxPerSec;
        const isBar = b % 4 === 0;

        if (isBar) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();

          // Bar number indicator (e.g. 1.1, 2.1)
          const barNum = Math.floor(b / 4) + 1;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = '10px JetBrains Mono';
          ctx.fillText(`${barNum}.1`, x + 3, 12);
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 4);
          ctx.lineTo(x, height - 4);
          ctx.stroke();
        }
      }

      // Draw Audio Waveform in Zoom Window
      if (track?.analysis) {
        const peaks = track.analysis.peaks;
        const low = track.analysis.lowPeaks;
        const high = track.analysis.highPeaks;
        const totalPoints = peaks.length;

        // Sample rate of analysis peaks points
        const pointsPerSec = totalPoints / duration;

        for (let x = 0; x < width; x += 2) {
          const timeAtX = currentPos + ((x - centerX) / pxPerSec);
          if (timeAtX < 0 || timeAtX > duration) continue;

          const pointIdx = Math.floor(timeAtX * pointsPerSec);
          if (pointIdx >= 0 && pointIdx < totalPoints) {
            const peak = peaks[pointIdx];
            const h = peak * (height * 0.82);
            const y = (height - h) / 2;

            const lowH = low[pointIdx] * (height * 0.5);
            const highH = high[pointIdx] * (height * 0.3);

            // Mid energy base
            ctx.fillStyle = '#10b981aa';
            ctx.fillRect(x, y, 1.5, h);

            // Sub bass energy in red
            ctx.fillStyle = '#ef4444cc';
            ctx.fillRect(x, (height - lowH) / 2, 1.5, lowH);

            // High crisp energy in accent color
            ctx.fillStyle = `${accentColor}ee`;
            ctx.fillRect(x, (height - highH) / 2, 1.5, highH);
          }
        }
      }

      // Draw Loop Region in zoom window
      if (loop.active && loop.loopIn !== null && loop.loopOut !== null) {
        const xIn = centerX + (loop.loopIn - currentPos) * pxPerSec;
        const xOut = centerX + (loop.loopOut - currentPos) * pxPerSec;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.fillRect(xIn, 0, xOut - xIn, height);
        ctx.strokeStyle = '#f59e0b';
        ctx.strokeRect(xIn, 0, xOut - xIn, height);
      }

      // Center Fixed Playhead Cursor (Red/White hairline)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, height);
      ctx.stroke();

      // Top and bottom pointer needles
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(centerX - 4, 0);
      ctx.lineTo(centerX + 4, 0);
      ctx.lineTo(centerX, 6);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(centerX - 4, height);
      ctx.lineTo(centerX + 4, height);
      ctx.lineTo(centerX, height - 6);
      ctx.fill();

      animId = requestAnimationFrame(renderZoom);
    };

    animId = requestAnimationFrame(renderZoom);
    return () => cancelAnimationFrame(animId);
  }, [deckId, accentColor]);

  // Click on overview canvas to seek
  const handleOverviewClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overviewCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const transport = discDjEngine.getTransport(deckId);
    const targetTime = ratio * (transport.duration || 0);
    discDjEngine.seek(deckId, targetTime);
  };

  return (
    <div className="flex flex-col bg-[#11131c] border border-white/5 rounded-xl p-2.5 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 px-0.5 text-xs">
        <div className="flex items-center gap-1.5 font-mono">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="font-bold text-white tracking-wider">{label}</span>
          <span className="text-zinc-400 text-[10px]">RGB SPECTRUM WAVEFORM</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> BASS
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> MIDS
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} /> HIGHS
          </span>
        </div>
      </div>

      {/* Dynamic Scrolling Zoom Waveform */}
      <div className="relative h-16 w-full rounded-lg overflow-hidden border border-white/10 mb-1.5 shadow-inner">
        <canvas
          ref={zoomCanvasRef}
          width={600}
          height={64}
          className="w-full h-full block"
        />
      </div>

      {/* Overview Waveform (Seekable) */}
      <div className="relative h-8 w-full rounded-md overflow-hidden border border-white/5 cursor-pointer shadow-inner">
        <canvas
          ref={overviewCanvasRef}
          width={600}
          height={32}
          onClick={handleOverviewClick}
          className="w-full h-full block hover:opacity-95 transition-opacity"
          title="Click anywhere to seek track position"
        />
      </div>
    </div>
  );
};
