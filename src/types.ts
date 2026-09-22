export type SupportedLanguageCode =
  | "en"
  | "te"
  | "hi"
  | "ta"
  | "kn"
  | "ml"
  | "mr"
  | "bn"
  | "gu"
  | "pa"
  | "or"
  | "es"
  | "fr"
  | "ar"
  | (string & {});

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  category: "Indian" | "Global";
}

export interface LocationItem {
  id?: string;
  name: string;
  admin1?: string;
  country: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface WeatherAlert {
  severity: "warning" | "advisory" | "watch";
  title: string;
  titleTelugu?: string;
  titleTranslations?: Record<string, string>;
  description: string;
  descriptionTelugu?: string;
  descriptionTranslations?: Record<string, string>;
  metric: string;
  type: "heavy_rain" | "thunderstorm" | "high_wind" | "heatwave" | "fog";
}

export interface CurrentWeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  condition: string;
  weatherCode: number;
  precipitation: number;
  rainProbability: number;
  isDay: boolean;
  time: string;
  severeAlert?: WeatherAlert | null;
}

export interface WeatherToolSummary {
  location: string;
  timeframe: string;
  temp: number;
  condition: string;
  wind: number;
  humidity: number;
}

export interface WeatherSnapshot {
  locationName: string;
  admin1?: string;
  country?: string;
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainChance: number;
  sourceTime: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface TranslatedContent {
  language: string;
  languageName: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentTelugu?: string;
  translatedContent?: TranslatedContent;
  translations?: Record<string, string>;
  timestamp: string;
  toolSummary?: WeatherToolSummary;
  weatherSnapshot?: WeatherSnapshot;
  groundingSources?: GroundingSource[];
  isError?: boolean;
}

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  promptTelugu?: string;
  promptTranslations?: Record<string, string>;
  persona: 'farmer' | 'fisher' | 'citizen' | 'commuter';
  icon: string;
}

export type VoiceAssistantState = "ready" | "listening" | "processing" | "speaking" | "error";

export interface CropAdvisoryData {
  crop: string;
  locationName: string;
  reply: string;
  replyTelugu?: string;
  weatherSnapshot?: WeatherSnapshot;
  timestamp: string;
}

export interface CropDamageDetails {
  crop?: string;
  symptoms?: string[];
  visiblePests?: string[];
  affectedPlantPart?: string;
  severity?: string;
  duration?: string;
  location?: string;
}

export interface CropDamageAnalysisResult {
  success: boolean;
  language: string;
  detectedLanguage?: "te" | "en" | string;
  crop: string;
  symptomsDescription: string;
  symptomsSummary?: string;
  affectedPlantPart?: string;
  duration?: string;
  possibleCauses: string[];
  diagnosisType: "possible_cause" | "preliminary_assessment" | "unclear_image_or_description";
  confidenceLevel: "low" | "medium" | "moderate_with_evidence";
  weatherConnection: string;
  treatmentOptionsNote: string;
  verifiedPesticides: Array<{
    name: string;
    activeIngredient: string;
    targetPestOrDisease: string;
    source: string;
    safetyNote: string;
  }>;
  nonChemicalManagement: string[];
  safetyPrecautions: string[];
  recommendedPhotoOrStep: string;
  followUpQuestion?: string;
  sources: string[];
  fullFormattedReply: string;
  isImageProvided?: boolean;
  isImageUnclear?: boolean;
  imageAssessment?: string;
  weatherSnapshot?: WeatherSnapshot;
  timestamp: string;
}
