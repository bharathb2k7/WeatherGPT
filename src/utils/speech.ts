/**
 * Speech Recognition and Text-to-Speech utilities for WeatherGPT
 * Dual-engine: Browser Web Speech API + Gemini Multimodal Audio Transcription fallback
 */

// Check if Speech Recognition is supported in the browser
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      navigator.mediaDevices?.getUserMedia
  );
}

// Check if Text-to-Speech is supported
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean("speechSynthesis" in window);
}

export interface LanguageTtsConfig {
  code: string;
  locale: string;
  preferredLocales: string[];
  name: string;
  nativeName: string;
  scriptRegex?: RegExp;
}

export const LANGUAGE_CONFIG: Record<string, LanguageTtsConfig> = {
  en: {
    code: "en",
    locale: "en-IN",
    preferredLocales: ["en-IN", "en-GB", "en-US", "en"],
    name: "English",
    nativeName: "English",
  },
  te: {
    code: "te",
    locale: "te-IN",
    preferredLocales: ["te-IN", "te"],
    name: "Telugu",
    nativeName: "తెలుగు",
    scriptRegex: /[\u0C00-\u0C7F]/,
  },
  hi: {
    code: "hi",
    locale: "hi-IN",
    preferredLocales: ["hi-IN", "hi"],
    name: "Hindi",
    nativeName: "हिन्दी",
    scriptRegex: /[\u0900-\u097F]/,
  },
  ta: {
    code: "ta",
    locale: "ta-IN",
    preferredLocales: ["ta-IN", "ta"],
    name: "Tamil",
    nativeName: "தமிழ்",
    scriptRegex: /[\u0B80-\u0BFF]/,
  },
  kn: {
    code: "kn",
    locale: "kn-IN",
    preferredLocales: ["kn-IN", "kn"],
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    scriptRegex: /[\u0C80-\u0CFF]/,
  },
  ml: {
    code: "ml",
    locale: "ml-IN",
    preferredLocales: ["ml-IN", "ml"],
    name: "Malayalam",
    nativeName: "മലയാളം",
    scriptRegex: /[\u0D00-\u0D7F]/,
  },
  mr: {
    code: "mr",
    locale: "mr-IN",
    preferredLocales: ["mr-IN", "mr"],
    name: "Marathi",
    nativeName: "मराठी",
    scriptRegex: /[\u0900-\u097F]/,
  },
  bn: {
    code: "bn",
    locale: "bn-IN",
    preferredLocales: ["bn-IN", "bn"],
    name: "Bengali",
    nativeName: "বাংলা",
    scriptRegex: /[\u0980-\u09FF]/,
  },
  gu: {
    code: "gu",
    locale: "gu-IN",
    preferredLocales: ["gu-IN", "gu"],
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    scriptRegex: /[\u0A80-\u0AFF]/,
  },
  pa: {
    code: "pa",
    locale: "pa-IN",
    preferredLocales: ["pa-IN", "pa"],
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    scriptRegex: /[\u0A00-\u0A7F]/,
  },
  or: {
    code: "or",
    locale: "or-IN",
    preferredLocales: ["or-IN", "or"],
    name: "Odia",
    nativeName: "ଓଡ଼ిଆ",
    scriptRegex: /[\u0B00-\u0B7F]/,
  },
  es: {
    code: "es",
    locale: "es-ES",
    preferredLocales: ["es-ES", "es"],
    name: "Spanish",
    nativeName: "Español",
  },
  fr: {
    code: "fr",
    locale: "fr-FR",
    preferredLocales: ["fr-FR", "fr"],
    name: "French",
    nativeName: "Français",
  },
  ar: {
    code: "ar",
    locale: "ar-SA",
    preferredLocales: ["ar-SA", "ar"],
    name: "Arabic",
    nativeName: "العربية",
    scriptRegex: /[\u0600-\u06FF]/,
  },
};

/**
 * Detects the script language of a text string (e.g. Telugu script -> "te")
 */
export function detectTextLanguage(text: string): string | null {
  if (!text) return null;
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
  if (/[\u0B00-\u0B7F]/.test(text)) return "or";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return null;
}

// Map app language code to BCP 47 locale for speech recognition & TTS
export function getSpeechLocale(langCode: string): string {
  const config = LANGUAGE_CONFIG[langCode];
  if (config) {
    return config.locale;
  }
  return "en-IN";
}

export interface SpeechRecognizerOptions {
  language: string;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (errorMsg: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onVolumeChange?: (volume: number) => void; // 0 to 100 for visualizer
}

export interface ActiveRecognitionHandle {
  stop: () => void;
  abort: () => void;
}

// Active singleton tracking to prevent duplicate concurrent sessions
let currentActiveSession: ActiveRecognitionHandle | null = null;

export function stopAllListening(): void {
  if (currentActiveSession) {
    try {
      currentActiveSession.stop();
    } catch (e) {}
    currentActiveSession = null;
  }
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/ogg")) return "audio/ogg";
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Transcribe recorded audio on server using Gemini multimodal API
 */
async function transcribeAudioOnServer(blob: Blob, language: string): Promise<string> {
  try {
    const base64 = await blobToBase64(blob);
    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioData: base64,
        mimeType: blob.type || "audio/webm",
        language,
      }),
    });
    if (!res.ok) {
      throw new Error(`Server status ${res.status}`);
    }
    const data = await res.json();
    return data.transcript?.trim() || "";
  } catch (err) {
    console.warn("Server audio transcription fallback error:", err);
    return "";
  }
}

/**
 * Start listening for speech with permission guarantee, audio meter,
 * Web Speech API live stream, and Gemini audio transcription fallback.
 */
export function startListening(
  options: SpeechRecognizerOptions
): ActiveRecognitionHandle {
  stopAllListening();

  let isSessionActive = true;
  let hasDeliveredFinal = false;
  let lastRecognizedText = "";
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let recordedAudioChunks: Blob[] = [];
  let audioContext: AudioContext | null = null;
  let animFrameId: number | null = null;
  let silenceTimer: any = null;
  let recognitionInstance: any = null;

  const cleanupAudio = () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (options.onVolumeChange) {
      options.onVolumeChange(0);
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      mediaStream = null;
    }
    if (audioContext) {
      try {
        audioContext.close();
      } catch (e) {}
      audioContext = null;
    }
  };

  const finalizeText = async (text: string) => {
    if (hasDeliveredFinal) return;
    hasDeliveredFinal = true;
    isSessionActive = false;
    cleanupAudio();

    const clean = text.trim();
    if (clean) {
      options.onInterim?.(clean);
      options.onFinal(clean);
    } else {
      // If Web Speech yielded empty text, check if recorded audio can be transcribed
      if (recordedAudioChunks.length > 0) {
        const mime = recordedAudioChunks[0]?.type || getSupportedMimeType() || "audio/webm";
        const combinedBlob = new Blob(recordedAudioChunks, { type: mime });
        if (combinedBlob.size > 1000) {
          options.onInterim?.(
            options.language === "te"
              ? "వాయిస్ ప్రాసెస్ అవుతోంది..."
              : "Transcribing your voice..."
          );
          const serverText = await transcribeAudioOnServer(combinedBlob, options.language);
          if (serverText.trim()) {
            options.onInterim?.(serverText.trim());
            options.onFinal(serverText.trim());
            options.onEnd?.();
            return;
          }
        }
      }
      options.onError?.(
        options.language === "te"
          ? "మాటలు వినిపించలేదు. దయచేసి మళ్లీ మాట్లాడండి లేదా టైప్ చేయండి."
          : "No speech detected. Please speak clearly or type your question."
      );
    }
    options.onEnd?.();
  };

  const handleStop = () => {
    if (!isSessionActive) return;
    isSessionActive = false;

    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (e) {}
    }

    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch (e) {}
    }

    setTimeout(() => {
      finalizeText(lastRecognizedText);
    }, 250);
  };

  const handleAbort = () => {
    isSessionActive = false;
    hasDeliveredFinal = true;
    cleanupAudio();
    if (recognitionInstance) {
      try {
        recognitionInstance.abort();
      } catch (e) {}
    }
    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
      } catch (e) {}
    }
    options.onEnd?.();
  };

  const sessionHandle: ActiveRecognitionHandle = {
    stop: handleStop,
    abort: handleAbort,
  };
  currentActiveSession = sessionHandle;

  // Initialize Microphone Hardware Stream
  (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia not supported");
      }

      // Request explicit microphone access (triggers permission prompt)
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!isSessionActive) {
        cleanupAudio();
        return;
      }

      options.onStart?.();

      // Audio Context for Volume Metering
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContext = new AudioCtx();
          const source = audioContext.createMediaStreamSource(mediaStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const pcmData = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!isSessionActive || !audioContext) return;
            analyser.getByteFrequencyData(pcmData);
            let sum = 0;
            for (let i = 0; i < pcmData.length; i++) {
              sum += pcmData[i];
            }
            const average = sum / pcmData.length;
            const normalized = Math.min(100, Math.round((average / 128) * 100));
            if (options.onVolumeChange) {
              options.onVolumeChange(normalized);
            }
            animFrameId = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (audioErr) {
        console.warn("Audio meter setup skipped:", audioErr);
      }

      // Setup MediaRecorder for guaranteed audio transcription fallback
      try {
        const mimeType = getSupportedMimeType();
        const optionsObj = mimeType ? { mimeType } : undefined;
        mediaRecorder = new MediaRecorder(mediaStream, optionsObj);
        recordedAudioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedAudioChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          if (!hasDeliveredFinal && !lastRecognizedText.trim()) {
            finalizeText("");
          }
        };

        mediaRecorder.start(250); // Slice every 250ms
      } catch (recErr) {
        console.warn("MediaRecorder fallback setup failed:", recErr);
      }

      // Setup Web Speech API for real-time streaming recognition
      const SpeechRecClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecClass) {
        try {
          const recognition = new SpeechRecClass();
          recognitionInstance = recognition;

          const locale = getSpeechLocale(options.language);
          recognition.lang = locale;
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;

          recognition.onresult = (event: any) => {
            if (!isSessionActive) return;

            let interim = "";
            let finalStr = "";

            for (let i = 0; i < event.results.length; ++i) {
              const res = event.results[i];
              if (res.isFinal) {
                finalStr += res[0].transcript + " ";
              } else {
                interim += res[0].transcript;
              }
            }

            const fullText = (finalStr + interim).trim();
            if (fullText) {
              lastRecognizedText = fullText;
              options.onInterim?.(fullText);

              // Auto silence reset: finalize if silence of 2.2s occurs after user spoke
              if (silenceTimer) clearTimeout(silenceTimer);
              silenceTimer = setTimeout(() => {
                if (isSessionActive && lastRecognizedText.trim()) {
                  handleStop();
                }
              }, 2200);
            }
          };

          recognition.onerror = (event: any) => {
            console.warn("Web Speech API notice:", event.error);
            // Non-fatal errors: let MediaRecorder fallback handle it
            if (event.error === "not-allowed" || event.error === "permission-denied") {
              cleanupAudio();
              isSessionActive = false;
              options.onError?.(
                options.language === "te"
                  ? "మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. దయచేసి బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి."
                  : "Microphone permission denied. Please allow microphone access in your browser."
              );
              options.onEnd?.();
            }
          };

          recognition.onend = () => {
            if (isSessionActive) {
              // If recognition stopped unexpectedly but session is still open, finalize
              setTimeout(() => {
                if (isSessionActive) {
                  handleStop();
                }
              }, 300);
            }
          };

          recognition.start();
        } catch (recStartErr) {
          console.warn("SpeechRecognition.start() error:", recStartErr);
        }
      }
    } catch (permErr: any) {
      console.error("Microphone initialization error:", permErr);
      isSessionActive = false;
      cleanupAudio();

      let friendlyMsg =
        options.language === "te"
          ? "మైక్రోఫోన్ ప్రారంభించడం సాధ్యపడలేదు. దయచేసి అనుమతిని తనిఖీ చేయండి లేదా టైప్ చేయండి."
          : "Could not access microphone. Please check your browser microphone permission or type instead.";

      if (
        permErr?.name === "NotAllowedError" ||
        permErr?.name === "PermissionDeniedError"
      ) {
        friendlyMsg =
          options.language === "te"
            ? "మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. బ్రౌజర్ అడ్రస్ బార్‌లో మైక్రోఫోన్ అనుమతించండి."
            : "Microphone access was blocked. Please enable microphone permissions in your browser address bar.";
      } else if (
        permErr?.name === "NotFoundError" ||
        permErr?.name === "DevicesNotFoundError"
      ) {
        friendlyMsg =
          options.language === "te"
            ? "ఈ పరికరంలో మైక్రోఫోన్ కనుగొనబడలేదు. దయచేసి టైప్ చేయండి."
            : "No microphone hardware detected on this device. You can type your question.";
      }

      options.onError?.(friendlyMsg);
      options.onEnd?.();
    }
  })();

  return sessionHandle;
}

/**
 * Text-to-Speech playback using window.speechSynthesis
 */
export interface VoiceUnavailableInfo {
  languageCode: string;
  languageName: string;
  nativeName: string;
  message: string;
}

export type TtsPlaybackStatus = "idle" | "speaking" | "paused";

export interface SpeechPlaybackState {
  status: TtsPlaybackStatus;
  languageCode: string;
  voiceName?: string;
  isPaused: boolean;
}

let currentSpeechUtterances: SpeechSynthesisUtterance[] = [];
let speechQueueIndex = 0;
let isSpeakingActive = false;
let isSpeechPaused = false;
let currentSpeakingLanguage = "en";
let currentSpeakingVoiceName: string | undefined = undefined;
let currentAudioElement: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;

const playbackSubscribers = new Set<(state: SpeechPlaybackState) => void>();
const voiceChangeSubscribers = new Set<(voices: SpeechSynthesisVoice[]) => void>();

function notifyPlaybackState(): void {
  const state: SpeechPlaybackState = {
    status: !isSpeakingActive ? "idle" : isSpeechPaused ? "paused" : "speaking",
    languageCode: currentSpeakingLanguage,
    voiceName: currentSpeakingVoiceName,
    isPaused: isSpeechPaused,
  };
  playbackSubscribers.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.warn("Subscriber callback error:", e);
    }
  });
}

export function subscribeSpeechPlayback(
  callback: (state: SpeechPlaybackState) => void
): () => void {
  playbackSubscribers.add(callback);
  callback({
    status: !isSpeakingActive ? "idle" : isSpeechPaused ? "paused" : "speaking",
    languageCode: currentSpeakingLanguage,
    voiceName: currentSpeakingVoiceName,
    isPaused: isSpeechPaused,
  });
  return () => {
    playbackSubscribers.delete(callback);
  };
}

export function subscribeVoicesChanged(
  callback: (voices: SpeechSynthesisVoice[]) => void
): () => void {
  voiceChangeSubscribers.add(callback);
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      callback(voices);
    }
  }
  return () => {
    voiceChangeSubscribers.delete(callback);
  };
}

// Global voice listener initialization
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    const voices = window.speechSynthesis.getVoices();
    voiceChangeSubscribers.forEach((cb) => {
      try {
        cb(voices);
      } catch (e) {}
    });
  };
}

/**
 * Returns a promise that resolves when speechSynthesis voices are loaded
 */
export function waitForVoices(timeoutMs: number = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return Promise.resolve([]);
  }

  const immediate = window.speechSynthesis.getVoices();
  if (immediate && immediate.length > 0) {
    return Promise.resolve(immediate);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(window.speechSynthesis.getVoices());
      }
    };

    const handler = () => cleanup();
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(cleanup, timeoutMs);
  });
}

/**
 * Validates if a voice is genuinely compatible with a given language
 * STRICT: Non-English languages NEVER match English voices!
 */
export function isVoiceCompatibleWithLanguage(
  voice: SpeechSynthesisVoice,
  langCode: string
): boolean {
  if (!voice) return false;
  const config = LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;
  const voiceLang = (voice.lang || "").toLowerCase().replace(/_/g, "-");
  const voiceName = (voice.name || "").toLowerCase();

  // If testing a non-English language, reject any English voice!
  if (langCode !== "en") {
    if (voiceLang.startsWith("en") || voiceName.includes("english")) {
      return false;
    }
  }

  switch (langCode) {
    case "te":
      return (
        voiceLang.startsWith("te") ||
        voiceName.includes("telugu") ||
        /[\u0C00-\u0C7F]/.test(voice.name)
      );
    case "hi":
      return (
        voiceLang.startsWith("hi") ||
        voiceName.includes("hindi") ||
        /[\u0900-\u097F]/.test(voice.name)
      );
    case "ta":
      return (
        voiceLang.startsWith("ta") ||
        voiceName.includes("tamil") ||
        /[\u0B80-\u0BFF]/.test(voice.name)
      );
    case "kn":
      return (
        voiceLang.startsWith("kn") ||
        voiceName.includes("kannada") ||
        /[\u0C80-\u0CFF]/.test(voice.name)
      );
    case "ml":
      return (
        voiceLang.startsWith("ml") ||
        voiceName.includes("malayalam") ||
        /[\u0D00-\u0D7F]/.test(voice.name)
      );
    case "mr":
      return (
        voiceLang.startsWith("mr") ||
        voiceName.includes("marathi")
      );
    case "bn":
      return (
        voiceLang.startsWith("bn") ||
        voiceName.includes("bengali") ||
        voiceName.includes("bangla") ||
        /[\u0980-\u09FF]/.test(voice.name)
      );
    case "gu":
      return (
        voiceLang.startsWith("gu") ||
        voiceName.includes("gujarati") ||
        /[\u0A80-\u0AFF]/.test(voice.name)
      );
    case "pa":
      return (
        voiceLang.startsWith("pa") ||
        voiceName.includes("punjabi") ||
        /[\u0A00-\u0A7F]/.test(voice.name)
      );
    case "or":
      return (
        voiceLang.startsWith("or") ||
        voiceName.includes("odia") ||
        voiceName.includes("oriya") ||
        /[\u0B00-\u0B7F]/.test(voice.name)
      );
    case "es":
      return voiceLang.startsWith("es") || voiceName.includes("spanish");
    case "fr":
      return voiceLang.startsWith("fr") || voiceName.includes("french");
    case "ar":
      return voiceLang.startsWith("ar") || voiceName.includes("arabic");
    case "en":
    default:
      return voiceLang.startsWith("en") || voiceName.includes("english");
  }
}

/**
 * Returns all compatible voices available on the device for the chosen language,
 * sorted so that exact regional matches (e.g., te-IN) appear first.
 */
export function getCompatibleVoices(langCode: string): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }
  const allVoices = window.speechSynthesis.getVoices();
  const config = LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;
  const exactLocale = config.locale.toLowerCase().replace(/_/g, "-");

  const filtered = allVoices.filter((v) => isVoiceCompatibleWithLanguage(v, langCode));
  return filtered.sort((a, b) => {
    const aLang = (a.lang || "").toLowerCase().replace(/_/g, "-");
    const bLang = (b.lang || "").toLowerCase().replace(/_/g, "-");
    const aExact = aLang === exactLocale ? 1 : 0;
    const bExact = bLang === exactLocale ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return a.name.localeCompare(b.name);
  });
}

/**
 * User speech preference storage (Rate & preferred Voice URI)
 */
export function getSpeechRate(): number {
  if (typeof window === "undefined") return 0.95;
  const stored = localStorage.getItem("weathergpt_speech_rate");
  if (stored) {
    const num = parseFloat(stored);
    if (!isNaN(num) && num >= 0.8 && num <= 1.3) {
      return num;
    }
  }
  return 0.95; // Default between 0.9 and 1.0 for regional clarity
}

export function setSpeechRate(rate: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.max(0.8, Math.min(1.3, rate));
  localStorage.setItem("weathergpt_speech_rate", clamped.toFixed(2));
}

export function getSavedVoiceUri(langCode: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`weathergpt_voice_${langCode}`);
}

export function setSavedVoiceUri(langCode: string, voiceUri: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`weathergpt_voice_${langCode}`, voiceUri);
}

/**
 * Selects the best available native voice for the given languageCode by filtering
 * speechSynthesis.getVoices() based on the LANGUAGE_CONFIG mappings provided.
 *
 * Ensures exact regional locale matches (e.g., 'te-IN') are prioritized before
 * falling back to generic language codes (e.g., 'te').
 *
 * Strictly prevents English voices from being selected for non-English languages
 * like Telugu, Hindi, Tamil, etc., so speech remains authentic and natural.
 */
export function getBestVoice(languageCode: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  const allVoices = window.speechSynthesis.getVoices();
  if (!allVoices || allVoices.length === 0) {
    return null;
  }

  // Lookup target configuration from LANGUAGE_CONFIG
  const normalizedKey = (languageCode || "en").trim();
  const config: LanguageTtsConfig =
    LANGUAGE_CONFIG[normalizedKey] ||
    LANGUAGE_CONFIG[normalizedKey.toLowerCase()] ||
    Object.values(LANGUAGE_CONFIG).find(
      (c) =>
        c.code.toLowerCase() === normalizedKey.toLowerCase() ||
        c.locale.toLowerCase() === normalizedKey.toLowerCase() ||
        c.preferredLocales.some((l) => l.toLowerCase() === normalizedKey.toLowerCase())
    ) ||
    LANGUAGE_CONFIG[normalizedKey.split("-")[0]?.toLowerCase()] ||
    LANGUAGE_CONFIG.en;

  const isEnglish = config.code === "en";
  const exactRegionalLocale = config.locale.toLowerCase().replace(/_/g, "-"); // e.g. "te-in"
  const preferredLocales = (config.preferredLocales || [config.locale, config.code]).map((l) =>
    l.toLowerCase().replace(/_/g, "-")
  );
  const genericCode = config.code.toLowerCase(); // e.g. "te"
  const languageName = config.name.toLowerCase();
  const nativeName = config.nativeName.toLowerCase();

  // 1. Filter speechSynthesis.getVoices() based on the LANGUAGE_CONFIG mappings
  const compatibleVoices = allVoices.filter((voice) => {
    if (!voice) return false;
    const voiceLang = (voice.lang || "").toLowerCase().replace(/_/g, "-");
    const voiceName = (voice.name || "").toLowerCase();

    // Prevent English voices from being chosen for non-English languages
    if (!isEnglish) {
      if (voiceLang.startsWith("en") || voiceName.includes("english")) {
        return false;
      }
    }

    // Match exact regional locale (e.g., "te-in")
    if (voiceLang === exactRegionalLocale) return true;

    // Match any preferred locale in LANGUAGE_CONFIG
    if (preferredLocales.includes(voiceLang)) return true;

    // Match generic language code or dialect prefix (e.g., "te" or "te-")
    if (voiceLang === genericCode || voiceLang.startsWith(`${genericCode}-`)) return true;

    // Match by voice name mentioning language name or native script
    if (voiceName.includes(languageName) || voiceName.includes(nativeName)) return true;

    // Match by script regex if configured
    if (config.scriptRegex && config.scriptRegex.test(voice.name)) return true;

    return false;
  });

  // If no candidate voices found:
  if (compatibleVoices.length === 0) {
    // Non-English: return null so caller knows no native voice is installed
    if (!isEnglish) {
      return null;
    }
    // English: fallback to default or first available system voice
    return allVoices.find((v) => v.default) || allVoices[0] || null;
  }

  // Check if user previously saved a custom voice URI preference for this language
  const savedUri = getSavedVoiceUri(languageCode) || getSavedVoiceUri(config.code);
  if (savedUri) {
    const savedVoice = compatibleVoices.find((v) => v.voiceURI === savedUri);
    if (savedVoice) return savedVoice;
  }

  // 2. Sort candidate voices: Prioritize exact regional locale matches (e.g., 'te-IN')
  // before falling back to generic language codes (e.g., 'te')
  const scoredVoices = compatibleVoices.map((voice) => {
    const vLang = (voice.lang || "").toLowerCase().replace(/_/g, "-");
    const vName = (voice.name || "").toLowerCase();

    let score = 0;

    // Priority Tier 1: Exact regional locale match (e.g., 'te-in' matches 'te-IN') -> Highest Priority (+1000)
    if (vLang === exactRegionalLocale) {
      score += 1000;
    } else {
      // Priority Tier 2: Position within preferredLocales list from LANGUAGE_CONFIG
      const prefIdx = preferredLocales.indexOf(vLang);
      if (prefIdx >= 0) {
        score += 800 - prefIdx * 50;
      } else if (vLang === genericCode) {
        // Priority Tier 3: Generic language code match (e.g., 'te')
        score += 600;
      } else if (vLang.startsWith(`${genericCode}-`)) {
        // Priority Tier 4: Other regional code of same language family
        score += 500;
      } else {
        // Priority Tier 5: Voice name mentions language name / script
        score += 300;
      }
    }

    // Natural/Enhanced voice boost (Google, Microsoft Mohan, Apple Natural)
    if (
      vName.includes("natural") ||
      vName.includes("online") ||
      vName.includes("google") ||
      vName.includes("enhanced") ||
      vName.includes("neural")
    ) {
      score += 100;
    }

    // Local service voice boost (faster response, no dropouts)
    if (voice.localService) {
      score += 20;
    }

    // System default flag boost
    if (voice.default) {
      score += 10;
    }

    return { voice, score };
  });

  // Sort descending by score
  scoredVoices.sort((a, b) => b.score - a.score);

  return scoredVoices[0]?.voice || null;
}

export function isSpeaking(): boolean {
  if (currentAudioElement && !currentAudioElement.paused && !currentAudioElement.ended) {
    return true;
  }
  if (!isSpeechSynthesisSupported()) return false;
  return isSpeakingActive;
}

export function isPaused(): boolean {
  if (currentAudioElement && currentAudioElement.paused && !currentAudioElement.ended && isSpeakingActive) {
    return true;
  }
  if (!isSpeechSynthesisSupported()) return false;
  return isSpeechPaused;
}

export function pauseSpeaking(): void {
  if (currentAudioElement && !currentAudioElement.paused) {
    try {
      currentAudioElement.pause();
      isSpeechPaused = true;
      notifyPlaybackState();
    } catch (e) {
      console.warn("Pause audio error:", e);
    }
    return;
  }
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.pause();
    isSpeechPaused = true;
    notifyPlaybackState();
  } catch (e) {
    console.warn("Pause speaking error:", e);
  }
}

export function resumeSpeaking(): void {
  if (currentAudioElement && currentAudioElement.paused) {
    try {
      currentAudioElement.play().catch((err) => console.warn("Resume audio error:", err));
      isSpeechPaused = false;
      notifyPlaybackState();
    } catch (e) {
      console.warn("Resume audio error:", e);
    }
    return;
  }
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.resume();
    isSpeechPaused = false;
    notifyPlaybackState();
  } catch (e) {
    console.warn("Resume speaking error:", e);
  }
}

export function stopSpeaking(): void {
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement.removeAttribute("src");
      currentAudioElement.load();
    } catch (e) {}
    currentAudioElement = null;
  }
  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch (e) {}
    currentAudioUrl = null;
  }

  isSpeakingActive = false;
  isSpeechPaused = false;
  currentSpeakingVoiceName = undefined;
  currentSpeechUtterances = [];
  speechQueueIndex = 0;

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  notifyPlaybackState();
}

/**
 * Dispatches a custom window event when a requested native voice is missing on the device
 */
function emitVoiceUnavailable(info: VoiceUnavailableInfo): void {
  if (typeof window !== "undefined") {
    const event = new CustomEvent("weathergpt:voice-unavailable", {
      detail: info,
    });
    window.dispatchEvent(event);
  }
}

/**
 * Cleans markdown symbols, emojis, and source links for natural speech
 * Preserves regional language characters (Telugu, Hindi, Tamil, etc.)
 */
export function cleanTextForSpeech(text: string, langCode: string = "en"): string {
  if (!text) return "";

  return text
    // 1. Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    // 2. Remove URLs
    .replace(/https?:\/\/\S+/g, "")
    // 3. Remove Markdown links -> keep the label
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // 4. Remove HTML tags if present
    .replace(/<[^>]*>/g, "")
    // 5. Remove citations, source lines, and UI artifacts
    .replace(/\bSource:\s*[^\n]+/gi, "")
    .replace(/\bమూలం:\s*[^\n]+/gi, "")
    .replace(/\bस्रोत:\s*[^\n]+/gi, "")
    .replace(/\[View\s+Details\]/gi, "")
    // 6. Remove Markdown syntax symbols (#, *, _, ~, >, etc.)
    .replace(/^[#>\s*+-]+\s*/gm, "")
    .replace(/[*_~`#]/g, "")
    // 7. Remove emojis so TTS engines don't pronounce emoji names
    .replace(/\p{Extended_Pictographic}/gu, "")
    // 8. Turn list bullets and section breaks into natural conversational pauses
    .replace(/\n\s*[-•]\s*/g, ", ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Split long text into manageable sentences to prevent browser TTS cutoffs
 */
function splitIntoSentences(text: string, langCode: string): string[] {
  const clean = cleanTextForSpeech(text, langCode);
  const parts = clean
    .split(/(?<=[.?!।\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length === 0 && clean.length > 0) {
    return [clean];
  }
  return parts;
}

/**
 * Speaks text using the high-fidelity server-side /api/tts endpoint.
 * This guarantees authentic native pronunciation (Telugu, Hindi, Tamil, Kannada, etc.)
 * across any browser and operating system even when local offline voice packs are missing.
 */
function speakWithAudioApi(
  cleanText: string,
  langCode: string,
  voiceDisplayName: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): boolean {
  if (typeof window === "undefined") return false;

  stopSpeaking();

  try {
    const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${encodeURIComponent(langCode)}`;
    const audio = new Audio(ttsUrl);
    currentAudioElement = audio;
    isSpeakingActive = true;
    isSpeechPaused = false;
    currentSpeakingLanguage = langCode;
    currentSpeakingVoiceName = voiceDisplayName;

    const rate = getSpeechRate();
    if (rate >= 0.8 && rate <= 1.3) {
      audio.playbackRate = rate;
    }

    audio.onplay = () => {
      isSpeakingActive = true;
      isSpeechPaused = false;
      notifyPlaybackState();
      onStart?.();
    };

    audio.onended = () => {
      isSpeakingActive = false;
      isSpeechPaused = false;
      currentSpeakingVoiceName = undefined;
      currentAudioElement = null;
      notifyPlaybackState();
      onEnd?.();
    };

    audio.onerror = (e) => {
      console.warn("Server TTS audio error:", e);
      isSpeakingActive = false;
      isSpeechPaused = false;
      currentSpeakingVoiceName = undefined;
      currentAudioElement = null;
      notifyPlaybackState();
      onError?.("Audio playback failed");
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Audio play() was interrupted or rejected:", err);
        isSpeakingActive = false;
        isSpeechPaused = false;
        currentSpeakingVoiceName = undefined;
        currentAudioElement = null;
        notifyPlaybackState();
        onError?.(err);
      });
    }

    notifyPlaybackState();
    return true;
  } catch (err) {
    console.error("speakWithAudioApi exception:", err);
    onError?.(err);
    return false;
  }
}

/**
 * Reads aloud text in the authentic native language voice.
 * Strictly avoids using an English voice for non-English languages (like Telugu).
 * Automatically provides high-fidelity native audio synthesis if local OS voice packs are absent.
 */
export function speakText(
  text: string,
  langCode: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void,
  onVoiceUnavailable?: (info: VoiceUnavailableInfo) => void
): boolean {
  if (typeof window === "undefined") return false;

  stopSpeaking();

  const config = LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;
  const clean = cleanTextForSpeech(text, langCode);
  if (!clean) {
    return false;
  }

  // 1. Check if the device has a genuine, matching native voice installed for this language
  const voice = getBestVoice(langCode);

  // If this is a non-English language and NO native voice exists on the client OS:
  // Instead of failing or falling back to an English voice (which is strictly forbidden),
  // automatically utilize the server-side native audio synthesis API!
  if (!voice && langCode !== "en") {
    return speakWithAudioApi(
      clean,
      langCode,
      langCode === "te" ? "WeatherGPT తెలుగు ఆడియో" : `${config.name} Cloud Voice`,
      onStart,
      onEnd,
      (err) => {
        const info: VoiceUnavailableInfo = {
          languageCode: langCode,
          languageName: config.name,
          nativeName: config.nativeName,
          message: `Native ${config.name} (${config.nativeName}) audio could not be played. Please check your network connection or volume.`,
        };
        emitVoiceUnavailable(info);
        onVoiceUnavailable?.(info);
        onError?.(err);
      }
    );
  }

  // If Web Speech API is not supported on this browser:
  if (!isSpeechSynthesisSupported()) {
    return speakWithAudioApi(
      clean,
      langCode,
      `${config.name} Cloud Voice`,
      onStart,
      onEnd,
      onError
    );
  }

  // 2. Play using browser SpeechSynthesis with the authentic native voice
  const sentences = splitIntoSentences(text, langCode);
  if (sentences.length === 0) {
    return false;
  }

  // Unstick Chrome/Safari speech synthesis if stuck in paused state
  if (window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch (e) {}
  }

  isSpeakingActive = true;
  isSpeechPaused = false;
  currentSpeakingLanguage = langCode;
  currentSpeakingVoiceName = voice?.name || `${config.name} Native Voice`;
  speechQueueIndex = 0;

  const currentRate = getSpeechRate();

  currentSpeechUtterances = sentences.map((sentence) => {
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = config.locale;
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = currentRate;
    utterance.pitch = 1.0;
    return utterance;
  });

  if (currentSpeechUtterances.length === 0) {
    isSpeakingActive = false;
    notifyPlaybackState();
    return false;
  }

  notifyPlaybackState();
  onStart?.();

  let hasSpokenAny = false;

  const speakNextChunk = () => {
    if (!isSpeakingActive || speechQueueIndex >= currentSpeechUtterances.length) {
      isSpeakingActive = false;
      isSpeechPaused = false;
      currentSpeakingVoiceName = undefined;
      notifyPlaybackState();
      onEnd?.();
      return;
    }

    const currentUtterance = currentSpeechUtterances[speechQueueIndex];
    speechQueueIndex++;

    currentUtterance.onend = () => {
      hasSpokenAny = true;
      speakNextChunk();
    };

    currentUtterance.onerror = (e) => {
      if (e.error !== "canceled" && e.error !== "interrupted") {
        console.warn("TTS chunk error:", e);
      }
      // If browser speech synthesis fails immediately on first chunk, try cloud audio fallback
      if (!hasSpokenAny && speechQueueIndex === 1 && langCode !== "en") {
        console.info("Falling back to server audio API for native voice playback...");
        speakWithAudioApi(
          clean,
          langCode,
          `${config.name} Cloud Voice`,
          onStart,
          onEnd,
          onError
        );
        return;
      }
      speakNextChunk();
    };

    try {
      window.speechSynthesis.speak(currentUtterance);
    } catch (err) {
      console.warn("speechSynthesis.speak threw error:", err);
      if (!hasSpokenAny) {
        speakWithAudioApi(
          clean,
          langCode,
          `${config.name} Cloud Voice`,
          onStart,
          onEnd,
          onError
        );
        return;
      }
      isSpeakingActive = false;
      isSpeechPaused = false;
      currentSpeakingVoiceName = undefined;
      notifyPlaybackState();
      onError?.(err);
    }
  };

  speakNextChunk();
  return true;
}
