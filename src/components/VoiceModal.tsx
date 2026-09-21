import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, X, AlertCircle, Sparkles, Loader2 } from "lucide-react";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  locationName,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<"idle" | "listening" | "speaking" | "error">("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [replyText, setReplyText] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const speechRecognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
  }, [isOpen]);

  const cleanup = () => {
    setIsRecording(false);
    setStatus("idle");
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const startVoiceSession = async () => {
    try {
      setStatus("listening");
      setIsRecording(true);
      setTranscript("");
      setReplyText("");

      // Establish WebSocket for Gemini Live
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = outputAudioCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = inputAudioCtx.createMediaStreamSource(stream);
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(inputAudioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert float32 to int16 PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          // Convert to base64
          let binary = "";
          const bytes = new Uint8Array(pcmData.buffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            setStatus("speaking");
            // Decode base64 24kHz PCM
            const binary = atob(msg.audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const pcm16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(pcm16.length);
            for (let i = 0; i < pcm16.length; i++) {
              float32[i] = pcm16[i] / 32768.0;
            }

            const buffer = outputAudioCtx.createBuffer(1, float32.length, 24000);
            buffer.copyToChannel(float32, 0);

            const sourceNode = outputAudioCtx.createBufferSource();
            sourceNode.buffer = buffer;
            sourceNode.connect(outputAudioCtx.destination);

            const currentTime = outputAudioCtx.currentTime;
            const startTime = Math.max(currentTime, nextStartTimeRef.current);
            sourceNode.start(startTime);
            nextStartTimeRef.current = startTime + buffer.duration;

            sourceNode.onended = () => {
              if (outputAudioCtx.currentTime >= nextStartTimeRef.current - 0.1) {
                setStatus("listening");
              }
            };
          }

          if (msg.interrupted) {
            nextStartTimeRef.current = outputAudioCtx.currentTime;
            setStatus("listening");
          }
        } catch (err) {
          console.error("Live audio receive error:", err);
        }
      };

      // Also attach Web Speech recognition as visual feedback helper
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onresult = (event: any) => {
          let current = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          setTranscript(current);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      }
    } catch (err: any) {
      console.error("Error starting live voice session:", err);
      setStatus("error");
      setIsRecording(false);
    }
  };

  const handleStop = () => {
    cleanup();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#fdfcf9] via-[#faf7f0] to-[#f5f2eb] rounded-3xl shadow-2xl border border-stone-300/80 overflow-hidden flex flex-col items-center p-6 text-center space-y-5 text-stone-900">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Badge */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold uppercase tracking-wider border border-amber-300">
            <Sparkles className="w-3 h-3 text-amber-700" />
            Live Voice Conversation
          </div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">WeatherGPT Voice</h2>
          <p className="text-xs text-stone-500">
            Real-time conversational voice grounded for {locationName}
          </p>
        </div>

        {/* Interactive Orb */}
        <div className="relative my-4 flex items-center justify-center">
          <div
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
              isRecording
                ? status === "speaking"
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-600/30 scale-110 animate-pulse"
                  : "bg-gradient-to-tr from-amber-600 to-stone-800 shadow-xl shadow-amber-600/30 animate-bounce"
                : "bg-white border border-stone-300 shadow-xs"
            }`}
          >
            {isRecording ? (
              status === "speaking" ? (
                <Volume2 className="w-12 h-12 text-white animate-pulse" />
              ) : (
                <Mic className="w-12 h-12 text-white animate-pulse" />
              )
            ) : (
              <MicOff className="w-10 h-10 text-stone-400" />
            )}
          </div>

          {/* Ripple rings */}
          {isRecording && (
            <div className="absolute inset-0 rounded-full border-2 border-amber-500/40 animate-ping pointer-events-none" />
          )}
        </div>

        {/* Status Indicator */}
        <div className="text-sm font-medium">
          {status === "idle" && <span className="text-stone-500 text-xs">Tap below to start speaking</span>}
          {status === "listening" && (
            <span className="text-amber-800 font-semibold flex items-center justify-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
              Listening... ask about rain, spray, or wind
            </span>
          )}
          {status === "speaking" && (
            <span className="text-emerald-800 font-semibold flex items-center justify-center gap-1.5 text-xs">
              <Volume2 className="w-4 h-4 animate-bounce" />
              Speaking meteorological advisory...
            </span>
          )}
          {status === "error" && (
            <span className="text-rose-800 font-medium flex items-center justify-center gap-1 text-xs">
              <AlertCircle className="w-4 h-4" /> Microphone permission needed
            </span>
          )}
        </div>

        {/* Live speech transcription text preview */}
        {transcript && (
          <div className="w-full bg-white rounded-2xl p-3 border border-stone-200 text-xs text-stone-800 max-h-24 overflow-y-auto italic shadow-xs">
            "{transcript}"
          </div>
        )}

        {/* Action Controls */}
        <div className="w-full pt-2 flex items-center justify-center gap-3">
          {!isRecording ? (
            <button
              onClick={startVoiceSession}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-700 to-stone-800 hover:from-amber-600 hover:to-stone-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              <Mic className="w-4 h-4" />
              Start Voice Conversation
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
            >
              <MicOff className="w-4 h-4" />
              End Voice Call
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
