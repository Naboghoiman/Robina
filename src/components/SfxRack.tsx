import React, { useState, useEffect } from 'react';
import { Sparkles, Power, Activity } from 'lucide-react';
import { DeckID, SfxType, SfxState } from '../types/discdj';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

export const SfxRack: React.FC = () => {
  const [activeDeck, setActiveDeck] = useState<DeckID>('deckA');
  const [sfx, setSfx] = useState<SfxState>(discDjEngine.getSfx('deckA'));

  useEffect(() => {
    const unsub = discDjEngine.subscribe(() => {
      setSfx({ ...discDjEngine.getSfx(activeDeck) });
    });
    return unsub;
  }, [activeDeck]);

  const effects: { id: SfxType; label: string }[] = [
    { id: 'delay_echo', label: 'ECHO' },
    { id: 'delay', label: 'DELAY' },
    { id: 'flanger', label: 'FLANGER' },
    { id: 'reverb_echo', label: 'REVERB' },
    { id: 'noise', label: 'NOISE' },
    { id: 'tremolo', label: 'TREMOLO' },
  ];

  const beatDivisions: SfxState['beatDivision'][] = ['1/8', '1/4', '1/2', '3/4', '1', '2'];

  return (
    <div className="flex flex-col bg-[#11131b] border border-white/10 rounded-2xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="font-mono text-xs font-bold text-white tracking-wider">
            DSP SFX RACK
          </span>
        </div>

        {/* Deck Selector Tabs */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveDeck('deckA')}
            className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded transition-colors ${
              activeDeck === 'deckA'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            DECK A
          </button>
          <button
            onClick={() => setActiveDeck('deckB')}
            className={`px-2.5 py-0.5 text-xs font-mono font-bold rounded transition-colors ${
              activeDeck === 'deckB'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            DECK B
          </button>
        </div>
      </div>

      {/* Main FX Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Effect Selector & Stomp Switch */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400">EFFECT SELECT</span>
            <button
              onClick={() => discDjEngine.toggleEffect(activeDeck)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all shadow-md ${
                sfx.enabled
                  ? 'bg-purple-600 text-white shadow-purple-600/30'
                  : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{sfx.enabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {effects.map((fx) => (
              <button
                key={fx.id}
                onClick={() => discDjEngine.selectEffect(activeDeck, fx.id)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-semibold transition-all border ${
                  sfx.selectedEffect === fx.id
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                    : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white'
                }`}
              >
                {fx.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tempo Beat Division Helper */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400">TEMPO BEAT DIVISION</span>
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
          </div>

          <div className="grid grid-cols-6 gap-1">
            {beatDivisions.map((div) => (
              <button
                key={div}
                onClick={() => discDjEngine.setEffectBeatDivision(activeDeck, div)}
                className={`h-9 rounded-lg text-xs font-mono font-bold transition-all border ${
                  sfx.beatDivision === div
                    ? 'bg-purple-500 text-black border-purple-400'
                    : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white'
                }`}
              >
                {div}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-zinc-500 text-center">
            Synchronized to current deck BPM
          </span>
        </div>

        {/* Depth (Value) & Wet/Dry Mix Sliders */}
        <div className="flex items-center justify-around gap-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
          {/* Depth Knob / Slider */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-mono text-zinc-400 mb-1">DEPTH</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={sfx.value}
              onChange={(e) => discDjEngine.setEffectValue(activeDeck, parseFloat(e.target.value))}
              className="w-20 h-2 accent-purple-400 cursor-pointer bg-zinc-800 rounded-lg"
            />
            <span className="text-[9px] font-mono text-zinc-400 mt-1">
              {Math.round(sfx.value * 100)}%
            </span>
          </div>

          {/* Wet/Dry Volume Slider */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-mono text-zinc-400 mb-1">WET/DRY</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={sfx.volume}
              onChange={(e) => discDjEngine.setEffectVolume(activeDeck, parseFloat(e.target.value))}
              className="w-20 h-2 accent-purple-400 cursor-pointer bg-zinc-800 rounded-lg"
            />
            <span className="text-[9px] font-mono text-zinc-400 mt-1">
              {Math.round(sfx.volume * 100)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
