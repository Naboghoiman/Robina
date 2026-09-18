import { SamplerPadItem } from '../types/discdj';

export const DEFAULT_SAMPLER_PADS: SamplerPadItem[] = [
  { id: 1, name: 'AIR HORN', category: 'fx', color: '#f43f5e', mode: 'one_shot', volume: 0.9, isPlaying: false },
  { id: 2, name: 'SIREN ALARM', category: 'fx', color: '#fb923c', mode: 'hold', volume: 0.85, isPlaying: false },
  { id: 3, name: 'LASER ZAP', category: 'fx', color: '#38bdf8', mode: 'one_shot', volume: 0.8, isPlaying: false },
  { id: 4, name: '808 SUB DROP', category: 'drum', color: '#a855f7', mode: 'one_shot', volume: 0.95, isPlaying: false },
  { id: 5, name: 'SCRATCH AH', category: 'vocal', color: '#eab308', mode: 'one_shot', volume: 0.85, isPlaying: false },
  { id: 6, name: 'SPINBACK FX', category: 'fx', color: '#ec4899', mode: 'one_shot', volume: 0.9, isPlaying: false },
  { id: 7, name: 'PUNCH KICK', category: 'drum', color: '#ef4444', mode: 'one_shot', volume: 0.95, isPlaying: false },
  { id: 8, name: 'CRISP SNARE', category: 'drum', color: '#10b981', mode: 'one_shot', volume: 0.9, isPlaying: false },
  { id: 9, name: 'HI-HAT ROLL', category: 'drum', color: '#06b6d4', mode: 'hold', volume: 0.8, isPlaying: false },
  { id: 10, name: 'STADIUM CLAP', category: 'drum', color: '#84cc16', mode: 'one_shot', volume: 0.85, isPlaying: false },
  { id: 11, name: 'IMPACT BOOM', category: 'fx', color: '#6366f1', mode: 'one_shot', volume: 0.9, isPlaying: false },
  { id: 12, name: 'VOCAL DROP', category: 'vocal', color: '#f472b6', mode: 'one_shot', volume: 0.9, isPlaying: false },
];

/**
 * Synthesizes high-impact performance sounds for the 12-pad sampler
 */
export function synthesizeSamplerSound(ctx: AudioContext, padId: number): AudioBuffer {
  const sr = ctx.sampleRate;

  switch (padId) {
    case 1: { // AIR HORN
      const dur = 1.0;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      const fundamental = 392.0; // G4
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const env = t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 1.8);
        const pitchDrift = 1 + 0.04 * Math.sin(2 * Math.PI * 8 * t);
        const s = (
          Math.sin(2 * Math.PI * fundamental * pitchDrift * t) * 0.5 +
          Math.sin(2 * Math.PI * fundamental * 1.5 * pitchDrift * t) * 0.35 +
          Math.sin(2 * Math.PI * fundamental * 2.0 * pitchDrift * t) * 0.25 +
          Math.sin(2 * Math.PI * fundamental * 2.5 * pitchDrift * t) * 0.15
        );
        data[i] = Math.tanh(s * 2.2) * env * 0.8;
      }
      return buf;
    }

    case 2: { // SIREN ALARM
      const dur = 1.6;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const lfo = Math.sin(2 * Math.PI * 3.5 * t);
        const freq = 650 + lfo * 280;
        const sample = Math.sin(2 * Math.PI * freq * t);
        const env = t < 0.05 ? t / 0.05 : t > dur - 0.1 ? (dur - t) / 0.1 : 1.0;
        data[i] = sample * env * 0.75;
      }
      return buf;
    }

    case 3: { // LASER ZAP
      const dur = 0.45;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const freq = 2200 * Math.exp(-t * 14) + 120;
        const env = Math.exp(-t * 7);
        data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
      }
      return buf;
    }

    case 4: { // 808 SUB DROP
      const dur = 1.5;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const freq = 110 * Math.exp(-t * 2.2) + 32;
        const env = Math.exp(-t * 1.8);
        const dist = Math.tanh(Math.sin(2 * Math.PI * freq * t) * 1.8);
        data[i] = dist * env * 0.9;
      }
      return buf;
    }

    case 5: { // SCRATCH AH
      const dur = 0.5;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        // Scratch forward and back motion
        const speed = Math.sin(2 * Math.PI * 4 * t);
        const freq = 440 + speed * 220;
        const formant1 = Math.sin(2 * Math.PI * freq * t);
        const formant2 = Math.sin(2 * Math.PI * (freq * 1.6) * t) * 0.6;
        const noise = (Math.random() * 2 - 1) * 0.15;
        const env = Math.exp(-t * 3.5);
        data[i] = Math.tanh((formant1 + formant2 + noise) * 1.6) * env * 0.8;
      }
      return buf;
    }

    case 6: { // SPINBACK FX
      const dur = 0.85;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        // Exponential deceleration of turntable friction
        const spinSpeed = Math.max(0.1, 1.0 - (t / dur));
        const freq = 800 * spinSpeed * (1 + 0.3 * Math.sin(2 * Math.PI * 40 * t * spinSpeed));
        const vinylNoise = (Math.random() * 2 - 1) * 0.25;
        const env = Math.max(0, 1 - t / dur);
        data[i] = (Math.sin(2 * Math.PI * freq * t) * 0.6 + vinylNoise) * env * 0.85;
      }
      return buf;
    }

    case 7: { // PUNCH KICK
      const dur = 0.35;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const freq = 180 * Math.exp(-t * 38) + 48;
        const click = t < 0.005 ? (Math.random() * 2 - 1) * 0.5 : 0;
        const env = Math.exp(-t * 12);
        data[i] = (Math.sin(2 * Math.PI * freq * t) + click) * env * 0.95;
      }
      return buf;
    }

    case 8: { // CRISP SNARE
      const dur = 0.3;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const body = Math.sin(2 * Math.PI * 210 * t) * Math.exp(-t * 26);
        const snap = (Math.random() * 2 - 1) * Math.exp(-t * 18);
        data[i] = (body * 0.45 + snap * 0.75) * 0.88;
      }
      return buf;
    }

    case 9: { // HI-HAT ROLL
      const dur = 0.6;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      const rollInterval = 0.075; // fast 32nd notes
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const beatT = t % rollInterval;
        const env = Math.exp(-beatT * 55);
        const noise = (Math.random() * 2 - 1);
        data[i] = noise * env * 0.7;
      }
      return buf;
    }

    case 10: { // STADIUM CLAP
      const dur = 0.45;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      const echoes = [0, 0.015, 0.03, 0.05];
      echoes.forEach((offset, idx) => {
        const s = Math.floor(sr * offset);
        for (let i = 0; i < sr * 0.25 && s + i < data.length; i++) {
          const t = i / sr;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 22);
          data[s + i] += noise * (idx === echoes.length - 1 ? 0.8 : 0.4);
        }
      });
      return buf;
    }

    case 11: { // IMPACT BOOM
      const dur = 1.4;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const sub = Math.sin(2 * Math.PI * (80 * Math.exp(-t * 3) + 30) * t) * Math.exp(-t * 2.2);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.5;
        data[i] = (sub + noise) * 0.9;
      }
      return buf;
    }

    case 12: { // VOCAL DROP
      const dur = 0.9;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      // Synthesized pitched vocal syllable with pitch drop
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const f0 = 240 * Math.exp(-t * 2.5) + 90;
        const formantA = Math.sin(2 * Math.PI * f0 * t);
        const formantB = Math.sin(2 * Math.PI * (f0 * 2.5) * t) * 0.4;
        const formantC = Math.sin(2 * Math.PI * (f0 * 4.2) * t) * 0.2;
        const env = t < 0.04 ? t / 0.04 : Math.exp(-(t - 0.04) * 2.8);
        data[i] = Math.tanh((formantA + formantB + formantC) * 1.5) * env * 0.8;
      }
      return buf;
    }

    default: {
      const dur = 0.2;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      return buf;
    }
  }
}
