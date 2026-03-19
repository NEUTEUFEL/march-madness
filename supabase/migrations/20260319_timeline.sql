CREATE TABLE IF NOT EXISTS timeline (
  id serial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  team_name text,
  detail jsonb,
  scores jsonb
);
ALTER TABLE timeline ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='timeline' AND policyname='timeline_public_read') THEN
    CREATE POLICY timeline_public_read ON timeline FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='timeline' AND policyname='timeline_public_write') THEN
    CREATE POLICY timeline_public_write ON timeline FOR INSERT WITH CHECK (true);
  END IF;
END $$;
