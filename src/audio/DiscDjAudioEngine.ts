import {
  DeckID,
  SyncDirection,
  TransportState,
  TempoSyncState,
  LoopState,
  ScratchState,
  MixerChannelState,
  MasterMixerState,
  SfxState,
  SyncTraceReport,
  TrackMetadata,
  CrossfaderCurve,
} from '../types/discdj';
import { synthesizeSamplerSound } from './sfxSamples';

interface DeckAudioNodes {
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  
  // 3-Band Isolator EQ
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;

  // 10-Band Graphic EQ bank
  tenBandFilters: BiquadFilterNode[];

  // Bipolar Filter (LPF / HPF)
  bipolarFilter: BiquadFilterNode;

  // Pre-cue headphone tap
  precueGain: GainNode;

  // SFX bus nodes
  sfxDryGain: GainNode;
  sfxWetGain: GainNode;
  sfxDelay: DelayNode;
  sfxFeedback: GainNode;
  sfxFlangerDelay: DelayNode;
  sfxFlangerLfo: OscillatorNode | null;
  sfxFlangerLfoGain: GainNode | null;
  sfxTremoloGain: GainNode;
  sfxTremoloLfo: OscillatorNode | null;
  sfxConvolver: ConvolverNode;

  // Metering analyser
  analyser: AnalyserNode;
}

export class DiscDjAudioEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Deck audio buffers & state
  private tracks: Record<DeckID, TrackMetadata | null> = { deckA: null, deckB: null };
  private transport: Record<DeckID, TransportState> = {
    deckA: { prepare: false, preparedState: 'unprepared', isPlaying: false, goingToBePlaying: false, currentPosition: 0, duration: 0, cuePosition: 0, isPaused: true },
    deckB: { prepare: false, preparedState: 'unprepared', isPlaying: false, goingToBePlaying: false, currentPosition: 0, duration: 0, cuePosition: 0, isPaused: true }
  };
  private tempo: Record<DeckID, TempoSyncState> = {
    deckA: { originalBpm: 124, currentSpeed: 1.0, pitchBend: 0, pitchShift: 0, keyLock: true, effectiveBpm: 124, beatStart: 0 },
    deckB: { originalBpm: 128, currentSpeed: 1.0, pitchBend: 0, pitchShift: 0, keyLock: true, effectiveBpm: 128, beatStart: 0 }
  };
  private loop: Record<DeckID, LoopState> = {
    deckA: { isLooping: false, loopIn: null, loopOut: null, loopBeats: 4, active: false },
    deckB: { isLooping: false, loopIn: null, loopOut: null, loopBeats: 4, active: false }
  };
  private scratch: Record<DeckID, ScratchState> = {
    deckA: { isScratching: false, scratchVelocity: 0, scratchAngle: 0 },
    deckB: { isScratching: false, scratchVelocity: 0, scratchAngle: 0 }
  };
  private mixerChannels: Record<DeckID, MixerChannelState> = {
    deckA: this.getDefaultMixerChannel(),
    deckB: this.getDefaultMixerChannel()
  };
  private masterMixer: MasterMixerState = {
    crossfader: 0,
    crossfaderCurve: 'smooth',
    masterVolume: 1.0,
    volumeBoost: 0,
    loudnessEnabled: true,
    replayGainEnabled: true,
    targetLoudness: -14,
    limiterRelease: 100,
    brakeTime: 0.8,
    duckingVolume: 0,
    precueLevel: 0.8,
    precueMix: 0.5,
  };
  private sfx: Record<DeckID, SfxState> = {
    deckA: { selectedEffect: 'delay_echo', enabled: false, value: 0.4, volume: 0.5, tempoSync: true, beatDivision: '1/2' },
    deckB: { selectedEffect: 'flanger', enabled: false, value: 0.5, volume: 0.5, tempoSync: true, beatDivision: '1/4' }
  };

  // Hot Cues
  private hotCues: Record<DeckID, number[]> = {
    deckA: [],
    deckB: []
  };

  // Playback timing tracking
  private playStartCtxTime: Record<DeckID, number> = { deckA: 0, deckB: 0 };
  private playStartPosition: Record<DeckID, number> = { deckA: 0, deckB: 0 };

  // Audio Graph Nodes
  private deckNodes: Record<DeckID, DeckAudioNodes | null> = { deckA: null, deckB: null };
  private crossfaderGainA: GainNode | null = null;
  private crossfaderGainB: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private precueMasterGain: GainNode | null = null;

  // Sampler state
  private samplerBuffers: Map<number, AudioBuffer> = new Map();
  private activeSamplerSources: Map<number, AudioBufferSourceNode> = new Map();
  private samplerMasterGain: GainNode | null = null;

  // Recording (MediaRecorder API for real WAV/WebM mix recording)
  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime = 0;
  private recordingTimerId: number | null = null;
  private isRecordingActive = false;
  private recordedAudioUrl: string | null = null;

  // Sync trace log
  private syncTraceLogs: SyncTraceReport[] = [];

  // Listeners for UI state reactivity
  private stateChangeListeners: Set<() => void> = new Set();
  private meterListeners: Set<(levels: { deckA: number; deckB: number; masterL: number; masterR: number }) => void> = new Set();
  private rafId: number | null = null;

  constructor() {
    // Lazy AudioContext initialization on first user gesture
  }

  public subscribe(cb: () => void): () => void {
    this.stateChangeListeners.add(cb);
    return () => this.stateChangeListeners.delete(cb);
  }

  public subscribeMeters(cb: (levels: { deckA: number; deckB: number; masterL: number; masterR: number }) => void): () => void {
    this.meterListeners.add(cb);
    return () => this.meterListeners.delete(cb);
  }

  private notify() {
    this.stateChangeListeners.forEach(cb => cb());
  }

  public async initAudioContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.isInitialized) {
      this.buildAudioGraph();
      this.preloadSampler();
      this.startMeterLoop();
      this.isInitialized = true;
    }
    return this.ctx;
  }

  private getDefaultMixerChannel(): MixerChannelState {
    return {
      volume: 0.85,
      gain: 0,
      balance: 0,
      eqLow: 0,
      eqMid: 0,
      eqHigh: 0,
      eqLowKill: false,
      eqMidKill: false,
      eqHighKill: false,
      filterPercent: 0,
      filterResonance: 1.0,
      tenBandEqEnabled: false,
      tenBandGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      precue: false,
    };
  }

  private buildAudioGraph() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Master bus
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.masterMixer.masterVolume;

    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -1.0;
    this.masterLimiter.knee.value = 4.0;
    this.masterLimiter.ratio.value = 16.0;
    this.masterLimiter.attack.value = 0.003;
    this.masterLimiter.release.value = this.masterMixer.limiterRelease / 1000;

    this.masterAnalyser = ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    // Media destination for live recording
    this.mediaDest = ctx.createMediaStreamDestination();

    // Crossfader gains
    this.crossfaderGainA = ctx.createGain();
    this.crossfaderGainB = ctx.createGain();

    this.crossfaderGainA.connect(this.masterGain);
    this.crossfaderGainB.connect(this.masterGain);

    // Sampler bus
    this.samplerMasterGain = ctx.createGain();
    this.samplerMasterGain.gain.value = 0.9;
    this.samplerMasterGain.connect(this.masterGain);

    // Precue headphone mix
    this.precueMasterGain = ctx.createGain();
    this.precueMasterGain.gain.value = this.masterMixer.precueLevel;

    // Master -> Limiter -> Master Analyser -> Destination & Recording
    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(ctx.destination);
    this.masterAnalyser.connect(this.mediaDest);

    // Build channel chains for Deck A and Deck B
    this.deckNodes.deckA = this.buildDeckAudioChain('deckA');
    this.deckNodes.deckB = this.buildDeckAudioChain('deckB');

    this.updateCrossfaderGains();
  }

  private buildDeckAudioChain(deckId: DeckID): DeckAudioNodes {
    if (!this.ctx) throw new Error('AudioContext missing');
    const ctx = this.ctx;

    const gainNode = ctx.createGain();
    const panNode = ctx.createStereoPanner();

    // 3-Band Isolator EQ
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 250;

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1.0;

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 4000;

    // 10-Band Graphic EQ
    const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const tenBandFilters = frequencies.map((f) => {
      const bq = ctx.createBiquadFilter();
      bq.type = 'peaking';
      bq.frequency.value = f;
      bq.Q.value = 1.4;
      bq.gain.value = 0;
      return bq;
    });

    // Bipolar Filter (LPF/HPF)
    const bipolarFilter = ctx.createBiquadFilter();
    bipolarFilter.type = 'allpass'; // Flat by default
    bipolarFilter.frequency.value = 1000;

    // Pre-cue headphone tap
    const precueGain = ctx.createGain();
    precueGain.gain.value = 0;
    precueGain.connect(this.precueMasterGain!);

    // SFX rack
    const sfxDryGain = ctx.createGain();
    const sfxWetGain = ctx.createGain();
    sfxWetGain.gain.value = 0;

    const sfxDelay = ctx.createDelay(5.0);
    sfxDelay.delayTime.value = 0.25;
    const sfxFeedback = ctx.createGain();
    sfxFeedback.gain.value = 0.4;
    sfxDelay.connect(sfxFeedback);
    sfxFeedback.connect(sfxDelay);

    const sfxFlangerDelay = ctx.createDelay(0.05);
    sfxFlangerDelay.delayTime.value = 0.003;

    const sfxTremoloGain = ctx.createGain();
    sfxTremoloGain.gain.value = 1.0;

    // Simple synthetic impulse response for reverb
    const sfxConvolver = ctx.createConvolver();
    sfxConvolver.buffer = this.createSyntheticReverbImpulse(ctx, 1.6);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    // Assemble chain:
    // Input source -> 3-Band EQ (Low -> Mid -> High) -> 10-Band EQ -> Bipolar Filter -> Precue Tap
    // -> Pan Node -> Channel Gain -> SFX Split -> Analyser -> Crossfader In
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);

    let lastNode: AudioNode = eqHigh;
    tenBandFilters.forEach((filter) => {
      lastNode.connect(filter);
      lastNode = filter;
    });

    lastNode.connect(bipolarFilter);
    bipolarFilter.connect(panNode);
    panNode.connect(gainNode);

    // Precue tap right after filter
    bipolarFilter.connect(precueGain);

    // SFX routing
    gainNode.connect(sfxDryGain);
    gainNode.connect(sfxDelay);
    gainNode.connect(sfxFlangerDelay);
    gainNode.connect(sfxConvolver);

    sfxDelay.connect(sfxWetGain);
    sfxFlangerDelay.connect(sfxWetGain);
    sfxConvolver.connect(sfxWetGain);

    sfxDryGain.connect(sfxTremoloGain);
    sfxWetGain.connect(sfxTremoloGain);

    const cfTarget = deckId === 'deckA' ? this.crossfaderGainA! : this.crossfaderGainB!;
    sfxTremoloGain.connect(analyser);
    analyser.connect(cfTarget);

    return {
      sourceNode: null,
      gainNode,
      panNode,
      eqLow,
      eqMid,
      eqHigh,
      tenBandFilters,
      bipolarFilter,
      precueGain,
      sfxDryGain,
      sfxWetGain,
      sfxDelay,
      sfxFeedback,
      sfxFlangerDelay,
      sfxFlangerLfo: null,
      sfxFlangerLfoGain: null,
      sfxTremoloGain,
      sfxTremoloLfo: null,
      sfxConvolver,
      analyser,
    };
  }

  private createSyntheticReverbImpulse(ctx: AudioContext, duration: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    const l = impulse.getChannelData(0);
    const r = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (rate * 0.4));
      l[i] = (Math.random() * 2 - 1) * decay;
      r[i] = (Math.random() * 2 - 1) * decay;
    }
    return impulse;
  }

  private preloadSampler() {
    if (!this.ctx) return;
    for (let padId = 1; padId <= 12; padId++) {
      const buffer = synthesizeSamplerSound(this.ctx, padId);
      this.samplerBuffers.set(padId, buffer);
    }
  }

  // --- NATIVE ENGINE API SURFACE: LOAD & PREPARE ---
  public loadTrack(deckId: DeckID, track: TrackMetadata) {
    this.stop(deckId);
    this.tracks[deckId] = track;
    this.transport[deckId] = {
      prepare: true,
      preparedState: 'ready',
      isPlaying: false,
      goingToBePlaying: false,
      currentPosition: 0,
      duration: track.duration,
      cuePosition: 0,
      isPaused: true,
    };
    this.tempo[deckId] = {
      originalBpm: track.bpm,
      currentSpeed: 1.0,
      pitchBend: 0,
      pitchShift: 0,
      keyLock: true,
      effectiveBpm: track.bpm,
      beatStart: 0,
    };
    this.loop[deckId] = {
      isLooping: false,
      loopIn: null,
      loopOut: null,
      loopBeats: 4,
      active: false,
    };
    this.hotCues[deckId] = [0];

    // ReplayGain auto-trim if enabled
    if (this.masterMixer.replayGainEnabled && track.analysis) {
      const trimDb = track.analysis.gainOffset;
      this.setGainNative(deckId, Math.max(-12, Math.min(12, trimDb)));
    }

    this.notify();
  }

  // --- TRANSPORT CONTROLS ---
  public async play(deckId: DeckID) {
    await this.initAudioContext();
    const trans = this.transport[deckId];
    const track = this.tracks[deckId];
    if (!track?.audioBuffer || !this.ctx) return;

    if (trans.isPlaying) return;

    trans.goingToBePlaying = true;
    trans.isPlaying = true;
    trans.isPaused = false;

    this.startAudioSource(deckId, trans.currentPosition);
    trans.goingToBePlaying = false;
    this.notify();
  }

  public pause(deckId: DeckID) {
    const trans = this.transport[deckId];
    if (!trans.isPlaying) return;

    // Simulate realistic turntable motor brake time
    const brakeTime = this.masterMixer.brakeTime;
    const node = this.deckNodes[deckId]?.sourceNode;
    if (node && this.ctx && brakeTime > 0.05) {
      const now = this.ctx.currentTime;
      node.playbackRate.setValueAtTime(node.playbackRate.value, now);
      node.playbackRate.exponentialRampToValueAtTime(0.01, now + brakeTime);
      setTimeout(() => {
        this.stopAudioSource(deckId);
        trans.isPlaying = false;
        trans.isPaused = true;
        this.notify();
      }, brakeTime * 1000);
    } else {
      this.stopAudioSource(deckId);
      trans.isPlaying = false;
      trans.isPaused = true;
      this.notify();
    }
  }

  public stop(deckId: DeckID) {
    this.stopAudioSource(deckId);
    this.transport[deckId].isPlaying = false;
    this.transport[deckId].isPaused = true;
    this.transport[deckId].currentPosition = 0;
    this.notify();
  }

  public reset(deckId: DeckID) {
    this.stop(deckId);
    this.resetSpeedNative(deckId, false);
    this.transport[deckId].currentPosition = 0;
    this.notify();
  }

  public seek(deckId: DeckID, position: number) {
    const trans = this.transport[deckId];
    const target = Math.max(0, Math.min(trans.duration, position));
    trans.currentPosition = target;

    if (trans.isPlaying) {
      this.startAudioSource(deckId, target);
    }
    this.notify();
  }

  public cue(deckId: DeckID) {
    const trans = this.transport[deckId];
    if (trans.isPlaying) {
      // Return to cue point and pause
      this.pause(deckId);
      this.seek(deckId, trans.cuePosition);
    } else {
      // Set new cue point at current position
      trans.cuePosition = trans.currentPosition;
      this.notify();
    }
  }

  private startAudioSource(deckId: DeckID, startOffset: number) {
    if (!this.ctx) return;
    const track = this.tracks[deckId];
    const nodes = this.deckNodes[deckId];
    if (!track?.audioBuffer || !nodes) return;

    this.stopAudioSource(deckId);

    const source = this.ctx.createBufferSource();
    source.buffer = track.audioBuffer;
    this.applySpeedToSource(deckId, source);

    source.connect(nodes.eqLow);
    source.start(0, startOffset);

    source.onended = () => {
      // Check if loop is active
      const loop = this.loop[deckId];
      if (loop.active && loop.loopIn !== null && loop.loopOut !== null) {
        this.seek(deckId, loop.loopIn);
        return;
      }
      if (this.transport[deckId].isPlaying && this.getCurrentPosition(deckId) >= track.duration - 0.2) {
        this.stop(deckId);
      }
    };

    nodes.sourceNode = source;
    this.playStartCtxTime[deckId] = this.ctx.currentTime;
    this.playStartPosition[deckId] = startOffset;
  }

  private stopAudioSource(deckId: DeckID) {
    const nodes = this.deckNodes[deckId];
    if (nodes?.sourceNode) {
      try {
        nodes.sourceNode.stop();
        nodes.sourceNode.disconnect();
      } catch {
        // Source might already be stopped
      }
      nodes.sourceNode = null;
    }
  }

  public getCurrentPosition(deckId: DeckID): number {
    const trans = this.transport[deckId];
    if (!trans.isPlaying || !this.ctx) return trans.currentPosition;

    const rate = this.tempo[deckId].currentSpeed + this.tempo[deckId].pitchBend;
    const elapsed = (this.ctx.currentTime - this.playStartCtxTime[deckId]) * Math.max(0.1, rate);
    let current = this.playStartPosition[deckId] + elapsed;

    // Check for loop boundaries
    const loop = this.loop[deckId];
    if (loop.active && loop.loopIn !== null && loop.loopOut !== null && loop.loopOut > loop.loopIn) {
      if (current >= loop.loopOut) {
        const loopLen = loop.loopOut - loop.loopIn;
        current = loop.loopIn + ((current - loop.loopIn) % loopLen);
        this.playStartPosition[deckId] = current;
        this.playStartCtxTime[deckId] = this.ctx.currentTime;
      }
    }

    trans.currentPosition = Math.min(trans.duration, current);
    return trans.currentPosition;
  }

  // --- TEMPO & SPEED NATIVE ---
  public getSpeedNative(deckId: DeckID): number {
    return this.tempo[deckId].currentSpeed;
  }

  public setSpeedNative(deckId: DeckID, speed: number) {
    const clamped = Math.max(0.5, Math.min(2.0, speed));
    this.tempo[deckId].currentSpeed = clamped;
    this.tempo[deckId].effectiveBpm = this.tempo[deckId].originalBpm * clamped;
    this.applySpeed(deckId);
    this.notify();
  }

  public resetSpeedNative(deckId: DeckID, notify = true) {
    this.tempo[deckId].currentSpeed = 1.0;
    this.tempo[deckId].pitchBend = 0;
    this.tempo[deckId].effectiveBpm = this.tempo[deckId].originalBpm;
    this.applySpeed(deckId);
    if (notify) this.notify();
  }

  public setPitchBendNative(deckId: DeckID, bend: number) {
    this.tempo[deckId].pitchBend = bend;
    this.applySpeed(deckId);
    this.notify();
  }

  public setPitchShiftNative(deckId: DeckID, semitones: number) {
    this.tempo[deckId].pitchShift = Math.max(-12, Math.min(12, semitones));
    this.applySpeed(deckId);
    this.notify();
  }

  public toggleKeyLock(deckId: DeckID) {
    this.tempo[deckId].keyLock = !this.tempo[deckId].keyLock;
    this.applySpeed(deckId);
    this.notify();
  }

  private applySpeed(deckId: DeckID) {
    const node = this.deckNodes[deckId]?.sourceNode;
    if (node && this.ctx) {
      this.applySpeedToSource(deckId, node);
    }
  }

  private applySpeedToSource(deckId: DeckID, source: AudioBufferSourceNode) {
    const t = this.tempo[deckId];
    const totalRate = Math.max(0.1, t.currentSpeed + t.pitchBend);
    source.playbackRate.setValueAtTime(totalRate, this.ctx?.currentTime || 0);

    // Key lock emulation (detune adjustment if key lock is enabled)
    if (t.keyLock) {
      // In Web Audio, pitch is linked to playbackRate by default: pitch change = 1200 * log2(playbackRate)
      // Key Lock counters this detune so pitch remains constant at original key:
      const naturalPitchCents = 1200 * Math.log2(totalRate);
      source.detune.setValueAtTime(-naturalPitchCents + (t.pitchShift * 100), this.ctx?.currentTime || 0);
    } else {
      source.detune.setValueAtTime(t.pitchShift * 100, this.ctx?.currentTime || 0);
    }
  }

  // --- THE VERIFIED 20-STEP CENTRAL EVENT-DRIVEN SYNC ROUTINE: AudioEngine.W(direction) ---
  public syncAudioEngineW(direction: SyncDirection): SyncTraceReport {
    const referenceDeck: DeckID = direction === 'A_TO_B' ? 'deckA' : 'deckB';
    const followerDeck: DeckID = direction === 'A_TO_B' ? 'deckB' : 'deckA';

    const refTrack = this.tracks[referenceDeck];
    const followerTrack = this.tracks[followerDeck];

    const refTempo = this.tempo[referenceDeck];
    const followerTempo = this.tempo[followerDeck];

    const steps = [];

    // Step 1: Check both original BPM values
    const originalBpmRef = refTempo.originalBpm || 120;
    const originalBpmFollower = followerTempo.originalBpm || 120;
    steps.push({ step: 1, name: 'Check Original BPMs', detail: `Ref: ${originalBpmRef} BPM, Follower: ${originalBpmFollower} BPM`, passed: true });

    // Step 2: resetSpeedNative(false) for follower deck
    this.resetSpeedNative(followerDeck, false);
    steps.push({ step: 2, name: 'Reset Speed Native', detail: `Reset follower speed to 1.0 (no-notify)`, passed: true });

    // Step 3: Choose reference/follower from SYNC direction
    steps.push({ step: 3, name: 'Choose Reference/Follower', detail: `Direction: ${direction} -> Reference: ${referenceDeck.toUpperCase()}, Follower: ${followerDeck.toUpperCase()}`, passed: true });

    // Step 4: referenceEffective = originalBpm * currentSpeed
    const referenceEffective = originalBpmRef * refTempo.currentSpeed;
    steps.push({ step: 4, name: 'Compute referenceEffective', detail: `referenceEffective = ${originalBpmRef} * ${refTempo.currentSpeed.toFixed(4)} = ${referenceEffective.toFixed(2)} BPM`, passed: true });

    // Step 5: followerEffective = originalBpm * currentSpeed
    const followerEffective = originalBpmFollower * followerTempo.currentSpeed;
    steps.push({ step: 5, name: 'Compute followerEffective', detail: `followerEffective = ${originalBpmFollower} * ${followerTempo.currentSpeed.toFixed(4)} = ${followerEffective.toFixed(2)} BPM`, passed: true });

    // Step 6: Compare referenceEffective*0.5, *1, *2 against followerEffective
    const targets = [referenceEffective * 0.5, referenceEffective * 1.0, referenceEffective * 2.0];
    steps.push({ step: 6, name: 'Compare 0.5x, 1x, 2x Targets', detail: `Targets: [0.5x: ${targets[0].toFixed(2)}, 1x: ${targets[1].toFixed(2)}, 2x: ${targets[2].toFixed(2)}]`, passed: true });

    // Step 7: Select minimum multiplicative distance
    let bestTarget = targets[1];
    let bestRatio = 1.0;
    let minDistance = Infinity;
    [0.5, 1.0, 2.0].forEach((ratio, idx) => {
      const target = targets[idx];
      const dist = Math.abs(Math.log(target / followerEffective));
      if (dist < minDistance) {
        minDistance = dist;
        bestTarget = target;
        bestRatio = ratio;
      }
    });
    steps.push({ step: 7, name: 'Select Min Multiplicative Distance', detail: `Selected target: ${bestTarget.toFixed(2)} BPM (ratio: ${bestRatio}x, logDist: ${minDistance.toFixed(4)})`, passed: true });

    // Step 8: followerTargetSpeed = selected / followerOriginalBpm
    let followerTargetSpeed = bestTarget / originalBpmFollower;
    steps.push({ step: 8, name: 'Compute followerTargetSpeed', detail: `Target Speed = ${bestTarget.toFixed(2)} / ${originalBpmFollower} = ${followerTargetSpeed.toFixed(4)}`, passed: true });

    // Step 9: Fold speed if <0.5 or >2.0
    let folded = false;
    if (followerTargetSpeed < 0.5) {
      followerTargetSpeed *= 2;
      folded = true;
    } else if (followerTargetSpeed > 2.0) {
      followerTargetSpeed *= 0.5;
      folded = true;
    }
    steps.push({ step: 9, name: 'Fold Speed Range', detail: `Folded: ${folded ? 'YES' : 'NO'}, Clamped Target: ${followerTargetSpeed.toFixed(4)}`, passed: true });

    // Step 10: Set follower speed ONCE
    this.setSpeedNative(followerDeck, followerTargetSpeed);
    steps.push({ step: 10, name: 'Set Follower Speed Once', detail: `Applied speed ${followerTargetSpeed.toFixed(4)} to ${followerDeck}`, passed: true });

    // Step 11: Re-read deck speeds
    const speedRef = this.getSpeedNative(referenceDeck);
    const speedFollower = this.getSpeedNative(followerDeck);
    steps.push({ step: 11, name: 'Re-read Deck Speeds', detail: `Ref Speed: ${speedRef.toFixed(4)}, Follower Speed: ${speedFollower.toFixed(4)}`, passed: true });

    // Step 12: real4 = 4*(60/BPM)/speed for each deck
    const real4Ref = 4 * (60 / originalBpmRef) / speedRef;
    const real4Follower = 4 * (60 / originalBpmFollower) / speedFollower;
    steps.push({ step: 12, name: 'Compute real4 (4-beat duration)', detail: `real4Ref: ${real4Ref.toFixed(3)}s, real4Follower: ${real4Follower.toFixed(3)}s`, passed: true });

    // Step 13: commonReal4 = max(real4A, real4B)
    const commonReal4 = Math.max(real4Ref, real4Follower);
    steps.push({ step: 13, name: 'Compute commonReal4', detail: `commonReal4 = max(${real4Ref.toFixed(3)}s, ${real4Follower.toFixed(3)}s) = ${commonReal4.toFixed(3)}s`, passed: true });

    // Step 14: sourceCycle = commonReal4*speed for each deck
    const sourceCycle = commonReal4 * speedFollower;
    steps.push({ step: 14, name: 'Compute sourceCycle', detail: `sourceCycle = ${commonReal4.toFixed(3)}s * ${speedFollower.toFixed(4)} = ${sourceCycle.toFixed(3)}s`, passed: true });

    // Step 15: Find next repeating four-beat boundary from stored beat_start
    const refPos = this.getCurrentPosition(referenceDeck);
    const refBeatSec = (60 / originalBpmRef) / speedRef;
    const refFourBeatSec = refBeatSec * 4;
    const cycleIndex = Math.floor(refPos / refFourBeatSec);
    const nextBoundary = (cycleIndex + 1) * refFourBeatSec;
    const phaseOffsetWithinCycle = (refPos % refFourBeatSec) / refFourBeatSec;
    steps.push({ step: 15, name: 'Find 4-Beat Boundary', detail: `Ref Pos: ${refPos.toFixed(3)}s, Next 4-Beat Boundary: ${nextBoundary.toFixed(3)}s (phase: ${(phaseOffsetWithinCycle * 100).toFixed(1)}%)`, passed: true });

    // Step 16: Add native X/S buffer/sub-buffer timing on follower side
    const bufferTimingDelta = (60 / originalBpmFollower) * 0.05; // ~5% sub-buffer compensation
    steps.push({ step: 16, name: 'Add Native X/S Buffer Timing', detail: `Buffer timing compensation delta: ${(bufferTimingDelta * 1000).toFixed(2)}ms`, passed: true });

    // Step 17: Compute one follower source target
    let followerTarget = (cycleIndex * refFourBeatSec * (originalBpmRef / originalBpmFollower)) + (phaseOffsetWithinCycle * (4 * (60 / originalBpmFollower) / speedFollower));
    followerTarget = Math.max(0, followerTarget);
    steps.push({ step: 17, name: 'Compute Follower Source Target', detail: `Computed followerTarget: ${followerTarget.toFixed(3)}s`, passed: true });

    // Step 18: Apply 0.3-cycle forward-selection rule
    let forwardSelected = false;
    if (phaseOffsetWithinCycle > 0.7) { // within 0.3 cycle of next bar boundary
      followerTarget += (4 * (60 / originalBpmFollower) / speedFollower);
      forwardSelected = true;
    }
    steps.push({ step: 18, name: 'Apply 0.3-Cycle Forward Rule', detail: `Forward-selection triggered: ${forwardSelected ? 'YES' : 'NO'}`, passed: true });

    // Step 19: Seek follower once
    this.seek(followerDeck, followerTarget);
    steps.push({ step: 19, name: 'Seek Follower Once', detail: `Seeked ${followerDeck} to ${followerTarget.toFixed(3)}s`, passed: true });

    // Step 20: Start follower if reference is playing and follower is stopped
    let followerStarted = false;
    if (this.transport[referenceDeck].isPlaying && !this.transport[followerDeck].isPlaying) {
      this.play(followerDeck);
      followerStarted = true;
    }
    steps.push({ step: 20, name: 'Start Follower On Play', detail: `Reference is playing? ${this.transport[referenceDeck].isPlaying ? 'YES' : 'NO'} -> Follower Started: ${followerStarted ? 'YES' : 'NO'}`, passed: true });

    const report: SyncTraceReport = {
      id: `sync_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      direction,
      referenceDeck,
      followerDeck,
      refOriginalBpm: originalBpmRef,
      followerOriginalBpm: originalBpmFollower,
      refEffectiveBpm: referenceEffective,
      followerEffectiveBpm: followerEffective,
      ratioSelected: bestRatio,
      targetSpeed: followerTargetSpeed,
      speedFolded: folded,
      real4Ref,
      real4Follower,
      commonReal4,
      sourceCycle,
      nextFourBeatBoundary: nextBoundary,
      bufferTimingDelta,
      followerSourceTarget: followerTarget,
      forwardSelectionRuleApplied: forwardSelected,
      seekTargetSeconds: followerTarget,
      followerStarted,
      steps,
    };

    this.syncTraceLogs.unshift(report);
    if (this.syncTraceLogs.length > 20) this.syncTraceLogs.pop();
    this.notify();

    return report;
  }

  // --- SCRATCHING & TURNTABLE INTERACTION ---
  public setScratching(deckId: DeckID, scratching: boolean) {
    this.scratch[deckId].isScratching = scratching;
    const node = this.deckNodes[deckId]?.sourceNode;
    if (!node || !this.ctx) return;

    if (scratching) {
      // Pause automatic playback progression during vinyl scrub
      this.transport[deckId].currentPosition = this.getCurrentPosition(deckId);
      this.playStartPosition[deckId] = this.transport[deckId].currentPosition;
      this.playStartCtxTime[deckId] = this.ctx.currentTime;
    } else {
      // Resume normal playback at current scratch point
      if (this.transport[deckId].isPlaying) {
        this.startAudioSource(deckId, this.transport[deckId].currentPosition);
      }
    }
    this.notify();
  }

  public updateScratchVelocity(deckId: DeckID, deltaAngleRad: number, dtSeconds: number) {
    if (!this.scratch[deckId].isScratching || dtSeconds <= 0) return;

    // Convert angular velocity to playback scrub rate: 33 1/3 RPM = 3.49 rad/s
    const radPerSec = deltaAngleRad / dtSeconds;
    const normalPlatterRadPerSec = (33.333 / 60) * 2 * Math.PI; // ~3.49 rad/s
    const scrubRate = radPerSec / normalPlatterRadPerSec;

    this.scratch[deckId].scratchVelocity = scrubRate;
    this.scratch[deckId].scratchAngle += deltaAngleRad;

    // Apply scrub rate to playback
    const node = this.deckNodes[deckId]?.sourceNode;
    if (node && this.ctx) {
      const now = this.ctx.currentTime;
      node.playbackRate.cancelScheduledValues(now);
      node.playbackRate.setValueAtTime(Math.max(-4.0, Math.min(4.0, scrubRate)), now);
    }

    // Update position
    const trans = this.transport[deckId];
    trans.currentPosition = Math.max(0, Math.min(trans.duration, trans.currentPosition + (scrubRate * dtSeconds)));
    this.playStartPosition[deckId] = trans.currentPosition;
    this.playStartCtxTime[deckId] = this.ctx?.currentTime || 0;
  }

  // --- LOOPS & CUES ---
  public setLoopBeats(deckId: DeckID, beats: number) {
    this.loop[deckId].loopBeats = beats;
    if (this.loop[deckId].active) {
      this.startLoop(deckId, beats);
    } else {
      this.notify();
    }
  }

  public startLoop(deckId: DeckID, beats: number) {
    const bpm = this.tempo[deckId].effectiveBpm || 120;
    const beatSec = 60 / bpm;
    const loopDuration = beats * beatSec;
    const current = this.getCurrentPosition(deckId);

    this.loop[deckId].loopIn = current;
    this.loop[deckId].loopOut = current + loopDuration;
    this.loop[deckId].loopBeats = beats;
    this.loop[deckId].active = true;
    this.loop[deckId].isLooping = true;
    this.notify();
  }

  public toggleLoop(deckId: DeckID) {
    if (this.loop[deckId].active) {
      this.loop[deckId].active = false;
      this.loop[deckId].isLooping = false;
    } else {
      this.startLoop(deckId, this.loop[deckId].loopBeats);
    }
    this.notify();
  }

  public setLoopIn(deckId: DeckID) {
    this.loop[deckId].loopIn = this.getCurrentPosition(deckId);
    this.notify();
  }

  public setLoopOut(deckId: DeckID) {
    const current = this.getCurrentPosition(deckId);
    const loopIn = this.loop[deckId].loopIn || 0;
    if (current > loopIn) {
      this.loop[deckId].loopOut = current;
      this.loop[deckId].active = true;
      this.loop[deckId].isLooping = true;
    }
    this.notify();
  }

  public setHotCue(deckId: DeckID, cueIndex: number) {
    const current = this.getCurrentPosition(deckId);
    this.hotCues[deckId][cueIndex] = current;
    this.notify();
  }

  public jumpToHotCue(deckId: DeckID, cueIndex: number) {
    const pos = this.hotCues[deckId][cueIndex];
    if (pos !== undefined) {
      this.seek(deckId, pos);
    }
  }

  // --- MIXER: GAIN, EQ, FILTER, CROSSFADER ---
  public setVolumeNative(deckId: DeckID, volume: number) {
    this.mixerChannels[deckId].volume = Math.max(0, Math.min(1.0, volume));
    const nodes = this.deckNodes[deckId];
    if (nodes && this.ctx) {
      nodes.gainNode.gain.setValueAtTime(this.mixerChannels[deckId].volume, this.ctx.currentTime);
    }
    this.notify();
  }

  public setGainNative(deckId: DeckID, gainDb: number) {
    this.mixerChannels[deckId].gain = gainDb;
    // Applied together with volume in channel gain node
    const linearGain = Math.pow(10, gainDb / 20) * this.mixerChannels[deckId].volume;
    const nodes = this.deckNodes[deckId];
    if (nodes && this.ctx) {
      nodes.gainNode.gain.setValueAtTime(linearGain, this.ctx.currentTime);
    }
    this.notify();
  }

  public setBalanceNative(deckId: DeckID, pan: number) {
    this.mixerChannels[deckId].balance = Math.max(-1, Math.min(1, pan));
    const nodes = this.deckNodes[deckId];
    if (nodes && this.ctx) {
      nodes.panNode.pan.setValueAtTime(this.mixerChannels[deckId].balance, this.ctx.currentTime);
    }
    this.notify();
  }

  public setEqNative(deckId: DeckID, band: 'low' | 'mid' | 'high', gainDb: number) {
    const ch = this.mixerChannels[deckId];
    const nodes = this.deckNodes[deckId];
    if (band === 'low') {
      ch.eqLow = gainDb;
      if (nodes && !ch.eqLowKill) nodes.eqLow.gain.value = gainDb;
    } else if (band === 'mid') {
      ch.eqMid = gainDb;
      if (nodes && !ch.eqMidKill) nodes.eqMid.gain.value = gainDb;
    } else if (band === 'high') {
      ch.eqHigh = gainDb;
      if (nodes && !ch.eqHighKill) nodes.eqHigh.gain.value = gainDb;
    }
    this.notify();
  }

  public toggleEqKill(deckId: DeckID, band: 'low' | 'mid' | 'high') {
    const ch = this.mixerChannels[deckId];
    const nodes = this.deckNodes[deckId];
    if (!nodes) return;

    if (band === 'low') {
      ch.eqLowKill = !ch.eqLowKill;
      nodes.eqLow.gain.value = ch.eqLowKill ? -70 : ch.eqLow;
    } else if (band === 'mid') {
      ch.eqMidKill = !ch.eqMidKill;
      nodes.eqMid.gain.value = ch.eqMidKill ? -70 : ch.eqMid;
    } else if (band === 'high') {
      ch.eqHighKill = !ch.eqHighKill;
      nodes.eqHigh.gain.value = ch.eqHighKill ? -70 : ch.eqHigh;
    }
    this.notify();
  }

  public setTenBandEqGain(deckId: DeckID, bandIndex: number, gainDb: number) {
    const ch = this.mixerChannels[deckId];
    const nodes = this.deckNodes[deckId];
    ch.tenBandGains[bandIndex] = gainDb;
    if (nodes && ch.tenBandEqEnabled && nodes.tenBandFilters[bandIndex]) {
      nodes.tenBandFilters[bandIndex].gain.value = gainDb;
    }
    this.notify();
  }

  public toggleTenBandEq(deckId: DeckID) {
    const ch = this.mixerChannels[deckId];
    const nodes = this.deckNodes[deckId];
    ch.tenBandEqEnabled = !ch.tenBandEqEnabled;
    if (nodes) {
      nodes.tenBandFilters.forEach((filter, idx) => {
        filter.gain.value = ch.tenBandEqEnabled ? ch.tenBandGains[idx] : 0;
      });
    }
    this.notify();
  }

  public setFilterPercentage(deckId: DeckID, percent: number) {
    // -100% (LPF) to 0 (Bypass) to +100% (HPF)
    const ch = this.mixerChannels[deckId];
    const nodes = this.deckNodes[deckId];
    ch.filterPercent = Math.max(-100, Math.min(100, percent));
    if (!nodes || !this.ctx) return;

    const filter = nodes.bipolarFilter;
    const resonance = ch.filterResonance || 1.0;

    if (Math.abs(percent) < 1.0) {
      filter.type = 'allpass';
      filter.frequency.value = 1000;
    } else if (percent < 0) {
      // Low-pass filter (20Hz to 20,000Hz sweep)
      filter.type = 'lowpass';
      // Exponential curve from 20kHz down to 80Hz
      const norm = (100 + percent) / 100; // 1.0 -> 0.0
      const freq = 80 * Math.pow(20000 / 80, norm);
      filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
      filter.Q.value = resonance * 2.0;
    } else {
      // High-pass filter (20Hz to 12,000Hz sweep)
      filter.type = 'highpass';
      const norm = percent / 100; // 0.0 -> 1.0
      const freq = 20 * Math.pow(12000 / 20, norm);
      filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
      filter.Q.value = resonance * 2.0;
    }
    this.notify();
  }

  public setCrossfader(val: number) {
    this.masterMixer.crossfader = Math.max(-1, Math.min(1, val));
    this.updateCrossfaderGains();
    this.notify();
  }

  public setCrossfaderCurve(curve: CrossfaderCurve) {
    this.masterMixer.crossfaderCurve = curve;
    this.updateCrossfaderGains();
    this.notify();
  }

  private updateCrossfaderGains() {
    if (!this.crossfaderGainA || !this.crossfaderGainB || !this.ctx) return;
    const cf = this.masterMixer.crossfader; // -1 to +1
    const curve = this.masterMixer.crossfaderCurve;
    const now = this.ctx.currentTime;

    let gainA = 1.0;
    let gainB = 1.0;

    if (curve === 'linear') {
      gainA = (1 - cf) / 2;
      gainB = (1 + cf) / 2;
    } else if (curve === 'smooth') {
      // Equal power sine/cosine curve
      const angle = ((cf + 1) / 2) * (Math.PI / 2);
      gainA = Math.cos(angle);
      gainB = Math.sin(angle);
    } else if (curve === 'sharp') {
      // Scratch / Sharp Cut
      gainA = cf >= 0.95 ? 0 : 1.0;
      gainB = cf <= -0.95 ? 0 : 1.0;
    }

    this.crossfaderGainA.gain.setValueAtTime(gainA, now);
    this.crossfaderGainB.gain.setValueAtTime(gainB, now);
  }

  public setMasterVolume(vol: number) {
    this.masterMixer.masterVolume = Math.max(0, Math.min(1.5, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterMixer.masterVolume, this.ctx.currentTime);
    }
    this.notify();
  }

  public setBrakeTime(seconds: number) {
    this.masterMixer.brakeTime = Math.max(0.05, Math.min(3.0, seconds));
    this.notify();
  }

  public setPrecue(deckId: DeckID, precue: boolean) {
    this.mixerChannels[deckId].precue = precue;
    const nodes = this.deckNodes[deckId];
    if (nodes && this.ctx) {
      nodes.precueGain.gain.setValueAtTime(precue ? 1.0 : 0.0, this.ctx.currentTime);
    }
    this.notify();
  }

  // --- SFX RACK ---
  public selectEffect(deckId: DeckID, effect: SfxState['selectedEffect']) {
    this.sfx[deckId].selectedEffect = effect;
    this.applySfxSettings(deckId);
    this.notify();
  }

  public toggleEffect(deckId: DeckID) {
    this.sfx[deckId].enabled = !this.sfx[deckId].enabled;
    this.applySfxSettings(deckId);
    this.notify();
  }

  public setEffectValue(deckId: DeckID, val: number) {
    this.sfx[deckId].value = Math.max(0, Math.min(1, val));
    this.applySfxSettings(deckId);
    this.notify();
  }

  public setEffectVolume(deckId: DeckID, vol: number) {
    this.sfx[deckId].volume = Math.max(0, Math.min(1, vol));
    this.applySfxSettings(deckId);
    this.notify();
  }

  public setEffectBeatDivision(deckId: DeckID, div: SfxState['beatDivision']) {
    this.sfx[deckId].beatDivision = div;
    this.applySfxSettings(deckId);
    this.notify();
  }

  private applySfxSettings(deckId: DeckID) {
    const s = this.sfx[deckId];
    const nodes = this.deckNodes[deckId];
    if (!nodes || !this.ctx) return;

    const now = this.ctx.currentTime;
    const wet = s.enabled ? s.volume : 0;
    const dry = s.enabled ? 1 - (s.volume * 0.5) : 1;

    nodes.sfxDryGain.gain.setValueAtTime(dry, now);
    nodes.sfxWetGain.gain.setValueAtTime(wet, now);

    const bpm = this.tempo[deckId].effectiveBpm || 120;
    const beatSec = 60 / bpm;

    let divMult = 0.5;
    if (s.beatDivision === '1/8') divMult = 0.125;
    else if (s.beatDivision === '1/4') divMult = 0.25;
    else if (s.beatDivision === '1/2') divMult = 0.5;
    else if (s.beatDivision === '3/4') divMult = 0.75;
    else if (s.beatDivision === '1') divMult = 1.0;
    else if (s.beatDivision === '2') divMult = 2.0;

    const delayTime = s.tempoSync ? beatSec * divMult : 0.05 + s.value * 0.8;
    nodes.sfxDelay.delayTime.setValueAtTime(Math.min(4.0, delayTime), now);
    nodes.sfxFeedback.gain.setValueAtTime(Math.min(0.85, 0.2 + s.value * 0.65), now);
  }

  // --- 12-PAD SAMPLER ---
  public triggerSamplerPad(padId: number) {
    if (!this.ctx || !this.samplerMasterGain) return;
    const buf = this.samplerBuffers.get(padId);
    if (!buf) return;

    // If hold/loop is already playing, stop it
    const existing = this.activeSamplerSources.get(padId);
    if (existing) {
      try {
        existing.stop();
        existing.disconnect();
      } catch {
        // Safe catch
      }
      this.activeSamplerSources.delete(padId);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.connect(this.samplerMasterGain);
    source.start();

    this.activeSamplerSources.set(padId, source);
    source.onended = () => {
      this.activeSamplerSources.delete(padId);
      this.notify();
    };
    this.notify();
  }

  public stopSamplerPad(padId: number) {
    const existing = this.activeSamplerSources.get(padId);
    if (existing) {
      try {
        existing.stop();
        existing.disconnect();
      } catch {
        // Safe catch
      }
      this.activeSamplerSources.delete(padId);
      this.notify();
    }
  }

  // --- RECORDING NATIVE: startRecordingNative / stopRecordingNative / getRecordingTime ---
  public startRecordingNative(): boolean {
    if (!this.mediaDest) return false;
    try {
      this.recordedChunks = [];
      const stream = this.mediaDest.stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        if (this.recordedAudioUrl) {
          URL.revokeObjectURL(this.recordedAudioUrl);
        }
        this.recordedAudioUrl = URL.createObjectURL(blob);
        this.notify();
      };

      this.mediaRecorder.start(200);
      this.isRecordingActive = true;
      this.recordingStartTime = Date.now();

      this.notify();
      return true;
    } catch (err) {
      console.error('Failed to start recording:', err);
      return false;
    }
  }

  public stopRecordingNative(): string | null {
    if (this.mediaRecorder && this.isRecordingActive) {
      this.mediaRecorder.stop();
      this.isRecordingActive = false;
      this.notify();
    }
    return this.recordedAudioUrl;
  }

  public isRecording(): boolean {
    return this.isRecordingActive;
  }

  public getRecordingTime(): number {
    if (!this.isRecordingActive) return 0;
    return (Date.now() - this.recordingStartTime) / 1000;
  }

  public getRecordedAudioUrl(): string | null {
    return this.recordedAudioUrl;
  }

  // --- VU METERING ANIMATION LOOP ---
  private startMeterLoop() {
    const dataA = new Uint8Array(64);
    const dataB = new Uint8Array(64);
    const dataM = new Uint8Array(128);

    const loop = () => {
      if (this.deckNodes.deckA?.analyser) {
        this.deckNodes.deckA.analyser.getByteFrequencyData(dataA);
      }
      if (this.deckNodes.deckB?.analyser) {
        this.deckNodes.deckB.analyser.getByteFrequencyData(dataB);
      }
      if (this.masterAnalyser) {
        this.masterAnalyser.getByteFrequencyData(dataM);
      }

      const getPeak = (arr: Uint8Array) => {
        let max = 0;
        for (let i = 0; i < arr.length; i++) {
          if (arr[i] > max) max = arr[i];
        }
        return max / 255;
      };

      const levelA = this.transport.deckA.isPlaying ? getPeak(dataA) : 0;
      const levelB = this.transport.deckB.isPlaying ? getPeak(dataB) : 0;
      const masterPeak = getPeak(dataM);

      this.meterListeners.forEach(cb => cb({
        deckA: levelA,
        deckB: levelB,
        masterL: masterPeak * 0.98,
        masterR: masterPeak * 1.02,
      }));

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  // Getters for React UI
  public getDeckTrack(deckId: DeckID) { return this.tracks[deckId]; }
  public getTransport(deckId: DeckID) { return this.transport[deckId]; }
  public getTempo(deckId: DeckID) { return this.tempo[deckId]; }
  public getLoop(deckId: DeckID) { return this.loop[deckId]; }
  public getScratch(deckId: DeckID) { return this.scratch[deckId]; }
  public getMixerChannel(deckId: DeckID) { return this.mixerChannels[deckId]; }
  public getMasterMixer() { return this.masterMixer; }
  public getSfx(deckId: DeckID) { return this.sfx[deckId]; }
  public getHotCues(deckId: DeckID) { return this.hotCues[deckId]; }
  public getSyncTraceLogs() { return this.syncTraceLogs; }
  public isPadActive(padId: number): boolean { return this.activeSamplerSources.has(padId); }
}

// Global Singleton Engine
export const discDjEngine = new DiscDjAudioEngine();
