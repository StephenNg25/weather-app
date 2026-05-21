import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: WeatherPage,
});

function WeatherPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Weather</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by city, zip / postal code, landmark, or coordinates.
          </p>
        </header>
      </div>
    </div>
  );
}