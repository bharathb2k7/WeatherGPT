import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  CloudRain,
  Zap,
  Wind,
  Flame,
  X,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Clock,
  Sparkles,
  PhoneCall,
} from "lucide-react";
import { WeatherAlert, LocationItem, SupportedLanguageCode } from "../types";
import { getLanguageInfo } from "../data/languages";

interface WeatherAlertBannerProps {
  alert: WeatherAlert;
  activeLocation: LocationItem;
  language: SupportedLanguageCode;
  onAskAboutAlert: (query: string) => void;
  onOpenTgicccModal?: () => void;
}

export const WeatherAlertBanner: React.FC<WeatherAlertBannerProps> = ({
  alert,
  activeLocation,
  language,
  onAskAboutAlert,
  onOpenTgicccModal,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const isTelugu = language === "te";
  const langInfo = getLanguageInfo(language);
  const displayTitle =
    alert.titleTranslations?.[language] ||
    (isTelugu && alert.titleTelugu ? alert.titleTelugu : undefined) ||
    alert.title;
  const displayDesc =
    alert.descriptionTranslations?.[language] ||
    (isTelugu && alert.descriptionTelugu ? alert.descriptionTelugu : undefined) ||
    alert.description;

  const getAlertIcon = () => {
    switch (alert.type) {
      case "heavy_rain":
        return <CloudRain className="w-5 h-5 text-cyan-400 shrink-0" />;
      case "thunderstorm":
        return <Zap className="w-5 h-5 text-amber-400 shrink-0" />;
      case "high_wind":
        return <Wind className="w-5 h-5 text-sky-400 shrink-0" />;
      case "heatwave":
        return <Flame className="w-5 h-5 text-rose-400 shrink-0" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
    }
  };

  const getSeverityStyle = () => {
    switch (alert.severity) {
      case "warning":
        return {
          wrapper:
            "bg-gradient-to-r from-rose-50 via-white to-rose-50/40 border-rose-300/90 text-rose-950 shadow-xs",
          badge: "bg-rose-100 text-rose-800 border-rose-300",
          tag: isTelugu ? "తీవ్ర హెచ్చరిక" : "SEVERE WEATHER WARNING",
          accentGlow: "bg-rose-100",
        };
      case "advisory":
        return {
          wrapper:
            "bg-gradient-to-r from-amber-50 via-white to-amber-50/40 border-amber-300/90 text-amber-950 shadow-xs",
          badge: "bg-amber-100 text-amber-900 border-amber-300",
          tag: isTelugu ? "వాతావరణ సలహా" : "METEOROLOGICAL ADVISORY",
          accentGlow: "bg-amber-100",
        };
      default:
        return {
          wrapper:
            "bg-gradient-to-r from-stone-50 via-white to-stone-50/40 border-stone-300/90 text-stone-950 shadow-xs",
          badge: "bg-stone-100 text-stone-800 border-stone-300",
          tag: isTelugu ? "వాతావరణ గమనిక" : "WEATHER WATCH",
          accentGlow: "bg-stone-100",
        };
    }
  };

  const styles = getSeverityStyle();

  const handleQueryAlert = () => {
    const query = isTelugu
      ? `${activeLocation.name}లో ${displayTitle} గురించి పూర్తి వివరాలు మరియు తీసుకోవాల్సిన జాగ్రత్తలు ఏమిటి?`
      : language === "hi"
      ? `${activeLocation.name} में ${displayTitle} के बारे में पूरी जानकारी और क्या सावधानियां बरतनी चाहिए?`
      : `What precautions should I take regarding the ${alert.title.toLowerCase()} in ${activeLocation.name}?`;
    onAskAboutAlert(query);
  };

  return (
    <AnimatePresence>
      <motion.div
        id="severe-weather-alert-banner"
        initial={{ opacity: 0, y: -8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`w-full rounded-2xl p-4 sm:p-4.5 border shadow-xs relative overflow-hidden ${styles.wrapper}`}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="p-2.5 rounded-xl bg-white border border-stone-200/90 shadow-xs flex items-center justify-center shrink-0">
            {getAlertIcon()}
          </div>

          <div className="flex-1 min-w-0 pr-6 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${styles.badge}`}
              >
                {styles.tag}
              </span>
              <span className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">
                {displayTitle} • {activeLocation.name}
              </span>
              <span className="text-[11px] font-mono text-amber-900 bg-white px-2 py-0.5 rounded-md border border-stone-300/80 shadow-xs">
                {alert.metric}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-normal">
              "{displayDesc}"
            </p>

            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleQueryAlert}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-800 hover:bg-amber-900 text-white shadow-xs transition-all cursor-pointer"
                title="Ask WeatherGPT for personalized safety advice"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>
                  {isTelugu ? "భద్రతా సలహా అడగండి" : "Ask Safety Advice"}
                </span>
                <ChevronRight className="w-3 h-3 text-amber-300" />
              </button>

              {onOpenTgicccModal && (
                <button
                  onClick={onOpenTgicccModal}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-rose-100/80 hover:bg-rose-200/80 text-rose-900 border border-rose-300/80 transition-all cursor-pointer shadow-xs"
                  title="Telangana Command Control Helpline"
                >
                  <PhoneCall className="w-3 h-3 text-rose-700" />
                  <span>TGICCC Helpline 112</span>
                </button>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-3 right-3 p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
