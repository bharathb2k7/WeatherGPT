import React, { useState } from "react";
import { motion } from "motion/react";
import {
  CloudSun,
  CloudRain,
  Zap,
  Wind,
  Droplets,
  Thermometer,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  Compass,
} from "lucide-react";
import { CurrentWeatherData, LocationItem, SupportedLanguageCode } from "../types";
import { getUiTranslation, getLanguageInfo } from "../data/languages";

interface WeatherHeroProps {
  location: LocationItem;
  weather: CurrentWeatherData | null;
  isLoading: boolean;
  language: SupportedLanguageCode;
  onOpenLocationModal: () => void;
  onOpenTgicccModal: () => void;
  onAskAdvice: (prompt: string) => void;
}

export const WeatherHero: React.FC<WeatherHeroProps> = ({
  location,
  weather,
  isLoading,
  language,
  onOpenLocationModal,
  onOpenTgicccModal,
  onAskAdvice,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const isTelugu = language === "te";
  const ui = getUiTranslation(language);
  const langInfo = getLanguageInfo(language);

  // Dynamic atmospheric weather condition style
  const getAtmosphericGlow = () => {
    if (!weather) return "from-amber-200/30 via-orange-100/15 to-transparent";
    const code = weather.weatherCode;

    // Thunderstorm
    if (code === 95 || code === 96 || code === 99) {
      return "from-amber-300/30 via-rose-200/20 to-stone-200/20";
    }
    // Rain
    if (
      code === 61 ||
      code === 63 ||
      code === 65 ||
      code === 80 ||
      code === 81 ||
      code === 82
    ) {
      return "from-sky-200/30 via-blue-100/20 to-stone-200/20";
    }
    // Clouds
    if (code === 1 || code === 2 || code === 3) {
      return "from-stone-200/40 via-amber-100/20 to-transparent";
    }
    // Clear / Sun
    return "from-amber-200/40 via-orange-100/20 to-transparent";
  };

  const getWeatherIcon = () => {
    if (!weather) return <CloudSun className="w-8 h-8 text-amber-600" />;
    const code = weather.weatherCode;
    if (code === 95 || code === 96 || code === 99) {
      return <Zap className="w-9 h-9 text-amber-600 animate-pulse" />;
    }
    if (code >= 61 && code <= 82) {
      return <CloudRain className="w-9 h-9 text-sky-700" />;
    }
    return <CloudSun className="w-9 h-9 text-amber-600" />;
  };

  return (
    <div
      id="weather-hero-section"
      className="relative rounded-3xl overflow-hidden border border-stone-300/80 bg-gradient-to-b from-[#fdfcf9] via-[#fbf9f5] to-[#f6f3ec] backdrop-blur-xl shadow-md text-stone-900 transition-all"
    >
      {/* Dynamic atmospheric radial backdrop */}
      <div
        className={`absolute inset-0 bg-gradient-to-tr ${getAtmosphericGlow()} pointer-events-none opacity-90`}
      />

      {/* Decorative ambient subtle ring */}
      <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-amber-200/25 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-stone-300/30 blur-3xl pointer-events-none" />

      <div className="relative p-5 sm:p-6 text-stone-900 space-y-4">
        {/* Top bar: Location badge & quick collapse */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenLocationModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white hover:bg-stone-50 border border-stone-300/80 text-stone-800 shadow-xs backdrop-blur-md transition-colors cursor-pointer group"
              title="Change active observation city"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-700 group-hover:scale-110 transition-transform" />
              <span className="font-semibold">{location.name}</span>
              {location.admin1 && (
                <span className="text-stone-500 font-normal text-[11px]">
                  • {location.admin1}
                </span>
              )}
            </button>

            <span className="text-[11px] font-medium text-stone-500 hidden sm:inline-flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-700" />
              {isTelugu ? "ప్రత్యక్ష వాతావరణ సమాచారం" : "Live Open-Meteo Grounding"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick TGICCC Pill */}
            <button
              onClick={onOpenTgicccModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors cursor-pointer shadow-xs"
              title="View TGICCC Command Centre & Emergency Helplines"
            >
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              <span>TGICCC 112</span>
            </button>

            {/* Collapse toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200/50 transition-colors cursor-pointer"
              title={isExpanded ? "Minimize weather card" : "Expand weather card"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Main Weather Display */}
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4 pt-1"
          >
            {isLoading && !weather ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-stone-500">
                <div className="w-8 h-8 rounded-full border-2 border-amber-600/30 border-t-amber-600 animate-spin" />
                <p className="text-xs">Fetching meteorological telemetry...</p>
              </div>
            ) : weather ? (
              <div>
                {/* Hero metrics: Big temperature & condition */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-white border border-stone-200/90 shadow-xs flex items-center justify-center">
                      {getWeatherIcon()}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl sm:text-6xl font-extrabold tracking-tight text-stone-900 font-sans">
                          {weather.temperature}
                        </span>
                        <span className="text-2xl sm:text-3xl font-light text-amber-700">
                          °C
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-semibold text-stone-800">
                          {weather.condition}
                        </span>
                        <span className="text-xs text-stone-500">
                          ({ui.feelsLike} {weather.apparentTemperature}°C)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Plain language AI summary chip */}
                  <div className="p-3 rounded-2xl bg-white/80 border border-stone-200/90 shadow-xs max-w-sm sm:text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1 sm:justify-end">
                      <Sparkles className="w-3 h-3" />
                      AI Intelligence
                    </span>
                    <p className="text-xs text-stone-700 mt-1 leading-snug">
                      {weather.rainProbability >= 60
                        ? isTelugu
                          ? "వర్షం పడే అవకాశం ఎక్కువగా ఉంది. ప్రయాణాలలో గొడుగు వెంట ఉంచుకోండి."
                          : language === "hi"
                          ? "बारिश की अधिक संभावना है। बाहर निकलते समय छाता साथ रखें।"
                          : "High chance of rain showers. Carry protective gear for commutes."
                        : weather.temperature >= 35
                        ? isTelugu
                          ? "ఎండ ఎక్కువగా ఉంది. తగినంత నీరు త్రాగండి, బయట ఎండలో జాగ్రత్త."
                          : language === "hi"
                          ? "तेज़ धूप और गर्मी है। पर्याप्त पानी पिएं और धूप से बचें।"
                          : "Elevated daytime temperatures. Maintain hydration and sun protection."
                        : isTelugu
                          ? "వాతావరణం అనుకూలంగా ఉంది. వ్యవసాయం మరియు దైనందిన పనులకు అనువైన సమయం."
                          : language === "hi"
                          ? "मौसम सुहावना और अनुकूल है। दैनिक कार्यों के लिए उपयुक्त समय है।"
                          : "Pleasant outdoor weather. Conditions are currently stable."}
                    </p>
                  </div>
                </div>

                {/* Secondary metric pills: Apple Weather Style */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3">
                  <div className="p-3 rounded-xl bg-white border border-stone-200/90 shadow-xs flex items-center gap-2.5">
                    <Droplets className="w-4 h-4 text-sky-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-stone-500 block uppercase tracking-wider">
                        {ui.humidity}
                      </span>
                      <span className="text-xs font-bold text-stone-900">
                        {weather.humidity}%
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-stone-200/90 shadow-xs flex items-center gap-2.5">
                    <Wind className="w-4 h-4 text-amber-700 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-stone-500 block uppercase tracking-wider">
                        {ui.wind}
                      </span>
                      <span className="text-xs font-bold text-stone-900 truncate">
                        {weather.windSpeed} km/h
                        {weather.windGusts ? ` • ${weather.windGusts} gust` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-stone-200/90 shadow-xs flex items-center gap-2.5">
                    <CloudRain className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-stone-500 block uppercase tracking-wider">
                        {ui.rainRisk}
                      </span>
                      <span className="text-xs font-bold text-stone-900">
                        {weather.rainProbability}%
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-stone-200/90 shadow-xs flex items-center gap-2.5">
                    <Thermometer className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-stone-500 block uppercase tracking-wider">
                        Cycle
                      </span>
                      <span className="text-xs font-bold text-stone-900">
                        {weather.isDay ? "Daylight" : "Nighttime"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </div>
    </div>
  );
};
