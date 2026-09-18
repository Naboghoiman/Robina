import React, { useState, useEffect } from 'react';
import { X, Sliders, Power, RotateCcw } from 'lucide-react';
import { DeckID } from '../types/discdj';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

interface TenBandEqModalProps {
  deckId: DeckID | null;
  onClose: () => void;
}

const FREQUENCIES = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

export const TenBandEqModal: React.FC<TenBandEqModalProps> = ({ deckId, onClose }) => {
  if (!deckId) return null;

  const [ch, setCh] = useState(discDjEngine.getMixerChannel(deckId));

  useEffect(() => {
    const unsub = discDjEngine.subscribe(() => {
      setCh({ ...discDjEngine.getMixerChannel(deckId) });
    });
    return unsub;
  }, [deckId]);

  const applyPreset = (gains: number[]) => {
    gains.forEach((g, idx) => {
      discDjEngine.setTenBandEqGain(deckId, idx, g);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#12141c] border border-white/15 rounded-2xl p-5 w-full max-w-2xl shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-mono text-sm font-bold text-white tracking-wider">
                10-BAND GRAPHIC EQUALIZER
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                {deckId.toUpperCase()} • Native DSP Filterbank
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Enable/Bypass switch */}
            <button
              onClick={() => discDjEngine.toggleTenBandEq(deckId)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                ch.tenBandEqEnabled
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{ch.tenBandEqEnabled ? 'ACTIVE' : 'BYPASS'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* EQ Sliders Grid */}
        <div className="grid grid-cols-10 gap-2 h-52 bg-[#0a0b10] rounded-xl p-3 border border-white/5 dj-fader-well">
          {FREQUENCIES.map((freq, idx) => {
            const gain = ch.tenBandGains[idx] || 0;
            return (
              <div key={freq} className="flex flex-col items-center justify-between h-full">
                {/* Gain Readout */}
                <span className="text-[9px] font-mono text-zinc-400">
                  {gain > 0 ? `+${gain.toFixed(0)}` : gain.toFixed(0)}
                </span>

                {/* Vertical Slider */}
                <div className="relative flex-1 flex items-center justify-center py-2">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-zinc-700/50 pointer-events-none -translate-y-1/2" />
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={gain}
                    disabled={!ch.tenBandEqEnabled}
                    onChange={(e) => discDjEngine.setTenBandEqGain(deckId, idx, parseFloat(e.target.value))}
                    className="h-28 w-4 appearance-none bg-transparent cursor-pointer disabled:opacity-40 [writing-mode:vertical-lr] [direction:rtl]"
                    style={{ accentColor: '#f59e0b' }}
                  />
                </div>

                {/* Frequency Label */}
                <span className="text-[9px] font-mono font-bold text-zinc-300">
                  {freq}
                </span>
              </div>
            );
          })}
        </div>

        {/* Presets & Reset Bar */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-zinc-500 mr-1">PRESETS:</span>
            <button
              onClick={() => applyPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
            >
              Flat
            </button>
            <button
              onClick={() => applyPreset([6, 5, 4, 2, 0, 0, 1, 2, 3, 4])}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
            >
              Club Bass
            </button>
            <button
              onClick={() => applyPreset([-2, -2, -1, 1, 3, 4, 3, 2, 0, -1])}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
            >
              Vocal
            </button>
            <button
              onClick={() => applyPreset([5, 4, 2, -1, -2, -1, 1, 3, 5, 6])}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
            >
              V-Curve
            </button>
            <button
              onClick={() => applyPreset([-3, -2, 0, 0, 1, 2, 3, 4, 5, 6])}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
            >
              Bright Air
            </button>
          </div>

          <button
            onClick={() => applyPreset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-zinc-400 hover:text-white bg-white/5 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        </div>
      </div>
    </div>
  );
};
