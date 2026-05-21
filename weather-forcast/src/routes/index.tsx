import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudFog, 
  CloudDrizzle, Wind, Droplets, Gauge, Thermometer, Loader2, MapPin, Search 
} from "lucide-react";


export const Route = createFileRoute("/")({
  component: WeatherPage,
});

type GeoResult = { name: string; latitude: number; longitude: number; country?: string; admin1?: string };

type WeatherData = {
  location: string;
  current: { temp: number; feels: number; humidity: number; wind: number; pressure: number; code: number; isDay: number;};
  daily: Array<{ date: string; tMax: number; tMin: number; code: number; precip: number; windMax: number }>;
};

const WMO: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  56: "Light freezing drizzle", 57: "Dense freezing drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  66: "Light freezing rain", 67: "Heavy freezing rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  85: "Slight snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm w/ slight hail", 99: "Thunderstorm w/ heavy hail",
};

function iconFor(code: number, isDay = 1, size = 48) {
  const cls = "text-primary";
  const p = { size, className: cls };
  if (code === 0 || code === 1) return <Sun {...p} />;
  if (code === 2) return <Cloud {...p} />;
  if (code === 3) return <Cloud {...p} />;
  if (code === 45 || code === 48) return <CloudFog {...p} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle {...p} />;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain {...p} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <CloudSnow {...p} />;
  if (code >= 95) return <CloudLightning {...p} />;
  return <Cloud {...p} />;
}


function WeatherPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Weather Forecast</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by city, zip / postal code, landmark, or coordinates.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            console.log(query);
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={18}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "Paris", "10001", "Eiffel Tower", "40.71,-74.01"'
              className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Search size={16} />
            Search
          </button>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <MapPin size={16} />
            Use my location
          </button>
        </form>
      </div>
    </div>
  );
}