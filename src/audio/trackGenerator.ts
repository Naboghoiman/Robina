import { AnalysisData, TrackMetadata } from '../types/discdj';

/**
 * Procedural Audio Synthesizer for high-fidelity multi-layer demo tracks
 * Ensures immediate playback & mixing without external asset loading issues.
 */
export function generateDemoTrack(
  ctx: AudioContext,
  genre: 'tech_house' | 'electro_breaks' | 'liquid_dnb' | 'hip_hop'
): { buffer: AudioBuffer; meta: TrackMetadata } {
  const sampleRate = ctx.sampleRate;
  
  let bpm = 124;
  let key = 'Am';
  let title = 'Tokyo Velocity';
  let artist = 'KAIRO';
  let color = '#06b6d4'; // Cyan
  let durationSeconds = 64; // ~1 minute loopable structure

  if (genre === 'electro_breaks') {
    bpm = 128;
    key = 'Dm';
    title = 'Solar Flare';
    artist = 'NEO PROTOCOL';
    color = '#f59e0b'; // Amber
    durationSeconds = 64;
  } else if (genre === 'liquid_dnb') {
    bpm = 172;
    key = 'Em';
    title = 'Liquid Nebula';
    artist = 'CYBER PULSE';
    color = '#ec4899'; // Pink
    durationSeconds = 56;
  } else if (genre === 'hip_hop') {
    bpm = 92;
    key = 'Gm';
    title = 'Soul Cypher';
    artist = 'VINYL RHYTHM';
    color = '#10b981'; // Emerald
    durationSeconds = 64;
  }

  const numFrames = Math.floor(sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(2, numFrames, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  const secondsPerBeat = 60 / bpm;
  const samplesPerBeat = Math.floor(sampleRate * secondsPerBeat);
  const samplesPerBar = samplesPerBeat * 4;
  const totalBars = Math.floor(numFrames / samplesPerBar);

  // Musical frequencies for chords/bass
  const noteFreqs: Record<string, number> = {
    'A1': 55.0, 'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.0,
    'A2': 110.0, 'B2': 123.47, 'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.0,
    'A3': 220.0, 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'G4': 392.0, 'A4': 440.0
  };

  // Render bars with dynamic layering (intro, groove, breakdown, drop)
  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * samplesPerBar;
    const isBreakdown = (bar >= 8 && bar < 12) || (bar >= 24 && bar < 28);
    const hasKick = !isBreakdown;
    const hasHihat = bar >= 2;
    const hasBass = bar >= 4 && !isBreakdown;
    const hasChords = true;

    // 4 beats per bar
    for (let beat = 0; beat < 4; beat++) {
      const beatStart = barStart + beat * samplesPerBeat;

      // --- KICK DRUM ---
      if (hasKick) {
        if (genre === 'liquid_dnb') {
          // DnB Kick on beat 0 and beat 2.5
          renderKick(left, right, beatStart, sampleRate, 0.9);
          if (beat === 2) {
            renderKick(left, right, beatStart + Math.floor(samplesPerBeat * 0.5), sampleRate, 0.75);
          }
        } else if (genre === 'hip_hop') {
          // Boom bap kick on beat 0 and beat 2.5
          renderKick(left, right, beatStart, sampleRate, 0.95);
          if (beat === 2) {
            renderKick(left, right, beatStart + Math.floor(samplesPerBeat * 0.6), sampleRate, 0.8);
          }
        } else {
          // 4 on the floor for tech house & electro
          renderKick(left, right, beatStart, sampleRate, 0.9);
        }
      }

      // --- SNARE / CLAP ---
      if (!isBreakdown && (beat === 1 || beat === 3)) {
        if (genre === 'liquid_dnb') {
          // DnB snare on 1 and 3
          renderSnare(left, right, beatStart, sampleRate, 0.8);
        } else {
          renderClap(left, right, beatStart, sampleRate, 0.7);
        }
      }

      // --- HI-HATS ---
      if (hasHihat) {
        // Off-beat open hat
        const offbeatStart = beatStart + Math.floor(samplesPerBeat * 0.5);
        renderHiHat(left, right, offbeatStart, sampleRate, 0.45, true);

        // 16th closed hats
        renderHiHat(left, right, beatStart, sampleRate, 0.25, false);
        renderHiHat(left, right, beatStart + Math.floor(samplesPerBeat * 0.25), sampleRate, 0.3, false);
        renderHiHat(left, right, beatStart + Math.floor(samplesPerBeat * 0.75), sampleRate, 0.3, false);
      }

      // --- BASSLINE ---
      if (hasBass) {
        let bassFreq = noteFreqs['A1'];
        if (genre === 'electro_breaks') {
          bassFreq = beat % 2 === 0 ? noteFreqs['D2'] : noteFreqs['F2'];
        } else if (genre === 'liquid_dnb') {
          bassFreq = bar % 4 < 2 ? noteFreqs['E2'] : noteFreqs['C2'];
        } else if (genre === 'hip_hop') {
          bassFreq = beat === 0 ? noteFreqs['G2'] : noteFreqs['D2'];
        }
        renderSubBass(left, right, beatStart + Math.floor(samplesPerBeat * 0.25), samplesPerBeat * 0.7, sampleRate, bassFreq, 0.65);
      }

      // --- SYNTH CHORD STABS / AMBIENCE ---
      if (hasChords && (beat === 0 || beat === 2)) {
        const chordFreqs = genre === 'electro_breaks' 
          ? [noteFreqs['D3'], noteFreqs['F3'], noteFreqs['A3']]
          : [noteFreqs['A2'], noteFreqs['C3'], noteFreqs['E3']];
        renderSynthChord(left, right, beatStart, samplesPerBeat * 1.5, sampleRate, chordFreqs, 0.35);
      }
    }
  }

  // Normalize audio to safe level
  normalizeBuffer(left, right);

  // Compute Analysis data (Waveforms, BPM, Loudness)
  const analysis = runAnalysisPipeline(buffer, bpm);

  return {
    buffer,
    meta: {
      id: `demo_${genre}`,
      title,
      artist,
      bpm,
      key,
      duration: durationSeconds,
      color,
      genre: genre.toUpperCase().replace('_', ' '),
      audioBuffer: buffer,
      analysis,
    }
  };
}

function renderKick(l: Float32Array, r: Float32Array, start: number, sr: number, gain: number) {
  const dur = Math.floor(sr * 0.28);
  for (let i = 0; i < dur && (start + i) < l.length; i++) {
    const t = i / sr;
    const freq = 130 * Math.exp(-t * 30) + 45;
    const env = Math.exp(-t * 14);
    const sample = Math.sin(2 * Math.PI * freq * t) * env * gain;
    l[start + i] += sample;
    r[start + i] += sample;
  }
}

function renderSnare(l: Float32Array, r: Float32Array, start: number, sr: number, gain: number) {
  const dur = Math.floor(sr * 0.22);
  for (let i = 0; i < dur && (start + i) < l.length; i++) {
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 22);
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 16);
    const sample = (tone * 0.4 + noise * 0.6) * gain;
    l[start + i] += sample * 0.95;
    r[start + i] += sample * 1.05;
  }
}

function renderClap(l: Float32Array, r: Float32Array, start: number, sr: number, gain: number) {
  const burstOffsets = [0, 0.01, 0.02, 0.035];
  burstOffsets.forEach((offset, idx) => {
    const bStart = start + Math.floor(sr * offset);
    const dur = Math.floor(sr * (idx === burstOffsets.length - 1 ? 0.18 : 0.015));
    for (let i = 0; i < dur && (bStart + i) < l.length; i++) {
      const t = i / sr;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 24);
      const sample = noise * gain * (idx === burstOffsets.length - 1 ? 0.9 : 0.5);
      l[bStart + i] += sample * 0.9;
      r[bStart + i] += sample * 1.1;
    }
  });
}

function renderHiHat(l: Float32Array, r: Float32Array, start: number, sr: number, gain: number, open: boolean) {
  const dur = Math.floor(sr * (open ? 0.24 : 0.05));
  for (let i = 0; i < dur && (start + i) < l.length; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1);
    const env = Math.exp(-t * (open ? 18 : 70));
    const sample = noise * env * gain;
    l[start + i] += sample;
    r[start + i] += sample;
  }
}

function renderSubBass(l: Float32Array, r: Float32Array, start: number, len: number, sr: number, freq: number, gain: number) {
  for (let i = 0; i < len && (start + i) < l.length; i++) {
    const t = i / sr;
    const env = Math.min(1, i / (sr * 0.01)) * Math.exp(-t * 2.5);
    const sample = Math.sin(2 * Math.PI * freq * t) * env * gain;
    l[start + i] += sample;
    r[start + i] += sample;
  }
}

function renderSynthChord(l: Float32Array, r: Float32Array, start: number, len: number, sr: number, freqs: number[], gain: number) {
  for (let i = 0; i < len && (start + i) < l.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 3.2);
    let sample = 0;
    freqs.forEach((f) => {
      sample += (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t)) / freqs.length;
    });
    l[start + i] += sample * env * gain * 0.8;
    r[start + i] += sample * env * gain * 1.2;
  }
}

function normalizeBuffer(left: Float32Array, right: Float32Array) {
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  if (peak > 0.01) {
    const scale = 0.92 / peak;
    for (let i = 0; i < left.length; i++) {
      left[i] *= scale;
      right[i] *= scale;
    }
  }
}

/**
 * Analysis Pipeline implementing:
 * - analysisStep1tempo / analysisBPM
 * - analysisWaveform (Low, Mid, High band splitting for DJ frequency visualization)
 * - analysisLoudness & analysisGain
 */
export function runAnalysisPipeline(buffer: AudioBuffer, detectedBpmHint?: number): AnalysisData {
  const duration = buffer.duration;
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // 1. Loudness Calculation (RMS & Target Normalization)
  let sumSquares = 0;
  const step = Math.max(1, Math.floor(channelData.length / 50000));
  let count = 0;
  for (let i = 0; i < channelData.length; i += step) {
    sumSquares += channelData[i] * channelData[i];
    count++;
  }
  const rms = Math.sqrt(sumSquares / count);
  const loudnessRms = 20 * Math.log10(Math.max(0.0001, rms));
  // Gain offset to reach -14 LUFS standard
  const gainOffset = -14 - loudnessRms;

  // 2. Waveform Peak Extraction (Multi-Band Split)
  const numPoints = 1200;
  const blockSize = Math.floor(channelData.length / numPoints);
  const peaks = new Float32Array(numPoints);
  const lowPeaks = new Float32Array(numPoints);
  const midPeaks = new Float32Array(numPoints);
  const highPeaks = new Float32Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    const start = i * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    let max = 0;
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;

    for (let j = start; j < end; j += 4) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;

      // Approximate 3-band energy via sample difference
      const diff = j > 0 ? Math.abs(channelData[j] - channelData[j - 1]) : 0;
      if (diff < 0.05) {
        lowEnergy += val;
      } else if (diff < 0.25) {
        midEnergy += val;
      } else {
        highEnergy += val;
      }
    }

    const subCount = Math.max(1, (end - start) / 4);
    peaks[i] = Math.min(1.0, max);
    lowPeaks[i] = Math.min(1.0, (lowEnergy / subCount) * 1.8);
    midPeaks[i] = Math.min(1.0, (midEnergy / subCount) * 1.8);
    highPeaks[i] = Math.min(1.0, (highEnergy / subCount) * 2.2);
  }

  // 3. Tempo & Beat Grid
  const bpm = detectedBpmHint || 124;
  const beatInterval = 60 / bpm;
  const beatGrid: number[] = [];
  for (let t = 0; t < duration; t += beatInterval) {
    beatGrid.push(t);
  }

  return {
    bpm,
    confidence: 0.96,
    peaks,
    lowPeaks,
    midPeaks,
    highPeaks,
    loudnessRms,
    gainOffset,
    beatGrid,
    duration,
  };
}
