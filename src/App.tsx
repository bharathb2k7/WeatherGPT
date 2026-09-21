/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Send, MapPin, Sparkles, Mic, Languages, ShieldAlert, Radio } from "lucide-react";
import { Header } from "./components/Header";
import { WeatherHero } from "./components/WeatherHero";
import { LocationModal } from "./components/LocationModal";
import { VoiceModal } from "./components/VoiceModal";
import { TgicccModal } from "./components/TgicccModal";
import { QuickPromptsBar } from "./components/QuickPromptsBar";
import { ChatMessageBubble } from "./components/ChatMessageBubble";
import { TypingIndicator } from "./components/TypingIndicator";
import { WeatherAlertBanner } from "./components/WeatherAlertBanner";
import { DEFAULT_LOCATIONS } from "./data/constants";
import { LocationItem, CurrentWeatherData, ChatMessage } from "./types";
import {
  auth,
  signInWithGoogle,
  logOut,
  testFirestoreConnection,
  saveUserChatHistory,
  getUserChatHistory,
} from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export default function App() {
  // Default location: Hyderabad, Telangana
  const [activeLocation, setActiveLocation] = useState<LocationItem>(
    DEFAULT_LOCATIONS[0]
  );
  const [currentWeather, setCurrentWeather] = useState<CurrentWeatherData | null>(
    null
  );
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isTgicccModalOpen, setIsTgicccModalOpen] = useState(false);
  const [language, setLanguage] = useState<"en" | "te">("en");
  const [user, setUser] = useState<User | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: `Hello! I'm WeatherGPT, your AI Weather Intelligence advisor. Instead of generic data tables, ask me practical questions grounded in live meteorological telemetry:
• "Should I spray pesticide tomorrow?" (Farmers 🌱)
• "Is it safe to go fishing this weekend?" (Fishers 🎣)
• "Will it rain during my commute this evening?" (Commuters 🚗)
• "Translate to Telugu" (తెలుగు అనువాదం 🇮🇳)
• "What are the TGICCC emergency guidelines?" (Emergency Dial 112 🚨)

Every answer is strictly grounded in real-time Open-Meteo data, Google Search grounding, and live voice conversations.`,
      contentTelugu: `నమస్కారం! నేను WeatherGPT, మీ వాతావరణ సలహాదారుని. సాంకేతిక నివేదికలకు బదులుగా, మీ దైనందిన ప్రశ్నలను అడగండి:
• "రేపు పురుగుమందు పిచికారీ చేయవచ్చా?" (రైతులు 🌱)
• "ఈ వారాంతంలో చేపల వేటకు వెళ్లడం సురక్షితమేనా?" (మత్స్యకారులు 🎣)
• "ఈ సాయంత్రం ప్రయాణంలో వర్షం పడుతుందా?" (ప్రయాణికులు 🚗)
• "TGICCC అత్యవసర సహాయ కేంద్రం (డయల్ 112) వివరాలు" 🚨

ప్రతి సమాధానం రియల్-టైమ్ Open-Meteo సమాచారం ఆధారంగా అందించబడుతుంది.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Test Firestore Connection & Listen to Auth changes
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load past history from Firestore if available
        try {
          const pastHistory = await getUserChatHistory(currentUser.uid);
          if (pastHistory && pastHistory.length > 0) {
            const restoredMessages: ChatMessage[] = pastHistory.reverse().map((h: any) => ({
              id: h.id || `hist-${Math.random()}`,
              role: "assistant",
              content: `Q: "${h.query}"\n\n${h.reply}`,
              contentTelugu: h.language === "te" ? h.reply : undefined,
              timestamp: new Date(h.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            }));
            setMessages((prev) => [...prev, ...restoredMessages]);
          }
        } catch (err) {
          console.warn("Could not restore Firestore history:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Fetch current weather snapshot when active location changes
  const fetchCurrentWeather = async (loc: LocationItem) => {
    setIsLoadingWeather(true);
    try {
      const res = await fetch(
        `/api/weather/current?lat=${loc.latitude}&lon=${loc.longitude}&timezone=${encodeURIComponent(
          loc.timezone || "Asia/Kolkata"
        )}`
      );
      if (res.ok) {
        const data = await res.json();
        setCurrentWeather(data);
      }
    } catch (err) {
      console.error("Failed to load header weather:", err);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  useEffect(() => {
    fetchCurrentWeather(activeLocation);
  }, [activeLocation]);

  // Handle message submission
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newUserMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: text,
      timestamp: userTimestamp,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Call backend /api/chat
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          activeLocation,
          language,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server responded with status ${response.status}`
        );
      }

      const data = await response.json();
      const assistantMessageId = `asst-${Date.now()}`;
      const assistantTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const newAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: data.reply,
        contentTelugu: data.contentTelugu,
        timestamp: assistantTimestamp,
        toolSummary: data.toolSummary,
        weatherSnapshot: data.weatherSnapshot,
        groundingSources: data.groundingSources,
      };

      setMessages((prev) => [...prev, newAssistantMessage]);

      // Save to Firebase Firestore if logged in
      if (user) {
        saveUserChatHistory(user.uid, {
          query: text,
          reply: data.reply,
          location: activeLocation.name,
          language,
        });
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessageId = `err-${Date.now()}`;
      const errorTimestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const fallbackErrorMessage: ChatMessage = {
        id: errorMessageId,
        role: "assistant",
        content: `I encountered a momentary issue contacting the weather service. Please ensure your location "${activeLocation.name}" is valid or try again in a few moments.`,
        timestamp: errorTimestamp,
        isError: true,
      };

      setMessages((prev) => [...prev, fallbackErrorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectQuickPrompt = (promptText: string) => {
    handleSendMessage(promptText);
  };

  const handleSelectLocation = (newLoc: LocationItem) => {
    setActiveLocation(newLoc);
    setMessages((prev) => [
      ...prev,
      {
        id: `loc-change-${Date.now()}`,
        role: "assistant",
        content: `Location switched to **${newLoc.name}${
          newLoc.admin1 ? ", " + newLoc.admin1 : ""
        }**. All queries will now evaluate real-time weather for this area.`,
        contentTelugu: `ప్రాంతం **${newLoc.name}** కి మార్చబడింది. మీ ప్రశ్నలన్నీ ఇకపై ఈ ప్రాంత వాతావరణ సమాచారాన్ని ఉపయోగిస్తాయి.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);
  };

  const toggleLanguage = () => {
    const nextLang = language === "en" ? "te" : "en";
    setLanguage(nextLang);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Firebase Sign in failed:", err);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error("Firebase Sign out failed:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f5f2eb] text-stone-900 overflow-hidden font-sans relative">
      {/* Background Ambient Warm Sun & Sky Glow Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-amber-200/30 via-orange-100/20 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[350px] bg-stone-300/30 blur-3xl pointer-events-none -z-10" />

      {/* Sticky Header with Firebase Auth, Voice, Language & Weather snapshot */}
      <Header
        activeLocation={activeLocation}
        currentWeather={currentWeather}
        isLoadingWeather={isLoadingWeather}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onOpenTgicccModal={() => setIsTgicccModalOpen(true)}
        language={language}
        onToggleLanguage={toggleLanguage}
        user={user}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleGoogleSignOut}
      />

      {/* Main Chat Area */}
      <main
        id="chat-main-container"
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Main Weather Hero Intelligence Card */}
          <WeatherHero
            location={activeLocation}
            weather={currentWeather}
            isLoading={isLoadingWeather}
            language={language}
            onOpenLocationModal={() => setIsLocationModalOpen(true)}
            onOpenTgicccModal={() => setIsTgicccModalOpen(true)}
            onAskAdvice={(prompt) => handleSendMessage(prompt)}
          />

          {/* Severe Weather Alert Banner (Automated detection from Open-Meteo) */}
          {currentWeather?.severeAlert && (
            <WeatherAlertBanner
              alert={currentWeather.severeAlert}
              activeLocation={activeLocation}
              language={language}
              onAskAboutAlert={(queryText) => handleSendMessage(queryText)}
              onOpenTgicccModal={() => setIsTgicccModalOpen(true)}
            />
          )}

          {/* AI Capabilities Indicator Strip */}
          <div className="bg-[#fcfbfa] border border-stone-200/90 rounded-2xl p-3 sm:p-3.5 text-xs text-stone-700 flex items-start gap-3 shadow-xs">
            <div className="p-1.5 rounded-xl bg-amber-100/80 text-amber-800 border border-amber-200/80 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-900 text-xs sm:text-sm">
                  Weather Intelligence Engine Active
                </span>
                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 font-mono text-[10px]">
                  Telugu (తెలుగు)
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono text-[10px]">
                  Open-Meteo Grounded
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px]">
                  Live Voice
                </span>
                <button
                  onClick={() => setIsTgicccModalOpen(true)}
                  className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono text-[10px] hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  TGICCC 112
                </button>
              </div>
              <p className="leading-relaxed text-[11px] sm:text-xs text-stone-600">
                Actionable advice for farmers, fishers, and commuters. Weather telemetry is synchronized directly with Open-Meteo models and Google Search bulletins.
              </p>
            </div>
          </div>

          {/* Chat Messages List */}
          {messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              globalLanguage={language}
            />
          ))}

          {/* Typing / Tool Invocations Indicator */}
          {isLoading && (
            <TypingIndicator locationName={activeLocation.name} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input & Quick Prompts Footer with Floating Glass Composer */}
      <footer
        id="chat-footer-controls"
        className="bg-[#f5f2eb]/90 backdrop-blur-xl border-t border-stone-200/90 px-3 sm:px-4 py-3 shrink-0 relative z-20 shadow-lg shadow-stone-400/5"
      >
        <div className="max-w-3xl mx-auto space-y-2.5">
          {/* Persona / Quick Prompts Bar */}
          <QuickPromptsBar
            onSelectPrompt={handleSelectQuickPrompt}
            disabled={isLoading}
            language={language}
          />

          {/* Floating Pill Chat Input Box */}
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400/20 to-stone-400/20 rounded-2xl blur-xs opacity-0 group-focus-within:opacity-100 transition duration-300" />
              <div className="relative flex items-center">
                <input
                  ref={inputRef}
                  id="input-chat-query"
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  placeholder={
                    language === "te"
                      ? `${activeLocation.name} కోసం వాతావరణ సలహా అడగండి (ఉదా: రేపు పురుగుమందు పిచికారీ చేయవచ్చా?)...`
                      : `Ask weather advice for ${activeLocation.name} (e.g. Should I spray pesticide tomorrow?)...`
                  }
                  className="w-full pl-4 pr-12 py-3 rounded-2xl border border-stone-300 bg-white text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/25 focus:border-amber-600 transition-all disabled:opacity-50 placeholder:text-stone-400 shadow-xs"
                />
                <button
                  id="btn-send-query"
                  onClick={() => handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-gradient-to-r from-amber-700 to-stone-800 hover:from-amber-600 hover:to-stone-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                  title="Send query"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Voice Trigger */}
            <button
              id="btn-footer-voice"
              onClick={() => setIsVoiceModalOpen(true)}
              className="p-3 rounded-2xl border border-amber-300/80 bg-amber-100/70 hover:bg-amber-200/80 text-amber-900 transition-colors shrink-0 cursor-pointer shadow-xs"
              title="Speak with WeatherGPT Live Voice"
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Quick Location Trigger */}
            <button
              id="btn-footer-location"
              onClick={() => setIsLocationModalOpen(true)}
              className="p-3 rounded-2xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 hover:text-stone-900 transition-colors shrink-0 cursor-pointer shadow-xs"
              title={`Current location: ${activeLocation.name}. Click to change.`}
            >
              <MapPin className="w-4 h-4 text-amber-700" />
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-[11px] text-stone-500">
            <span className="flex items-center gap-1.5">
              <span>Observation City:</span>
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="font-medium text-stone-800 hover:text-amber-800 underline cursor-pointer"
              >
                {activeLocation.name}
                {activeLocation.admin1 ? `, ${activeLocation.admin1}` : ""}
              </button>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTgicccModalOpen(true)}
                className="text-rose-700 hover:text-rose-800 font-semibold cursor-pointer"
              >
                TGICCC Dial 112
              </button>
              <span>•</span>
              <span>
                {language === "te" ? "తెలుగు మోడ్ ఆన్" : "English Mode"}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Location Picker & Geocoding Modal */}
      <LocationModal
        isOpen={isLocationModalOpen}
        activeLocation={activeLocation}
        onClose={() => setIsLocationModalOpen(false)}
        onSelectLocation={handleSelectLocation}
      />

      {/* Live Voice Conversation Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        locationName={activeLocation.name}
      />

      {/* TGICCC Command Centre & Emergency Helplines Modal */}
      <TgicccModal
        isOpen={isTgicccModalOpen}
        onClose={() => setIsTgicccModalOpen(false)}
        language={language}
        onAskQuery={(q) => handleSendMessage(q)}
      />
    </div>
  );
}
