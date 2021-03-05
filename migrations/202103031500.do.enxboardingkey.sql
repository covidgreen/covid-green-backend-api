ALTER TABLE enx_onboarding_requests 
  ALTER COLUMN event_date SET DATA TYPE TIMESTAMPTZ,
  ADD UNIQUE (event_date);