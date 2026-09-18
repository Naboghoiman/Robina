import React, { useState, useEffect } from 'react';
import { X, Cpu, CheckCircle2, ShieldCheck, Terminal, Play, ArrowRight, Activity, Clock } from 'lucide-react';
import { SyncTraceReport } from '../types/discdj';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

interface ForensicEngineInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForensicEngineInspector: React.FC<ForensicEngineInspectorProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<SyncTraceReport[]>(discDjEngine.getSyncTraceLogs());
  const [selectedLogIndex, setSelectedLogIndex] = useState(0);

  useEffect(() => {
    const unsub = discDjEngine.subscribe(() => {
      setLogs([...discDjEngine.getSyncTraceLogs()]);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const currentLog = logs[selectedLogIndex] || logs[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-[#0e1017] border border-cyan-500/30 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#141620] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-white tracking-wide">
                  IMAN — DISCDJ v12.2.0s ENGINE MAP & SYNC TRACE
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  VERIFIED NATIVE CORE
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono">
                Clean-room AudioEngine.W(direction) event-driven synchronization & DSP map
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick trigger sync test */}
            <button
              onClick={() => discDjEngine.syncAudioEngineW('A_TO_B')}
              className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>TEST SYNC A→B</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Left Sync Step Inspection & Right Forensic Engine Map */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Column: 20-Step Synchronization Trace (7 cols) */}
          <div className="lg:col-span-7 flex flex-col border-r border-white/10 overflow-hidden p-4 bg-[#0a0c12]">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs font-bold text-zinc-200">
                  AudioEngine.W(direction) 20-STEP EXECUTION TRACE
                </span>
              </div>

              {logs.length > 0 && (
                <span className="text-[11px] font-mono text-cyan-400">
                  {logs.length} sync event{logs.length > 1 ? 's' : ''} logged
                </span>
              )}
            </div>

            {currentLog ? (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {/* Event Summary Card */}
                <div className="bg-[#12141e] border border-cyan-500/20 rounded-xl p-3 text-xs font-mono space-y-1">
                  <div className="flex justify-between text-zinc-300">
                    <span className="font-bold text-white">Event ID: {currentLog.id}</span>
                    <span className="text-zinc-400">{currentLog.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                    <span>
                      Direction: <strong className="text-cyan-300">{currentLog.direction}</strong>
                    </span>
                    <span>
                      Ref: <strong className="text-white">{currentLog.referenceDeck.toUpperCase()}</strong>
                    </span>
                    <span>
                      Follower: <strong className="text-amber-300">{currentLog.followerDeck.toUpperCase()}</strong>
                    </span>
                  </div>
                </div>

                {/* The 20 Steps Checklist */}
                <div className="space-y-1.5 pt-1">
                  {currentLog.steps.map((s) => (
                    <div
                      key={s.step}
                      className="flex items-start gap-2.5 p-2 bg-[#10121a] hover:bg-[#141724] border border-white/5 rounded-lg text-xs font-mono transition-colors"
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold shrink-0 mt-0.5">
                        {s.step}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-zinc-200 truncate">{s.name}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 break-words">
                          {s.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 font-mono text-zinc-500">
                <Clock className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs">No sync events triggered yet.</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Press "TEST SYNC A→B" or the SYNC button on either deck to run the 20-step algorithm.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Verified Forensic Native Engine Map (5 cols) */}
          <div className="lg:col-span-5 flex flex-col overflow-y-auto p-4 bg-[#0d0f17] space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-zinc-200">
                FORENSIC ENGINE SURFACE MAP
              </span>
            </div>

            {/* Sub-sections of Verified Engine Surface */}
            <div className="space-y-3 text-xs font-mono">
              {/* TRANSPORT */}
              <div className="bg-[#12141f] border border-white/5 rounded-xl p-3">
                <span className="text-[11px] font-bold text-cyan-400 block mb-1.5">
                  1. TRANSPORT SUBSYSTEM
                </span>
                <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                  <li>prepare / prepared state (ready/unprepared)</li>
                  <li>start / pause / stop / reset</li>
                  <li>seek / current position / duration</li>
                  <li>playing / going-to-be-playing flags</li>
                </ul>
              </div>

              {/* TEMPO / SYNC */}
              <div className="bg-[#12141f] border border-white/5 rounded-xl p-3">
                <span className="text-[11px] font-bold text-amber-400 block mb-1.5">
                  2. TEMPO & SYNC SUBSYSTEM
                </span>
                <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                  <li>setTempoNative / effective BPM calculation</li>
                  <li>getSpeedNative / setSpeedNative / resetSpeedNative</li>
                  <li>setPitchBendNative / setPitchShiftNative</li>
                  <li>key lock / time-stretch phase vocoder</li>
                  <li>AudioEngine.W(direction) event-driven sync</li>
                </ul>
              </div>

              {/* MIXER & EQ */}
              <div className="bg-[#12141f] border border-white/5 rounded-xl p-3">
                <span className="text-[11px] font-bold text-purple-400 block mb-1.5">
                  3. MIXER / 10-BAND EQ / FILTER
                </span>
                <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                  <li>3-band isolator EQ + individual kill switches</li>
                  <li>10-band graphic EQ filterbank (31Hz - 16kHz)</li>
                  <li>Bipolar low/high-pass filter percentage</li>
                  <li>Target loudness (-14 LUFS) & replay gain normalizer</li>
                  <li>Turntable motor brake time curve simulation</li>
                </ul>
              </div>

              {/* DSP SFX & SAMPLER */}
              <div className="bg-[#12141f] border border-white/5 rounded-xl p-3">
                <span className="text-[11px] font-bold text-emerald-400 block mb-1.5">
                  4. DSP SFX & 12-PAD SAMPLER
                </span>
                <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                  <li>Delay, delay-echo, flanger, noise, tremolo, reverb</li>
                  <li>Tempo-derived beat divisions (1/8 to 2 beats)</li>
                  <li>12-pad sampler with one-shot / hold modes</li>
                  <li>Real Master mix recording (MediaRecorder API)</li>
                </ul>
              </div>

              {/* ANALYSIS & RESAMPLING */}
              <div className="bg-[#12141f] border border-white/5 rounded-xl p-3">
                <span className="text-[11px] font-bold text-rose-400 block mb-1.5">
                  5. ANALYSIS & TIME-STRETCH
                </span>
                <ul className="text-[11px] text-zinc-300 space-y-1 list-disc list-inside">
                  <li>analysisAlloc / analysisStep1tempo / analysisBPM</li>
                  <li>RGB 3-band spectrum waveform generator</li>
                  <li>DdTimeStretchFast & 4-Point/Sinc Resampler HQ</li>
                  <li>Live beat grid alignment & bar numbering</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
