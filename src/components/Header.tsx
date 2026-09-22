import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  ChevronDown,
  CloudSun,
  Wind,
  CloudRain,
  Sparkles,
  Mic,
  Languages,
  LogIn,
  LogOut,
  ShieldAlert,
  Globe,
  Check,
  Volume2,
} from "lucide-react";
import { LocationItem, CurrentWeatherData, SupportedLanguageCode } from "../types";
import { SUPPORTED_LANGUAGES, getLanguageInfo, getUiTranslation } from "../data/languages";
import { User } from "firebase/auth";

interface HeaderProps {
  activeLocation: LocationItem;
  currentWeather: CurrentWeatherData | null;
  isLoadingWeather: boolean;
  onOpenLocationModal: () => void;
  onOpenVoiceModal: () => void;
  onOpenTgicccModal?: () => void;
  onOpenVoiceSettings?: () => void;
  language: SupportedLanguageCode;
  onSelectLanguage: (lang: SupportedLanguageCode) => void;
  onToggleLanguage?: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeLocation,
  currentWeather,
  isLoadingWeather,
  onOpenLocationModal,
  onOpenVoiceModal,
  onOpenTgicccModal,
  onOpenVoiceSettings,
  language,
  onSelectLanguage,
  onToggleLanguage,
  user,
  onSignIn,
  onSignOut,
}) => {
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  const currentLangInfo = getLanguageInfo(language);
  const ui = getUiTranslation(language);

  // Close language menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    if (isLangMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isLangMenuOpen]);
  return (
    <header
      id="weathergpt-header"
      className="sticky top-0 z-30 bg-[#f5f2eb]/90 backdrop-blur-xl border-b border-stone-200/90 shadow-xs"
    >
      <div className="max-w-5xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Logo and Branding */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-stone-700 rounded-2xl blur-xs opacity-40 group-hover:opacity-80 transition duration-300" />
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-600 to-stone-800 border border-amber-500/30 flex items-center justify-center text-amber-100 shadow-xs">
              <CloudSun className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-stone-900 tracking-tight leading-none flex items-center gap-1.5">
                <span>WeatherGPT</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-300/80 hidden sm:inline-block">
                  AI Live
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-stone-500 hidden sm:block mt-0.5 font-normal tracking-wide">
              Your AI Weather Intelligence
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* TGICCC Emergency Helpline Quick Access */}
          {onOpenTgicccModal && (
            <button
              id="btn-header-tgiccc"
              onClick={onOpenTgicccModal}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-all cursor-pointer shadow-xs"
              title="Telangana Integrated Command and Control Centre (Dial 112)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>TGICCC 112</span>
            </button>
          )}

          {/* Location Selector Pill */}
          <button
            id="btn-location-picker"
            onClick={onOpenLocationModal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium bg-white hover:bg-stone-50 text-stone-800 transition-all border border-stone-300/80 shadow-xs group cursor-pointer"
            title="Change active location"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-700 group-hover:scale-110 transition-transform" />
            <span className="max-w-[85px] sm:max-w-[130px] truncate font-semibold">
              {activeLocation.name}
            </span>
            <ChevronDown className="w-3 h-3 text-stone-400" />
          </button>

          {/* Current Weather Snapshot Mini Badge */}
          {currentWeather ? (
            <div
              id="header-weather-pill"
              className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white border border-stone-200 text-xs text-stone-700 shadow-xs"
            >
              <span className="font-bold text-stone-900">
                {currentWeather.temperature}°C
              </span>
              <span className="text-stone-500 text-[11px]">
                {currentWeather.condition}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-sky-700 pl-1 border-l border-stone-200">
                <CloudRain className="w-3 h-3" />
                <span>{currentWeather.rainProbability}%</span>
              </div>
            </div>
          ) : isLoadingWeather ? (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs text-stone-500">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
              <span>Syncing...</span>
            </div>
          ) : null}

          {/* Live Voice Button */}
          <button
            id="btn-voice-conversation"
            onClick={onOpenVoiceModal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-100/80 hover:bg-amber-200/80 text-amber-900 border border-amber-300/80 transition-all shadow-xs cursor-pointer"
            title="Start real-time Voice Conversation"
          >
            <Mic className="w-3.5 h-3.5 text-amber-800" />
            <span className="hidden sm:inline">Voice</span>
          </button>

          {/* Voice & TTS Settings Button */}
          {onOpenVoiceSettings && (
            <button
              id="btn-header-voice-settings"
              onClick={onOpenVoiceSettings}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-stone-50 text-stone-700 hover:text-stone-900 border border-stone-300/80 transition-all shadow-xs cursor-pointer"
              title="Voice & Speech Settings (Language, Voice, Speed)"
            >
              <Volume2 className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden lg:inline">{language === "te" ? "వాయిస్" : "Voice"}</span>
            </button>
          )}

          {/* Multi-Language Selector Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <motion.button
              id="btn-language-selector"
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border shadow-xs cursor-pointer select-none transition-all duration-200 ${
                isLangMenuOpen
                  ? "bg-amber-800 text-white border-amber-800 shadow-amber-900/15"
                  : language !== "en"
                  ? "bg-amber-100/90 hover:bg-amber-200/80 text-amber-900 border-amber-300/80"
                  : "bg-white hover:bg-stone-50 text-stone-800 border-stone-300/80"
              }`}
              title="Select Language (14+ Indian & Global languages)"
              aria-expanded={isLangMenuOpen}
            >
              <Languages
                className={`w-3.5 h-3.5 ${
                  isLangMenuOpen
                    ? "text-amber-200"
                    : language !== "en"
                    ? "text-amber-800"
                    : "text-amber-700"
                }`}
              />
              <span className="inline-block max-w-[70px] sm:max-w-[90px] truncate font-medium">
                {currentLangInfo.nativeName}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ${
                  isLangMenuOpen ? "rotate-180 text-amber-200" : "text-stone-500"
                }`}
              />
            </motion.button>

            {/* Language Selection Menu */}
            <AnimatePresence>
              {isLangMenuOpen && (
                <motion.div
                  id="menu-language-options"
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute right-0 mt-2 w-72 sm:w-80 bg-[#fdfcf9] border border-stone-200 rounded-2xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-stone-200/80 bg-stone-100/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-amber-800" />
                      <span className="text-xs font-bold text-stone-800 tracking-tight">
                        Select Language / భాషను ఎంచుకోండి
                      </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-900 font-semibold border border-amber-200/60">
                      14 Languages
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2 divide-y divide-stone-100">
                    {/* Indian Languages Section */}
                    <div className="pb-2">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        Indian Languages (భారతీయ భాషలు)
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {SUPPORTED_LANGUAGES.filter((l) => l.category === "Indian").map((lang) => {
                          const isSelected = language === lang.code;
                          return (
                            <button
                              key={lang.code}
                              id={`btn-lang-${lang.code}`}
                              onClick={() => {
                                onSelectLanguage(lang.code);
                                setIsLangMenuOpen(false);
                              }}
                              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                                isSelected
                                  ? "bg-amber-800 text-white font-semibold shadow-xs"
                                  : "hover:bg-stone-100 text-stone-700"
                              }`}
                            >
                              <div className="truncate pr-1">
                                <span className="block font-medium truncate">{lang.nativeName}</span>
                                <span
                                  className={`block text-[10px] ${
                                    isSelected ? "text-amber-200" : "text-stone-500"
                                  }`}
                                >
                                  {lang.name}
                                </span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-amber-200" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Global Languages Section */}
                    <div className="pt-2">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                        Global Languages
                      </div>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {SUPPORTED_LANGUAGES.filter((l) => l.category === "Global").map((lang) => {
                          const isSelected = language === lang.code;
                          return (
                            <button
                              key={lang.code}
                              id={`btn-lang-${lang.code}`}
                              onClick={() => {
                                onSelectLanguage(lang.code);
                                setIsLangMenuOpen(false);
                              }}
                              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                                isSelected
                                  ? "bg-amber-800 text-white font-semibold shadow-xs"
                                  : "hover:bg-stone-100 text-stone-700"
                              }`}
                            >
                              <div className="truncate pr-1">
                                <span className="block font-medium truncate">{lang.nativeName}</span>
                                <span
                                  className={`block text-[10px] ${
                                    isSelected ? "text-amber-200" : "text-stone-500"
                                  }`}
                                >
                                  {lang.name}
                                </span>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-amber-200" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Firebase Authentication Sign-In / User Profile */}
          {user ? (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-stone-300">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-7 h-7 rounded-full border border-stone-300 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-stone-800 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  {user.displayName?.charAt(0) || "U"}
                </div>
              )}
              <button
                id="btn-signout"
                onClick={onSignOut}
                className="p-1.5 rounded-lg text-stone-500 hover:text-rose-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
                title="Sign out of Firebase"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-signin-google"
              onClick={onSignIn}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition-all shadow-xs cursor-pointer"
              title="Sign in with Google to sync queries across devices"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
