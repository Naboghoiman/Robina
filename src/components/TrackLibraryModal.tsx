import React, { useState } from 'react';
import { X, Music, Upload, Play, Check, Sparkles, Disc } from 'lucide-react';
import { DeckID, TrackMetadata } from '../types/discdj';
import { discDjEngine } from '../audio/DiscDjAudioEngine';
import { generateDemoTrack, runAnalysisPipeline } from '../audio/trackGenerator';

interface TrackLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetDeck: DeckID;
  demoTracks: TrackMetadata[];
}

export const TrackLibraryModal: React.FC<TrackLibraryModalProps> = ({
  isOpen,
  onClose,
  defaultTargetDeck,
  demoTracks,
}) => {
  const [selectedDeck, setSelectedDeck] = useState<DeckID>(defaultTargetDeck);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState('');

  if (!isOpen) return null;

  const handleSelectTrack = (track: TrackMetadata) => {
    discDjEngine.loadTrack(selectedDeck, track);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDecoding(true);
    setDecodeProgress('Reading audio file...');

    try {
      const ctx = await discDjEngine.initAudioContext();
      const arrayBuffer = await file.arrayBuffer();

      setDecodeProgress('Decoding audio data with Web Audio decoder...');
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      setDecodeProgress('Running analysisStep1tempo, analysisBPM & waveform pipeline...');
      const analysis = runAnalysisPipeline(audioBuffer);

      const customTrack: TrackMetadata = {
        id: `user_${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'User Track',
        bpm: analysis.bpm,
        key: 'Cm',
        duration: audioBuffer.duration,
        color: selectedDeck === 'deckA' ? '#06b6d4' : '#f59e0b',
        genre: 'CUSTOM',
        audioBuffer,
        analysis,
      };

      discDjEngine.loadTrack(selectedDeck, customTrack);
      setIsDecoding(false);
      onClose();
    } catch (err) {
      console.error('Audio decode error:', err);
      setDecodeProgress('Failed to decode audio. Please try a standard MP3 or WAV file.');
      setTimeout(() => setIsDecoding(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#10121a] border border-white/10 rounded-2xl p-5 w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-mono text-sm font-bold text-white tracking-wider">
                TRACK LIBRARY & AUDIO IMPORTER
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Load high-fidelity demo stems or import local MP3/WAV files
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Deck Toggle */}
        <div className="flex items-center justify-between bg-black/30 p-2.5 rounded-xl border border-white/5 mb-4">
          <span className="text-xs font-mono text-zinc-300">LOAD DESTINATION:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDeck('deckA')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                selectedDeck === 'deckA'
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              LOAD TO DECK A
            </button>
            <button
              onClick={() => setSelectedDeck('deckB')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                selectedDeck === 'deckB'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              LOAD TO DECK B
            </button>
          </div>
        </div>

        {/* Drag & Drop / File Upload Card */}
        <label className="flex flex-col items-center justify-center p-4 mb-4 border-2 border-dashed border-white/15 hover:border-cyan-400/50 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-colors group">
          <Upload className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400 mb-1.5 transition-colors" />
          <span className="text-xs font-mono font-bold text-zinc-200">
            Click to Browse or Drop MP3 / WAV File
          </span>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5">
            Instant client-side decoding with BPM estimation & RGB waveform generation
          </span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        {isDecoding && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-center mb-4">
            <span className="text-xs font-mono text-cyan-300 animate-pulse">{decodeProgress}</span>
          </div>
        )}

        {/* Demo Tracks Grid */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono text-zinc-400 font-bold tracking-wider uppercase block mb-1">
            PRE-LOADED DEMO TRACKS
          </span>

          {demoTracks.map((track) => {
            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-2.5 bg-[#141622] hover:bg-[#191c2b] border border-white/5 hover:border-white/15 rounded-xl transition-all"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shadow-inner"
                    style={{ backgroundColor: `${track.color}20`, border: `1px solid ${track.color}40` }}
                  >
                    <Disc className="w-5 h-5" style={{ color: track.color }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{track.title}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {track.artist} • {track.bpm} BPM • Key {track.key} • {track.genre}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectTrack(track)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>LOAD</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
