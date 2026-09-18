export type DeckID = 'deckA' | 'deckB';

export type SyncDirection = 'A_TO_B' | 'B_TO_A';

export interface TransportState {
  prepare: boolean;
  preparedState: 'unprepared' | 'preparing' | 'ready';
  isPlaying: boolean;
  goingToBePlaying: boolean;
  currentPosition: number; // in seconds
  duration: number; // in seconds
  cuePosition: number; // in seconds
  isPaused: boolean;
}

export interface TempoSyncState {
  originalBpm: number;
  currentSpeed: number; // 1.0 = 100% (range 0.5 - 2.0)
  pitchBend: number; // temporary nudge in playback rate (-0.1 to +0.1)
  pitchShift: number; // semitones (-12 to +12)
  keyLock: boolean;
  effectiveBpm: number;
  beatStart: number; // time in seconds of first beat
}

export interface LoopState {
  isLooping: boolean;
  loopIn: number | null;
  loopOut: number | null;
  loopBeats: number; // 0.125, 0.25, 0.5, 1, 2, 4, 8, 16
  active: boolean;
}

export interface ScratchState {
  isScratching: boolean;
  scratchVelocity: number;
  scratchAngle: number;
}

export interface MixerChannelState {
  volume: number; // 0.0 to 1.0
  gain: number; // -12 to +12 dB
  balance: number; // -1.0 to +1.0
  eqLow: number; // -24 to +6 dB
  eqMid: number;
  eqHigh: number;
  eqLowKill: boolean;
  eqMidKill: boolean;
  eqHighKill: boolean;
  filterPercent: number; // -100% (LPF) to +100% (HPF), 0% is Flat/Bypass
  filterResonance: number; // Q factor (0.5 to 5.0)
  tenBandEqEnabled: boolean;
  tenBandGains: number[]; // 10 bands gains in dB
  precue: boolean; // Headphone cue listen
}

export type CrossfaderCurve = 'linear' | 'smooth' | 'sharp';

export interface MasterMixerState {
  crossfader: number; // -1.0 (Deck A) to +1.0 (Deck B)
  crossfaderCurve: CrossfaderCurve;
  masterVolume: number; // 0.0 to 1.5
  volumeBoost: number; // 0 to +12 dB
  loudnessEnabled: boolean;
  replayGainEnabled: boolean;
  targetLoudness: number; // LUFS (e.g. -14)
  limiterRelease: number; // ms (10 to 500)
  brakeTime: number; // seconds for vinyl motor stop (0.1 to 3.0)
  duckingVolume: number; // 0 to 1
  precueLevel: number; // headphone volume 0 to 1
  precueMix: number; // 0 = Cue only, 1 = Master only
}

export type SfxType = 
  | 'delay' 
  | 'delay_echo' 
  | 'flanger' 
  | 'noise' 
  | 'tremolo' 
  | 'vibrato' 
  | 'reverb_echo';

export interface SfxState {
  selectedEffect: SfxType;
  enabled: boolean;
  value: number; // 0.0 to 1.0 parameter depth
  volume: number; // 0.0 to 1.0 dry/wet level
  tempoSync: boolean;
  beatDivision: '1/8' | '1/4' | '1/2' | '3/4' | '1' | '2';
}

export interface HotCue {
  id: number;
  position: number; // seconds
  color: string;
}

export interface SamplerPadItem {
  id: number;
  name: string;
  category: 'fx' | 'drum' | 'vocal';
  color: string;
  mode: 'one_shot' | 'hold' | 'loop';
  volume: number;
  isPlaying: boolean;
}

export interface AnalysisData {
  bpm: number;
  confidence: number;
  peaks: Float32Array;
  lowPeaks: Float32Array;
  midPeaks: Float32Array;
  highPeaks: Float32Array;
  loudnessRms: number;
  gainOffset: number;
  beatGrid: number[];
  duration: number;
}

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album?: string;
  bpm: number;
  key: string;
  duration: number;
  color: string;
  genre: string;
  audioBuffer?: AudioBuffer;
  analysis?: AnalysisData;
}

export interface SyncStepExecution {
  step: number;
  name: string;
  detail: string;
  passed: boolean;
}

export interface SyncTraceReport {
  id: string;
  timestamp: string;
  direction: SyncDirection;
  referenceDeck: DeckID;
  followerDeck: DeckID;
  refOriginalBpm: number;
  followerOriginalBpm: number;
  refEffectiveBpm: number;
  followerEffectiveBpm: number;
  ratioSelected: number;
  targetSpeed: number;
  speedFolded: boolean;
  real4Ref: number;
  real4Follower: number;
  commonReal4: number;
  sourceCycle: number;
  nextFourBeatBoundary: number;
  bufferTimingDelta: number;
  followerSourceTarget: number;
  forwardSelectionRuleApplied: boolean;
  seekTargetSeconds: number;
  followerStarted: boolean;
  steps: SyncStepExecution[];
}
