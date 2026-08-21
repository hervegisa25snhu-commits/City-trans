import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, Sparkles, RefreshCw, AlertCircle, Radio, Bot, User, CheckCircle2 } from 'lucide-react';

// Helper to convert Float32Array PCM audio to 16-bit PCM base64
function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to decode Base64 24kHz 16-bit PCM to AudioBuffer
function base64ToAudioBuffer(base64: string, audioCtx: AudioContext): AudioBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const audioBuffer = audioCtx.createBuffer(1, int16.length, 24000);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) {
    channelData[i] = int16[i] / 32768.0;
  }
  return audioBuffer;
}

export default function VoiceTransitAssistant() {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [recentTranscripts, setRecentTranscripts] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const stopAllAudioPlayback = () => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    if (!outputAudioCtxRef.current) {
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }

    const ctx = outputAudioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    setStatus('speaking');
    const audioBuffer = base64ToAudioBuffer(base64Audio, ctx);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.05;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
    activeSourcesRef.current.push(source);

    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
      if (activeSourcesRef.current.length === 0 && isActive) {
        setStatus('listening');
      }
    };
  };

  const startVoiceSession = async () => {
    setErrorMessage(null);
    setStatus('connecting');
    setRecentTranscripts([]);

    try {
      // Connect WebSocket to backend Live API proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/gemini/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('Connected to Live WebSocket');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          micStreamRef.current = stream;

          const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000,
          });
          inputAudioCtxRef.current = inputCtx;

          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBase64 = floatTo16BitPCMBase64(inputData);
              ws.send(
                JSON.stringify({
                  type: 'audio',
                  audio: pcmBase64,
                })
              );
            }
          };

          source.connect(processor);
          processor.connect(inputCtx.destination);

          setIsActive(true);
          setStatus('listening');
        } catch (micErr: any) {
          console.error('Microphone access error:', micErr);
          setErrorMessage('Microphone access denied or unavailable.');
          setStatus('error');
          stopVoiceSession();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'audio' && data.audio) {
            playAudioChunk(data.audio);
          } else if (data.type === 'transcript' && data.text) {
            setTranscript((prev) => prev + ' ' + data.text);
            setRecentTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                return [...prev.slice(0, -1), { role: 'assistant', text: last.text + ' ' + data.text }];
              }
              return [...prev, { role: 'assistant', text: data.text }];
            });
          } else if (data.type === 'interrupted') {
            stopAllAudioPlayback();
            setStatus('listening');
          } else if (data.type === 'turn_complete') {
            setStatus('listening');
          } else if (data.type === 'error') {
            setErrorMessage(data.error);
            setStatus('error');
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        setErrorMessage('Failed to establish Live voice connection.');
        setStatus('error');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsActive(false);
        if (status !== 'error') setStatus('idle');
      };
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Could not start voice session');
      setStatus('error');
    }
  };

  const stopVoiceSession = () => {
    setIsActive(false);
    setStatus('idle');
    stopAllAudioPlayback();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (_) {}
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch (_) {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch (_) {}
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-600 to-purple-600 text-white shadow-md shadow-purple-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
              Live Voice Conversation
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold border border-pink-500/30">
                gemini-3.1-flash-live-preview
              </span>
            </h2>
            <p className="text-xs text-slate-400">Speak naturally in real-time with Kigali Transit Assistant</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-between space-y-4 text-center">
        {/* Animated Voice Radar Visualizer */}
        <div className="w-full py-6 flex flex-col items-center justify-center relative">
          <div className="relative flex items-center justify-center">
            {isActive && (
              <>
                <div
                  className={`absolute w-36 h-36 rounded-full ${
                    status === 'speaking'
                      ? 'bg-purple-500/20 animate-ping'
                      : 'bg-emerald-500/20 animate-pulse'
                  }`}
                />
                <div
                  className={`absolute w-28 h-28 rounded-full ${
                    status === 'speaking' ? 'bg-purple-500/30' : 'bg-emerald-500/30'
                  }`}
                />
              </>
            )}

            <button
              onClick={isActive ? stopVoiceSession : startVoiceSession}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl transition-all active:scale-95 ${
                isActive
                  ? status === 'speaking'
                    ? 'bg-gradient-to-tr from-purple-600 to-pink-600 shadow-purple-500/50'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-500/50'
                  : 'bg-gradient-to-tr from-slate-800 to-slate-700 hover:from-purple-600 hover:to-indigo-600 border border-slate-600'
              }`}
            >
              {isActive ? (
                status === 'speaking' ? (
                  <Volume2 className="w-8 h-8 animate-bounce" />
                ) : (
                  <Mic className="w-8 h-8" />
                )
              ) : (
                <MicOff className="w-8 h-8 text-slate-400 group-hover:text-white" />
              )}
            </button>
          </div>

          <div className="mt-4 space-y-1">
            <div className="text-sm font-bold text-slate-200">
              {status === 'idle' && 'Tap microphone to start live conversation'}
              {status === 'connecting' && 'Connecting to Gemini Live API...'}
              {status === 'listening' && 'Listening... Speak in English or Kinyarwanda'}
              {status === 'speaking' && 'Transit AI is speaking...'}
              {status === 'error' && 'Voice Session Error'}
            </div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Low-latency, bi-directional live audio stream powered by Gemini Live API.
            </p>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div className="w-full p-3 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="text-left">{errorMessage}</span>
          </div>
        )}

        {/* Real-time Spoken Conversation Transcript Box */}
        <div className="w-full flex-1 bg-slate-950/70 rounded-xl border border-slate-800 p-3.5 text-left flex flex-col justify-between overflow-hidden">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span>Live Audio Transcript</span>
            {isActive && (
              <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE STREAM
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs">
            {recentTranscripts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Spoken advice and answers will appear here in real-time.</span>
              </div>
            ) : (
              recentTranscripts.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl text-xs ${
                    t.role === 'assistant'
                      ? 'bg-purple-950/40 border border-purple-800/40 text-purple-200'
                      : 'bg-blue-950/40 border border-blue-800/40 text-blue-200'
                  }`}
                >
                  <div className="text-[10px] font-bold text-slate-400 mb-0.5">
                    {t.role === 'assistant' ? '🤖 Kigali Transit AI' : '👤 You'}
                  </div>
                  {t.text}
                </div>
              ))
            )}
          </div>

          {/* Quick Voice Suggestions */}
          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
            <span className="font-semibold block mb-1">Try saying aloud:</span>
            <div className="flex flex-wrap gap-1">
              <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                "How do I get to Kigali Convention Centre?"
              </span>
              <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                "What is the bus fare from Downtown to Remera?"
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
