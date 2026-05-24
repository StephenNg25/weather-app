import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudFog, 
  CloudDrizzle, Wind, Droplets, Gauge, Thermometer, Loader2, MapPin, Search,
  Save, Trash2, Pencil, Download, Map as MapIcon, X 
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

type SavedQuery = {
  id: string;
  location_query: string;
  resolved_name: string;
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  temperatures: Array<{date: string; tMax: number; tMin: number; tMean?: number;}>;
  created_at: string;
  updated_at: string;
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

async function geocode(query: string): Promise<GeoResult> {
  // Coords check: "lat,lon"
  const coordMatch = query.trim().match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`, latitude: lat, longitude: lon };
    }
  }

  // Otherwise, e.g "Toronto"
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
  
  const res = await fetch(url, {
    headers: {"Accept": "application/json",},
  });
  
  if (!res.ok) {
    throw new Error("Location search is unavailable. Try again later.");
  }
  
  const json = await res.json();
  
  if (!json || json.length === 0) {
    throw new Error(`No results found for "${query}". Try a city, postal code, landmark, or "lat,lon".`);
  }
  
  const r = json[0];
  
  return {
    name: r.display_name,
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    country: r.address?.country,
    admin1: r.address?.state || r.address?.province || r.address?.region,
  };
}

async function fetchRangeTemperatures(
  lat: number,
  lon: number,
  startISO: string,
  endISO: string
): Promise<SavedQuery["temperatures"]> {
  const todayISO = new Date().toISOString().slice(0, 10);

  const endpoint =
    endISO < todayISO
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";

  const url =
    `${endpoint}?latitude=${lat}&longitude=${lon}` +
    `&start_date=${startISO}&end_date=${endISO}` +
    `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean` +
    `&timezone=auto&temperature_unit=fahrenheit`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Could not fetch temperatures for that date range.");
  }

  const json = await res.json();

  if (!json.daily?.time) {
    throw new Error("No temperature data found for that range.");
  }

  return json.daily.time.map((date: string, i: number) => ({
    date,
    tMax: json.daily.temperature_2m_max?.[i] ?? null,
    tMin: json.daily.temperature_2m_min?.[i] ?? null,
    tMean: json.daily.temperature_2m_mean?.[i] ?? null,
  }));
}

async function fetchWeather(
  lat: number,
  lon: number,
  label: string
): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=5&temperature_unit=fahrenheit&wind_speed_unit=mph`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Weather service is unavailable. Please try again.");
  }

  const j = await res.json();

  if (!j.current || !j.daily) {
    throw new Error("Received malformed weather data.");
  }

  return {
    location: label,
    current: {
      temp: j.current.temperature_2m,
      feels: j.current.apparent_temperature,
      humidity: j.current.relative_humidity_2m,
      wind: j.current.wind_speed_10m,
      pressure: j.current.pressure_msl,
      code: j.current.weather_code,
      isDay: j.current.is_day,
    },
    daily: j.daily.time.map((date: string, i: number) => ({
      date,
      tMax: j.daily.temperature_2m_max[i],
      tMin: j.daily.temperature_2m_min[i],
      code: j.daily.weather_code[i],
      precip: j.daily.precipitation_sum[i],
      windMax: j.daily.wind_speed_10m_max[i],
    })),
  };
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
    const res = await fetch(url);
    const json = await res.json();
    const r = json?.results?.[0];

    if (r) {
      return [r.name, r.admin1, r.country].filter(Boolean).join(", ");
    }
  } catch {
    // Fall back to coordinates if reverse geocoding fails.
  }

  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

function fahrenheitToCelsius(f: number) {
  return ((f - 32) * 5) / 9;
}

function WeatherPage() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<WeatherData | null>(null);
  const [unit, setUnit] = useState<"F" | "C">("F");

  const formatTemp = (tempF: number) => {
    const value = unit === "F" ? tempF : fahrenheitToCelsius(tempF);
    return Math.round(value);
  };
  
  const inactiveUnit = unit === "F" ? "C" : "F";

  const mutation = useMutation({
    mutationFn: async (q: string) => {
      if (!q.trim()) {
        throw new Error("Please enter a location.");
      }

      const geo = await geocode(q);

      const label = [geo.name, geo.admin1, geo.country]
        .filter(Boolean)
        .join(", ");

      return fetchWeather(geo.latitude, geo.longitude, label);
    },
    onSuccess: (d) => setData(d),
  });

  const geoMutation = useMutation({
    mutationFn: async () => {
      if (!("geolocation" in navigator)) {
        throw new Error("Geolocation is not supported by your browser.");
      }
  
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              reject(new Error("Location permission denied."));
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              reject(new Error("Your location is unavailable."));
            } else if (err.code === err.TIMEOUT) {
              reject(new Error("Location request timed out."));
            } else {
              reject(new Error("Could not get your location."));
            }
          },
          { timeout: 10000 }
        );
      });
  
      const label = await reverseGeocode(
        pos.coords.latitude,
        pos.coords.longitude
      );
  
      return fetchWeather(pos.coords.latitude, pos.coords.longitude, label);
    },
    onSuccess: (d) => setData(d),
  });

  const error = mutation.error || geoMutation.error;
  const loading = mutation.isPending || geoMutation.isPending;

  function download(filename: string, mime: string, content: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  
    URL.revokeObjectURL(url);
  }
  
  function toCSV(rows: SavedQuery[]): string {
    const header = [
      "id",
      "location_query",
      "resolved_name",
      "latitude",
      "longitude",
      "start_date",
      "end_date",
      "notes",
      "created_at",
    ];
  
    const escapeValue = (value: unknown) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
  
    return [
      header.join(","),
      ...rows.map((row) =>
        header.map((key) => escapeValue(row[key as keyof SavedQuery])).join(",")
      ),
    ].join("\n");
  }
  
  function toMarkdown(rows: SavedQuery[]): string {
    let output = `# Weather Queries (${rows.length})\n\n`;
  
    for (const row of rows) {
      output += `## ${row.resolved_name}\n`;
      output += `- Query: ${row.location_query}\n`;
      output += `- Coordinates: ${row.latitude}, ${row.longitude}\n`;
      output += `- Date range: ${row.start_date} to ${row.end_date}\n`;
  
      if (row.notes) {
        output += `- Notes: ${row.notes}\n`;
      }
  
      output += `\n| Date | Min °F | Max °F | Mean °F |\n`;
      output += `|---|---:|---:|---:|\n`;
  
      for (const temp of row.temperatures) {
        output += `| ${temp.date} | ${temp.tMin ?? "-"} | ${temp.tMax ?? "-"} | ${temp.tMean ?? "-"} |\n`;
      }
  
      output += `\n`;
    }
  
    return output;
  }

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
            mutation.mutate(query);
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
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            Search
          </button>

          <button
            type="button"
            onClick={() => geoMutation.mutate()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {geoMutation.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <MapPin size={16} />
            )}
            Use my location
          </button>
        </form>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {(error as Error).message}
          </div>
        )}

        {!data && !error && !loading && (
          <div className="mt-10 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            Enter a location above to see the current weather and 5-day forecast.
          </div>
        )}

        {data && (
          <>
            <section className="mt-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin size={14} className="mt-1 shrink-0" />
                    <span className="line-clamp-2 break-words">
                      {data.location}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-4">
                    {iconFor(data.current.code, data.current.isDay, 64)}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold">
                          {formatTemp(data.current.temp)}°{unit}
                        </span>

                        <button
                          type="button"
                          onClick={() => setUnit(inactiveUnit)}
                          className="text-2xl font-semibold text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={`Switch to ${inactiveUnit}`}
                        >
                          / °{inactiveUnit}
                        </button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {WMO[data.current.code] ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-2">
                  <Stat
                    icon={<Thermometer size={16} />}
                    label="Feels like"
                    value={`${formatTemp(data.current.feels)}°${unit}`}
                  />
                  <Stat
                    icon={<Droplets size={16} />}
                    label="Humidity"
                    value={`${data.current.humidity}%`}
                  />
                  <Stat
                    icon={<Wind size={16} />}
                    label="Wind"
                    value={`${Math.round(data.current.wind)} mph`}
                  />
                  <Stat
                    icon={<Gauge size={16} />}
                    label="Pressure"
                    value={`${Math.round(data.current.pressure)} hPa`}
                  />
                </div>
              </div>
            </section>

            {/* Extra: 5-day forecast section */}
            <section className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">5-Day Forecast</h2>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {data.daily.map((d) => {
                  const date = new Date(d.date + "T00:00:00");
                  const day = date.toLocaleDateString(undefined, { weekday: "short" });
                  const md = date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <div
                      key={d.date}
                      className="rounded-lg border bg-card p-4 text-card-foreground"
                    >
                      <div className="text-sm font-medium">{day}</div>
                      <div className="text-xs text-muted-foreground">{md}</div>

                      <div className="my-3 flex justify-center">
                        {iconFor(d.code, 1, 36)}
                      </div>

                      <div className="text-center text-sm">
                        <span className="font-semibold">{formatTemp(d.tMax)}°</span>
                        <span className="text-muted-foreground"> / {formatTemp(d.tMin)}°</span>
                      </div>

                      <div className="mt-2 text-center text-xs text-muted-foreground">
                        {WMO[d.code] ?? "—"}
                      </div>

                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span title="Precipitation">
                          <Droplets size={12} className="inline" />{" "}
                          {d.precip.toFixed(1)}"
                        </span>
                        <span title="Max wind">
                          <Wind size={12} className="inline" /> {Math.round(d.windMax)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            
            <p className="mt-6 text-xs text-muted-foreground">
              Data from OpenStreetMap. No API key required.
            </p>

            <section className="mt-10 border-t pt-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Saved Weather Queries</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Save location and date range searches, then manage them with CRUD actions.
                </p>
              </div>

              <SavedQueries />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SavedQueries() {
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["weather_queries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weather_queries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []) as unknown as SavedQuery[];
    },
  });
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const refreshSavedQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["weather_queries"] });
  };
  if (isLoading) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        Loading saved queries...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Save size={14} />
          New query
        </button>
      </div>
  
      {showForm && (
        <QueryForm
          initial={null}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            refreshSavedQueries();
          }}
        />
      )}
  
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No saved queries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border bg-card p-4 text-card-foreground">
              <div className="flex items-center gap-2 font-semibold">
                <MapPin size={14} />
                {row.resolved_name}
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                Searched as "{row.location_query}" · {row.latitude.toFixed(3)},{" "}
                {row.longitude.toFixed(3)}
              </div>

              <div className="mt-2 text-sm">
                {row.start_date} to {row.end_date} · {row.temperatures.length} day(s)
              </div>

              {row.notes && (
                <div className="mt-1 text-sm italic text-muted-foreground">
                  "{row.notes}"
                </div>
              )}

              {row.temperatures.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[400px] text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-3">Date</th>
                        <th className="py-1 pr-3">Min °F</th>
                        <th className="py-1 pr-3">Max °F</th>
                        <th className="py-1 pr-3">Mean °F</th>
                      </tr>
                    </thead>

                    <tbody>
                      {row.temperatures.map((temp) => (
                        <tr key={temp.date} className="border-t">
                          <td className="py-1 pr-3">{temp.date}</td>
                          <td className="py-1 pr-3">{temp.tMin ?? "—"}</td>
                          <td className="py-1 pr-3">{temp.tMax ?? "—"}</td>
                          <td className="py-1 pr-3">{temp.tMean ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QueryForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: SavedQuery | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [location, setLocation] = useState(initial?.location_query ?? "");
  const [start, setStart] = useState(initial?.start_date ?? today);
  const [end, setEnd] = useState(initial?.end_date ?? in7Days);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!location.trim()) {
        throw new Error("Location is required.");
      }
  
      if (!start || !end) {
        throw new Error("Start and end dates are required.");
      }
  
      if (start > end) {
        throw new Error("End date must be on or after start date.");
      }
  
      const daysApart =
        (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  
      if (daysApart > 366) {
        throw new Error("Date range cannot exceed 366 days.");
      }
  
      const geo = await geocode(location);
      const resolvedName = [geo.name, geo.admin1, geo.country]
        .filter(Boolean)
        .join(", ");
  
      const temperatures = await fetchRangeTemperatures(
        geo.latitude,
        geo.longitude,
        start,
        end
      );
  
      const payload = {
        location_query: location.trim(),
        resolved_name: resolvedName,
        latitude: geo.latitude,
        longitude: geo.longitude,
        start_date: start,
        end_date: end,
        notes: notes.trim() || null,
        temperatures,
      };
  
      const { error } = await supabase.from("weather_queries").insert(payload);
  
      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: onSaved,
  });

  return (
    <div className="mb-4 rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">New weather query</h3>

        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-muted-foreground">
            Location
          </span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder='e.g. "Tokyo", "94103", "CN Tower", or "43.65,-79.38"'
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">Start date</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">End date</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs text-muted-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>

        {saveMutation.error && (
          <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
            {(saveMutation.error as Error).message}
          </div>
        )}
        
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMutation.isPending && <Loader2 className="animate-spin" size={14} />}
          Save
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}