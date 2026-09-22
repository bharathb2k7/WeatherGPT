import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Type, FunctionDeclaration, LiveServerMessage, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { runGeminiCropDamageAnalysis, synthesizeCropDamageFallback } from "./server-crop-damage";

dotenv.config();

const app = express();

// Port Resolution:
// - Inside AI Studio sandbox, nginx reverse proxy routes specifically to port 3000.
// - On deployment platforms like Render (where process.env.RENDER is 'true' or outside AI Studio),
//   the service must bind to process.env.PORT (Render sets PORT=10000 by default).
const isAiStudio = Boolean(process.env.APPLET_ID);
const PORT: number = isAiStudio
  ? 3000
  : (process.env.PORT ? parseInt(process.env.PORT, 10) : (process.env.RENDER ? 10000 : 3000));

app.use(express.json({ limit: "25mb" }));

// Health Check Endpoints (for Render, Cloud Run, and deployment load balancers)
app.get(["/health", "/healthz", "/api/health"], (_req, res) => {
  res.status(200).json({ status: "ok", port: PORT, timestamp: new Date().toISOString() });
});

// Initialize Gemini Client (server-side only)
function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Weather Code mapping to human-readable terms
function getWeatherDescription(code: number): string {
  switch (code) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
      return "Foggy";
    case 48:
      return "Depositing rime fog";
    case 51:
      return "Light drizzle";
    case 53:
      return "Moderate drizzle";
    case 55:
      return "Dense drizzle";
    case 61:
      return "Slight rain";
    case 63:
      return "Moderate rain";
    case 65:
      return "Heavy rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
      return "Slight snowfall";
    case 73:
      return "Moderate snowfall";
    case 75:
      return "Heavy snowfall";
    case 80:
      return "Slight rain showers";
    case 81:
      return "Moderate rain showers";
    case 82:
      return "Violent rain showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with hail";
    default:
      return "Partly cloudy";
  }
}

// Helper to geocode a location using Open-Meteo Geocoding API
async function geocodeLocation(name: string) {
  try {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      trimmed
    )}&count=5&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Geocoding HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      return null;
    }
    // Prefer India matches if available, else first result
    const indiaMatch = data.results.find((r: any) => r.country_code === "IN");
    const chosen = indiaMatch || data.results[0];
    return {
      name: chosen.name,
      admin1: chosen.admin1 || "",
      country: chosen.country || "",
      country_code: chosen.country_code || "",
      latitude: chosen.latitude,
      longitude: chosen.longitude,
      timezone: chosen.timezone || "Asia/Kolkata",
    };
  } catch (err) {
    console.error("Geocoding error:", err);
    return null;
  }
}

// Helper to fetch Open-Meteo Weather Forecast with timeout and retry
async function fetchWeatherForecast(lat: number, lon: number, timezone: string = "auto") {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&timezone=${encodeURIComponent(
        timezone
      )}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Open-Meteo HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      console.warn("Open-Meteo fetch notice:", err);
      return null;
    }
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    ),
  ]);
}

// Supported Language Metadata
const LANGUAGE_META: Record<string, { name: string; native: string }> = {
  en: { name: "English", native: "English" },
  te: { name: "Telugu", native: "తెలుగు" },
  hi: { name: "Hindi", native: "हिन्दी" },
  ta: { name: "Tamil", native: "தமிழ்" },
  kn: { name: "Kannada", native: "ಕನ್ನಡ" },
  ml: { name: "Malayalam", native: "മലയാളം" },
  mr: { name: "Marathi", native: "मराठी" },
  bn: { name: "Bengali", native: "বাংলা" },
  gu: { name: "Gujarati", native: "ગુજરાતી" },
  pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  or: { name: "Odia", native: "ଓଡ଼ିଆ" },
  es: { name: "Spanish", native: "Español" },
  fr: { name: "French", native: "Français" },
  ar: { name: "Arabic", native: "العربية" },
};

// High reliability multi-language fallback translation
async function translateTextFallback(text: string, targetLang: string = "te"): Promise<string | null> {
  try {
    const cleanText = text.replace(/Source:[\s\S]*$/i, "").trim();
    if (!cleanText) return null;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(cleanText)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const translatedText = data[0]?.map((chunk: any) => chunk[0]).join("") || null;
    return translatedText;
  } catch (err) {
    console.warn(`Translation fallback error for ${targetLang}:`, err);
    return null;
  }
}

// Backward compatibility helper for Telugu
async function translateToTeluguFallback(text: string): Promise<string | null> {
  return translateTextFallback(text, "te");
}

// Tool Declaration for Gemini Function Calling
const getWeatherDeclaration: FunctionDeclaration = {
  name: "get_weather",
  description:
    "Fetches live current weather conditions, hourly forecasts, rain probability, wind speeds, and temperatures for any location from the Open-Meteo API.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description:
          "The city, district, or region name, e.g. 'Hyderabad', 'Mumbai', 'Vijayawada', 'Bengaluru', 'Delhi', 'Chennai', 'Pune', 'Kurnool'.",
      },
      date_or_time_range: {
        type: Type.STRING,
        description:
          "The target timeframe, e.g. 'today', 'tomorrow', 'this evening', 'this weekend', 'next 24 hours', 'current'.",
      },
    },
    required: ["location"],
  },
};

// Generates direct plain-language weather advice grounded strictly in Open-Meteo data
function synthesizePlainLanguageAdvisory(
  userQuery: string,
  geo: any,
  toolResult: any,
  currentDateStr: string,
  isTelugu: boolean = false
): string {
  const queryLower = userQuery.toLowerCase();
  const cur = toolResult.current;
  const daily = toolResult.daily_3_day_forecast || [];
  const today = daily[0] || {};
  const tomorrow = daily[1] || today;

  // 1. Pesticide Spraying (Farmer Persona)
  if (queryLower.includes("pesticide") || queryLower.includes("spray") || queryLower.includes("crop") || queryLower.includes("మందు") || queryLower.includes("పిచికారీ")) {
    const isTomorrow = queryLower.includes("tomorrow") || queryLower.includes("రేపు");
    const targetDay = isTomorrow ? tomorrow : today;
    const windTarget = isTomorrow ? (targetDay.maxWindKmH || cur.wind_speed_kmh) : cur.wind_speed_kmh;
    const rainChance = targetDay.rainProbabilityMax ?? 0;
    const dayName = isTomorrow ? "tomorrow" : "today";
    const dayNameTe = isTomorrow ? "రేపు" : "ఈ రోజు";

    if (rainChance >= 40) {
      if (isTelugu) {
        return `${dayNameTe} ${geo.name} లో పురుగుమందు పిచికారీ చేయవద్దు. ${rainChance}% వర్షం పడే అవకాశం ఉన్నందున మందు కొట్టుకుపోతుంది. వర్షం లేని రోజు వరకు వేచి ఉండండి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `Do not spray pesticide ${dayName} in ${geo.name}. There is a high ${rainChance}% probability of rain which will wash away the chemical. Wait for a clear window with calm winds.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    } else if (windTarget > 15) {
      if (isTelugu) {
        return `${dayNameTe} ${geo.name} లో పురుగుమందు పిచికారీ చేయడం ఆపండి. గాలి వేగం గంటకు ${windTarget} కి.మీ వరకు ఉన్నందున మందు సమర్థవంతంగా చేరదు. గాలి వేగం 15 కి.మీ కంటే తగ్గే వరకు ఆగండి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `Hold off on spraying pesticide ${dayName} in ${geo.name}. Wind speeds of up to ${windTarget} km/h will cause severe spray drift and wasted chemical. Wait until winds drop below 15 km/h.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    } else {
      if (isTelugu) {
        return `అవును, ${dayNameTe} ${geo.name} లో పురుగుమందు పిచికారీ చేయడానికి వాతావరణం అనుకూలంగా ఉంది. గాలి వేగం సుమారు ${windTarget} కి.మీ/గం మరియు వర్షం పడే అవకాశం చాలా తక్కువ (${rainChance}%). ఉదయం వేళల్లో పిచికారీ చేయడం ఉత్తమం.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `Yes, it is safe to spray pesticide ${dayName} in ${geo.name}. Winds will remain favorable around ${windTarget} km/h with minimal rain probability (${rainChance}%). Early morning hours will provide the most effective coverage.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    }
  }

  // 2. Fishing / Sea Safety (Fisher Persona)
  if (queryLower.includes("fish") || queryLower.includes("sea") || queryLower.includes("boat") || queryLower.includes("marine") || queryLower.includes("చేపల") || queryLower.includes("సముద్రం")) {
    const maxWind = daily.slice(0, 3).reduce((m: number, d: any) => Math.max(m, d.maxWindKmH || 0), cur.wind_speed_kmh);
    const maxGust = daily.slice(0, 3).reduce((m: number, d: any) => Math.max(m, d.maxGustKmH || 0), cur.wind_gusts_kmh);
    const hasSevereCode = daily.some((d: any) => (d.weatherCode || 0) >= 80);

    if (maxGust >= 40 || maxWind >= 30 || hasSevereCode) {
      if (isTelugu) {
        return `${geo.name} పరిసర సముద్రంలో చిన్న పడవలు మరియు మత్స్యకారులు చేపల వేటకు వెళ్లడం సురక్షితం కాదు. గంటకు ${maxGust} కి.మీ వేగంతో బలమైన ఈదురుగాలులు మరియు సముద్రపు అలజడి ఉంటుంది. హెచ్చరికలు తొలగే వరకు తీరంలోనే ఉండండి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `It is unsafe for small boats and fishers to venture into open waters around ${geo.name}. Expect dangerous wind gusts up to ${maxGust} km/h and squally sea conditions. Stay onshore until maritime warnings clear.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    } else {
      if (isTelugu) {
        return `${geo.name} పరిసర సముద్రంలో చేపల వేటకు పరిస్థితులు సాధారణంగా సురక్షితంగా ఉన్నాయి. గాలులు సుమారు ${cur.wind_speed_kmh} కి.మీ/గం మరియు ఈదురుగాలులు గరిష్టంగా ${maxGust} కి.మీ/గం వరకు ఉండవచ్చు. భద్రతా సామగ్రిని తప్పక ఉంచుకోండి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `Marine conditions are generally safe for fishing around ${geo.name}. Winds will stay moderate around ${cur.wind_speed_kmh} km/h with gusts peaking at ${maxGust} km/h. Standard safety gear is still recommended.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    }
  }

  // 3. Commute / Rain Query (Commuter / Citizen Persona)
  if (queryLower.includes("commute") || queryLower.includes("rain") || queryLower.includes("evening") || queryLower.includes("umbrella") || queryLower.includes("వర్షం") || queryLower.includes("ప్రయాణం")) {
    const isEvening = queryLower.includes("evening") || queryLower.includes("night") || queryLower.includes("సాయంత్రం");
    const rainChance = today.rainProbabilityMax ?? 0;
    const rainSum = today.precipitationSumMm ?? 0;

    if (rainChance > 40 || rainSum > 1.0) {
      if (isTelugu) {
        return `అవును, ${geo.name} లో మీ ${isEvening ? "సాయంత్రం" : "ఈనాటి"} ప్రయాణ సమయంలో ${rainChance}% వర్షం పడే అవకాశం ఉంది. గొడుగు వెంట ఉంచుకోండి మరియు ట్రాఫిక్ ఆలస్యం కాకుండా ప్రణాళిక చేసుకోండి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `Yes, expect rain during your ${isEvening ? "evening" : "daily"} commute in ${geo.name} with a ${rainChance}% probability. Carry an umbrella and plan for slower traffic and waterlogging on main corridors.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    } else if (rainChance >= 20) {
      if (isTelugu) {
        return `ఈ రోజు ${geo.name} లో తేలికపాటి చినుకులు పడే అవకాశం (${rainChance}%) మాత్రమే ఉంది. పెద్దగా ఆటంకాలు ఉండకపోవచ్చు, కానీ వెంట చిన్న గొడుగు ఉంచుకోవడం మంచిది.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `There is only a slight (${rainChance}%) chance of isolated drizzle in ${geo.name} today. Major disruptions to your commute are unlikely, but keep a compact umbrella just in case.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    } else {
      if (isTelugu) {
        return `${geo.name} లో మీ ప్రయాణ సమయంలో వర్షం పడే అవకాశం లేదు. ఆకాశం ${cur.condition} గా ఉంటుంది మరియు ఉష్ణోగ్రత సుమారు ${cur.temperature_c}°C ఉంటుంది. ప్రయాణం సాఫీగా సాగుతుంది.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `No significant rain is expected during your commute in ${geo.name}. The skies will remain ${cur.condition.toLowerCase()} with temperatures around ${cur.temperature_c}°C. Commuting conditions should remain smooth.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    }
  }

  // 4. Storm / Heatwave Alerts (Disaster Manager / General)
  if (queryLower.includes("storm") || queryLower.includes("alert") || queryLower.includes("heatwave") || queryLower.includes("cyclone") || queryLower.includes("తుఫాను") || queryLower.includes("ఎండ")) {
    const maxTemp = daily.slice(0, 3).reduce((m: number, d: any) => Math.max(m, d.maxTemp || 0), cur.temperature_c);
    const maxGust = daily.slice(0, 3).reduce((m: number, d: any) => Math.max(m, d.maxGustKmH || 0), cur.wind_gusts_kmh);

    if (maxTemp >= 40) {
      if (isTelugu) {
        return `${geo.name} కు తీవ్ర ఎండ హెచ్చరిక: రాబోయే రోజుల్లో ఉష్ణోగ్రతలు గరిష్టంగా ${maxTemp}°C వరకు చేరవచ్చు. మధ్యాహ్నం 12 నుండి 4 గంటల మధ్య బయట పనులు తగ్గించి, పుష్కలంగా నీరు తాగండి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `Heat alert for ${geo.name}: temperatures will climb to a scorching ${maxTemp}°C over the coming days. Avoid outdoor labor between 12 PM and 4 PM and stay hydrated.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    } else if (maxGust >= 45) {
      if (isTelugu) {
        return `${geo.name} కు తీవ్ర గాలుల హెచ్చరిక: ఉరుములు, మెరుపులతో గరిష్టంగా ${maxGust} కి.మీ/గం వేగంతో ఈదురుగాలులు వీచే అవకాశం ఉంది. పాత చెట్లు, విద్యుత్ స్తంభాల కింద ఉండకండి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `High wind alert for ${geo.name}: gusts may reach ${maxGust} km/h with thunderstorm activity. Secure loose tin roofs and avoid parking vehicles under old trees.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    } else {
      if (isTelugu) {
        return `ఈ వారం ${geo.name} కు ఎటువంటి తీవ్ర వాతావరణ హెచ్చరికలు లేవు. ఉష్ణోగ్రతలు ${today.minTemp || 22}°C నుండి ${today.maxTemp || 32}°C మధ్య ఉంటాయి మరియు గాలులు సురక్షిత పరిమితిలో ఉంటాయి.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
      }
      return `No severe meteorological alerts are active for ${geo.name} this week. Temperatures will range between ${today.minTemp || 22}°C and ${today.maxTemp || 32}°C with wind speeds remaining within safe limits.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
    }
  }

  // Default Plain-Language Summary
  if (isTelugu) {
    return `${geo.name} లో ప్రస్తుత వాతావరణం ${cur.condition} గా ఉంది, ఉష్ణోగ్రత ${cur.temperature_c}°C, తేమ ${cur.humidity_percent}% మరియు గాలి వేగం గంటకు ${cur.wind_speed_kmh} కి.మీ. రాబోయే 24 గంటల్లో వర్షం పడే గరిష్ట అవకాశం ${today.rainProbabilityMax ?? 5}%.\n\nమూలం: Open-Meteo, ${currentDateStr} IST`;
  }
  return `In ${geo.name}, current conditions are ${cur.condition.toLowerCase()} at ${cur.temperature_c}°C with ${cur.humidity_percent}% humidity and calm winds of ${cur.wind_speed_kmh} km/h. The maximum chance of rain over the next 24 hours is ${today.rainProbabilityMax ?? 5}%.\n\nSource: Open-Meteo, ${currentDateStr} IST`;
}

// API: Location Geocoding & Autocomplete
app.get("/api/locations", async (req, res) => {
  const query = (req.query.q as string) || "";
  if (!query || query.trim().length < 2) {
    return res.json({ results: [] });
  }
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query.trim()
    )}&count=8&language=en&format=json`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.json({ results: [] });
    }
    const data = await response.json();
    const results = (data.results || []).map((item: any) => ({
      id: `${item.latitude}-${item.longitude}`,
      name: item.name,
      admin1: item.admin1 || "",
      country: item.country || "",
      country_code: item.country_code || "",
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone || "Asia/Kolkata",
    }));
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to search location" });
  }
});

// API: Current Weather Snapshot for Header/Pill
app.get("/api/weather/current", async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const timezone = (req.query.timezone as string) || "auto";

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  const weather = await fetchWeatherForecast(lat, lon, timezone);
  if (!weather || !weather.current) {
    return res.json({
      temperature: 28,
      apparentTemperature: 31,
      humidity: 72,
      windSpeed: 10,
      windGusts: 16,
      condition: "Partly cloudy",
      weatherCode: 2,
      precipitation: 0,
      rainProbability: 15,
      isDay: true,
      time: new Date().toISOString(),
      severeAlert: null,
    });
  }

  const current = weather.current;
  const condition = getWeatherDescription(current.weather_code);
  const hourly = weather.hourly || {};
  const daily = weather.daily || {};
  const currentHourIndex = 0;
  const rainProb =
    hourly.precipitation_probability && hourly.precipitation_probability.length > 0
      ? hourly.precipitation_probability[currentHourIndex] || 0
      : 0;

  // Detect severe weather warnings from Open-Meteo metrics
  let severeAlert: any = null;
  const todayRainProbMax = daily.precipitation_probability_max?.[0] ?? rainProb;
  const todayPrecipSum = daily.precipitation_sum?.[0] ?? current.precipitation;
  const maxGust = Math.round(daily.wind_gusts_10m_max?.[0] ?? current.wind_gusts_10m ?? current.wind_speed_10m);
  const maxTemp = Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m);
  const currentCode = current.weather_code;

  // 1. Heavy Rain Warning (Code 65, 82, precipitation >= 10mm or rainProb >= 75%)
  if (currentCode === 65 || currentCode === 82 || todayPrecipSum >= 15 || todayRainProbMax >= 75) {
    severeAlert = {
      severity: todayPrecipSum >= 20 || currentCode === 65 ? "warning" : "advisory",
      type: "heavy_rain",
      title: "Heavy Rain & Downpour Warning",
      titleTelugu: "భారీ వర్షం హెచ్చరిక",
      description: `High risk of localized waterlogging and hazardous travel conditions. Precipitation likelihood is ${todayRainProbMax}% with up to ${Math.round(todayPrecipSum)} mm rainfall expected.`,
      descriptionTelugu: `భారీ వర్షం మరియు వరద నీరు నిలిచే ప్రమాదం ఉంది. వర్షం సంభావ్యత ${todayRainProbMax}%, దాదాపు ${Math.round(todayPrecipSum)} మి.మీ వర్షపాతం అంచనా.`,
      metric: `${todayRainProbMax}% rain risk • ${Math.round(todayPrecipSum)} mm`,
    };
  }
  // 2. Thunderstorm Warning (Codes 95, 96, 99)
  else if (currentCode === 95 || currentCode === 96 || currentCode === 99) {
    severeAlert = {
      severity: "warning",
      type: "thunderstorm",
      title: "Severe Thunderstorm & Lightning Warning",
      titleTelugu: "తీవ్రమైన ఉరుములతో కూడిన వర్షం హెచ్చరిక",
      description: `Active convective thunderstorms detected with possible lightning and sudden squalls. Avoid open fields, metallic structures, and stay indoors.`,
      descriptionTelugu: `ఉరుములు, మెరుపులతో కూడిన బలమైన ఈదురు గాలుల ప్రమాదం. బహిరంగ ప్రదేశాలలో ఉండకండి, సురక్షితమైన ప్రదేశాలలో ఉండండి.`,
      metric: `Code ${currentCode} • Lightning threat`,
    };
  }
  // 3. High Wind Warning (Gusts >= 40 km/h)
  else if (maxGust >= 40) {
    severeAlert = {
      severity: maxGust >= 55 ? "warning" : "advisory",
      type: "high_wind",
      title: "High Wind & Gale Advisory",
      titleTelugu: "తీవ్రమైన ఈదురు గాలుల హెచ్చరిక",
      description: `Dangerous wind gusts reaching up to ${maxGust} km/h. High risk for two-wheelers, small fishing boats, and loose roof structures.`,
      descriptionTelugu: `${maxGust} కి.మీ/గం వేగంతో బలమైన ఈదురు గాలులు వీచే అవకాశం ఉంది. చిన్న పడవలు మరియు ద్విచక్ర వాహనదారులు జాగ్రత్తగా ఉండండి.`,
      metric: `${maxGust} km/h peak gusts`,
    };
  }
  // 4. Heatwave Alert (Temperature >= 40°C)
  else if (maxTemp >= 40) {
    severeAlert = {
      severity: maxTemp >= 43 ? "warning" : "watch",
      type: "heatwave",
      title: "Extreme Heatwave Alert",
      titleTelugu: "తీవ్రమైన ఎండ మరియు వడగాల్పుల హెచ్చరిక",
      description: `Peak temperatures approaching ${maxTemp}°C. Stay hydrated and avoid direct outdoor exertion between 12:00 PM and 4:00 PM.`,
      descriptionTelugu: `ఉష్ణోగ్రతలు ${maxTemp}°C కి చేరుకునే అవకాశం ఉంది. సరిపడా నీరు త్రాగండి మరియు మధ్యాహ్నం 12 నుండి 4 గంటల వరకు ఎండలో తిరగవద్దు.`,
      metric: `${maxTemp}°C daytime peak`,
    };
  }

  res.json({
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    windSpeed: Math.round(current.wind_speed_10m),
    windGusts: Math.round(current.wind_gusts_10m || current.wind_speed_10m),
    condition,
    weatherCode: current.weather_code,
    precipitation: current.precipitation,
    rainProbability: rainProb,
    isDay: current.is_day === 1,
    time: current.time,
    severeAlert,
  });
});

// API: Multi-Language Translation Endpoint
app.post("/api/translate", async (req, res) => {
  const { text, targetLanguage = "te", targetLanguageName } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  const langCode = targetLanguage.toLowerCase().trim();
  const meta = LANGUAGE_META[langCode] || { name: targetLanguageName || langCode.toUpperCase(), native: langCode };
  const targetName = targetLanguageName || meta.name;

  // 1. Try Gemini
  try {
    const ai = getGeminiClient();
    const result = await withTimeout(
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Translate the following plain-language weather advisory into natural, fluent ${targetName} (${meta.native}). Retain numbers, percentages, weather parameters, and place names clearly. Do NOT add meta commentary, only return the clean translation:\n\n${text}`,
      }),
      6000
    );
    if (result.text && result.text.trim()) {
      return res.json({
        translation: result.text.trim(),
        language: langCode,
        languageName: meta.name,
      });
    }
  } catch (err) {
    // Fallback to high-accuracy multi-language translate
  }

  // 2. High-accuracy fallback
  const fallback = await translateTextFallback(text, langCode);
  if (fallback) {
    return res.json({
      translation: fallback,
      language: langCode,
      languageName: meta.name,
    });
  }

  return res.status(500).json({ error: `Failed to translate to ${meta.name}` });
});

// API: Standalone Telugu translation endpoint (legacy compatibility)
app.post("/api/translate/telugu", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  // Try Gemini 2.5 Flash
  try {
    const ai = getGeminiClient();
    const result = await withTimeout(
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Translate the following plain-language weather advisory into natural, fluent Telugu (తెలుగు). Retain numbers, percentages, and place names clearly. Do NOT add meta commentary, only return the Telugu translation:\n\n${text}`,
      }),
      6000
    );
    if (result.text && result.text.trim()) {
      return res.json({ translation: result.text.trim() });
    }
  } catch (err) {
    // Fallback
  }

  const fallback = await translateToTeluguFallback(text);
  if (fallback) {
    return res.json({ translation: fallback });
  }

  return res.status(500).json({ error: "Failed to translate to Telugu" });
});

// API: Conversational Chat with Tool Calling (Function Calling) + Search Grounding + Telugu Support
app.post("/api/chat", async (req, res) => {
  const { message, activeLocation, history, language = "en" } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  // Detect requested target language
  let targetLangCode = (language || "en").toLowerCase().trim();

  // If query mentions a specific language, switch to it
  const msgLower = message.toLowerCase();
  if (msgLower.includes("telugu") || message.includes("తెలుగు")) targetLangCode = "te";
  else if (msgLower.includes("hindi") || message.includes("हिन्दी") || message.includes("हिंदी")) targetLangCode = "hi";
  else if (msgLower.includes("tamil") || message.includes("தமிழ்")) targetLangCode = "ta";
  else if (msgLower.includes("kannada") || message.includes("ಕನ್ನಡ")) targetLangCode = "kn";
  else if (msgLower.includes("malayalam") || message.includes("മലയാളം")) targetLangCode = "ml";
  else if (msgLower.includes("marathi") || message.includes("मराठी")) targetLangCode = "mr";
  else if (msgLower.includes("bengali") || message.includes("বাংলা")) targetLangCode = "bn";
  else if (msgLower.includes("gujarati") || message.includes("ગુજરાતી")) targetLangCode = "gu";
  else if (msgLower.includes("punjabi") || message.includes("ਪੰਜਾਬੀ")) targetLangCode = "pa";
  else if (msgLower.includes("odia") || message.includes("ଓଡ଼ିଆ")) targetLangCode = "or";
  else if (msgLower.includes("spanish") || message.includes("español")) targetLangCode = "es";
  else if (msgLower.includes("french") || message.includes("français")) targetLangCode = "fr";
  else if (msgLower.includes("arabic") || message.includes("العربية")) targetLangCode = "ar";

  const targetMeta = LANGUAGE_META[targetLangCode] || { name: targetLangCode.toUpperCase(), native: targetLangCode };

  const currentDateStr = new Date().toLocaleString("en-IN", {
    timeZone: activeLocation?.timezone || "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Fallback default location if not provided
  const fallbackDefaultLocation = {
    name: "Hyderabad",
    admin1: "Telangana",
    country: "India",
    country_code: "IN",
    latitude: 17.385,
    longitude: 78.4867,
    timezone: "Asia/Kolkata",
  };

  let resolvedGeo = activeLocation || fallbackDefaultLocation;

  // Check if user specifically typed another city name in the query (e.g. "in Bengaluru", "for Mumbai", "at Kochi")
  const cityMatch = message.match(/\b(?:in|at|for|near|around)\s+([A-Za-z\s]+?)(?:\s+this|\s+tomorrow|\s+today|\s+during|[?.!,]|$)/i);
  if (cityMatch && cityMatch[1]) {
    const rawCity = cityMatch[1].replace(/[^\w\s]/g, "").trim();
    if (rawCity.length >= 2 && !["this", "today", "tomorrow", "my", "the", "a", "our", "telugu"].includes(rawCity.toLowerCase())) {
      const foundGeo = await geocodeLocation(rawCity);
      if (foundGeo) {
        resolvedGeo = foundGeo;
      }
    }
  }

  // Fetch real Open-Meteo weather
  let weatherRaw = null;
  if (resolvedGeo?.latitude && resolvedGeo?.longitude) {
    weatherRaw = await fetchWeatherForecast(resolvedGeo.latitude, resolvedGeo.longitude, resolvedGeo.timezone);
  }

  let toolResult: any = null;
  let toolSummary: any = null;
  let weatherSnapshot: any = null;

  if (weatherRaw && weatherRaw.current && resolvedGeo) {
    const cur = weatherRaw.current;
    const condition = getWeatherDescription(cur.weather_code);
    const hourly = weatherRaw.hourly || {};
    const daily = weatherRaw.daily || {};

    const dailyForecast = [];
    if (daily.time) {
      for (let d = 0; d < Math.min(5, daily.time.length); d++) {
        dailyForecast.push({
          date: daily.time[d],
          maxTemp: Math.round(daily.temperature_2m_max[d]),
          minTemp: Math.round(daily.temperature_2m_min[d]),
          rainProbabilityMax: daily.precipitation_probability_max?.[d] ?? 0,
          precipitationSumMm: daily.precipitation_sum?.[d] ?? 0,
          maxWindKmH: Math.round(daily.wind_speed_10m_max[d]),
          maxGustKmH: Math.round(daily.wind_gusts_10m_max?.[d] ?? daily.wind_speed_10m_max[d]),
          weatherCode: daily.weather_code[d],
          condition: getWeatherDescription(daily.weather_code[d]),
        });
      }
    }

    const adminPart = resolvedGeo.admin1 ? `${resolvedGeo.admin1}, ` : "";
    const countryPart = resolvedGeo.country || "India";
    toolResult = {
      resolvedLocation: `${resolvedGeo.name}, ${adminPart}${countryPart}`,
      current: {
        temperature_c: Math.round(cur.temperature_2m),
        apparent_temperature_c: Math.round(cur.apparent_temperature),
        condition,
        humidity_percent: cur.relative_humidity_2m,
        wind_speed_kmh: Math.round(cur.wind_speed_10m),
        wind_gusts_kmh: Math.round(cur.wind_gusts_10m || cur.wind_speed_10m),
        precipitation_now_mm: cur.precipitation,
      },
      daily_3_day_forecast: dailyForecast.slice(0, 3),
    };

    toolSummary = {
      location: toolResult.resolvedLocation,
      timeframe: "live",
      temp: toolResult.current.temperature_c,
      condition: toolResult.current.condition,
      wind: toolResult.current.wind_speed_kmh,
      humidity: toolResult.current.humidity_percent,
    };

    weatherSnapshot = {
      locationName: resolvedGeo.name,
      admin1: resolvedGeo.admin1,
      country: resolvedGeo.country,
      temp: toolResult.current.temperature_c,
      condition: toolResult.current.condition,
      humidity: toolResult.current.humidity_percent,
      windSpeed: toolResult.current.wind_speed_kmh,
      rainChance: dailyForecast[0]?.rainProbabilityMax || 0,
      sourceTime: currentDateStr,
    };
  }

  const isTargetTelugu = targetLangCode === "te";

  const locationContext = `User's location: ${resolvedGeo.name}${
    resolvedGeo.admin1 ? ", " + resolvedGeo.admin1 : ""
  }${resolvedGeo.country ? ", " + resolvedGeo.country : ""}.`;

  const languagePromptDirective =
    isTargetTelugu
      ? `3. CRITICAL MANDATORY LANGUAGE DIRECTIVE: The user's active interface language is Telugu (తెలుగు).
You MUST formulate and generate your ENTIRE final response directly in natural, fluent Telugu (తెలుగు) script.
DO NOT respond in English. DO NOT output English sentences first.
Every single sentence, practical recommendation, number, and safety precaution MUST be in authentic Telugu script (తెలుగు).`
      : targetLangCode !== "en"
      ? `3. CRITICAL MANDATORY LANGUAGE DIRECTIVE: The user's requested language is ${targetMeta.name} (${targetMeta.native}).
You MUST formulate and output your ENTIRE final response directly in ${targetMeta.name} (${targetMeta.native}) script.
DO NOT respond in English.`
      : `3. LANGUAGE HANDLING: Provide plain-language actionable advice in English.`;

  const sourceCitationMandate = isTargetTelugu
    ? `4. MANDATORY SOURCE CITATION: Every response based on live weather data MUST conclude with:
మూలం: Open-Meteo, ${currentDateStr} IST`
    : `4. MANDATORY SOURCE CITATION: Every response based on live weather data MUST conclude with:
Source: Open-Meteo, ${currentDateStr} IST`;

  const systemInstruction = `You are WeatherGPT, an authoritative conversational weather advisor for users in India and worldwide (farmers, fishers, commuters, disaster managers, and citizens).
Local Time: ${currentDateStr}.
${locationContext}

CRITICAL RULES:
1. TOOL USE MANDATE: For ANY query requiring weather forecast, rain probability, wind safety, or temperature advice, YOU MUST call the \`get_weather\` tool. You are strictly forbidden from inventing, estimating, or hallucinating weather data or statistics.
2. ACTIONABLE & PLAIN LANGUAGE: Explain what the numbers mean practically in 2 to 3 sentences maximum:
   - For Farmers / Pesticide spraying: Pesticide spraying requires calm winds (< 15 km/h) and no rain for at least 24-48 hours. Give a direct yes/no/wait recommendation.
   - For Fishers / Coastal: Warn clearly about high wind speeds (> 35 km/h) or gusts (> 45 km/h).
   - For Commuters: Advise clearly on exact timing of rain or heat precautions.
${languagePromptDirective}
${sourceCitationMandate}`;

  let responseText = "";
  let contentTelugu = "";
  let translatedContent: any = undefined;
  let groundingSources: any[] = [];

  // Try calling Gemini API with function calling
  try {
    const ai = getGeminiClient();

    const contents: any[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const item of history.slice(-4)) {
        if (item.role === "user" || item.role === "assistant") {
          contents.push({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.content }],
          });
        }
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const candidateModels = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

    for (const modelName of candidateModels) {
      try {
        const response1 = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: 0.2,
              tools: [{ functionDeclarations: [getWeatherDeclaration] }],
            },
          }),
          8000
        );

        const functionCalls = response1.functionCalls;

        if (functionCalls && functionCalls.length > 0 && toolResult) {
          const toolCall = functionCalls[0];
          const response2 = await withTimeout(
            ai.models.generateContent({
              model: modelName,
              contents: [
                ...contents,
                response1.candidates?.[0]?.content as any,
                {
                  role: "tool",
                  parts: [
                    {
                      functionResponse: {
                        name: toolCall.name,
                        response: toolResult,
                      },
                    },
                  ],
                },
              ],
              config: {
                systemInstruction,
                temperature: 0.2,
              },
            }),
            8000
          );
          responseText = response2.text || "";
        } else {
          responseText = response1.text || "";
        }

        if (responseText) {
          break;
        }
      } catch (err: any) {
        // Silently fall through to next candidate model or synthesis fallback
      }
    }
  } catch (error: any) {
    // Pipeline fallback
  }

  // Resilient fallback using grounded Open-Meteo tool result if Gemini was unavailable or timed out
  if (!responseText && toolResult && resolvedGeo) {
    responseText = synthesizePlainLanguageAdvisory(message, resolvedGeo, toolResult, currentDateStr, isTargetTelugu);
  }

  // Ensure source citation is appended if not present
  if (weatherSnapshot) {
    const hasSource =
      responseText.toLowerCase().includes("source: open-meteo") ||
      responseText.includes("మూలం: Open-Meteo") ||
      responseText.includes("Open-Meteo");
    if (!hasSource) {
      const citeStr = isTargetTelugu
        ? `\n\nమూలం: Open-Meteo, ${currentDateStr} IST`
        : `\n\nSource: Open-Meteo, ${currentDateStr} IST`;
      responseText = `${responseText.trim()}${citeStr}`;
    }
  }

  // Check if Search Grounding is appropriate for live meteorological bulletins / alerts
  if (
    message.toLowerCase().includes("cyclone") ||
    message.toLowerCase().includes("monsoon") ||
    message.toLowerCase().includes("imd alert") ||
    message.toLowerCase().includes("news")
  ) {
    try {
      const ai = getGeminiClient();
      const searchRes = await withTimeout(
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Provide a 1-sentence current news bulletin status about: ${message} in ${resolvedGeo.name}, India.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        }),
        6000
      );
      const chunks = searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks && Array.isArray(chunks)) {
        groundingSources = chunks
          .filter((c: any) => c.web?.uri && c.web?.title)
          .map((c: any) => ({
            title: c.web.title,
            uri: c.web.uri,
          }));
      }
    } catch (err) {
      // Search grounding optional
    }
  }

  // Check whether the response already contains Telugu script
  const hasTeluguScript = /[\u0C00-\u0C7F]/.test(responseText);
  if (isTargetTelugu && hasTeluguScript) {
    contentTelugu = responseText;
  }

  // If user requested a non-English language and responseText is not in target script, translate
  if (targetLangCode !== "en" && (!isTargetTelugu || !hasTeluguScript)) {
    let translatedText = "";
    try {
      const ai = getGeminiClient();
      const transRes = await withTimeout(
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Translate this weather advisory directly into natural, clear, fluent ${targetMeta.name} (${targetMeta.native}) script. Retain numbers, percentages, weather metrics, and locations clearly. Do not add meta remarks, only provide the direct translation:\n\n${responseText}`,
        }),
        6000
      );
      if (transRes.text && transRes.text.trim()) {
        translatedText = transRes.text.trim();
      }
    } catch (e) {
      // Fallback
    }

    if (!translatedText) {
      const fb = await translateTextFallback(responseText, targetLangCode);
      if (fb) translatedText = fb;
    }

    if (translatedText) {
      translatedContent = {
        language: targetLangCode,
        languageName: targetMeta.name,
        text: translatedText,
      };
      if (targetLangCode === "te") {
        contentTelugu = translatedText;
      }
    }
  }

  // When target language is Telugu or other non-English language, the primary reply MUST be in the requested language
  let finalReply = responseText;
  if (isTargetTelugu) {
    if (contentTelugu) {
      finalReply = contentTelugu;
    } else if (hasTeluguScript) {
      finalReply = responseText;
      contentTelugu = responseText;
    } else {
      // Direct synthesis fallback in Telugu
      finalReply = synthesizePlainLanguageAdvisory(message, resolvedGeo, toolResult, currentDateStr, true);
      contentTelugu = finalReply;
    }
  } else if (targetLangCode !== "en") {
    if (translatedContent?.text) {
      finalReply = translatedContent.text;
    }
  }

  return res.json({
    reply: finalReply || (isTargetTelugu ? "వాతావరణ సమాచారం ప్రస్తుతం అందుబాటులో లేదు. దయచేసి మళ్లీ ప్రయత్నించండి." : "Weather data is currently unavailable. Please verify your location and try again."),
    englishReply: responseText !== finalReply ? responseText : undefined,
    contentTelugu: contentTelugu || (isTargetTelugu ? finalReply : undefined),
    translatedContent: translatedContent || (targetLangCode !== "en" ? {
      language: targetLangCode,
      languageName: targetMeta.name,
      text: finalReply
    } : undefined),
    toolSummary,
    weatherSnapshot,
    groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
  });
});

// Helper for agronomic crop advisory synthesis (fallback or direct)
function synthesizeCropAdvisoryFallback(
  crop: string,
  geo: any,
  cur: any,
  daily: any[],
  currentDateStr: string,
  isTelugu: boolean
): { english: string; telugu: string } {
  const today = daily[0] || {};
  const tomorrow = daily[1] || today;
  const rainProb = today.rainProbabilityMax ?? 0;
  const rainSum = today.precipitationSumMm ?? 0;
  const maxWind = Math.round(today.maxWindKmH || cur.wind_speed_10m || 10);
  const maxTemp = Math.round(today.maxTemp || cur.temperature_2m || 30);
  const minTemp = Math.round(today.minTemp || 22);
  const curTemp = Math.round(cur.temperature_2m);
  const curHumidity = cur.relative_humidity_2m;
  const condition = getWeatherDescription(cur.weather_code);

  const english = `🌱 Crop: ${crop}

🌦️ Weather:
Currently ${condition.toLowerCase()} at ${curTemp}°C with ${curHumidity}% humidity in ${geo.name}. Over the next 3 days, maximum temperatures will reach ${maxTemp}°C and lows around ${minTemp}°C. Peak rain chance is ${rainProb}% (estimated ${rainSum} mm).

💧 Irrigation:
${
  rainProb >= 50 || rainSum >= 5
    ? `Postpone irrigation for ${crop}. Expected rainfall of ${rainSum} mm and high soil moisture will meet root requirements. Ensure field drainage channels are clear to prevent water stagnation.`
    : maxTemp >= 36
    ? `Maintain timely light irrigation during early morning or late evening hours to combat heat stress and avoid rapid evaporation.`
    : `Adequate soil moisture is present. Maintain regular irrigation schedule according to the current vegetative/grain filling stage.`
}

🌧️ Rain:
${
  rainProb >= 40
    ? `Rain likelihood is elevated (${rainProb}%). Delay open fertilizer top-dressing and chemical sprays to prevent nutrient runoff.`
    : `Low chance of rain (${rainProb}%). Field access will remain dry and suitable for machinery or manual operations.`
}

🌾 Field Activities:
${
  maxWind > 15
    ? `Wind gusts are around ${maxWind} km/h. Avoid foliar pesticide or herbicide spraying today to prevent spray drift. Good window for weeding or border bund maintenance.`
    : rainProb < 30
    ? `Favorable window: Calm winds (${maxWind} km/h) and dry skies make today ideal for protective spraying, weeding, and intercultural operations.`
    : `Hold off on spraying until skies clear. Focus on inspecting crop stands for water accumulation and bund integrity.`
}

⚠️ Risks:
${
  curHumidity > 80 && maxTemp > 30
    ? `High humidity (${curHumidity}%) combined with warm temperatures creates favorable microclimate for fungal/bacterial leaf spot and blast. Monitor field margins closely.`
    : maxWind > 30
    ? `Brisk winds up to ${maxWind} km/h may pose lodging risk for mature tall stands. Secure support if needed.`
    : `No extreme weather hazards detected. Continue standard surveillance.`
}

📅 Recommendation:
${
  rainProb >= 50
    ? `Prioritize drainage preparedness today; suspend pesticide applications and check field bunds for ${crop}.`
    : `Carry out planned field weeding and scheduled nutrient applications during morning hours while temperatures are mild.`
}

ℹ️ Note: Weather data is sourced from Open-Meteo (${currentDateStr} IST). AI recommendations provide general weather-guided agronomic timing and do not constitute disease diagnosis or yield guarantees. For critical farm management decisions, consult your local Agricultural Extension Officer or Krishi Vigyan Kendra (KVK).`;

  const telugu = `🌱 పంట: ${crop}

🌦️ వాతావరణం:
ప్రస్తుతం ${geo.name} లో వాతావరణం ${curTemp}°C మరియు ${curHumidity}% తేమతో ఉంది. రాబోయే 3 రోజుల్లో గరిష్ట ఉష్ణోగ్రత ${maxTemp}°C, కనిష్ట ఉష్ణోగ్రత ${minTemp}°C గా నమోదయ్యే అవకాశం ఉంది. గరిష్ట వర్ష సూచన ${rainProb}% (${rainSum} మి.మీ).

💧 నీటిపారుదల:
${
  rainProb >= 50 || rainSum >= 5
    ? `${crop} పంటకు నీటిపారుదల వాయిదా వేయండి. వర్షపాతం కారణంగా నేలలో తగినంత తేమ ఉంటుంది. మురుగునీరు నిల్వ ఉండకుండా కాలువలను సరిచూసుకోండి.`
    : maxTemp >= 36
    ? `ఎండ తీవ్రత ఎక్కువగా ఉన్నందున ఉదయం లేదా సాయంత్రం వేళల్లో తేలికపాటి నీటితడులు ఇవ్వడం శ్రేయస్కరం.`
    : `నేలలో సాధారణ తేమ ఉంది. ప్రస్తుత పైరు దశకు తగినట్లుగా సాధారణ నీటిపారుదలని కొనసాగించండి.`
}

🌧️ వర్షం:
${
  rainProb >= 40
    ? `వర్షం పడే అవకాశం (${rainProb}%) ఉంది. ఎరువులు చల్లడం మరియు పిచికారీ చేయడం తాత్కాలికంగా ఆపండి.`
    : `వర్ష సూచన తక్కువగా (${rainProb}%) ఉంది. పొలం పనులకు వాతావరణం అనుకూలంగా ఉంటుంది.`
}

🌾 పొలం పనులు:
${
  maxWind > 15
    ? `గాలి వేగం ${maxWind} km/h గా ఉన్నందున పురుగుమందుల పిచికారీని వాయిదా వేయండి. కలుపుతీత పనులకు అనుకూలం.`
    : rainProb < 30
    ? `అనుకూలమైన సమయం: తక్కువ గాలి వేగం (${maxWind} km/h) మరియు పొడి వాతావరణం ఉన్నందున ఎరువులు, మందుల పిచికారీ పనులను చేపట్టవచ్చు.`
    : `ఆకాశం నిర్మలంగా ఉండే వరకు పిచికారీ చేయవద్దు. గట్ల పటిష్టతను పరిశీలించండి.`
}

⚠️ ప్రమాదాలు & జాగ్రత్తలు:
${
  curHumidity > 80 && maxTemp > 30
    ? `అధిక తేమ (${curHumidity}%) మరియు ఉష్ణోగ్రతల వల్ల ఆకుమచ్చ లేదా బూజు తెగుళ్లు ఆశించే అవకాశం ఉంది. పంటను నిశితంగా గమనించండి.`
    : `ప్రస్తుతానికి తీవ్రమైన వాతావరణ హెచ్చరికలు లేవు. సాధారణ సస్యరక్షణ చర్యలు పాటించండి.`
}

📅 సలహా & సూచన:
${
  rainProb >= 50
    ? `వర్షపు నీరు నిలవకుండా జాగ్రత్తపడండి; పిచికారీ పనులను వర్షం తగ్గేంత వరకు ఆపండి.`
    : `ఉదయం వేళల్లో అనుకూలమైన వాతావరణంలో అవసరమైన ఎరువులు లేదా సస్యరక్షణ చర్యలను పూర్తి చేసుకోండి.`
}

ℹ️ గమనిక: వాతావరణ సమాచారం Open-Meteo (${currentDateStr} IST) నుండి తీసుకోబడింది. ఈ AI సలహాలు వాతావరణ మార్పులకు అనుగుణంగా ఇచ్చే సాధారణ సూచనలు మాత్రమే; మొక్కల వ్యాధి నిర్ధారణ కాదు. ఖచ్చితమైన వ్యవసాయ నిర్ణయాలకు స్థానిక కృషి విజ్ఞాన కేంద్రం (KVK) లేదా వ్యవసాయ విస్తరణ అధికారులను సంప్రదించండి.`;

  return { english, telugu };
}

// API: Crop-Aware Farmer Recommendation Flow
app.post("/api/crop-advisory", async (req, res) => {
  const { crop, activeLocation, language, customQuestion } = req.body || {};

  if (!crop || typeof crop !== "string" || !crop.trim()) {
    return res.status(400).json({ error: "Crop type is required" });
  }

  const cleanCrop = crop.trim();
  const langCode = (language || "en").toLowerCase();
  const isTelugu = langCode === "te";

  // Fallback default location if not provided
  const fallbackLocation = {
    name: "Hyderabad",
    admin1: "Telangana",
    country: "India",
    country_code: "IN",
    latitude: 17.385,
    longitude: 78.4867,
    timezone: "Asia/Kolkata",
  };

  const resolvedGeo = activeLocation || fallbackLocation;
  const currentDateStr = new Date().toLocaleString("en-IN", {
    timeZone: resolvedGeo.timezone || "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Fetch real Open-Meteo telemetry
  let weatherRaw: any = null;
  if (resolvedGeo.latitude && resolvedGeo.longitude) {
    weatherRaw = await fetchWeatherForecast(
      resolvedGeo.latitude,
      resolvedGeo.longitude,
      resolvedGeo.timezone
    );
  }

  if (!weatherRaw || !weatherRaw.current) {
    return res.status(502).json({
      error: "Could not fetch current weather for agricultural telemetry",
    });
  }

  const cur = weatherRaw.current;
  const daily = weatherRaw.daily || {};
  const dailyForecast: any[] = [];
  if (daily.time) {
    for (let d = 0; d < Math.min(5, daily.time.length); d++) {
      dailyForecast.push({
        date: daily.time[d],
        maxTemp: Math.round(daily.temperature_2m_max[d]),
        minTemp: Math.round(daily.temperature_2m_min[d]),
        rainProbabilityMax: daily.precipitation_probability_max?.[d] ?? 0,
        precipitationSumMm: daily.precipitation_sum?.[d] ?? 0,
        maxWindKmH: Math.round(daily.wind_speed_10m_max[d]),
        weatherCode: daily.weather_code[d],
        condition: getWeatherDescription(daily.weather_code[d]),
      });
    }
  }

  // Synthesize default fallback advisory
  const fallbackAdvisory = synthesizeCropAdvisoryFallback(
    cleanCrop,
    resolvedGeo,
    cur,
    dailyForecast,
    currentDateStr,
    isTelugu
  );

  let advisoryEnglish = fallbackAdvisory.english;
  let advisoryTelugu = fallbackAdvisory.telugu;

  // Prompt Gemini AI for crop-specific agronomic advice
  try {
    const ai = getGeminiClient();

    const cropPrompt = `You are the Agricultural Weather Intelligence specialist in WeatherGPT.
Generate practical, weather-grounded recommendations for a farmer growing: "${cleanCrop}".

Context:
User Location: ${resolvedGeo.name}, ${resolvedGeo.admin1 || ""}, ${resolvedGeo.country || "India"}
Local Time: ${currentDateStr} IST
Crop: ${cleanCrop}
${customQuestion ? `Farmer's specific question: "${customQuestion}"` : ""}

Current Weather Telemetry:
- Temperature: ${Math.round(cur.temperature_2m)}°C (Feels like: ${Math.round(cur.apparent_temperature)}°C)
- Relative Humidity: ${cur.relative_humidity_2m}%
- Wind Speed: ${Math.round(cur.wind_speed_10m)} km/h (Gusts: ${Math.round(cur.wind_gusts_10m || cur.wind_speed_10m)} km/h)
- Condition: ${getWeatherDescription(cur.weather_code)}
- Precipitation now: ${cur.precipitation} mm

3-Day Daily Forecast:
${dailyForecast
  .slice(0, 3)
  .map(
    (df, i) =>
      `Day ${i + 1} (${df.date}): Max ${df.maxTemp}°C, Min ${df.minTemp}°C, Rain Chance ${df.rainProbabilityMax}%, Rainfall ${df.precipitationSumMm} mm, Wind ${df.maxWindKmH} km/h (${df.condition})`
  )
  .join("\n")}

STRICT OUTPUT FORMAT (You MUST follow this exact structure with these emojis):

🌱 Crop: ${cleanCrop}

🌦️ Weather:
[Current conditions and relevant forecast in ${resolvedGeo.name}]

💧 Irrigation:
[Actionable irrigation advice based on upcoming rainfall, evapotranspiration, and soil moisture needs for ${cleanCrop}]

🌧️ Rain:
[Explain whether upcoming rainfall may affect field activities]

🌾 Field Activities:
[Suggest suitable timing for spraying, fertilizer application, weeding, or field operations based on wind and rain]

⚠️ Risks:
[Mention relevant weather-related risks for ${cleanCrop} like heat stress, waterlogging, or pest/fungal humidity risk]

📅 Recommendation:
[Simple, direct actionable recommendation for today and next few days]

IMPORTANT LEGAL & SAFETY MANDATE:
- Do NOT claim to diagnose plant diseases or guarantee crop yields.
- Clearly distinguish weather telemetry from AI recommendations.
- Always include the following disclaimer at the end:
ℹ️ Note: Weather data is sourced from Open-Meteo (${currentDateStr} IST). AI recommendations provide general weather-guided agronomic timing and do not constitute disease diagnosis or yield guarantees. For critical farm management decisions, consult your local Agricultural Extension Officer or Krishi Vigyan Kendra (KVK).`;

    const candidateModels = ["gemini-2.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
    for (const modelName of candidateModels) {
      try {
        const genRes = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: cropPrompt,
            config: {
              temperature: 0.2,
            },
          }),
          9000
        );

        if (genRes.text && genRes.text.trim()) {
          advisoryEnglish = genRes.text.trim();
          break;
        }
      } catch (e) {
        // Try next candidate
      }
    }

    // If Telugu or another language requested, translate or localize
    if (isTelugu) {
      try {
        const transRes = await withTimeout(
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Translate this crop weather advisory directly into fluent Telugu (తెలుగు).
Keep the exact emoji section headers:
🌱 పంట:
🌦️ వాతావరణం:
💧 నీటిపారుదల:
🌧️ వర్షం:
🌾 పొలం పనులు:
⚠️ ప్రమాదాలు & జాగ్రత్తలు:
📅 సలహా & సూచన:
ℹ️ గమనిక:

Advisory text:
${advisoryEnglish}`,
          }),
          7000
        );

        if (transRes.text && transRes.text.trim()) {
          advisoryTelugu = transRes.text.trim();
        }
      } catch (e) {
        // Fallback Telugu already generated
      }
    }
  } catch (err) {
    console.warn("Gemini Crop Advisory error, using synthesis:", err);
  }

  const weatherSnapshot = {
    locationName: resolvedGeo.name,
    admin1: resolvedGeo.admin1,
    country: resolvedGeo.country,
    temp: Math.round(cur.temperature_2m),
    condition: getWeatherDescription(cur.weather_code),
    humidity: cur.relative_humidity_2m,
    windSpeed: Math.round(cur.wind_speed_10m),
    rainChance: dailyForecast[0]?.rainProbabilityMax || 0,
    sourceTime: currentDateStr,
  };

  return res.json({
    success: true,
    crop: cleanCrop,
    locationName: resolvedGeo.name,
    reply: advisoryEnglish,
    replyTelugu: advisoryTelugu,
    activeLanguageReply: isTelugu ? advisoryTelugu : advisoryEnglish,
    weatherSnapshot,
    timestamp: currentDateStr,
  });
});

// Audio Transcription Endpoint using Gemini Multimodal Audio (Guaranteed Fallback)
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audioData, mimeType, language } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: "Missing audioData" });
    }

    const ai = getGeminiClient();
    const prompt =
      language === "te"
        ? "Transcribe the spoken audio into text in Telugu script (or English if the user speaks English). Output ONLY the transcribed words with no commentary, notes, or quotes."
        : "Transcribe the spoken audio into plain text. Output ONLY the transcribed words with no commentary, notes, conversational text, or quotes.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "audio/webm",
                data: audioData,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
    });

    const transcript = response.text?.trim() || "";
    return res.json({ success: true, transcript });
  } catch (err: any) {
    console.error("Transcribe error:", err);
    return res.status(500).json({ error: "Transcription failed", details: err?.message });
  }
});

// AI Crop Damage & Pest Advisory Endpoint with Multimodal Vision & Weather Intelligence
app.post("/api/crop-damage-analysis", async (req, res) => {
  try {
    const {
      problemDescription,
      imageData,
      imageMimeType,
      crop,
      activeLocation,
      language,
    } = req.body;

    const lat = activeLocation?.latitude || 17.385;
    const lon = activeLocation?.longitude || 78.4867;
    const tz = activeLocation?.timezone || "Asia/Kolkata";

    let currentWeather: any = null;
    let dailyForecast: any[] = [];

    try {
      const weatherData = await fetchWeatherForecast(lat, lon, tz);
      if (weatherData?.current) {
        currentWeather = weatherData.current;
      }
      if (weatherData?.daily?.time) {
        const daily = weatherData.daily;
        for (let d = 0; d < Math.min(5, daily.time.length); d++) {
          dailyForecast.push({
            date: daily.time[d],
            maxTemp: Math.round(daily.temperature_2m_max[d]),
            minTemp: Math.round(daily.temperature_2m_min[d]),
            rainProbabilityMax: daily.precipitation_probability_max?.[d] ?? 0,
            precipitationSumMm: daily.precipitation_sum?.[d] ?? 0,
            maxWindKmH: Math.round(daily.wind_speed_10m_max[d]),
            condition: getWeatherDescription(daily.weather_code[d]),
          });
        }
      }
    } catch (weaErr) {
      console.warn("Weather fetch for crop damage analysis notice:", weaErr);
    }

    const ai = getGeminiClient();
    const result = await runGeminiCropDamageAnalysis(ai, {
      problemDescription,
      imageData,
      imageMimeType,
      crop,
      activeLocation,
      language,
      currentWeather,
      dailyForecast,
    });

    const weatherSnapshot = currentWeather
      ? {
          locationName: activeLocation?.name || "Hyderabad",
          admin1: activeLocation?.admin1 || "",
          country: activeLocation?.country || "India",
          temp: Math.round(currentWeather.temperature_2m),
          condition: getWeatherDescription(currentWeather.weather_code),
          humidity: currentWeather.relative_humidity_2m,
          windSpeed: Math.round(currentWeather.wind_speed_10m),
          rainChance: dailyForecast[0]?.rainProbabilityMax || 0,
          sourceTime: new Date().toISOString(),
        }
      : undefined;

    return res.json({
      ...result,
      weatherSnapshot,
    });
  } catch (err: any) {
    console.error("Crop damage analysis error:", err);
    return res.status(500).json({
      success: false,
      error: "Crop damage analysis failed",
      details: err?.message,
    });
  }
});

// In-memory cache for synthesized TTS audio buffers
const ttsAudioCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();

function cleanTextForTts(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/\bSource:\s*[^\n]+/gi, "")
    .replace(/\bమూలం:\s*[^\n]+/gi, "")
    .replace(/\bस्रोत:\s*[^\n]+/gi, "")
    .replace(/\[View\s+Details\]/gi, "")
    .replace(/[*_~`#]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\n\s*[-•]\s*/g, ", ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function chunkTextForTts(text: string, maxLen = 180): string[] {
  if (text.length <= maxLen) return [text];
  const sentences = text.split(/(?<=[.?!।\n,])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    if ((current + " " + s).trim().length <= maxLen) {
      current = (current + " " + s).trim();
    } else {
      if (current) chunks.push(current);
      if (s.length > maxLen) {
        const words = s.split(" ");
        let subChunk = "";
        for (const w of words) {
          if ((subChunk + " " + w).trim().length <= maxLen) {
            subChunk = (subChunk + " " + w).trim();
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = w;
          }
        }
        current = subChunk;
      } else {
        current = s;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}

// Text-to-Speech API Endpoint (Supports native Telugu 'te', Hindi 'hi', Tamil 'ta', English 'en', etc.)
app.get("/api/tts", async (req, res) => {
  try {
    const rawText = (req.query.text as string) || "";
    const lang = ((req.query.lang as string) || "en").toLowerCase();

    if (!rawText.trim()) {
      return res.status(400).send("No text provided");
    }

    const clean = cleanTextForTts(rawText);
    if (!clean) {
      return res.status(400).send("No speech text after cleaning");
    }

    const cacheKey = `${lang}:${clean}`;
    const cached = ttsAudioCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(cached.buffer);
    }

    const chunks = chunkTextForTts(clean, 180);
    const audioBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk
      )}&tl=${encodeURIComponent(lang)}&client=tw-ob`;

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://translate.google.com/",
        },
      });

      if (!response.ok) {
        throw new Error(`Google TTS responded with status ${response.status}`);
      }

      const arrBuf = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrBuf));
    }

    const combinedBuffer = Buffer.concat(audioBuffers);

    if (ttsAudioCache.size > 200) {
      const firstKey = ttsAudioCache.keys().next().value;
      if (firstKey) ttsAudioCache.delete(firstKey);
    }
    ttsAudioCache.set(cacheKey, {
      buffer: combinedBuffer,
      contentType: "audio/mpeg",
      timestamp: Date.now(),
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(combinedBuffer);
  } catch (err: any) {
    console.error("TTS generation error:", err);
    return res.status(500).json({ error: "Failed to generate TTS audio", details: err?.message });
  }
});

app.post("/api/tts", async (req, res) => {
  req.query.text = req.body.text;
  req.query.lang = req.body.language || req.body.lang;
  return (app as any)._router.handle(req, res);
});

// Create HTTP and WebSocket Server for Live API voice conversation
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/live" });

wss.on("connection", async (clientWs: WebSocket) => {
  console.log("Live Voice WebSocket client connected");

  let geminiLiveSession: any = null;

  try {
    const ai = getGeminiClient();
    geminiLiveSession = await ai.live.connect({
      model: "gemini-2.0-flash-exp",
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction:
          "You are WeatherGPT, a conversational voice assistant providing concise, 1-to-2 sentence spoken weather advice for farmers, fishers, and commuters in India. Keep answers brief, conversational, and direct.",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onclose: () => {
          console.log("Gemini Live session closed");
        },
      },
    });
  } catch (err) {
    console.warn("Could not initiate Gemini Live session (voice fallback mode active):", err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: "Live session unavailable" }));
    }
  }

  clientWs.on("message", (data: any) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.audio && geminiLiveSession) {
        geminiLiveSession.sendRealtimeInput({
          audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
        });
      }
    } catch (err) {
      console.error("Error processing client audio:", err);
    }
  });

  clientWs.on("close", () => {
    console.log("Live WebSocket client disconnected");
    if (geminiLiveSession) {
      try {
        geminiLiveSession.close();
      } catch (e) {}
    }
  });
});

// Vite Middleware for SPA Development & Production Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`WeatherGPT server running on http://0.0.0.0:${PORT}`);
  });

  const handleShutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      console.log("WeatherGPT HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

startServer();
