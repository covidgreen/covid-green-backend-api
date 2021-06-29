CREATE TABLE IF NOT EXISTS dcc_stats (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  event_date TIMESTAMPTZ NOT NULL,
  app_location TEXT NOT NULL,
  cert_type TEXT NOT NULL,
  scan_passed BOOLEAN NOT NULL,
  failure_reason TEXT,
  issuing_country TEXT NOT NULL,
  uvci TEXT
);

CREATE INDEX IF NOT EXISTS dcc_stats_date ON dcc_stats(event_date);
