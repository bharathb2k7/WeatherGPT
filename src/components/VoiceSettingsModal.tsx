import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Volume2,
  VolumeX,
  Languages,
  Gauge,
  Play,
  Square,
  Check,
  X,
  Info,
  ExternalLink,
} from "lucide-react";
import { SupportedLanguageCode } from "../types";
import { SUPPORTED_LANGUAGES, getLanguageInfo } from "../data/languages";
import {
  LANGUAGE_CONFIG,
  getCompatibleVoices,
  getBestVoice,
  getSpeechRate,
  setSpeechRate,
  getSavedVoiceUri,
  setSavedVoiceUri,
  speakText,
  stopSpeaking,
  waitForVoices,
  subscribeVoicesChanged,
} from "../utils/speech";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: SupportedLanguageCode;
  onSelectLanguage: (lang: SupportedLanguageCode) => void;
}

const SAMPLE_TEXTS: Record<string, string> = {
  te: "నమస్కారం! WeatherGPT వాయిస్ స్పష్టంగా మరియు సహజంగా ఉంది.",
  hi: "नमस्ते! WeatherGPT की क्षेत्रीय आवाज़ बिल्कुल तैयार है।",
  ta: "வணக்கம்! WeatherGPT தமிழ் குரல் தயாராக உள்ளது.",
  kn: "ನಮಸ್ಕಾರ! WeatherGPT ಧ್ವನಿ ಸಿದ್ಧವಾಗಿದೆ.",
  ml: "നമസ്കാരം! WeatherGPT ശബ്ദം സജ്ജമാണ്.",
  mr: "नमस्कार! WeatherGPT चा आवाज तयार आहे.",
  bn: "নমস্কার! WeatherGPT ভয়েস প্রস্তুত।",
  gu: "નમસ્તે! WeatherGPT નો અવાજ તૈયાર છે.",
  pa: "ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ! WeatherGPT ਅਵਾਜ਼ ਤਿਆਰ ਹੈ।",
  or: "ନମସ୍କାର! WeatherGPT କଣ୍ଠସ୍ୱର ପ୍ରସ୍ତୁତ।",
  en: "Hello! WeatherGPT voice is calibrated for clear speech.",
  es: "¡Hola! La voz de WeatherGPT está lista.",
  fr: "Bonjour! La voix de WeatherGPT est prête.",
  ar: "مرحباً! صوت WeatherGPT جاهز.",
};

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onSelectLanguage,
}) => {
  const [selectedLang, setSelectedLang] = useState<SupportedLanguageCode>(currentLanguage);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>("");
  const [speed, setSpeed] = useState<number>(getSpeechRate());
  const [isPlayingSample, setIsPlayingSample] = useState<boolean>(false);

  // Sync selectedLang if prop changes
  useEffect(() => {
    setSelectedLang(currentLanguage);
  }, [currentLanguage]);

  // Load and refresh compatible voices
  useEffect(() => {
    const refreshVoices = () => {
      const compatible = getCompatibleVoices(selectedLang);
      setAvailableVoices(compatible);

      const saved = getSavedVoiceUri(selectedLang);
      if (saved && compatible.some((v) => v.voiceURI === saved)) {
        setSelectedVoiceUri(saved);
      } else {
        const best = getBestVoice(selectedLang);
        setSelectedVoiceUri(best?.voiceURI || "");
      }
    };

    refreshVoices();
    waitForVoices().then(refreshVoices);

    const unsub = subscribeVoicesChanged(() => {
      refreshVoices();
    });
    return () => unsub();
  }, [selectedLang]);

  // Update speed in localStorage when user toggles
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    setSpeechRate(newSpeed);
  };

  const handleVoiceChange = (uri: string) => {
    setSelectedVoiceUri(uri);
    setSavedVoiceUri(selectedLang, uri);
  };

  const handleLanguageChange = (code: SupportedLanguageCode) => {
    stopSpeaking();
    setIsPlayingSample(false);
    setSelectedLang(code);
    onSelectLanguage(code);
  };

  const handleTestVoice = () => {
    if (isPlayingSample) {
      stopSpeaking();
      setIsPlayingSample(false);
      return;
    }

    const sample = SAMPLE_TEXTS[selectedLang] || SAMPLE_TEXTS.en;
    setIsPlayingSample(true);

    speakText(
      sample,
      selectedLang,
      () => setIsPlayingSample(true),
      () => setIsPlayingSample(false),
      () => setIsPlayingSample(false)
    );
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  if (!isOpen) return null;

  const currentLangInfo = getLanguageInfo(selectedLang);
  const isTelugu = selectedLang === "te";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gradient-to-r from-amber-50 to-stone-50 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 leading-tight">
                  {isTelugu ? "వాయిస్ సెట్టింగ్‌లు" : "Voice Settings"}
                </h3>
                <p className="text-[11px] text-stone-500">
                  {isTelugu
                    ? "భాష, నేటివ్ వాయిస్ & ఉచ్చారణ వేగం"
                    : "Language, Native Voice & Speech Speed"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Settings Form */}
          <div className="p-5 space-y-4.5 text-xs text-stone-800">
            {/* 1. Language Selection */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
                <Languages className="w-3.5 h-3.5 text-amber-700" />
                <span>{isTelugu ? "భాష (Language)" : "Language"}</span>
              </label>
              <select
                value={selectedLang}
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguageCode)}
                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-300 text-stone-900 font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Native Voice Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
                  <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isTelugu ? "నేటివ్ వాయిస్ (Native Voice)" : "Native Voice"}</span>
                </label>
                <span className="text-[10px] text-stone-500">
                  {availableVoices.length > 0
                    ? `${availableVoices.length} ${availableVoices.length === 1 ? "voice" : "voices"} found`
                    : "No native voice on device"}
                </span>
              </div>

              {availableVoices.length > 0 ? (
                <select
                  value={selectedVoiceUri}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-300 text-stone-900 font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-colors cursor-pointer"
                >
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.default ? "★ Default" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-stone-700 space-y-1.5">
                  <div className="flex items-start gap-1.5 font-medium text-amber-900">
                    <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span>
                      {isTelugu
                        ? "ఈ పరికరంలో నేటివ్ తెలుగు వాయిస్ కనుగొనబడలేదు."
                        : `No native ${currentLangInfo.name} voice detected in this browser.`}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-600 leading-relaxed">
                    {isTelugu
                      ? "ఆండ్రాయిడ్ లేదా విండోస్ సిస్టమ్ సెట్టింగ్స్‌లో 'Telugu (India)' టెక్స్ట్-టు-స్పీచ్ డేటాను డౌన్‌లోడ్ చేసుకోవచ్చు. ఉచ్చారణ స్వచ్ఛత కోసం ఆంగ్ల వాయిస్‌తో తెలుగు చదవబడదు."
                      : `Install the regional voice pack in your device system settings (Android: Text-to-speech output; Windows: Time & Language > Speech). WeatherGPT will not use an English voice for ${currentLangInfo.name}.`}
                  </p>
                </div>
              )}
            </div>

            {/* 3. Speed Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-700">
                  <Gauge className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isTelugu ? "ఉచ్చారణ వేగం (Speech Speed)" : "Speech Speed"}</span>
                </label>
                <span className="text-[10px] font-mono text-stone-500">{speed.toFixed(2)}x</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "0.9x", value: 0.9, hint: "Clear / Slow" },
                  { label: "1.0x", value: 1.0, hint: "Normal" },
                  { label: "1.1x", value: 1.1, hint: "Brisk" },
                ].map((s) => {
                  const isActive = Math.abs(speed - s.value) < 0.05;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleSpeedChange(s.value)}
                      className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? "bg-amber-100 text-amber-950 border-amber-400 shadow-xs"
                          : "bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200"
                      }`}
                    >
                      <span className="text-xs">{s.label}</span>
                      <span className="text-[9px] text-stone-500 font-normal">{s.hint}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-stone-500 pt-0.5">
                {isTelugu
                  ? "ప్రాంతీయ భాషల స్పష్టత కోసం 0.9x – 1.0x సిఫార్సు చేయబడింది."
                  : "0.9x – 1.0x is recommended for natural regional language cadence and clarity."}
              </p>
            </div>
          </div>

          {/* Footer Controls */}
          <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={availableVoices.length === 0 && selectedLang !== "en"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                isPlayingSample
                  ? "bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 animate-pulse"
                  : availableVoices.length > 0 || selectedLang === "en"
                  ? "bg-white hover:bg-stone-100 text-stone-800 border border-stone-300"
                  : "bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
              }`}
            >
              {isPlayingSample ? (
                <>
                  <Square className="w-3.5 h-3.5 text-rose-700" />
                  <span>{isTelugu ? "ఆపు (Stop)" : "Stop Sample"}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-amber-700" />
                  <span>{isTelugu ? "వాయిస్ పరీక్ష (Listen Sample)" : "Listen Sample"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-stone-900 bg-amber-400 hover:bg-amber-300 border border-amber-500/80 shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isTelugu ? "పూర్తయింది (Done)" : "Done"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
