import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CloudSun,
  User,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Compass,
  Languages,
  Search,
  Sprout,
  Anchor,
  Car,
  ShieldAlert,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ChatMessage, SupportedLanguageCode } from "../types";
import { getLanguageInfo } from "../data/languages";
import { SpeechControls } from "./SpeechControls";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  globalLanguage: SupportedLanguageCode;
  onTranslateMessage?: (messageId: string, targetLang: SupportedLanguageCode) => void;
  onOpenVoiceSettings?: () => void;
  isTranslating?: boolean;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  globalLanguage,
  onTranslateMessage,
  onOpenVoiceSettings,
  isTranslating = false,
}) => {
  const isUser = message.role === "user";
  const currentLangInfo = getLanguageInfo(globalLanguage);
  const [showOriginal, setShowOriginal] = useState(false);

  // Check if content already contains Telugu characters
  const isMessageTelugu = /[\u0C00-\u0C7F]/.test(message.content);

  // Determine the active text in user's selected language
  const activeLanguageContent =
    globalLanguage === "te"
      ? (isMessageTelugu
          ? message.content
          : message.contentTelugu ||
            message.translations?.te ||
            (message.translatedContent?.language === "te" ? message.translatedContent.text : undefined) ||
            message.content)
      : globalLanguage !== "en"
      ? (message.translations?.[globalLanguage] ||
         (message.translatedContent?.language === globalLanguage ? message.translatedContent.text : undefined) ||
         message.content)
      : message.content;

  const hasAlternativeLanguage =
    activeLanguageContent !== message.content && message.content.trim().length > 0;

  const displayedContent = showOriginal ? message.content : activeLanguageContent;

  // Persona detector based on content keywords
  const detectPersona = (text: string) => {
    const lower = text.toLowerCase();
    if (
      lower.includes("pesticide") ||
      lower.includes("crop") ||
      lower.includes("farmer") ||
      lower.includes("farming") ||
      lower.includes("పురుగుమందు") ||
      lower.includes("రైతు")
    ) {
      return {
        label: "Agriculture / Farmer",
        icon: <Sprout className="w-3 h-3 text-emerald-700" />,
        badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      };
    }
    if (
      lower.includes("fish") ||
      lower.includes("sea") ||
      lower.includes("marine") ||
      lower.includes("boat") ||
      lower.includes("చేపల") ||
      lower.includes("మత్స్య")
    ) {
      return {
        label: "Coastal & Fishery",
        icon: <Anchor className="w-3 h-3 text-sky-700" />,
        badge: "bg-sky-100 text-sky-800 border-sky-300",
      };
    }
    if (
      lower.includes("commute") ||
      lower.includes("traffic") ||
      lower.includes("travel") ||
      lower.includes("road") ||
      lower.includes("drive") ||
      lower.includes("ప్రయాణ")
    ) {
      return {
        label: "Commute & Transit",
        icon: <Car className="w-3 h-3 text-amber-700" />,
        badge: "bg-amber-100 text-amber-900 border-amber-300",
      };
    }
    return null;
  };

  const persona = !isUser ? detectPersona(message.content) : null;

  // Parse out the "Source: Open-Meteo, ..." line if present to format cleanly
  const renderFormattedAssistantContent = (text: string) => {
    const lines = text.split("\n");
    const bodyLines: string[] = [];
    let sourceLine: string | null = null;

    for (const line of lines) {
      if (line.trim().toLowerCase().startsWith("source:")) {
        sourceLine = line.trim();
      } else {
        bodyLines.push(line);
      }
    }

    const cleanBody = bodyLines.join("\n").trim();

    return (
      <div className="space-y-3">
        {/* Persona header chip if detected */}
        {persona && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border mb-1 ${persona.badge}`}>
            {persona.icon}
            <span>{persona.label}</span>
          </div>
        )}

        <p className="text-sm leading-relaxed text-stone-800 whitespace-pre-wrap font-normal">
          {cleanBody}
        </p>

        {/* Source citation if present */}
        {sourceLine && (
          <div className="pt-1.5 text-[11px] font-mono text-stone-500">
            {sourceLine}
          </div>
        )}

        {/* Alternative Language / Original Toggle */}
        {hasAlternativeLanguage && (
          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
            <span className="flex items-center gap-1.5 font-medium text-amber-800">
              <Languages className="w-3.5 h-3.5 text-amber-700" />
              <span>
                {showOriginal
                  ? "Showing English Original"
                  : `${currentLangInfo.nativeName} (${currentLangInfo.name})`}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowOriginal(!showOriginal)}
              className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline underline-offset-2 transition-colors cursor-pointer"
            >
              {showOriginal
                ? globalLanguage === "te"
                  ? "తెలుగు సమాధానం చూడండి"
                  : `Switch to ${currentLangInfo.nativeName}`
                : globalLanguage === "te"
                ? "View English original"
                : "View original"}
            </button>
          </div>
        )}

        {/* If global language is not English, and message is not translated yet, offer translate action */}
        {!hasAlternativeLanguage && !isMessageTelugu && globalLanguage !== "en" && onTranslateMessage && (
          <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              id={`btn-translate-msg-${message.id}`}
              onClick={() => onTranslateMessage(message.id, globalLanguage)}
              disabled={isTranslating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100/70 hover:bg-amber-200/70 text-amber-900 border border-amber-200 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isTranslating ? (
                <Loader2 className="w-3 h-3 animate-spin text-amber-800" />
              ) : (
                <Languages className="w-3 h-3 text-amber-800" />
              )}
              <span>
                Translate to {currentLangInfo.nativeName} ({currentLangInfo.name})
              </span>
            </button>
          </div>
        )}

        {/* Google Search Grounding Sources */}
        {message.groundingSources && message.groundingSources.length > 0 && (
          <div className="pt-2.5 mt-2 border-t border-stone-200 space-y-1.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-500">
              <Search className="w-3 h-3 text-amber-700" />
              <span>Google Search Grounding Sources</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.groundingSources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 text-[10px] transition-colors"
                >
                  <span className="truncate max-w-[180px]">{source.title}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 text-stone-500" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Mandatory Source Citation */}
        {sourceLine && (
          <div className="pt-2.5 mt-1 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="text-stone-700">{sourceLine}</span>
            </div>
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-0.5 text-amber-800 hover:text-amber-900 hover:underline shrink-0 text-[10px]"
            >
              <span>Open-Meteo API</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div
      key={`${message.id}-${globalLanguage}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`flex items-start gap-3 my-4 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
          isUser
            ? "bg-stone-800 text-amber-100 border border-stone-700"
            : message.isError
            ? "bg-rose-100 text-rose-800 border border-rose-300"
            : "bg-gradient-to-tr from-amber-600 to-stone-800 text-amber-100 shadow-xs"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : message.isError ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <CloudSun className="w-4 h-4" />
        )}
      </div>

      {/* Bubble Container */}
      <div className={`max-w-[88%] sm:max-w-[78%] space-y-1.5`}>
        {/* Author & Timestamp */}
        <div
          className={`flex items-center gap-2 text-[11px] text-stone-500 ${
            isUser ? "justify-end" : "justify-between"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-stone-700">
              {isUser ? "You" : "WeatherGPT Advisor"}
            </span>
            <span>•</span>
            <span className="font-mono text-[10px]">{message.timestamp}</span>
          </div>

          {!isUser && !message.isError && (
            <SpeechControls
              textToSpeak={displayedContent}
              language={showOriginal ? "en" : globalLanguage}
              onOpenVoiceSettings={onOpenVoiceSettings}
              size="sm"
            />
          )}
        </div>

        {/* Message Card */}
        <div
          className={`rounded-2xl px-4.5 py-3.5 shadow-xs border transition-all ${
            isUser
              ? "bg-gradient-to-r from-stone-900 to-stone-800 text-stone-50 border-stone-800 rounded-tr-xs shadow-xs"
              : message.isError
              ? "bg-rose-50 text-rose-900 border-rose-300 rounded-tl-xs"
              : "bg-white text-stone-900 border-stone-200/90 rounded-tl-xs shadow-xs"
          }`}
        >
          {/* Tool Grounding Context Badge if weather data was retrieved */}
          {!isUser && message.weatherSnapshot && (
            <div className="mb-3 p-2.5 rounded-xl bg-[#faf8f4] border border-stone-200/90 text-xs text-stone-700">
              <div className="flex items-center justify-between pb-1.5 border-b border-stone-200 text-[11px]">
                <span className="font-semibold text-stone-900 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-700" />
                  Live Observation: {message.weatherSnapshot.locationName}
                </span>
                <span className="text-[10px] bg-white text-stone-800 font-medium px-2 py-0.5 rounded-md border border-stone-300 shadow-xs">
                  {message.weatherSnapshot.condition}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                <div>
                  <span className="text-stone-500 block text-[10px]">Temp</span>
                  <span className="font-bold text-stone-900">
                    {message.weatherSnapshot.temp}°C
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">Wind</span>
                  <span className="font-bold text-stone-900">
                    {message.weatherSnapshot.windSpeed} km/h
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">Rain Risk</span>
                  <span className="font-bold text-sky-700">
                    {message.weatherSnapshot.rainChance}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Body Content */}
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap font-normal">
              {message.content}
            </p>
          ) : (
            renderFormattedAssistantContent(displayedContent)
          )}
        </div>
      </div>
    </motion.div>
  );
};
