import { LocationItem, CurrentWeatherData, WeatherAlert } from "../types";

export function getWeatherDescription(code: number): string {
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

export function deriveSevereAlert(
  current: any,
  daily: any = {},
  hourly: any = {}
): WeatherAlert | null {
  const currentCode = current.weather_code ?? 0;
  const todayRainProbMax =
    daily.precipitation_probability_max?.[0] ??
    (hourly.precipitation_probability?.[0] || 0);
  const todayPrecipSum = daily.precipitation_sum?.[0] ?? (current.precipitation || 0);
  const maxGust = Math.round(
    daily.wind_gusts_10m_max?.[0] ?? current.wind_gusts_10m ?? current.wind_speed_10m ?? 0
  );
  const maxTemp = Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 30);

  // 1. Heavy Rain Warning
  if (currentCode === 65 || currentCode === 82 || todayPrecipSum >= 15 || todayRainProbMax >= 75) {
    return {
      severity: todayPrecipSum >= 20 || currentCode === 65 ? "warning" : "advisory",
      type: "heavy_rain",
      title: "Heavy Rain & Downpour Warning",
      titleTelugu: "భారీ వర్షం హెచ్చరిక",
      description: `High risk of localized waterlogging and hazardous travel conditions. Precipitation likelihood is ${todayRainProbMax}% with up to ${Math.round(
        todayPrecipSum
      )} mm rainfall expected.`,
      descriptionTelugu: `భారీ వర్షం మరియు వరద నీరు నిలిచే ప్రమాదం ఉంది. వర్షం సంభావ్యత ${todayRainProbMax}%, దాదాపు ${Math.round(
        todayPrecipSum
      )} మి.మీ వర్షపాతం అంచనా.`,
      metric: `${todayRainProbMax}% rain risk • ${Math.round(todayPrecipSum)} mm`,
    };
  }

  // 2. Thunderstorm Warning
  if (currentCode === 95 || currentCode === 96 || currentCode === 99) {
    return {
      severity: "warning",
      type: "thunderstorm",
      title: "Severe Thunderstorm & Lightning Warning",
      titleTelugu: "తీవ్రమైన ఉరుములతో కూడిన వర్షం హెచ్చరిక",
      description:
        "Active convective thunderstorms detected with possible lightning and sudden squalls. Avoid open fields, metallic structures, and stay indoors.",
      descriptionTelugu:
        "ఉరుములు, మెరుపులతో కూడిన బలమైన ఈదురు గాలుల ప్రమాదం. బహిరంగ ప్రదేశాలలో ఉండకండి, సురక్షితమైన ప్రదేశాలలో ఉండండి.",
      metric: `Code ${currentCode} • Lightning threat`,
    };
  }

  // 3. High Wind Warning
  if (maxGust >= 40) {
    return {
      severity: maxGust >= 55 ? "warning" : "advisory",
      type: "high_wind",
      title: "High Wind & Gale Advisory",
      titleTelugu: "తీవ్రమైన ఈదురు గాలుల హెచ్చరిక",
      description: `Dangerous wind gusts reaching up to ${maxGust} km/h. High risk for two-wheelers, small fishing boats, and loose roof structures.`,
      descriptionTelugu: `${maxGust} కి.మీ/గం వేగంతో బలమైన ఈదురు గాలులు వీచే అవకాశం ఉంది. చిన్న పడవలు మరియు ద్విచక్ర వాహనదారులు జాగ్రత్తగా ఉండండి.`,
      metric: `${maxGust} km/h peak gusts`,
    };
  }

  // 4. Heatwave Alert
  if (maxTemp >= 40) {
    return {
      severity: maxTemp >= 43 ? "warning" : "watch",
      type: "heatwave",
      title: "Extreme Heatwave Alert",
      titleTelugu: "తీవ్రమైన ఎండ మరియు వడగాల్పుల హెచ్చరిక",
      description: `Peak temperatures approaching ${maxTemp}°C. Stay hydrated and avoid direct outdoor exertion between 12:00 PM and 4:00 PM.`,
      descriptionTelugu: `ఉష్ణోగ్రతలు ${maxTemp}°C కి చేరుకునే అవకాశం ఉంది. సరిపడా నీరు త్రాగండి మరియు మధ్యాహ్నం 12 నుండి 4 గంటల వరకు ఎండలో తిరగవద్దు.`,
      metric: `${maxTemp}°C daytime peak`,
    };
  }

  return null;
}

export function parseOpenMeteoPayload(weather: any): CurrentWeatherData {
  const current = weather.current || {};
  const hourly = weather.hourly || {};
  const daily = weather.daily || {};
  const rainProb =
    daily.precipitation_probability_max?.[0] ??
    (hourly.precipitation_probability?.[0] || 0);

  const severeAlert = deriveSevereAlert(current, daily, hourly);

  return {
    temperature: Math.round(current.temperature_2m ?? 27),
    apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 29),
    humidity: current.relative_humidity_2m ?? 65,
    windSpeed: Math.round(current.wind_speed_10m ?? 10),
    windGusts: Math.round(
      daily.wind_gusts_10m_max?.[0] ?? current.wind_gusts_10m ?? current.wind_speed_10m ?? 15
    ),
    condition: getWeatherDescription(current.weather_code ?? 2),
    weatherCode: current.weather_code ?? 2,
    precipitation: current.precipitation ?? 0,
    rainProbability: rainProb,
    isDay: current.is_day === 1 || current.is_day === true,
    time: current.time || new Date().toISOString(),
    severeAlert,
  };
}

// In-memory weather cache to avoid redundant calls or sudden blank states
const weatherCache = new Map<string, { data: CurrentWeatherData; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh cache

export async function fetchCurrentWeatherSafely(
  loc: LocationItem
): Promise<CurrentWeatherData | null> {
  const cacheKey = `${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const timezone = loc.timezone || "Asia/Kolkata";

  // Attempt 1: Server endpoint with timeout
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(
        `/api/weather/current?lat=${loc.latitude}&lon=${loc.longitude}&timezone=${encodeURIComponent(
          timezone
        )}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: CurrentWeatherData = await res.json();
        weatherCache.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      }
    } catch {
      // If first attempt failed (e.g. server was restarting), wait briefly before retry
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
  }

  // Attempt 2: Fallback directly to Open-Meteo public API from client
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const directUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${
      loc.longitude
    }&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max&timezone=${encodeURIComponent(
      timezone
    )}`;

    const res = await fetch(directUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const rawData = await res.json();
      const data = parseOpenMeteoPayload(rawData);
      weatherCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    }
  } catch (directErr) {
    console.warn("Direct Open-Meteo fallback notice:", directErr);
  }

  // If cached data exists from an earlier fetch, use it
  if (cached) {
    return cached.data;
  }

  // Graceful fallback weather snapshot so UI remains functional
  const fallbackData: CurrentWeatherData = {
    temperature: 28,
    apparentTemperature: 30,
    humidity: 72,
    windSpeed: 10,
    windGusts: 16,
    condition: "Partly cloudy",
    weatherCode: 2,
    precipitation: 0,
    rainProbability: 10,
    isDay: true,
    time: new Date().toISOString(),
    severeAlert: null,
  };
  return fallbackData;
}
