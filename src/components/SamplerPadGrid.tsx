import React, { useState, useEffect } from 'react';
import { Grid, Volume2 } from 'lucide-react';
import { SamplerPadItem } from '../types/discdj';
import { DEFAULT_SAMPLER_PADS } from '../audio/sfxSamples';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

export const SamplerPadGrid: React.FC = () => {
  const [pads, setPads] = useState<SamplerPadItem[]>(DEFAULT_SAMPLER_PADS);
  const [samplerVolume, setSamplerVolume] = useState(0.85);

  useEffect(() => {
    const unsub = discDjEngine.subscribe(() => {
      // Refresh pad playing status
      setPads(prev => prev.map(p => ({
        ...p,
        isPlaying: discDjEngine.isPadActive(p.id)
      })));
    });
    return unsub;
  }, []);

  const handlePadPress = (padId: number) => {
    discDjEngine.triggerSamplerPad(padId);
    setPads(prev => prev.map(p => p.id === padId ? { ...p, isPlaying: true } : p));
  };

  const handlePadRelease = (pad: SamplerPadItem) => {
    if (pad.mode === 'hold') {
      discDjEngine.stopSamplerPad(pad.id);
      setPads(prev => prev.map(p => p.id === pad.id ? { ...p, isPlaying: false } : p));
    }
  };

  return (
    <div className="flex flex-col bg-[#11131b] border border-white/10 rounded-2xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-bold text-white tracking-wider">
            12-PAD PERFORMANCE SAMPLER
          </span>
        </div>

        {/* Sampler Volume Slider */}
        <div className="flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={samplerVolume}
            onChange={(e) => setSamplerVolume(parseFloat(e.target.value))}
            className="w-20 h-1.5 accent-emerald-400 cursor-pointer bg-zinc-800 rounded-lg"
          />
        </div>
      </div>

      {/* 12-Pad Grid (3 rows of 4 pads) */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {pads.map((pad) => {
          return (
            <button
              key={pad.id}
              onMouseDown={() => handlePadPress(pad.id)}
              onMouseUp={() => handlePadRelease(pad)}
              onTouchStart={(e) => {
                e.preventDefault();
                handlePadPress(pad.id);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handlePadRelease(pad);
              }}
              className={`relative h-16 rounded-xl flex flex-col items-center justify-center p-1.5 transition-all duration-75 select-none touch-none shadow-md border ${
                pad.isPlaying
                  ? 'scale-95 brightness-125 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]'
                  : 'hover:brightness-110 active:scale-95 border-white/10'
              }`}
              style={{
                backgroundColor: `${pad.color}${pad.isPlaying ? '55' : '20'}`,
                borderColor: pad.isPlaying ? '#ffffff' : `${pad.color}40`,
              }}
            >
              <span className="text-[9px] font-mono font-bold text-white/70 absolute top-1 left-1.5">
                0{pad.id}
              </span>
              <span className="text-[11px] font-mono font-extrabold text-white tracking-tight text-center px-1">
                {pad.name}
              </span>
              <span
                className="text-[8px] font-mono uppercase tracking-wider mt-0.5 px-1 rounded"
                style={{ color: pad.color }}
              >
                {pad.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
