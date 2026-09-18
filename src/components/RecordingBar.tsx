import React, { useState, useEffect } from 'react';
import { Circle, Square, Download, Play, CheckCircle2 } from 'lucide-react';
import { discDjEngine } from '../audio/DiscDjAudioEngine';

export const RecordingBar: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecTime(discDjEngine.getRecordingTime());
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleToggleRecord = async () => {
    await discDjEngine.initAudioContext();
    if (!isRecording) {
      const ok = discDjEngine.startRecordingNative();
      if (ok) {
        setIsRecording(true);
        setAudioUrl(null);
      }
    } else {
      const url = discDjEngine.stopRecordingNative();
      setIsRecording(false);
      setAudioUrl(url);
    }
  };

  const formatRecTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-[#12141f] border border-white/10 rounded-xl px-3 py-1.5 shadow-sm">
      {/* Record Trigger Button */}
      <button
        onClick={handleToggleRecord}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition-all ${
          isRecording
            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
            : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5'
        }`}
        title={isRecording ? 'Stop Recording Master Mix' : 'Record Live Master Mix Output'}
      >
        {isRecording ? (
          <>
            <Square className="w-3 h-3 fill-current" />
            <span>STOP REC</span>
          </>
        ) : (
          <>
            <Circle className="w-3 h-3 text-rose-500 fill-rose-500" />
            <span>REC MIX</span>
          </>
        )}
      </button>

      {/* Recording Timer Display */}
      {isRecording && (
        <span className="text-xs font-mono font-bold text-rose-400 min-w-[45px]">
          {formatRecTime(recTime)}
        </span>
      )}

      {/* Download Recorded File */}
      {audioUrl && !isRecording && (
        <a
          href={audioUrl}
          download={`DiscDJ_Mix_${Date.now()}.webm`}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
          title="Download Master Mix Recording"
        >
          <Download className="w-3 h-3" />
          <span>Save Mix</span>
        </a>
      )}
    </div>
  );
};
