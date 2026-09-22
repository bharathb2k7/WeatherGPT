import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { VolumeX, Settings, RefreshCw, BookOpen, X, AlertTriangle } from "lucide-react";
import { VoiceUnavailableInfo, waitForVoices } from "../utils/speech";

interface VoiceUnavailableDialogProps {
  info: VoiceUnavailableInfo | null;
  onClose: () => void;
  onOpenVoiceSettings: () => void;
  onReadAsText?: () => void;
  onRetrySpeech?: () => void;
}

export const VoiceUnavailableDialog: React.FC<VoiceUnavailableDialogProps> = ({
  info,
  onClose,
  onOpenVoiceSettings,
  onReadAsText,
  onRetrySpeech,
}) => {
  const [isRetrying, setIsRetrying] = React.useState(false);

  if (!info) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await waitForVoices(1200);
      onRetrySpeech?.();
    } finally {
      setIsRetrying(false);
    }
  };

  const isTelugu = info.languageCode === "te";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
                <VolumeX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 leading-tight">
                  {isTelugu
                    ? "నేటివ్ తెలుగు వాయిస్ అందుబాటులో లేదు"
                    : `Native ${info.languageName} Voice Unavailable`}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {info.nativeName} ({info.languageName})
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-3.5 text-xs text-stone-700">
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-stone-900 leading-relaxed">
                  {info.message}
                </p>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  {isTelugu
                    ? "సహజమైన ఉచ్చారణను కాపాడేందుకు తెలుగు వచనాన్ని ఆంగ్ల/US వాయిస్‌తో చదవడం జరగదు."
                    : `WeatherGPT never reads ${info.languageName} using an English/US voice to prevent unnatural and distorted pronunciation.`}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-semibold text-stone-800 text-[11px] block">
                {isTelugu ? "ఎంపికలు (Options):" : "Available Options:"}
              </span>
              <ul className="space-y-1.5 text-[11px] text-stone-600 pl-1">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  <span>
                    <strong>{isTelugu ? "వచనంగా చదవండి" : "Read as Text"}:</strong>{" "}
                    {isTelugu ? "సమాధానాన్ని స్క్రీన్‌పై స్పష్టంగా చదవండి." : "Read the full response comfortably on screen."}
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  <span>
                    <strong>{isTelugu ? "వాయిస్ సెట్టింగ్‌లు" : "Voice Settings"}:</strong>{" "}
                    {isTelugu ? "మద్దతు ఉన్న ఇతర వాయిస్ లేదా వేగాన్ని ఎంచుకోండి." : "Check installed voices or adjust speech rate."}
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  <span>
                    <strong>{isTelugu ? "మళ్లీ ప్రయత్నించండి" : "Try Again"}:</strong>{" "}
                    {isTelugu ? "బ్రౌజర్ వాయిస్ జాబితాను తిరిగి రిఫ్రెష్ చేయండి." : "Refresh browser voice list if you just installed one."}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-end gap-2">
            {onReadAsText && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReadAsText();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 shadow-xs transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-stone-600" />
                <span>{isTelugu ? "వచనంగా చదవండి" : "Read as Text"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-stone-700 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-stone-600 ${isRetrying ? "animate-spin" : ""}`} />
              <span>{isTelugu ? "మళ్లీ ప్రయత్నించండి" : "Try Again"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenVoiceSettings();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-500/80 shadow-xs transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{isTelugu ? "వాయిస్ సెట్టింగ్‌లు" : "Voice Settings"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
