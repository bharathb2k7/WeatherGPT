import React, { useState, useEffect, useRef } from "react";
import {
  Sprout,
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Info,
  Layers,
  Bug,
  CloudSun,
} from "lucide-react";
import {
  startListening,
  speakText,
  stopSpeaking,
  isSpeaking,
  isSpeechRecognitionSupported,
  ActiveRecognitionHandle,
} from "../utils/speech";
import { LocationItem, CurrentWeatherData, SupportedLanguageCode } from "../types";
import { CropHealthAssistant } from "./CropHealthAssistant";
import { SpeechControls } from "./SpeechControls";

interface FarmerModeCardProps {
  activeLocation: LocationItem;
  currentWeather: CurrentWeatherData | null;
  language: SupportedLanguageCode;
  onAdvisoryGenerated?: (advisoryText: string, crop: string) => void;
  onOpenVoiceSettings?: () => void;
}

const COMMON_CROPS = [
  { id: "rice", name: "Rice / Paddy", telugu: "వరి (Paddy)", icon: "🌾" },
  { id: "cotton", name: "Cotton", telugu: "పత్తి (Cotton)", icon: "☁️" },
  { id: "maize", name: "Maize / Corn", telugu: "మొక్కజొన్న (Maize)", icon: "🌽" },
  { id: "groundnut", name: "Groundnut", telugu: "వేరుశనగ (Groundnut)", icon: "🥜" },
  { id: "chilli", name: "Chilli", telugu: "మిరప (Chilli)", icon: "🌶️" },
  { id: "tomato", name: "Tomato", telugu: "టమోటా (Tomato)", icon: "🍅" },
  { id: "sugarcane", name: "Sugarcane", telugu: "చెరకు (Sugarcane)", icon: "🎋" },
  { id: "wheat", name: "Wheat", telugu: "గోధుమ (Wheat)", icon: "🌾" },
];

export const FarmerModeCard: React.FC<FarmerModeCardProps> = ({
  activeLocation,
  currentWeather,
  language,
  onAdvisoryGenerated,
  onOpenVoiceSettings,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [activeFarmerTab, setActiveFarmerTab] = useState<"crop_health" | "weather_advisory">("crop_health");
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [customCropInput, setCustomCropInput] = useState<string>("");
  const [step, setStep] = useState<"choose" | "confirm" | "advisory">("choose");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [advisoryResult, setAdvisoryResult] = useState<string>("");
  const [isListeningCrop, setIsListeningCrop] = useState<boolean>(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);

  const recognitionRef = useRef<ActiveRecognitionHandle | null>(null);
  const isTelugu = language === "te";

  useEffect(() => {
    return () => {
      stopSpeaking();
      recognitionRef.current?.abort();
    };
  }, []);

  // Monitor speaking status
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAudioPlaying && !isSpeaking()) {
        setIsAudioPlaying(false);
      }
    }, 400);
    return () => clearInterval(interval);
  }, [isAudioPlaying]);

  // Voice recognition for crop name
  const handleSpeakCropName = () => {
    setMicError(null);
    if (isListeningCrop) {
      recognitionRef.current?.stop();
      setIsListeningCrop(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setMicError(
        isTelugu
          ? "మైక్రోఫోన్ అందుబాటులో లేదు. దయచేసి పంట పేరును క్రింద ఎంచుకోండి లేదా టైప్ చేయండి."
          : "Microphone access is unavailable. You can type or select your crop instead."
      );
      return;
    }

    setIsListeningCrop(true);
    const handle = startListening({
      language,
      onStart: () => setIsListeningCrop(true),
      onInterim: (text) => setCustomCropInput(text),
      onFinal: (finalCropText) => {
        setIsListeningCrop(false);
        setCustomCropInput(finalCropText);
        if (finalCropText.trim()) {
          handleSelectCrop(finalCropText.trim());
        }
      },
      onError: (msg) => {
        setIsListeningCrop(false);
        setMicError(msg);
      },
      onEnd: () => setIsListeningCrop(false),
    });
    recognitionRef.current = handle;
  };

  // Crop Selected: Trigger confirmation & load advisory
  const handleSelectCrop = async (cropName: string) => {
    setSelectedCrop(cropName);
    setStep("confirm");
    setIsLoading(true);
    setAdvisoryResult("");
    setMicError(null);

    try {
      const res = await fetch("/api/crop-advisory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: cropName,
          activeLocation,
          language,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const text = isTelugu && data.replyTelugu ? data.replyTelugu : data.reply;
      setAdvisoryResult(text);
      setStep("advisory");
      onAdvisoryGenerated?.(text, cropName);

      // Speak confirmation + advisory intro
      const intro = isTelugu
        ? `మీ ${cropName} పంట కోసం వాతావరణ సలహాలు సిద్ధమయ్యాయి.`
        : `Weather recommendations for your ${cropName} crop are ready.`;
      speakText(intro, language);
    } catch (err) {
      console.error("Crop advisory failed:", err);
      setStep("choose");
      setMicError(
        isTelugu
          ? "పంట సలహా లోడ్ చేయడంలో విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి."
          : "Failed to generate crop advisory. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Read Aloud
  const handleToggleReadAloud = () => {
    if (isAudioPlaying) {
      stopSpeaking();
      setIsAudioPlaying(false);
    } else if (advisoryResult) {
      setIsAudioPlaying(true);
      speakText(
        advisoryResult,
        language,
        () => setIsAudioPlaying(true),
        () => setIsAudioPlaying(false),
        () => setIsAudioPlaying(false)
      );
    }
  };

  const handleReset = () => {
    stopSpeaking();
    setIsAudioPlaying(false);
    setSelectedCrop("");
    setCustomCropInput("");
    setAdvisoryResult("");
    setStep("choose");
  };

  return (
    <div
      id="card-farmer-mode"
      className="rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#fbfdfa] via-[#f7f9f4] to-[#f4f7f0] border border-emerald-300/60 p-4 sm:p-5 shadow-xs relative overflow-hidden transition-all"
    >
      {/* Nature Glow Accent */}
      <div className="absolute top-0 right-0 w-80 h-40 bg-gradient-to-bl from-emerald-100/40 via-green-50/20 to-transparent blur-3xl pointer-events-none" />

      {/* Header View */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-emerald-200/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-800 border border-emerald-200">
            <Sprout className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                🌱 Farmer Mode
              </span>
              <span className="px-2 py-0.2 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                Crop Advisory
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-stone-900">
              {isTelugu
                ? "మీ పంటకు వాతావరణ ఆధారిత వ్యవసాయ సలహాలు"
                : "Get weather-aware recommendations for your crop"}
            </h3>
          </div>
        </div>

        {/* Start / Toggle Button */}
        {!isOpen ? (
          <button
            id="btn-start-crop-advisory"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs sm:text-sm font-semibold cursor-pointer shadow-xs transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            {isTelugu ? "రైతు సలహా ప్రారంభించండి" : "Start Crop Advisory"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {step === "advisory" && (
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-medium cursor-pointer transition-colors"
              >
                {isTelugu ? "మరో పంట మార్చు" : "Change Crop"}
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                handleReset();
              }}
              className="px-2.5 py-1.5 rounded-lg text-stone-500 hover:text-stone-800 text-xs cursor-pointer"
            >
              {isTelugu ? "మూసివేయి" : "Close"}
            </button>
          </div>
        )}
      </div>

      {/* Interactive Crop Recommendation Steps */}
      {isOpen && (
        <div className="pt-3 space-y-3 relative z-10 animate-in fade-in duration-200">
          {/* Submode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-emerald-100/70 border border-emerald-200/80">
            <button
              id="tab-crop-health-doctor"
              type="button"
              onClick={() => setActiveFarmerTab("crop_health")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all ${
                activeFarmerTab === "crop_health"
                  ? "bg-white text-emerald-950 shadow-xs border border-emerald-200"
                  : "text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50/50"
              }`}
            >
              <Bug className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                {isTelugu
                  ? "🌱 పంట రోగ & పురుగుల డాక్టర్ (AI Doctor)"
                  : "🌱 Crop Health & Pest Doctor"}
              </span>
            </button>
            <button
              id="tab-crop-weather-advisory"
              type="button"
              onClick={() => setActiveFarmerTab("weather_advisory")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all ${
                activeFarmerTab === "weather_advisory"
                  ? "bg-white text-emerald-950 shadow-xs border border-emerald-200"
                  : "text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50/50"
              }`}
            >
              <CloudSun className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                {isTelugu ? "🌦️ పంట వాతావరణ సలహాలు" : "🌦️ Crop Weather Advisory"}
              </span>
            </button>
          </div>

          {/* TAB 1: CROP HEALTH ASSISTANT (VOICE & MULTIMODAL PEST DOCTOR) */}
          {activeFarmerTab === "crop_health" && (
            <CropHealthAssistant
              activeLocation={activeLocation}
              currentWeather={currentWeather}
              language={language}
              onAdvisoryGenerated={onAdvisoryGenerated}
              onOpenVoiceSettings={onOpenVoiceSettings}
            />
          )}

          {/* TAB 2: CROP STAGE & WEATHER ADVISORY */}
          {activeFarmerTab === "weather_advisory" && (
            <div className="space-y-4 pt-1">
              {/* STEP 1: CHOOSE CROP */}
              {step === "choose" && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-semibold text-stone-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      {isTelugu
                        ? "మీరు ఏ పంట సాగు చేస్తున్నారు?"
                        : "Which crop are you growing?"}
                    </p>

                    {/* Microphone Button to Speak Crop Name */}
                    <button
                      id="btn-speak-crop-name"
                      type="button"
                      onClick={handleSpeakCropName}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        isListeningCrop
                          ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                          : "bg-emerald-100/90 text-emerald-900 border-emerald-300 hover:bg-emerald-200"
                      }`}
                      title="Speak your crop name"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      {isListeningCrop
                        ? isTelugu
                          ? "వింటున్నాను..."
                          : "Listening..."
                        : isTelugu
                        ? "🎙️ పంట పేరు చెప్పండి"
                        : "🎙️ Speak Crop Name"}
                    </button>
                  </div>

                  {micError && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      {micError}
                    </div>
                  )}

                  {/* Quick Crop Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {COMMON_CROPS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCrop(c.name)}
                        className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-emerald-50/70 hover:border-emerald-300 text-stone-800 text-xs font-medium cursor-pointer transition-all shadow-2xs hover:shadow-xs text-left"
                      >
                        <span className="text-base">{c.icon}</span>
                        <span className="truncate">
                          {isTelugu ? c.telugu : c.name}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Crop Input Field */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customCropInput}
                      onChange={(e) => setCustomCropInput(e.target.value)}
                      placeholder={
                        isTelugu
                          ? "ఇతర పంట పేరును ఇక్కడ టైప్ చేయండి (ఉదా: పసుపు, పొద్దుతిరుగుడు)..."
                          : "Type any other crop name (e.g. Turmeric, Sunflower, Mango)..."
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customCropInput.trim()) {
                          handleSelectCrop(customCropInput.trim());
                        }
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customCropInput.trim()) {
                          handleSelectCrop(customCropInput.trim());
                        }
                      }}
                      disabled={!customCropInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      {isTelugu ? "సలహా పొందండి" : "Get Advisory"}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: CONFIRMATION & LOADING */}
              {step === "confirm" && isLoading && (
                <div className="p-5 rounded-2xl bg-white border border-emerald-200 text-center space-y-3 shadow-xs">
                  <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-100 text-emerald-800 animate-pulse">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      {isTelugu
                        ? `ఎంచుకున్న పంట: ${selectedCrop}`
                        : `Crop selected: ${selectedCrop}`}
                    </p>
                    <p className="text-sm font-semibold text-stone-800">
                      {isTelugu
                        ? `అర్థమైంది! మీ ${selectedCrop} పంట కోసం ${activeLocation.name} లైవ్ వాతావరణ సమాచారంతో సలహాలు సిద్ధం చేస్తున్నాను...`
                        : `Got it. I'll provide weather-aware recommendations for your ${selectedCrop} crop in ${activeLocation.name}...`}
                    </p>
                    <p className="text-xs text-stone-500">
                      {isTelugu
                        ? "ఉష్ణోగ్రత, వర్ష సూచన, గాలి వేగం మరియు తేమ గణాంకాలను పరిశీలిస్తున్నాము..."
                        : "Analyzing Open-Meteo rainfall forecast, wind speeds, and microclimate risk factors..."}
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: STRUCTURED CROP ADVISORY DISPLAY */}
              {step === "advisory" && advisoryResult && (
                <div className="space-y-3">
                  {/* Top Banner with Read Aloud & Crop Pill */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span className="font-bold text-emerald-950">
                        {isTelugu
                          ? `పంట ఎంపిక: ${selectedCrop}`
                          : `Crop selected: ${selectedCrop}`}
                      </span>
                      <span className="text-stone-500">({activeLocation.name})</span>
                    </div>

                    {/* Read Aloud Audio Control */}
                    <SpeechControls
                      textToSpeak={advisoryResult}
                      language={language}
                      onOpenVoiceSettings={onOpenVoiceSettings}
                      size="sm"
                    />
                  </div>

                  {/* Formatted Advisory Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200/90 shadow-xs space-y-3">
                    <div className="prose prose-stone max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-line text-stone-800">
                      {advisoryResult}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
