CREATE TABLE IF NOT EXISTS live_scores (
  id serial PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now(),
  games jsonb NOT NULL DEFAULT '[]'
);
ALTER TABLE live_scores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_scores' AND policyname='live_scores_public_read') THEN
    CREATE POLICY live_scores_public_read ON live_scores FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='live_scores' AND policyname='live_scores_public_write') THEN
    CREATE POLICY live_scores_public_write ON live_scores FOR ALL WITH CHECK (true);
  END IF;
END $$;
-- Seed with one row
INSERT INTO live_scores (games) VALUES ('[]') ON CONFLICT DO NOTHING;
