import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, Music, Lock, Unlock, Disc } from 'lucide-react';
import { DeckID, TrackMetadata } from '../types/discdj';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

interface TurntableProps {
  deckId: DeckID;
  accentColor: string; // e.g. '#06b6d4' for Deck A, '#f59e0b' for Deck B
  deckLabel: string; // 'DECK A' | 'DECK B'
  onOpenLibrary: () => void;
}

export const Turntable: React.FC<TurntableProps> = ({
  deckId,
  accentColor,
  deckLabel,
  onOpenLibrary,
}) => {
  const [transport, setTransport] = useState(discDjEngine.getTransport(deckId));
  const [tempo, setTempo] = useState(discDjEngine.getTempo(deckId));
  const [loop, setLoop] = useState(discDjEngine.getLoop(deckId));
  const [scratch, setScratch] = useState(discDjEngine.getScratch(deckId));
  const [track, setTrack] = useState<TrackMetadata | null>(discDjEngine.getDeckTrack(deckId));
  const [hotCues, setHotCues] = useState(discDjEngine.getHotCues(deckId));

  const platterRef = useRef<HTMLDivElement>(null);
  const rotationAngleRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastAngleRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [, setRenderTrigger] = useState(0);

  // Subscribe to engine state updates
  useEffect(() => {
    const unsub = discDjEngine.subscribe(() => {
      setTransport({ ...discDjEngine.getTransport(deckId) });
      setTempo({ ...discDjEngine.getTempo(deckId) });
      setLoop({ ...discDjEngine.getLoop(deckId) });
      setScratch({ ...discDjEngine.getScratch(deckId) });
      setTrack(discDjEngine.getDeckTrack(deckId));
      setHotCues([...discDjEngine.getHotCues(deckId)]);
    });
    return unsub;
  }, [deckId]);

  // Turntable Platter Animation Loop (33 1/3 RPM = ~0.55 rev/s = ~200 deg/s)
  useEffect(() => {
    let animId: number;
    let lastAnimTime = performance.now();

    const animatePlatter = (now: number) => {
      const dt = (now - lastAnimTime) / 1000;
      lastAnimTime = now;

      if (transport.isPlaying && !scratch.isScratching) {
        const rate = tempo.currentSpeed + tempo.pitchBend;
        const degPerSec = 200 * rate;
        rotationAngleRef.current = (rotationAngleRef.current + degPerSec * dt) % 360;
        if (platterRef.current) {
          platterRef.current.style.transform = `rotate(${rotationAngleRef.current}deg)`;
        }
      }
      animId = requestAnimationFrame(animatePlatter);
    };

    animId = requestAnimationFrame(animatePlatter);
    return () => cancelAnimationFrame(animId);
  }, [transport.isPlaying, scratch.isScratching, tempo.currentSpeed, tempo.pitchBend]);

  // Helper to calculate pointer angle relative to center of platter
  const getAngleFromCenter = useCallback((clientX: number, clientY: number) => {
    if (!platterRef.current) return 0;
    const rect = platterRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return Math.atan2(clientY - centerY, clientX - centerX);
  }, []);

  // Pointer event handlers for vinyl scratch interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    discDjEngine.setScratching(deckId, true);
    lastAngleRef.current = getAngleFromCenter(e.clientX, e.clientY);
    lastTimeRef.current = performance.now();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const now = performance.now();
    const dt = (now - lastTimeRef.current) / 1000;
    if (dt <= 0.005) return;

    const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
    let deltaAngle = currentAngle - lastAngleRef.current;

    // Normalize angle delta across -PI / +PI wrap
    if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
    if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

    // Apply rotation visually
    rotationAngleRef.current = (rotationAngleRef.current + (deltaAngle * 180 / Math.PI)) % 360;
    if (platterRef.current) {
      platterRef.current.style.transform = `rotate(${rotationAngleRef.current}deg)`;
    }

    // Send velocity to audio engine for realistic scratch pitch & audio scrub
    discDjEngine.updateScratchVelocity(deckId, deltaAngle, dt);

    lastAngleRef.current = currentAngle;
    lastTimeRef.current = now;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
      isDraggingRef.current = false;
      discDjEngine.setScratching(deckId, false);
      setRenderTrigger(prev => prev + 1);
    }
  };

  // Pitch fader change handler (0.5 to 2.0 range, centered at 1.0)
  const handlePitchSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    discDjEngine.setSpeedNative(deckId, val);
  };

  const pitchPercentage = ((tempo.currentSpeed - 1.0) * 100).toFixed(1);

  // Position progress
  const currentPos = discDjEngine.getCurrentPosition(deckId);
  const duration = transport.duration || 1;
  const progressRatio = Math.min(1.0, currentPos / duration);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex flex-col bg-[#13151e] border border-white/5 rounded-2xl p-4 shadow-2xl relative overflow-hidden">
      {/* Top Header & Deck Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="px-2.5 py-0.5 rounded text-xs font-bold tracking-wider uppercase font-mono shadow-sm"
            style={{ backgroundColor: `${accentColor}25`, color: accentColor, border: `1px solid ${accentColor}40` }}
          >
            {deckLabel}
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight truncate max-w-[170px] sm:max-w-[220px]">
              {track ? track.title : 'No Track Loaded'}
            </div>
            <div className="text-[11px] text-zinc-400 truncate max-w-[170px]">
              {track ? `${track.artist} • ${track.key}` : 'Tap load track'}
            </div>
          </div>
        </div>

        <button
          onClick={onOpenLibrary}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg border border-white/10 transition-colors"
          title="Select Track from Library or upload file"
        >
          <Music className="w-3.5 h-3.5" />
          <span>Load</span>
        </button>
      </div>

      {/* Main Turntable & Pitch Controls Area */}
      <div className="flex items-center justify-between gap-3">
        {/* Interactive Vinyl Platter Unit */}
        <div className="relative flex-1 flex items-center justify-center p-2">
          {/* Turntable Platter Outer Ring with Strobe Dots */}
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full p-2 bg-[#181a24] shadow-[inset_0_4px_12px_rgba(0,0,0,0.8),0_6px_20px_rgba(0,0,0,0.6)] border border-white/5 flex items-center justify-center">
            {/* Strobe pattern rim */}
            <div className="absolute inset-1 rounded-full border border-dashed border-zinc-700/40 pointer-events-none" />

            {/* Interactive Scratch Vinyl Record */}
            <div
              ref={platterRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full cursor-grab active:cursor-grabbing vinyl-grooves select-none shadow-2xl flex items-center justify-center touch-none transition-transform duration-75"
            >
              {/* Radial Grooves and Sheen overlay */}
              <div className="absolute inset-0 rounded-full vinyl-sheen pointer-events-none opacity-60" />

              {/* Strobe marker dots on vinyl edge */}
              <div className="absolute top-2 w-2 h-2 rounded-full bg-white/70 shadow-sm pointer-events-none" />
              <div className="absolute bottom-2 w-2 h-2 rounded-full bg-white/70 shadow-sm pointer-events-none" />

              {/* Center Vinyl Record Label */}
              <div
                className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-full flex flex-col items-center justify-center p-1.5 shadow-inner border border-white/20 select-none pointer-events-none"
                style={{ backgroundColor: `${accentColor}20`, backdropFilter: 'blur(4px)' }}
              >
                <Disc className="w-5 h-5 mb-0.5" style={{ color: accentColor }} />
                <span className="text-[10px] font-bold text-white tracking-widest font-mono">
                  {tempo.effectiveBpm.toFixed(1)}
                </span>
                <span className="text-[8px] text-zinc-300 font-mono">BPM</span>

                {/* Spindle hole */}
                <div className="w-3.5 h-3.5 rounded-full bg-[#0a0a0f] border-2 border-zinc-600 mt-1 shadow-inner" />
              </div>
            </div>

            {/* Tonearm Visual Indicator */}
            <div
              className="absolute right-0 top-6 w-24 h-1 bg-gradient-to-r from-zinc-700 to-zinc-400 origin-right pointer-events-none rounded-full shadow-lg"
              style={{
                transform: `rotate(${24 - (progressRatio * 32)}deg)`,
                transition: 'transform 0.2s ease-out'
              }}
            >
              {/* Headshell & cartridge */}
              <div
                className="absolute -left-2 -top-1.5 w-4 h-4 rounded-sm shadow-md"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          </div>
        </div>

        {/* Pitch / Tempo Control Fader (Right rail) */}
        <div className="flex flex-col items-center bg-[#0d0e14] border border-white/5 rounded-xl p-2.5 shadow-inner min-w-[72px]">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1 font-mono">
            TEMPO
          </div>

          {/* Key Lock Toggle */}
          <button
            onClick={() => discDjEngine.toggleKeyLock(deckId)}
            className={`p-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1 mb-2 transition-all ${
              tempo.keyLock
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-white/5 text-zinc-400 border border-transparent hover:text-zinc-200'
            }`}
            title="Key Lock: Lock musical pitch when changing speed"
          >
            {tempo.keyLock ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span className="text-[9px]">KEY</span>
          </button>

          {/* Pitch Bend Nudge (+) */}
          <button
            onMouseDown={() => discDjEngine.setPitchBendNative(deckId, 0.05)}
            onMouseUp={() => discDjEngine.setPitchBendNative(deckId, 0)}
            onTouchStart={() => discDjEngine.setPitchBendNative(deckId, 0.05)}
            onTouchEnd={() => discDjEngine.setPitchBendNative(deckId, 0)}
            className="w-10 h-7 rounded bg-white/5 hover:bg-white/10 active:bg-white/20 text-zinc-200 font-mono font-bold text-xs flex items-center justify-center border border-white/10 transition-colors mb-2"
            title="Pitch Bend (+)"
          >
            +
          </button>

          {/* Vertical Pitch Fader */}
          <div className="relative h-40 flex items-center justify-center py-2">
            {/* Center zero detent line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-600/60 pointer-events-none -translate-y-1/2" />
            <div className={`absolute top-1/2 -left-1.5 w-1.5 h-1.5 rounded-full -translate-y-1/2 pointer-events-none ${Math.abs(tempo.currentSpeed - 1.0) < 0.005 ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-zinc-700'}`} />

            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.001"
              value={tempo.currentSpeed}
              onChange={handlePitchSlider}
              className="h-36 w-6 accent-cyan-400 appearance-none bg-transparent cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
              style={{ accentColor }}
            />
          </div>

          {/* Pitch Bend Nudge (-) */}
          <button
            onMouseDown={() => discDjEngine.setPitchBendNative(deckId, -0.05)}
            onMouseUp={() => discDjEngine.setPitchBendNative(deckId, 0)}
            onTouchStart={() => discDjEngine.setPitchBendNative(deckId, -0.05)}
            onTouchEnd={() => discDjEngine.setPitchBendNative(deckId, 0)}
            className="w-10 h-7 rounded bg-white/5 hover:bg-white/10 active:bg-white/20 text-zinc-200 font-mono font-bold text-xs flex items-center justify-center border border-white/10 transition-colors mt-2"
            title="Pitch Bend (-)"
          >
            -
          </button>

          {/* Speed / Pitch Display readout */}
          <div className="mt-2 text-center">
            <button
              onClick={() => discDjEngine.resetSpeedNative(deckId)}
              className="text-[11px] font-mono font-bold tracking-tight px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
              style={{ color: Math.abs(tempo.currentSpeed - 1.0) < 0.005 ? '#10b981' : '#f59e0b' }}
              title="Click to reset tempo to 100% (0.0%)"
            >
              {parseFloat(pitchPercentage) >= 0 ? `+${pitchPercentage}%` : `${pitchPercentage}%`}
            </button>
          </div>
        </div>
      </div>

      {/* Transport Controls Bar (Play/Pause, Cue, Sync Trigger) */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        {/* Play/Pause Button */}
        <button
          onClick={() => {
            if (transport.isPlaying) {
              discDjEngine.pause(deckId);
            } else {
              discDjEngine.play(deckId);
            }
          }}
          className={`h-11 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
            transport.isPlaying
              ? 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20'
              : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
          }`}
        >
          {transport.isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{transport.isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        {/* CUE Button */}
        <button
          onClick={() => discDjEngine.cue(deckId)}
          className="h-11 rounded-xl bg-[#212433] hover:bg-[#2a2e42] active:bg-[#343a54] text-amber-300 border border-amber-500/30 font-bold font-mono text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
          title="Cue: Jump to cue point or set new cue point"
        >
          <span>CUE</span>
        </button>

        {/* SYNC Button (AudioEngine.W direction trigger) */}
        <button
          onClick={() => {
            const dir = deckId === 'deckA' ? 'B_TO_A' : 'A_TO_B';
            discDjEngine.syncAudioEngineW(dir);
          }}
          className="h-11 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/80 active:bg-cyan-800 text-cyan-300 border border-cyan-500/40 font-bold font-mono text-xs flex items-center justify-center gap-1 transition-all shadow-sm"
          title="SYNC: Execute 20-step AudioEngine.W sync routine to match this deck to the other deck"
        >
          <span>SYNC</span>
        </button>

        {/* Reset / Stop Button */}
        <button
          onClick={() => discDjEngine.reset(deckId)}
          className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 font-mono text-xs flex items-center justify-center gap-1 transition-all"
          title="Reset deck position and speed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RST</span>
        </button>
      </div>

      {/* Auto Loop & Hot Cues Row */}
      <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-col gap-2.5">
        {/* Loop Controls */}
        <div className="flex items-center justify-between gap-1.5">
          <button
            onClick={() => discDjEngine.toggleLoop(deckId)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
              loop.active
                ? 'bg-amber-500 text-black shadow-sm'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            LOOP {loop.loopBeats}
          </button>

          <div className="flex items-center gap-1">
            {[0.5, 1, 2, 4, 8].map((beats) => (
              <button
                key={beats}
                onClick={() => {
                  discDjEngine.setLoopBeats(deckId, beats);
                  if (!loop.active) discDjEngine.startLoop(deckId, beats);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  loop.loopBeats === beats && loop.active
                    ? 'bg-amber-400 text-black font-bold'
                    : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {beats < 1 ? '1/2' : beats}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => discDjEngine.setLoopIn(deckId)}
              className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 rounded"
              title="Set Loop IN point"
            >
              IN
            </button>
            <button
              onClick={() => discDjEngine.setLoopOut(deckId)}
              className="px-1.5 py-0.5 text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 rounded"
              title="Set Loop OUT point"
            >
              OUT
            </button>
          </div>
        </div>

        {/* Hot Cues Bar (1-4) */}
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((cueIdx) => {
            const hasCue = hotCues[cueIdx] !== undefined;
            return (
              <button
                key={cueIdx}
                onClick={(e) => {
                  if (e.shiftKey) {
                    // Clear hot cue
                    discDjEngine.setHotCue(deckId, cueIdx);
                  } else if (hasCue) {
                    discDjEngine.jumpToHotCue(deckId, cueIdx);
                  } else {
                    discDjEngine.setHotCue(deckId, cueIdx);
                  }
                }}
                className={`h-7 rounded text-[11px] font-mono font-semibold transition-all border ${
                  hasCue
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                    : 'bg-white/5 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'
                }`}
                title={hasCue ? `Jump to Cue ${cueIdx + 1} (${formatTime(hotCues[cueIdx])})` : `Set Hot Cue ${cueIdx + 1}`}
              >
                CUE {cueIdx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Position & Time Tracker Bar */}
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mt-3 pt-2 border-t border-white/5">
        <span className="text-zinc-200 font-bold">{formatTime(currentPos)}</span>
        <div className="flex-1 mx-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{ width: `${progressRatio * 100}%`, backgroundColor: accentColor }}
          />
        </div>
        <span>-{formatTime(Math.max(0, duration - currentPos))}</span>
      </div>
    </div>
  );
};
