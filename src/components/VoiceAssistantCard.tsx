import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Send,
  Languages,
  AlertCircle,
  Radio,
  CheckCircle2,
} from "lucide-react";
import {
  startListening,
  speakText,
  stopSpeaking,
  isSpeaking,
  isSpeechRecognitionSupported,
  ActiveRecognitionHandle,
} from "../utils/speech";
import { LocationItem, CurrentWeatherData, SupportedLanguageCode, VoiceAssistantState } from "../types";
import { SpeechControls } from "./SpeechControls";

interface VoiceAssistantCardProps {
  activeLocation: LocationItem;
  currentWeather: CurrentWeatherData | null;
  language: SupportedLanguageCode;
  onSelectLanguage: (lang: SupportedLanguageCode) => void;
  onAskQuestion: (text: string) => Promise<string | void>;
  onSyncInputText?: (text: string) => void;
}

export const VoiceAssistantCard: React.FC<VoiceAssistantCardProps> = ({
  activeLocation,
  currentWeather,
  language,
  onSelectLanguage,
  onAskQuestion,
  onSyncInputText,
}) => {
  const [voiceState, setVoiceState] = useState<VoiceAssistantState>("ready");
  const [transcript, setTranscript] = useState<string>("");
  const [interimText, setInterimText] = useState<string>("");
  const [response, setResponse] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);

  const recognitionHandleRef = useRef<ActiveRecognitionHandle | null>(null);
  const isTelugu = language === "te";

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      recognitionHandleRef.current?.abort();
    };
  }, []);

  // Sync state if audio ends
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAudioPlaying && !isSpeaking()) {
        setIsAudioPlaying(false);
        if (voiceState === "speaking") {
          setVoiceState("ready");
        }
      }
    }, 400);
    return () => clearInterval(interval);
  }, [isAudioPlaying, voiceState]);

  // Handle Speech Recognition Trigger
  const handleToggleListening = () => {
    setErrorMessage(null);

    // If currently listening, stop
    if (voiceState === "listening") {
      recognitionHandleRef.current?.stop();
      setVoiceState("ready");
      return;
    }

    // If currently speaking, stop
    if (isAudioPlaying || voiceState === "speaking") {
      stopSpeaking();
      setIsAudioPlaying(false);
      setVoiceState("ready");
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setErrorMessage(
        isTelugu
          ? "ఈ బ్రౌజర్‌లో స్పీచ్ గుర్తింపు అందుబాటులో లేదు. దయచేసి టైప్ చేయండి."
          : "Microphone access is unavailable. You can type your question instead."
      );
      setVoiceState("error");
      return;
    }

    setTranscript("");
    setInterimText("");
    setVoiceState("listening");

    const handle = startListening({
      language,
      onStart: () => {
        setVoiceState("listening");
      },
      onInterim: (text) => {
        setInterimText(text);
        if (onSyncInputText) {
          onSyncInputText(text);
        }
      },
      onFinal: async (finalSpokenText) => {
        setTranscript(finalSpokenText);
        setInterimText("");
        if (onSyncInputText) {
          onSyncInputText(finalSpokenText);
        }

        // Process request to Gemini
        await processSpokenQuery(finalSpokenText);
      },
      onError: (msg) => {
        setErrorMessage(msg);
        setVoiceState("error");
        setTimeout(() => {
          setVoiceState((prev) => (prev === "error" ? "ready" : prev));
        }, 5000);
      },
      onEnd: () => {
        // Handled in onFinal / onError
      },
    });

    recognitionHandleRef.current = handle;
  };

  // Send recognized speech to Gemini and handle Text-to-Speech
  const processSpokenQuery = async (queryText: string) => {
    if (!queryText.trim()) {
      setVoiceState("ready");
      return;
    }

    setVoiceState("processing");
    try {
      const assistantReply = await onAskQuestion(queryText);
      if (assistantReply && typeof assistantReply === "string") {
        setResponse(assistantReply);
        // Automatically speak the response
        readResponseAloud(assistantReply);
      } else {
        setVoiceState("ready");
      }
    } catch (err: any) {
      setErrorMessage(
        isTelugu
          ? "సమాధానం పొందడంలో సమస్య ఏర్పడింది. దయచేసి మళ్లీ ప్రయత్నించండి."
          : "Could not generate response. Please try again or type instead."
      );
      setVoiceState("error");
    }
  };

  // Text-to-Speech Playback
  const readResponseAloud = (textToSpeak: string) => {
    if (!textToSpeak) return;

    setVoiceState("speaking");
    setIsAudioPlaying(true);

    const started = speakText(
      textToSpeak,
      language,
      () => {
        setIsAudioPlaying(true);
        setVoiceState("speaking");
      },
      () => {
        setIsAudioPlaying(false);
        setVoiceState("ready");
      },
      (err) => {
        console.warn("TTS error:", err);
        setIsAudioPlaying(false);
        setVoiceState("ready");
      }
    );

    if (!started) {
      setIsAudioPlaying(false);
      setVoiceState("ready");
    }
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    setIsAudioPlaying(false);
    setVoiceState("ready");
  };

  return (
    <div
      id="card-weathergpt-voice-assistant"
      className="rounded-2xl sm:rounded-3xl bg-[#fcfbfa] border border-stone-200/90 p-4 sm:p-5 shadow-xs relative overflow-hidden transition-all"
    >
      {/* Subtle Warm Atmospheric Ambient Glow */}
      <div className="absolute top-0 right-0 w-72 h-36 bg-gradient-to-bl from-amber-100/40 via-orange-50/20 to-transparent blur-2xl pointer-events-none" />

      {/* Card Header & Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-stone-200/60 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-100/80 text-amber-800 border border-amber-200/80">
              <Radio className="w-4 h-4 animate-pulse" />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
              WeatherGPT Voice Assistant
            </h2>
          </div>
          <p className="text-xs text-stone-600 mt-0.5">
            {isTelugu
              ? "వాతావరణం, ప్రయాణం, వ్యవసాయం మరియు భద్రత గురించి మాట్లాడండి."
              : "Ask about weather, travel, farming and safety."}
          </p>
        </div>

        {/* Dedicated English | తెలుగు Switcher */}
        <div className="flex items-center gap-1.5 self-start sm:self-center bg-stone-100/90 p-1 rounded-xl border border-stone-200 text-xs">
          <Languages className="w-3.5 h-3.5 text-stone-500 ml-1.5" />
          <button
            onClick={() => onSelectLanguage("en")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              language === "en"
                ? "bg-white text-stone-900 shadow-xs font-semibold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            English
          </button>
          <button
            onClick={() => onSelectLanguage("te")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              language === "te"
                ? "bg-amber-600 text-white shadow-xs font-semibold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            తెలుగు
          </button>
        </div>
      </div>

      {/* Central Interactive Voice Control Area */}
      <div className="pt-4 space-y-4 relative z-10">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Main Microphone Button */}
          <div className="relative flex items-center justify-center">
            {/* Animated Pulse Rings when Listening or Speaking */}
            {voiceState === "listening" && (
              <span className="absolute w-20 h-20 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
            )}
            {voiceState === "speaking" && (
              <span className="absolute w-20 h-20 rounded-full bg-amber-500/25 animate-pulse pointer-events-none" />
            )}

            <button
              id="btn-voice-assistant-mic"
              onClick={handleToggleListening}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 ${
                voiceState === "listening"
                  ? "bg-rose-600 text-white ring-4 ring-rose-300"
                  : voiceState === "speaking"
                  ? "bg-amber-600 text-white ring-4 ring-amber-300"
                  : voiceState === "processing"
                  ? "bg-stone-700 text-white animate-pulse"
                  : "bg-gradient-to-tr from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white hover:shadow-lg"
              }`}
              title={
                voiceState === "listening"
                  ? "Stop listening"
                  : voiceState === "speaking"
                  ? "Stop audio"
                  : "Tap to speak"
              }
            >
              {voiceState === "listening" ? (
                <div className="w-5 h-5 rounded-sm bg-white" />
              ) : voiceState === "speaking" ? (
                <VolumeX className="w-6 h-6" />
              ) : voiceState === "processing" ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
            </button>
          </div>

          {/* Status Descriptor and Hint */}
          <div className="flex-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase">
              {voiceState === "ready" && (
                <span className="text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                  🎙️ Ready • Tap to Speak
                </span>
              )}
              {voiceState === "listening" && (
                <span className="text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                  🔴 Listening... Speak now ({isTelugu ? "తెలుగు" : "English"})
                </span>
              )}
              {voiceState === "processing" && (
                <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  ⏳ Processing with Gemini...
                </span>
              )}
              {voiceState === "speaking" && (
                <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 animate-pulse" />
                  🔊 Speaking response...
                </span>
              )}
              {voiceState === "error" && (
                <span className="text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                  ⚠️ Error
                </span>
              )}
            </div>

            <p className="text-xs text-stone-600 mt-1">
              {voiceState === "listening"
                ? isTelugu
                  ? "మీరు మాట్లాడుతున్నది వింటున్నాను..."
                  : "Listening to your voice. Say something like: \"Will it rain today?\""
                : isTelugu
                ? "మైక్ నొక్కి మాట్లాడండి. మాట్లాడిన సమాధానం స్క్రీన్‌పై కనిపించి, వినిపిస్తుంది."
                : "Click the mic to speak. Recognized speech appears in the chat and replies are read aloud."}
            </p>
          </div>
        </div>

        {/* Error message banner if any */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-snug">{errorMessage}</p>
          </div>
        )}

        {/* Real-Time Transcript Area ("What I heard...") */}
        {(transcript || interimText) && (
          <div className="p-3 rounded-xl bg-white border border-stone-200/90 shadow-2xs space-y-1">
            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
              What I heard...
            </span>
            <p className="text-xs sm:text-sm font-medium text-stone-800">
              {transcript}
              {interimText && (
                <span className="text-stone-400 italic"> {interimText}</span>
              )}
            </p>
          </div>
        )}

        {/* AI Response Area ("WeatherGPT") */}
        {response && (
          <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/70 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-700" />
                WeatherGPT Spoken Response
              </span>

              {/* Read Aloud / Speech Control */}
              <SpeechControls
                textToSpeak={response}
                language={language}
                size="sm"
              />
            </div>

            <p className="text-xs sm:text-sm text-stone-800 whitespace-pre-line leading-relaxed">
              {response}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
