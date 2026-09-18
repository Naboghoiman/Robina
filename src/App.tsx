import React, { useState, useEffect } from 'react';
import { Disc, Settings2, Sparkles, Volume2, ShieldCheck, Music2 } from 'lucide-react';
import { DeckID, TrackMetadata } from './types/discdj';
import { discDjEngine } from './audio/DiscDjAudioEngine';
import { generateDemoTrack } from './audio/trackGenerator';
import { Turntable } from './components/Turntable';
import { WaveformDisplay } from './components/WaveformDisplay';
import { MixerSection } from './components/MixerSection';
import { TenBandEqModal } from './components/TenBandEqModal';
import { SfxRack } from './components/SfxRack';
import { SamplerPadGrid } from './components/SamplerPadGrid';
import { ForensicEngineInspector } from './components/ForensicEngineInspector';
import { TrackLibraryModal } from './components/TrackLibraryModal';
import { RecordingBar } from './components/RecordingBar';

export default function App() {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [tenBandDeck, setTenBandDeck] = useState<DeckID | null>(null);
  const [libraryDeck, setLibraryDeck] = useState<DeckID | null>(null);
  const [demoTracks, setDemoTracks] = useState<TrackMetadata[]>([]);
  const [isAudioStarted, setIsAudioStarted] = useState(false);

  // Initialize AudioEngine and generate high-fidelity demo stems
  useEffect(() => {
    let mounted = true;

    const setupInitialTracks = async () => {
      // Create temporary AudioContext to synthesize demo buffers
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const tempCtx = new AudioCtx();

      const track1 = generateDemoTrack(tempCtx, 'tech_house');
      const track2 = generateDemoTrack(tempCtx, 'electro_breaks');
      const track3 = generateDemoTrack(tempCtx, 'liquid_dnb');
      const track4 = generateDemoTrack(tempCtx, 'hip_hop');

      if (!mounted) return;

      const loadedDemos = [track1.meta, track2.meta, track3.meta, track4.meta];
      setDemoTracks(loadedDemos);

      // Pre-load Deck A with Track 1 and Deck B with Track 2
      discDjEngine.loadTrack('deckA', track1.meta);
      discDjEngine.loadTrack('deckB', track2.meta);
    };

    setupInitialTracks();

    return () => {
      mounted = false;
    };
  }, []);

  const handleUserGestureStart = async () => {
    await discDjEngine.initAudioContext();
    setIsAudioStarted(true);
  };

  return (
    <div
      onClick={handleUserGestureStart}
      className="min-h-screen bg-[#0a0b10] text-zinc-100 flex flex-col p-3 sm:p-5 selection:bg-cyan-500 selection:text-black font-sans"
    >
      {/* Top Professional Header Bar */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Disc className="w-6 h-6 text-white animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white font-mono">
                IMAN — DISCDJ <span className="text-cyan-400 font-bold">v12.2.0s</span>
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-zinc-300 border border-white/10">
                PRO ENGINE CORE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">
              Verified 20-Step Synchronization Model • Multi-Band Isolator • 12-Pad Sampler
            </p>
          </div>
        </div>

        {/* Right Status Actions: Recording & Engine Trace */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <RecordingBar />

          <button
            onClick={() => setIsInspectorOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/40 shadow-sm transition-all"
            title="Inspect AudioEngine.W 20-Step Sync Trace & Engine Surface"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">FORENSIC ENGINE TRACE</span>
            <span className="md:hidden">TRACE</span>
          </button>
        </div>
      </header>

      {/* Main DJ Console Layout */}
      <main className="flex-1 flex flex-col gap-4 max-w-[1550px] w-full mx-auto">
        {/* Dual Stacked Waveform Spectrum Unit */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <WaveformDisplay
            deckId="deckA"
            accentColor="#06b6d4"
            label="DECK A"
          />
          <WaveformDisplay
            deckId="deckB"
            accentColor="#f59e0b"
            label="DECK B"
          />
        </section>

        {/* Center DJ Hardware Workstation: Deck A Turntable + Mixer + Deck B Turntable */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Deck A Turntable */}
          <div className="lg:col-span-4">
            <Turntable
              deckId="deckA"
              accentColor="#06b6d4"
              deckLabel="DECK A"
              onOpenLibrary={() => setLibraryDeck('deckA')}
            />
          </div>

          {/* Central DJ Mixer */}
          <div className="lg:col-span-4">
            <MixerSection
              onOpenTenBandEq={(deckId) => setTenBandDeck(deckId)}
              onOpenInspector={() => setIsInspectorOpen(true)}
            />
          </div>

          {/* Deck B Turntable */}
          <div className="lg:col-span-4">
            <Turntable
              deckId="deckB"
              accentColor="#f59e0b"
              deckLabel="DECK B"
              onOpenLibrary={() => setLibraryDeck('deckB')}
            />
          </div>
        </section>

        {/* Lower Performance Units: DSP SFX Rack & 12-Pad Sampler Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-6">
          <SfxRack />
          <SamplerPadGrid />
        </section>
      </main>

      {/* Modals & Dialogs */}
      <TenBandEqModal
        deckId={tenBandDeck}
        onClose={() => setTenBandDeck(null)}
      />

      <ForensicEngineInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />

      <TrackLibraryModal
        isOpen={libraryDeck !== null}
        onClose={() => setLibraryDeck(null)}
        defaultTargetDeck={libraryDeck || 'deckA'}
        demoTracks={demoTracks}
      />
    </div>
  );
}
