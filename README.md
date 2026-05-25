# Weather Forecast App Technical Assessment

This project is a full-stack weather application built for the PM Accelerator technical assessment. The app allows users to search for real-time weather information, view a 5-day forecast, save weather queries with custom date ranges, manage saved records with CRUD operations, and export saved data.

## What I Built
I built a weather app that supports:

- Searching weather by city, town, landmark, postal/zip code, or GPS coordinates
- Using the browser’s current location to fetch local weather
- Displaying current weather conditions, including temperature, feels-like temperature, humidity, wind, pressure, and weather condition
- Displaying a 5-day forecast using real weather API data
- Saving weather queries with a selected date range
- Creating/Updating/Deleting saved query records
- Reading saved weather query records from the database
- Exporting saved weather records as JSON, CSV, or Markdown
- Viewing extra location resources, including Google Maps, YouTube search, and Wikipedia links
- Handling invalid inputs, failed API requests, and denied geolocation permissions

## Tech Stack
1. Front End
- React
- Vite 
- TypeScript
- TanStack Router
- TanStack Query
- Tailwind CSS
- Lucide React icons
- Bun

2. Back End
- Supabase
- PostgreSQL
_ Open Source APIs

## APIs Used
- OpenStreetMap/Nominatim API for current weather and forecast data
- Open-Meteo Geocoding API for converting user location input into latitude and longitude
- Browser Geolocation API for current location weather
- Google Maps embed/search links for location exploration
- YouTube search links for location-related videos
- Wikipedia search links for location information

## Database
- Supabase is used as the backend service for this project. It provides a hosted PostgreSQL database and an API that allows the frontend to create, read, update, and delete saved weather queries. 
- PostgreSQL is the actual relational database where the weather query records are stored, including the location, coordinates, date range, forecast data, and timestamps.

## How to Run Locally

Clone the repository:

```bash
git clone <your-repo-url>
cd <your-project-folder>
```
Install dependencies:

```bash
bun install
```
Create a .env file in the root directory and add the required Supabase environment variables:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the development server:

```bash
bun run dev
```

Open the local development URL shown in the terminal, usually: http://localhost:3000
