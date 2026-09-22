import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Camera,
  Upload,
  RefreshCw,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Send,
  X,
  Sprout,
  Bug,
  CloudSun,
  FileText,
  HelpCircle,
  ImageIcon,
} from "lucide-react";
import {
  startListening,
  speakText,
  stopSpeaking,
  isSpeaking,
  isSpeechRecognitionSupported,
  ActiveRecognitionHandle,
} from "../utils/speech";
import {
  LocationItem,
  CurrentWeatherData,
  SupportedLanguageCode,
  CropDamageAnalysisResult,
} from "../types";
import { SpeechControls } from "./SpeechControls";

interface CropHealthAssistantProps {
  activeLocation: LocationItem;
  currentWeather: CurrentWeatherData | null;
  language: SupportedLanguageCode;
  onAdvisoryGenerated?: (advisoryText: string, cropName: string) => void;
  onOpenVoiceSettings?: () => void;
}

type AssistantState =
  | "idle"
  | "listening"
  | "transcribing"
  | "analyzing"
  | "speaking"
  | "error";

type ViewSection = "issue" | "treatment" | "weather" | "safety";

interface DemoPreset {
  id: string;
  cropEn: string;
  cropTe: string;
  titleEn: string;
  titleTe: string;
  problemEn: string;
  problemTe: string;
  icon: string;
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "paddy-yellow",
    cropEn: "Rice / Paddy",
    cropTe: "వరి (Paddy)",
    titleEn: "🌾 Paddy: Yellowing Leaves & Insects",
    titleTe: "🌾 వరి: ఆకులు పసుపు రంగు & పురుగులు",
    problemEn:
      "My rice leaves are turning yellow and there are small insects on the leaves. The tips are drying up.",
    problemTe:
      "నా వరి ఆకులు పసుపు రంగులోకి మారుతున్నాయి, ఆకుల మీద చిన్న పురుగులు ఉన్నాయి. చివర్లు ఎండిపోతున్నాయి.",
    icon: "🌾",
  },
  {
    id: "chilli-curl",
    cropEn: "Chilli",
    cropTe: "మిరప (Chilli)",
    titleEn: "🌶️ Chilli: Severe Leaf Curl",
    titleTe: "🌶️ మిరప: ఆకులు ముడుచుకుపోవడం",
    problemEn:
      "My chilli plant leaves are curling upwards and shoots are stunted. What medicine should I use safely?",
    problemTe:
      "నా మిరప పంటలో ఆకులు పైకి ముడుచుకుపోతున్నాయి, చిగుళ్ళు ఎదగడం లేదు. ఏ మందు వాడాలి?",
    icon: "🌶️",
  },
  {
    id: "tomato-blight",
    cropEn: "Tomato",
    cropTe: "టమోటా (Tomato)",
    titleEn: "🍅 Tomato: Brown Spots & Blight",
    titleTe: "🍅 టమోటా: ఆకులపై గోధుమ మచ్చలు",
    problemEn:
      "Tomato lower leaves have dark brown concentric spots and leaves are withering after recent rain.",
    problemTe:
      "టమోటా క్రింది ఆకులపై నల్లటి మరియు గోధుమ రంగు మచ్చలు వస్తున్నాయి, వర్షం తర్వాత ఆకులు రాలిపోతున్నాయి.",
    icon: "🍅",
  },
  {
    id: "cotton-boll",
    cropEn: "Cotton",
    cropTe: "పత్తి (Cotton)",
    titleEn: "☁️ Cotton: Bollworm & Square Drop",
    titleTe: "☁️ పత్తి: కాయ తొలిచే పురుగు & పూత రాలడం",
    problemEn:
      "Cotton squares and young bolls are dropping, and small holes are visible in the green bolls.",
    problemTe:
      "పత్తిలో పూత మరియు లేత కాయలు రాలిపోతున్నాయి, కాయలకు చిన్న రంధ్రాలు కనిపిస్తున్నాయి.",
    icon: "☁️",
  },
];

export const CropHealthAssistant: React.FC<CropHealthAssistantProps> = ({
  activeLocation,
  currentWeather,
  language,
  onAdvisoryGenerated,
  onOpenVoiceSettings,
}) => {
  const isTelugu = language === "te";

  // Form State
  const [problemDescription, setProblemDescription] = useState<string>("");
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [showTypeInput, setShowTypeInput] = useState<boolean>(false);

  // Status & Audio
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [activeVolumeLevel, setActiveVolumeLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);

  // Analysis Result
  const [analysisResult, setAnalysisResult] = useState<CropDamageAnalysisResult | null>(null);
  const [activeSection, setActiveSection] = useState<ViewSection>("issue");
  const [followUpResponse, setFollowUpResponse] = useState<string>("");

  // Refs
  const recognitionRef = useRef<ActiveRecognitionHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      recognitionRef.current?.abort();
    };
  }, []);

  // Sync speaking status
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAudioPlaying && !isSpeaking()) {
        setIsAudioPlaying(false);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [isAudioPlaying]);

  // Voice Recognition Handler
  const handleStartVoice = () => {
    setErrorMessage(null);

    if (assistantState === "listening") {
      recognitionRef.current?.stop();
      setAssistantState("idle");
      setActiveVolumeLevel(0);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setErrorMessage(
        isTelugu
          ? "మైక్రోఫోన్ అందుబాటులో లేదు. దయచేసి క్రింద మీ సమస్యను టైప్ చేయండి లేదా ఫోటో అప్‌లోడ్ చేయండి."
          : "Microphone access is unavailable on this device. You can type your problem or upload a photo."
      );
      setShowTypeInput(true);
      return;
    }

    setAssistantState("listening");
    setActiveVolumeLevel(0);

    const handle = startListening({
      language,
      onStart: () => {
        setAssistantState("listening");
        setErrorMessage(null);
      },
      onVolumeChange: (vol) => {
        setActiveVolumeLevel(vol);
      },
      onInterim: (interimText) => {
        setProblemDescription(interimText);
      },
      onFinal: (finalText) => {
        setActiveVolumeLevel(0);
        const clean = finalText.trim();
        if (clean) {
          setProblemDescription(clean);
          setAssistantState("idle");
          // Automatically trigger analysis if sufficient description provided
          triggerAnalysis(clean, selectedImageBase64, selectedCrop);
        } else {
          setAssistantState("idle");
        }
      },
      onError: (err) => {
        console.warn("Crop voice input notice:", err);
        setAssistantState("idle");
        setActiveVolumeLevel(0);
        setErrorMessage(err);
      },
      onEnd: () => {
        setActiveVolumeLevel(0);
        setAssistantState((prev) => (prev === "listening" ? "idle" : prev));
      },
    });

    recognitionRef.current = handle;
  };

  // Image Upload Handler
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage(
        isTelugu
          ? "దయచేసి చెల్లుబాటు అయ్యే పంట ఫోటోను ఎంచుకోండి (JPEG, PNG, WEBP)."
          : "Please select a valid image file (JPEG, PNG, WEBP)."
      );
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage(
        isTelugu
          ? "ఫోటో పరిమాణం చాలా పెద్దది (15MB కంటే తక్కువగా ఉండాలి)."
          : "Photo size is too large (must be under 15MB)."
      );
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      setSelectedImageBase64(b64);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImageBase64(null);
    setImageFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Trigger Analysis API
  const triggerAnalysis = async (
    desc: string,
    imgBase64: string | null,
    cropName?: string
  ) => {
    const cleanDesc = desc.trim();
    if (!cleanDesc && !imgBase64) {
      setErrorMessage(
        isTelugu
          ? "దయచేసి పంట సమస్యను మాట్లాడండి, టైప్ చేయండి లేదా పంట ఫోటోను అప్‌లోడ్ చేయండి."
          : "Please describe your crop problem using voice/text, or upload a photo."
      );
      return;
    }

    setAssistantState("analyzing");
    setErrorMessage(null);
    stopSpeaking();
    setIsAudioPlaying(false);

    try {
      const res = await fetch("/api/crop-damage-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemDescription: cleanDesc,
          imageData: imgBase64 || undefined,
          imageMimeType: imgBase64?.startsWith("data:image/png")
            ? "image/png"
            : "image/jpeg",
          crop: cropName || selectedCrop || undefined,
          activeLocation,
          language,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data: CropDamageAnalysisResult = await res.json();
      setAnalysisResult(data);
      setAssistantState("idle");
      setActiveSection("issue");

      if (data.crop) {
        setSelectedCrop(data.crop);
      }

      onAdvisoryGenerated?.(data.fullFormattedReply, data.crop || "Crop");

      // Auto Read Aloud concise summary in detected/active language
      const audioIntro =
        data.language === "te"
          ? `మీ ${data.crop} పంట సమస్యను విశ్లేషించాము. సాధ్యమైన కారణాలు మరియు సురక్షిత సిఫార్సులు సిద్ధంగా ఉన్నాయి.`
          : `We analyzed your ${data.crop} crop issue. Possible causes and verified recommendations are ready.`;

      speakText(audioIntro, data.language || language, () =>
        setIsAudioPlaying(true)
      );
    } catch (err: any) {
      console.error("Crop analysis failed:", err);
      setAssistantState("error");
      setErrorMessage(
        isTelugu
          ? "విశ్లేషణను పూర్తి చేయడంలో సమస్య ఏర్పడింది. దయచేసి మళ్లీ ప్రయత్నించండి."
          : "Failed to complete crop damage analysis. Please check your network and try again."
      );
    }
  };

  // Toggle Read Aloud for Full Answer
  const handleToggleReadAloud = () => {
    if (isAudioPlaying) {
      stopSpeaking();
      setIsAudioPlaying(false);
    } else if (analysisResult?.fullFormattedReply) {
      setIsAudioPlaying(true);
      speakText(
        analysisResult.fullFormattedReply,
        analysisResult.language || language,
        () => setIsAudioPlaying(true),
        () => setIsAudioPlaying(false),
        () => setIsAudioPlaying(false)
      );
    }
  };

  // Handle Quick Demo Preset
  const handleSelectPreset = (preset: DemoPreset) => {
    const desc = isTelugu ? preset.problemTe : preset.problemEn;
    const crop = isTelugu ? preset.cropTe : preset.cropEn;
    setProblemDescription(desc);
    setSelectedCrop(crop);
    triggerAnalysis(desc, null, crop);
  };

  // Reset Assistant
  const handleReset = () => {
    stopSpeaking();
    setIsAudioPlaying(false);
    recognitionRef.current?.abort();
    setAssistantState("idle");
    setProblemDescription("");
    setSelectedCrop("");
    setSelectedImageBase64(null);
    setImageFileName(null);
    setAnalysisResult(null);
    setErrorMessage(null);
    setFollowUpResponse("");
  };

  // Send Follow-Up Answer
  const handleSendFollowUp = () => {
    if (!followUpResponse.trim() || !analysisResult) return;
    const updatedDesc = `${analysisResult.symptomsDescription}. ${isTelugu ? "రైతు అదనపు సమాధానం:" : "Additional farmer clarification:"} ${followUpResponse.trim()}`;
    setProblemDescription(updatedDesc);
    setFollowUpResponse("");
    triggerAnalysis(updatedDesc, selectedImageBase64, analysisResult.crop);
  };

  return (
    <div
      id="card-crop-health-assistant"
      className="rounded-3xl bg-gradient-to-b from-[#fbfdf9] via-[#f7f9f3] to-[#f2f6ee] border-2 border-emerald-300/70 p-4 sm:p-6 shadow-sm relative overflow-hidden transition-all"
    >
      {/* Visual Nature Accent */}
      <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-emerald-100/50 via-green-50/20 to-transparent blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 border-b border-emerald-200/70 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-xs">
            <Sprout className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300/60">
                🌱 CROP HEALTH ASSISTANT
              </span>
              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-medium border border-stone-200">
                {isTelugu ? "తెలుగు వాయిస్ సపోర్ట్" : "Multilingual Voice AI"}
              </span>
              {currentWeather && (
                <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 text-[10px] font-semibold border border-sky-200 flex items-center gap-1">
                  <CloudSun className="w-3 h-3 text-sky-600" />
                  {activeLocation.name} ({Math.round(currentWeather.temperature)}°C, {currentWeather.humidity}%)
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-stone-900 mt-0.5">
              {isTelugu
                ? "పంట నష్టం & పురుగుల విశ్లేషణ (వాయిస్ / ఫోటో ద్వారా)"
                : "AI Crop Damage & Pest Doctor (Voice / Photo Diagnosis)"}
            </h3>
            <p className="text-xs text-stone-600">
              {isTelugu
                ? "మీ పంట సమస్యను తెలుగులో మాట్లాడండి లేదా ఆకుల ఫోటోను అప్‌లోడ్ చేయండి."
                : "Describe your crop problem using your voice or upload a photo."}
            </p>
          </div>
        </div>

        {/* Top Controls: Reset or Switch */}
        {analysisResult && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isTelugu ? "మరో సమస్యను అడగండి" : "Ask Another Question"}
            </button>
          </div>
        )}
      </div>

      {/* ERROR NOTICE */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-300/80 text-amber-900 text-xs flex items-start gap-2 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-amber-700 hover:text-amber-900 text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* INPUT FORM VIEW (When no analysis result yet) */}
      {!analysisResult && (
        <div className="mt-4 space-y-4 relative z-10">
          {/* PROMINENT MICROPHONE HERO BUTTON */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white/90 border border-emerald-200/80 shadow-xs flex flex-col items-center text-center space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                {isTelugu ? "వాయిస్ ద్వారా సమస్యను చెప్పండి" : "Speak Naturally By Voice"}
              </span>
              <p className="text-xs sm:text-sm text-stone-700 max-w-lg">
                {isTelugu
                  ? "ఉదాహరణ: \"నా వరి ఆకులు పసుపు రంగులోకి మారుతున్నాయి, ఆకుల మీద చిన్న పురుగులు ఉన్నాయి.\""
                  : 'Example: "My rice leaves are turning yellow and there are small insects on the leaves."'}
              </p>
            </div>

            {/* Big 🎙️ Button */}
            <button
              id="btn-describe-crop-problem-voice"
              type="button"
              onClick={handleStartVoice}
              disabled={assistantState === "analyzing"}
              className={`w-full sm:w-auto min-w-[260px] flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl font-bold text-sm sm:text-base cursor-pointer shadow-md transition-all active:scale-95 ${
                assistantState === "listening"
                  ? "bg-rose-600 hover:bg-rose-700 text-white animate-pulse ring-4 ring-rose-200"
                  : "bg-emerald-700 hover:bg-emerald-600 text-white hover:shadow-lg"
              }`}
            >
              <Mic
                className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  assistantState === "listening" ? "animate-bounce" : ""
                }`}
              />
              <span>
                {assistantState === "listening"
                  ? isTelugu
                    ? "🔴 వింటున్నాను... ఆపడానికి నొక్కండి"
                    : "🔴 Listening... Tap to Stop"
                  : isTelugu
                  ? "🎙️ పంట సమస్యను మాట్లాడండి"
                  : "🎙️ Describe Crop Problem"}
              </span>
            </button>

            {/* Live Audio Equalizer Waveform while listening */}
            {assistantState === "listening" && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs w-full max-w-md justify-center">
                <div className="flex items-center gap-1 h-5 px-2 bg-rose-100/90 rounded-lg">
                  <span
                    className="w-1.5 bg-rose-600 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(6, Math.min(20, 6 + activeVolumeLevel * 0.25))}px`,
                    }}
                  />
                  <span
                    className="w-1.5 bg-rose-600 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(8, Math.min(20, 8 + activeVolumeLevel * 0.4))}px`,
                    }}
                  />
                  <span
                    className="w-1.5 bg-rose-600 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(10, Math.min(20, 10 + activeVolumeLevel * 0.55))}px`,
                    }}
                  />
                  <span
                    className="w-1.5 bg-rose-600 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(7, Math.min(20, 7 + activeVolumeLevel * 0.3))}px`,
                    }}
                  />
                </div>
                <span className="font-medium animate-pulse">
                  {isTelugu
                    ? "ఇప్పుడు మాట్లాడండి... మీ మాటలు గుర్తించబడుతున్నాయి"
                    : "Speak now... audio detected"}
                </span>
              </div>
            )}

            {/* Spoken Transcription Preview */}
            {problemDescription.trim() && (
              <div className="w-full max-w-lg p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-left space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                  {isTelugu ? "గుర్తించిన మాటలు:" : "Transcribed Speech:"}
                </span>
                <p className="text-xs sm:text-sm font-medium text-stone-900">
                  &ldquo;{problemDescription}&rdquo;
                </p>
              </div>
            )}
          </div>

          {/* SECONDARY ACTION BUTTONS: 📷 UPLOAD PHOTO & ⌨️ TYPE PROBLEM */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* PHOTO UPLOAD CARD */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  {isTelugu ? "📷 పంట ఫోటో అప్‌లోడ్ చేయండి" : "📷 Upload Crop Photo"}
                </span>
                <span className="text-[10px] text-stone-500">
                  {isTelugu ? "ఆకు / కాయ / పురుగు" : "Leaf / Stem / Pest"}
                </span>
              </div>

              {/* Hidden file and camera inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageFileChange}
                className="hidden"
              />

              {/* Photo Preview or Select Buttons */}
              {selectedImageBase64 ? (
                <div className="flex items-center gap-3 p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <img
                    src={selectedImageBase64}
                    alt="Crop upload preview"
                    className="w-14 h-14 object-cover rounded-lg border border-emerald-300 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-emerald-950 truncate">
                      {imageFileName || "crop-photo.jpg"}
                    </p>
                    <span className="text-[10px] text-emerald-700">
                      {isTelugu ? "ఫోటో జోడించబడింది" : "Photo attached"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="p-1.5 rounded-lg hover:bg-emerald-200/60 text-stone-600 hover:text-stone-900 cursor-pointer"
                    title="Remove photo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-stone-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    {isTelugu ? "కెమెరా తీయండి" : "Take Photo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-stone-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    {isTelugu ? "గ్యాలరీ నుండి" : "Upload File"}
                  </button>
                </div>
              )}
            </div>

            {/* TYPE PROBLEM CARD */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  {isTelugu ? "⌨️ టైప్ చేయండి (ఐచ్ఛికం)" : "⌨️ Type Problem (Optional)"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTypeInput(!showTypeInput)}
                  className="text-[11px] text-emerald-700 hover:underline cursor-pointer font-medium"
                >
                  {showTypeInput
                    ? isTelugu
                      ? "దాచండి"
                      : "Hide"
                    : isTelugu
                    ? "ఓపెన్ చేయండి"
                    : "Open"}
                </button>
              </div>

              {showTypeInput ? (
                <textarea
                  rows={2}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder={
                    isTelugu
                      ? "పంట పేరు, ఆకుల రంగు, పురుగులు లేదా మచ్చల వివరాలను ఇక్కడ టైప్ చేయండి..."
                      : "Type crop name, leaf color, insects, or spot details here..."
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 resize-none shadow-2xs"
                />
              ) : (
                <p className="text-[11px] text-stone-500">
                  {isTelugu
                    ? "వాయిస్‌కి బదులుగా చేతితో టైప్ చేసి సమస్యను వివరించాలనుకుంటే ఇక్కడ రాయవచ్చు."
                    : "If you prefer typing your question manually, click Open to enter details."}
                </p>
              )}
            </div>
          </div>

          {/* SUBMIT ANALYSIS ACTION BUTTON (When input is ready) */}
          {(problemDescription.trim() || selectedImageBase64) && (
            <div className="flex justify-end pt-1">
              <button
                id="btn-analyze-crop-damage"
                type="button"
                onClick={() =>
                  triggerAnalysis(problemDescription, selectedImageBase64, selectedCrop)
                }
                disabled={assistantState === "analyzing"}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm cursor-pointer shadow-md transition-all active:scale-95"
              >
                {assistantState === "analyzing" ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {isTelugu
                        ? "రోగాన్ని & వాతావరణాన్ని విశ్లేషిస్తున్నాను..."
                        : "Analyzing Crop Damage & Weather..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>
                      {isTelugu
                        ? "పంట సమస్యను విశ్లేషించండి (Analyze Now)"
                        : "Analyze Crop Problem Now"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* LOADING STATE CARD */}
          {assistantState === "analyzing" && (
            <div className="p-6 rounded-2xl bg-white border border-emerald-300 text-center space-y-3 shadow-sm animate-pulse">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-100 text-emerald-800">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  🤖 {isTelugu ? "AI వ్యవసాయ శాస్త్రవేత్త విశ్లేషిస్తున్నారు..." : "Plant Pathology AI & Open-Meteo Telemetry"}
                </p>
                <p className="text-sm font-semibold text-stone-900">
                  {isTelugu
                    ? `లక్షణాలు, ${activeLocation.name} లైవ్ వాతావరణం మరియు ICAR ప్రామాణిక మార్గదర్శకాలను సరిపోల్చుతున్నాము...`
                    : `Correlating symptoms with ${activeLocation.name} humidity, rainfall, and ICAR agricultural standards...`}
                </p>
                <p className="text-xs text-stone-500">
                  {isTelugu
                    ? "సాధ్యమైన కారణాలు మరియు రసాయన రహిత నిర్వహణ ఎంపికలు సిద్ధమవుతున్నాయి..."
                    : "Differentiating possible causes from confirmed diagnoses with safety verification..."}
                </p>
              </div>
            </div>
          )}

          {/* QUICK HACKATHON DEMO PRESETS */}
          <div className="pt-2 space-y-2 border-t border-emerald-200/60">
            <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {isTelugu ? "త్వరిత డెమో ప్రశ్నలు (ఒక్క క్లిక్‌తో పరీక్షించండి):" : "Instant Hackathon Demo Presets (1-Tap Test):"}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border border-stone-200 bg-white hover:bg-emerald-50/80 hover:border-emerald-300 text-left text-xs transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                >
                  <span className="text-lg">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-900 truncate">
                      {isTelugu ? preset.titleTe : preset.titleEn}
                    </p>
                    <p className="text-[11px] text-stone-600 line-clamp-1">
                      &ldquo;{isTelugu ? preset.problemTe : preset.problemEn}&rdquo;
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ANALYSIS RESULT PRESENTATION (Structured Farmer-Friendly Cards) */}
      {analysisResult && (
        <div className="mt-4 space-y-4 relative z-10 animate-in fade-in duration-200">
          {/* TOP AUDIO & SUMMARY STRIP */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:p-3.5 rounded-2xl bg-emerald-100/70 border border-emerald-300 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-emerald-950 text-xs sm:text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                {analysisResult.crop}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/90 text-stone-700 font-medium text-[10px] border border-stone-200">
                {analysisResult.language === "te" ? "🇮🇳 తెలుగు" : "🌐 English"}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-semibold text-[10px] border border-amber-200">
                {isTelugu ? "సాధ్యమైన కారణం (ప్రాథమిక పరిశీలన)" : "Possible Cause (Preliminary Assessment)"}
              </span>
            </div>

            {/* Read Aloud Voice Button */}
            <div className="flex items-center gap-2">
              <SpeechControls
                textToSpeak={
                  analysisResult.fullFormattedReply ||
                  analysisResult.treatmentOptionsNote ||
                  analysisResult.symptomsDescription
                }
                language={language}
                onOpenVoiceSettings={onOpenVoiceSettings}
                size="default"
              />

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-semibold cursor-pointer shadow-2xs"
              >
                {isTelugu ? "కొత్త ప్రశ్న" : "New Question"}
              </button>
            </div>
          </div>

          {/* UNCLEAR IMAGE NOTICE (IF APPLICABLE) */}
          {analysisResult.isImageUnclear && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {isTelugu
                    ? "చిత్రం తగినంత స్పష్టంగా లేదు (Unclear Photo)"
                    : "The image is not clear enough to identify the problem reliably."}
                </p>
                <p>
                  {isTelugu
                    ? "దయచేసి ప్రభావిత ఆకు లేదా మొక్కకు దగ్గరగా స్పష్టమైన ఫోటో తీసి మళ్లీ పంపండి. అస్పష్టమైన ఫోటోల ఆధారంగా మేము ఊహాజనిత రోగ నిర్ధారణ చేయము."
                    : "Please upload a closer photo of the affected leaf/plant. We do not invent a diagnosis based on blurry photos."}
                </p>
              </div>
            </div>
          )}

          {/* NAVIGATION TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-200">
            <button
              type="button"
              onClick={() => setActiveSection("issue")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                activeSection === "issue"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              🌱 {isTelugu ? "సాధ్యమైన సమస్య" : "Possible Crop Issue"}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("treatment")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                activeSection === "treatment"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              💊 {isTelugu ? "చికిత్స & నిర్వహణ" : "Treatment & Management"}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("weather")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                activeSection === "weather"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              🌦️ {isTelugu ? "వాతావరణ ముప్పు" : "Weather Risk"}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection("safety")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                activeSection === "safety"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-white text-stone-700 hover:bg-stone-100 border border-stone-200"
              }`}
            >
              ⚠️ {isTelugu ? "భద్రతా జాగ్రత్తలు" : "Safety"}
            </button>
          </div>

          {/* TAB 1: POSSIBLE CROP ISSUE */}
          {activeSection === "issue" && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Bug className="w-4 h-4 text-emerald-600" />
                  {isTelugu ? "గుర్తించిన లక్షణాలు & సాధ్యమైన కారణాలు" : "Extracted Symptoms & Possible Causes"}
                </h4>
                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  {analysisResult.confidenceLevel === "medium"
                    ? isTelugu
                      ? "నమ్మకం: మధ్యస్థం (ప్రాథమిక పరిశీలన)"
                      : "Confidence: Moderate (Preliminary)"
                    : isTelugu
                    ? "నమ్మకం: పరిశీలనాత్మక"
                    : "Confidence: Observational"}
                </span>
              </div>

              {/* What was described */}
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-1 text-xs">
                <span className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">
                  {isTelugu ? "🔍 మీరు వివరించిన సమస్య:" : "🔍 What You Described:"}
                </span>
                <p className="text-stone-800 font-medium">
                  {analysisResult.symptomsSummary || analysisResult.symptomsDescription}
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] text-stone-500">
                  <span>
                    <strong>{isTelugu ? "ప్రభావిత భాగం:" : "Affected Part:"}</strong> {analysisResult.affectedPlantPart || (isTelugu ? "ఆకులు / చిగుళ్ళు" : "Leaves / Shoots")}
                  </span>
                  <span>
                    <strong>{isTelugu ? "వ్యవధి:" : "Duration:"}</strong> {analysisResult.duration || (isTelugu ? "ఇటీవల గమనించబడింది" : "Recently observed")}
                  </span>
                </div>
              </div>

              {/* Possible Causes List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-stone-900">
                  {isTelugu ? "🩺 సాధ్యమైన కారణాలు (Possible Causes):" : "🩺 Possible Causes (Not Confirmed Diagnoses):"}
                </span>
                <ul className="space-y-1.5">
                  {analysisResult.possibleCauses.map((cause, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs sm:text-sm text-stone-800 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Image Assessment Note if photo provided */}
              {analysisResult.isImageProvided && analysisResult.imageAssessment && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 space-y-1">
                  <span className="font-bold uppercase text-[10px] text-sky-800 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {isTelugu ? "ఫోటో పరిశీలన గమనిక:" : "Visual Photo Observation:"}
                  </span>
                  <p>{analysisResult.imageAssessment}</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TREATMENT & MANAGEMENT */}
          {activeSection === "treatment" && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
              {/* IPM / Non-Chemical Management First */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-emerald-100 text-emerald-800">
                    <Sprout className="w-4 h-4" />
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                    {isTelugu
                      ? "🌿 రసాయన రహిత & సమగ్ర సస్యరక్షణ (IPM Non-Chemical Management)"
                      : "🌿 Non-Chemical Management & IPM Practices"}
                  </h4>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {analysisResult.nonChemicalManagement.map((practice, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs sm:text-sm text-stone-800 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{practice}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verified Chemical / Pesticide Options (Safe & Verified Only) */}
              <div className="space-y-2.5 pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    {isTelugu ? "💊 నిర్ధారించబడిన రసాయన ఎంపికలు (Verified Options Only)" : "💊 Verified Treatment Options (Strictly Verified)"}
                  </h4>
                  <span className="text-[10px] text-stone-500 font-semibold">
                    {isTelugu ? "డోసేజ్ లేబుల్ ప్రకారం మాత్రమే" : "Check Product Label"}
                  </span>
                </div>

                <p className="text-xs text-stone-600 italic">
                  {analysisResult.treatmentOptionsNote}
                </p>

                {analysisResult.verifiedPesticides && analysisResult.verifiedPesticides.length > 0 ? (
                  <div className="space-y-2">
                    {analysisResult.verifiedPesticides.map((pest, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold text-stone-900">
                          <span>{pest.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono">
                            {pest.activeIngredient}
                          </span>
                        </div>
                        <p className="text-stone-600">
                          <strong>{isTelugu ? "లక్ష్యం:" : "Target:"}</strong> {pest.targetPestOrDisease}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                          <span>
                            <strong>{isTelugu ? "మూలం:" : "Source:"}</strong> {pest.source}
                          </span>
                          <span className="text-amber-800 font-medium">
                            {pest.safetyNote}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    {isTelugu
                      ? "అందుబాటులో ఉన్న సమాచారంతో నిర్దిష్ట రసాయనాన్ని ధృవీకరించడం సాధ్యం కాదు. దయచేసి స్థానిక వ్యవసాయ విస్తరణ అధికారిని (AEO) సంప్రదించండి."
                      : "I can identify the likely problem, but I cannot safely verify a pesticide recommendation from the available information. Please check the local agricultural department/extension officer or the product label before applying any pesticide."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WEATHER RISK */}
          {activeSection === "weather" && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-sky-600" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                    {isTelugu ? "🌦️ వాతావరణ అనుసంధానం & తెగులు రిస్క్" : "🌦️ Weather Connection & Microclimate Risk"}
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    Open-Meteo Telemetry for {activeLocation.name}
                  </p>
                </div>
              </div>

              {/* Live Weather Metrics */}
              {currentWeather && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10px] uppercase">
                      {isTelugu ? "ఉష్ణోగ్రత" : "Temperature"}
                    </span>
                    <p className="text-sm font-bold text-stone-900">
                      {Math.round(currentWeather.temperature)}°C
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10px] uppercase">
                      {isTelugu ? "గాలిలో తేమ" : "Humidity"}
                    </span>
                    <p className="text-sm font-bold text-stone-900">
                      {currentWeather.humidity}%
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10px] uppercase">
                      {isTelugu ? "వర్ష సూచన" : "Rain Prob"}
                    </span>
                    <p className="text-sm font-bold text-stone-900">
                      {currentWeather.rainProbability}%
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-50 border border-stone-200">
                    <span className="text-stone-500 text-[10px] uppercase">
                      {isTelugu ? "గాలి వేగం" : "Wind Speed"}
                    </span>
                    <p className="text-sm font-bold text-stone-900">
                      {Math.round(currentWeather.windSpeed)} km/h
                    </p>
                  </div>
                </div>
              )}

              {/* Weather Connection Explanation */}
              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs sm:text-sm text-stone-800 space-y-1">
                <span className="font-bold text-sky-900 text-xs block">
                  {isTelugu ? "వాతావరణం ఎలా ప్రభావితం చేస్తుంది:" : "How Weather Influences This Condition:"}
                </span>
                <p className="leading-relaxed">
                  {analysisResult.weatherConnection}
                </p>
              </div>

              <p className="text-[11px] text-stone-500 italic">
                {isTelugu
                  ? "గమనిక: ప్రస్తుత వాతావరణం వ్యాప్తిని మాత్రమే ప్రభావితం చేస్తుంది; వాతావరణం ఒక్కటే సమస్య ఉనికిని నిర్ధారించదు."
                  : "Note: Weather conditions indicate disease favorability only; weather alone does not prove the presence of the pathogen."}
              </p>
            </div>
          )}

          {/* TAB 4: SAFETY PRECAUTIONS */}
          {activeSection === "safety" && (
            <div className="p-4 sm:p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900">
                    {isTelugu ? "⚠️ తప్పనిసరి భద్రతా సూత్రాలు (Safety Rules)" : "⚠️ Mandatory Safety Precautions"}
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    {isTelugu ? "రైతులు మరియు పర్యావరణ రక్షణ కోసం మార్గదర్శకాలు" : "Official Agricultural Worker Safety Mandates"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {analysisResult.safetyPrecautions.map((precaution, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 text-xs sm:text-sm text-rose-950 font-medium flex items-start gap-2"
                  >
                    <span>{precaution}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold">
                  {isTelugu ? "వ్యవసాయ సలహా సూచన:" : "Official Extension Advisory:"}
                </p>
                <p>
                  {isTelugu
                    ? "ఇది నిర్ణయ మద్దతు వ్యవస్థ మాత్రమే (Decision Support Tool). క్షేత్రస్థాయి చికిత్సకు ముందు స్థానిక వ్యవసాయ విస్తరణ అధికారి (AEO / KVK)ని సంప్రదించండి."
                    : "WeatherGPT is an agronomic decision-support tool, not a substitute for qualified agricultural extension officers. Always verify product labels locally."}
                </p>
              </div>
            </div>
          )}

          {/* INTERACTIVE FOLLOW-UP SECTION (IF APPLICABLE) */}
          {analysisResult.followUpQuestion && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-300 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950">
                  {isTelugu ? "AI వ్యవసాయ సహాయకుడి అదనపు ప్రశ్న:" : "AI Follow-Up Question:"}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-stone-900">
                &ldquo;{analysisResult.followUpQuestion}&rdquo;
              </p>

              {/* Reply field or voice input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={followUpResponse}
                  onChange={(e) => setFollowUpResponse(e.target.value)}
                  placeholder={
                    isTelugu
                      ? "మీ సమాధానం ఇక్కడ టైప్ చేయండి (ఉదా: 4 రోజుల నుండి)..."
                      : "Type clarification here (e.g. 3 days, seen on leaf underside)..."
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && followUpResponse.trim()) {
                      handleSendFollowUp();
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleSendFollowUp}
                  disabled={!followUpResponse.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTelugu ? "పంపండి" : "Send"}</span>
                </button>
              </div>
            </div>
          )}

          {/* RECOMMENDED PHOTO & OFFICIAL SOURCES */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-stone-500 border-t border-emerald-200/70">
            <span className="flex items-center gap-1">
              📷 <strong>{isTelugu ? "తదుపరి సిఫార్సు:" : "Next Step:"}</strong>{" "}
              {analysisResult.recommendedPhotoOrStep}
            </span>
            <span className="font-mono text-[10px]">
              {isTelugu ? "మూలాలు: " : "Sources: "}
              {analysisResult.sources.join(", ")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
