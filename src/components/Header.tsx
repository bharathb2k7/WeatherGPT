import React from "react";
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
} from "lucide-react";
import { LocationItem, CurrentWeatherData } from "../types";
import { User } from "firebase/auth";

interface HeaderProps {
  activeLocation: LocationItem;
  currentWeather: CurrentWeatherData | null;
  isLoadingWeather: boolean;
  onOpenLocationModal: () => void;
  onOpenVoiceModal: () => void;
  onOpenTgicccModal?: () => void;
  language: "en" | "te";
  onToggleLanguage: () => void;
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
  language,
  onToggleLanguage,
  user,
  onSignIn,
  onSignOut,
}) => {
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

          {/* Language Toggle Button with Smooth Spring Animation */}
          <motion.button
            id="btn-language-toggle"
            onClick={onToggleLanguage}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            layout
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border shadow-xs cursor-pointer select-none transition-colors duration-200 ${
              language === "te"
                ? "bg-amber-800 hover:bg-amber-900 text-white border-amber-800 shadow-amber-900/10"
                : "bg-white hover:bg-stone-50 text-stone-800 border-stone-300/80"
            }`}
            title="Toggle between English and Telugu (తెలుగు)"
          >
            <motion.div
              animate={{ rotate: language === "te" ? 180 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Languages className={`w-3.5 h-3.5 ${language === "te" ? "text-amber-200" : "text-amber-700"}`} />
            </motion.div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={language}
                initial={{ opacity: 0, y: -4, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="inline-block min-w-[30px] text-center"
              >
                {language === "te" ? "తెలుగు" : "EN"}
              </motion.span>
            </AnimatePresence>
          </motion.button>

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
