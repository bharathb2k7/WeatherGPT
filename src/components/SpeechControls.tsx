import React, { useState, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Pause,
  Play,
  Square,
  Settings,
} from "lucide-react";
import { SupportedLanguageCode } from "../types";
import { getLanguageInfo } from "../data/languages";
import {
  speakText,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  isSpeaking,
  isPaused,
  subscribeSpeechPlayback,
  SpeechPlaybackState,
  VoiceUnavailableInfo,
} from "../utils/speech";

interface SpeechControlsProps {
  textToSpeak: string;
  language: SupportedLanguageCode;
  onOpenVoiceSettings?: () => void;
  onVoiceUnavailable?: (info: VoiceUnavailableInfo) => void;
  size?: "sm" | "default";
  className?: string;
  showSettingsButton?: boolean;
}

export const SpeechControls: React.FC<SpeechControlsProps> = ({
  textToSpeak,
  language,
  onOpenVoiceSettings,
  onVoiceUnavailable,
  size = "sm",
  className = "",
  showSettingsButton = true,
}) => {
  const [isPlayingThis, setIsPlayingThis] = useState<boolean>(false);
  const [playbackState, setPlaybackState] = useState<SpeechPlaybackState>({
    status: "idle",
    languageCode: language,
    isPaused: false,
  });

  const langInfo = getLanguageInfo(language);
  const isTelugu = language === "te";

  useEffect(() => {
    const unsub = subscribeSpeechPlayback((state) => {
      setPlaybackState(state);
      if (state.status === "idle") {
        setIsPlayingThis(false);
      }
    });
    return () => unsub();
  }, []);

  const handleStartSpeak = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!textToSpeak) return;

    setIsPlayingThis(true);
    const success = speakText(
      textToSpeak,
      language,
      () => {
        setIsPlayingThis(true);
      },
      () => {
        setIsPlayingThis(false);
      },
      (err) => {
        console.warn("TTS error:", err);
        setIsPlayingThis(false);
      },
      (unavailableInfo) => {
        setIsPlayingThis(false);
        onVoiceUnavailable?.(unavailableInfo);
      }
    );

    if (!success) {
      setIsPlayingThis(false);
    }
  };

  const handlePause = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    pauseSpeaking();
  };

  const handleResume = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    resumeSpeaking();
  };

  const handleStop = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    stopSpeaking();
    setIsPlayingThis(false);
  };

  const isCurrentActive = isPlayingThis && playbackState.status !== "idle";
  const isCurrentlyPaused = isCurrentActive && playbackState.isPaused;

  const btnPadding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";

  if (!isCurrentActive) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={handleStartSpeak}
          className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer bg-stone-100 hover:bg-stone-200/90 text-stone-700 hover:text-stone-900 border border-stone-200/90 shadow-2xs ${btnPadding}`}
          title={isTelugu ? "వినండి (Read Aloud)" : "Read message aloud"}
        >
          <Volume2 className="w-3.5 h-3.5 text-stone-600" />
          <span>{isTelugu ? "వినండి" : "Read Aloud"}</span>
        </button>

        {showSettingsButton && onOpenVoiceSettings && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVoiceSettings();
            }}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            title={isTelugu ? "వాయిస్ సెట్టింగ్‌లు" : "Voice Settings"}
          >
            <Settings className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // Active Playback Controls: [🔊 Speaking in తెలుగు...] [⏸ Pause / ▶ Resume] [⏹ Stop] [⚙️]
  return (
    <div
      className={`inline-flex items-center gap-1.5 p-0.5 rounded-lg bg-amber-50/90 border border-amber-300 text-stone-800 shadow-2xs ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Speaking Status Pill */}
      <span className="inline-flex items-center gap-1 px-1.5 text-[10px] font-semibold text-amber-900 animate-pulse">
        <Volume2 className="w-3 h-3 text-amber-700" />
        <span>
          {isCurrentlyPaused
            ? isTelugu
              ? "తాత్కాలికంగా ఆపబడింది"
              : "Paused"
            : isTelugu
            ? "తెలుగులో చదువుతోంది..."
            : `Speaking in ${langInfo.nativeName}...`}
        </span>
      </span>

      {/* Pause / Resume Button */}
      {isCurrentlyPaused ? (
        <button
          type="button"
          onClick={handleResume}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-200/80 hover:bg-amber-300 text-amber-950 transition-colors cursor-pointer"
          title="Resume speech"
        >
          <Play className="w-3 h-3 text-amber-900" />
          <span className="hidden sm:inline">Resume</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePause}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-200/80 hover:bg-amber-300 text-amber-950 transition-colors cursor-pointer"
          title="Pause speech"
        >
          <Pause className="w-3 h-3 text-amber-900" />
          <span className="hidden sm:inline">Pause</span>
        </button>
      )}

      {/* Stop Button */}
      <button
        type="button"
        onClick={handleStop}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-rose-100 hover:bg-rose-200 text-rose-800 transition-colors cursor-pointer"
        title="Stop reading aloud"
      >
        <Square className="w-3 h-3 text-rose-700" />
        <span className="hidden sm:inline">Stop</span>
      </button>

      {/* Settings Button */}
      {showSettingsButton && onOpenVoiceSettings && (
        <button
          type="button"
          onClick={onOpenVoiceSettings}
          className="p-1 rounded-md text-amber-800 hover:text-amber-950 hover:bg-amber-200/50 transition-colors cursor-pointer"
          title="Voice Settings"
        >
          <Settings className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
