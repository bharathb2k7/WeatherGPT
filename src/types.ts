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
  titleTelugu: string;
  description: string;
  descriptionTelugu: string;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentTelugu?: string;
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
  persona: 'farmer' | 'fisher' | 'citizen' | 'commuter';
  icon: string;
}
