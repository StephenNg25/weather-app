
CREATE TABLE public.weather_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_query text NOT NULL,
  resolved_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text,
  temperatures jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date),
  CONSTRAINT valid_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT valid_lon CHECK (longitude BETWEEN -180 AND 180)
);

ALTER TABLE public.weather_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.weather_queries FOR SELECT USING (true);
CREATE POLICY "Public insert" ON public.weather_queries FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON public.weather_queries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete" ON public.weather_queries FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER weather_queries_updated_at
BEFORE UPDATE ON public.weather_queries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX weather_queries_created_at_idx ON public.weather_queries (created_at DESC);
