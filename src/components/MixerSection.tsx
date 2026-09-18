import React, { useState, useEffect } from 'react';
import { Headphones, Sliders, Volume2, Zap, ArrowLeftRight, Settings2 } from 'lucide-react';
import { DeckID, CrossfaderCurve } from '../types/discdj';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

interface MixerSectionProps {
  onOpenTenBandEq: (deckId: DeckID) => void;
  onOpenInspector: () => void;
}

export const MixerSection: React.FC<MixerSectionProps> = ({
  onOpenTenBandEq,
  onOpenInspector,
}) => {
  const [chA, setChA] = useState(discDjEngine.getMixerChannel('deckA'));
  const [chB, setChB] = useState(discDjEngine.getMixerChannel('deckB'));
  const [master, setMaster] = useState(discDjEngine.getMasterMixer());
  const [levels, setLevels] = useState({ deckA: 0, deckB: 0, masterL: 0, masterR: 0 });

  // Update on engine state changes
  useEffect(() => {
    const unsubState = discDjEngine.subscribe(() => {
      setChA({ ...discDjEngine.getMixerChannel('deckA') });
      setChB({ ...discDjEngine.getMixerChannel('deckB') });
      setMaster({ ...discDjEngine.getMasterMixer() });
    });

    const unsubMeters = discDjEngine.subscribeMeters((lvl) => {
      setLevels(lvl);
    });

    return () => {
      unsubState();
      unsubMeters();
    };
  }, []);

  const renderMeter = (level: number, heightClass = 'h-32') => {
    const segments = 12;
    const activeCount = Math.floor(level * segments);
    return (
      <div className={`flex flex-col-reverse gap-0.5 w-2 ${heightClass} bg-black/50 p-0.5 rounded border border-white/5`}>
        {Array.from({ length: segments }).map((_, i) => {
          const isActive = i < activeCount;
          let color = 'bg-emerald-500';
          if (i >= 8 && i < 10) color = 'bg-amber-400';
          if (i >= 10) color = 'bg-rose-500';
          return (
            <div
              key={i}
              className={`w-full flex-1 rounded-xs transition-opacity duration-75 ${
                isActive ? `${color} opacity-100 shadow-sm` : 'bg-zinc-800/40 opacity-30'
              }`}
            />
          );
        })}
      </div>
    );
  };

  const renderChannelStrip = (deckId: DeckID, ch: typeof chA, label: string, accent: string) => {
    return (
      <div className="flex flex-col items-center p-3 bg-[#13151f] rounded-xl border border-white/5 shadow-lg flex-1">
        {/* Channel Header */}
        <div className="flex items-center justify-between w-full pb-2 mb-2 border-b border-white/5">
          <span className="font-mono text-xs font-bold tracking-wider" style={{ color: accent }}>
            {label}
          </span>
          <button
            onClick={() => onOpenTenBandEq(deckId)}
            className={`p-1 rounded text-[10px] font-mono flex items-center gap-1 transition-colors ${
              ch.tenBandEqEnabled
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-white/5 text-zinc-400 hover:text-white'
            }`}
            title="Open 10-Band Graphic Equalizer"
          >
            <Sliders className="w-3 h-3" />
            <span>10-EQ</span>
          </button>
        </div>

        {/* Trim / Gain Knob */}
        <div className="flex flex-col items-center mb-3">
          <span className="text-[9px] font-mono text-zinc-400 mb-0.5">TRIM</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            value={ch.gain}
            onChange={(e) => discDjEngine.setGainNative(deckId, parseFloat(e.target.value))}
            className="w-16 h-2 accent-zinc-300 cursor-pointer bg-zinc-800 rounded-lg"
          />
          <span className="text-[9px] font-mono text-zinc-400 mt-0.5">
            {ch.gain > 0 ? `+${ch.gain}dB` : `${ch.gain}dB`}
          </span>
        </div>

        {/* 3-Band Isolator EQ Section */}
        <div className="flex flex-col gap-2.5 w-full px-1 mb-3">
          {/* HIGH */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono text-zinc-400 w-6">HI</span>
            <input
              type="range"
              min="-24"
              max="6"
              step="0.5"
              value={ch.eqHigh}
              onChange={(e) => discDjEngine.setEqNative(deckId, 'high', parseFloat(e.target.value))}
              className="flex-1 h-2 accent-cyan-400 cursor-pointer bg-zinc-800 rounded-lg"
            />
            <button
              onClick={() => discDjEngine.toggleEqKill(deckId, 'high')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                ch.eqHighKill ? 'bg-rose-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title="Kill High frequencies"
            >
              KILL
            </button>
          </div>

          {/* MID */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono text-zinc-400 w-6">MID</span>
            <input
              type="range"
              min="-24"
              max="6"
              step="0.5"
              value={ch.eqMid}
              onChange={(e) => discDjEngine.setEqNative(deckId, 'mid', parseFloat(e.target.value))}
              className="flex-1 h-2 accent-emerald-400 cursor-pointer bg-zinc-800 rounded-lg"
            />
            <button
              onClick={() => discDjEngine.toggleEqKill(deckId, 'mid')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                ch.eqMidKill ? 'bg-rose-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title="Kill Mid frequencies"
            >
              KILL
            </button>
          </div>

          {/* LOW */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-mono text-zinc-400 w-6">LOW</span>
            <input
              type="range"
              min="-24"
              max="6"
              step="0.5"
              value={ch.eqLow}
              onChange={(e) => discDjEngine.setEqNative(deckId, 'low', parseFloat(e.target.value))}
              className="flex-1 h-2 accent-rose-400 cursor-pointer bg-zinc-800 rounded-lg"
            />
            <button
              onClick={() => discDjEngine.toggleEqKill(deckId, 'low')}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                ch.eqLowKill ? 'bg-rose-500 text-white' : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
              title="Kill Low frequencies"
            >
              KILL
            </button>
          </div>
        </div>

        {/* Color Filter Knob (HPF / LPF Bipolar) */}
        <div className="flex flex-col items-center mb-3 w-full bg-black/20 p-2 rounded-lg border border-white/5">
          <div className="flex justify-between w-full text-[9px] font-mono text-zinc-400 mb-1">
            <span>LPF</span>
            <span className="font-bold text-zinc-200">FILTER</span>
            <span>HPF</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="1"
            value={ch.filterPercent}
            onChange={(e) => discDjEngine.setFilterPercentage(deckId, parseFloat(e.target.value))}
            className="w-full h-2 accent-indigo-400 cursor-pointer bg-zinc-800 rounded-lg"
          />
          <button
            onClick={() => discDjEngine.setFilterPercentage(deckId, 0)}
            className="text-[9px] font-mono text-zinc-400 mt-1 hover:text-white"
            title="Reset Filter to Flat (0%)"
          >
            {ch.filterPercent === 0 ? 'FLAT' : `${ch.filterPercent > 0 ? '+' : ''}${ch.filterPercent}%`}
          </button>
        </div>

        {/* Headphone Pre-cue button */}
        <button
          onClick={() => discDjEngine.setPrecue(deckId, !ch.precue)}
          className={`w-full py-1.5 rounded-lg flex items-center justify-center gap-1.5 font-mono text-xs font-semibold mb-3 transition-all border ${
            ch.precue
              ? 'bg-amber-500 text-black border-amber-400 shadow-sm'
              : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white'
          }`}
          title="Headphone Cue Listen"
        >
          <Headphones className="w-3.5 h-3.5" />
          <span>CUE</span>
        </button>

        {/* Channel Volume Fader with Side VU Meter */}
        <div className="flex items-center justify-center gap-3 w-full h-36">
          {/* Volume Slider */}
          <div className="relative h-full flex items-center justify-center">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={ch.volume}
              onChange={(e) => discDjEngine.setVolumeNative(deckId, parseFloat(e.target.value))}
              className="h-32 w-6 cursor-pointer appearance-none bg-transparent [writing-mode:vertical-lr] [direction:rtl]"
              style={{ accentColor: accent }}
            />
          </div>

          {/* Channel Level VU Meter */}
          {renderMeter(deckId === 'deckA' ? levels.deckA : levels.deckB, 'h-32')}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col bg-[#0e1017] border border-white/10 rounded-2xl p-4 shadow-2xl">
      {/* Top Header Bar & Central Inspector Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold text-white tracking-widest uppercase">
            DISCDJ PRO MIXER & ENGINE CORE
          </span>
        </div>

        <button
          onClick={onOpenInspector}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 rounded-lg transition-colors"
          title="Open AudioEngine.W sync trace and forensic engine map"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>ENGINE TRACE</span>
        </button>
      </div>

      {/* Main Dual Channel Strips & Master Center Hub */}
      <div className="flex items-stretch justify-between gap-3">
        {/* Left: Deck A Channel Strip */}
        {renderChannelStrip('deckA', chA, 'CH 1 • DECK A', '#06b6d4')}

        {/* Center: Master Levels, Limiter, and Headphone Controls */}
        <div className="flex flex-col items-center justify-between p-3 bg-[#141620] rounded-xl border border-white/5 w-44">
          {/* Master Volume */}
          <div className="flex flex-col items-center w-full pb-2 border-b border-white/5">
            <span className="text-[10px] font-mono font-bold text-zinc-300 mb-1">MASTER</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.02"
              value={master.masterVolume}
              onChange={(e) => discDjEngine.setMasterVolume(parseFloat(e.target.value))}
              className="w-24 h-2 accent-white cursor-pointer bg-zinc-800 rounded-lg mb-1"
            />
            <span className="text-[9px] font-mono text-zinc-400">
              {Math.round(master.masterVolume * 100)}%
            </span>
          </div>

          {/* Master Stereo VU Meters */}
          <div className="flex items-center justify-center gap-1.5 my-2">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-zinc-400 mb-0.5">L</span>
              {renderMeter(levels.masterL, 'h-24')}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-mono text-zinc-400 mb-0.5">R</span>
              {renderMeter(levels.masterR, 'h-24')}
            </div>
          </div>

          {/* Turntable Motor Brake Time Knob */}
          <div className="flex flex-col items-center w-full py-1.5 border-t border-white/5">
            <span className="text-[9px] font-mono text-zinc-400">MOTOR BRAKE</span>
            <input
              type="range"
              min="0.05"
              max="3.0"
              step="0.1"
              value={master.brakeTime}
              onChange={(e) => discDjEngine.setBrakeTime(parseFloat(e.target.value))}
              className="w-20 h-1.5 accent-amber-400 cursor-pointer bg-zinc-800 rounded-lg mt-1"
            />
            <span className="text-[8px] font-mono text-zinc-400 mt-0.5">
              {master.brakeTime.toFixed(1)}s
            </span>
          </div>

          {/* Central SYNC Buttons */}
          <div className="grid grid-cols-2 gap-1.5 w-full pt-2 border-t border-white/5">
            <button
              onClick={() => discDjEngine.syncAudioEngineW('B_TO_A')}
              className="py-1 px-1 rounded bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold"
              title="Sync A to B (Follow Deck A)"
            >
              SYNC A
            </button>
            <button
              onClick={() => discDjEngine.syncAudioEngineW('A_TO_B')}
              className="py-1 px-1 rounded bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold"
              title="Sync B to A (Follow Deck B)"
            >
              SYNC B
            </button>
          </div>
        </div>

        {/* Right: Deck B Channel Strip */}
        {renderChannelStrip('deckB', chB, 'CH 2 • DECK B', '#f59e0b')}
      </div>

      {/* Bottom Crossfader Section with Curve Selection */}
      <div className="flex flex-col bg-[#13151f] rounded-xl border border-white/5 p-3 mt-3 shadow-inner">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase">
              CROSSFADER
            </span>
          </div>

          {/* Crossfader Curve Selector */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
            {(['smooth', 'linear', 'sharp'] as CrossfaderCurve[]).map((c) => (
              <button
                key={c}
                onClick={() => discDjEngine.setCrossfaderCurve(c)}
                className={`px-2 py-0.5 text-[9px] font-mono font-semibold rounded capitalize transition-colors ${
                  master.crossfaderCurve === c
                    ? 'bg-white/20 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Crossfader Track & Slider */}
        <div className="relative flex items-center justify-between w-full h-10 px-2 bg-[#090a0f] rounded-lg dj-fader-well border border-white/5">
          {/* Deck A Indicator */}
          <span className="text-[11px] font-mono font-bold text-cyan-400">A</span>

          {/* Center Detent mark */}
          <div className="absolute left-1/2 top-1 bottom-1 w-0.5 bg-zinc-700 pointer-events-none -translate-x-1/2" />

          {/* Horizontal Crossfader Slider */}
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={master.crossfader}
            onChange={(e) => discDjEngine.setCrossfader(parseFloat(e.target.value))}
            className="w-full mx-4 h-4 cursor-pointer appearance-none bg-transparent accent-white"
          />

          {/* Deck B Indicator */}
          <span className="text-[11px] font-mono font-bold text-amber-400">B</span>
        </div>

        {/* Quick Crossfader Center Snap Button */}
        <div className="flex justify-center mt-1.5">
          <button
            onClick={() => discDjEngine.setCrossfader(0)}
            className="text-[9px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            [SNAP TO CENTER]
          </button>
        </div>
      </div>
    </div>
  );
};
