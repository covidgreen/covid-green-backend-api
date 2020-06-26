CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS check_ins (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at DATE NOT NULL DEFAULT CURRENT_DATE,
  sex TEXT NULL,
  ok BOOL NOT NULL,
  payload JSON NOT NULL,
  age_range TEXT NULL,
  locality TEXT NULL
);

CREATE TABLE IF NOT EXISTS exposure_export_files (
  id SERIAL NOT NULL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  path TEXT NOT NULL,
  exposure_count INT NOT NULL,
  last_exposure_id INT NOT NULL
);

CREATE TABLE IF NOT EXISTS exposures (
  id SERIAL NOT NULL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  key_data TEXT NOT NULL CONSTRAINT exposures_key_data_unique UNIQUE,
  rolling_start_number INT NOT NULL,
  transmission_risk_level INT NOT NULL,
  rolling_period INT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  event TEXT NOT NULL,
  os TEXT NOT NULL,
  version TEXT NOT NULL,
  value INT DEFAULT 0,
  PRIMARY KEY (date, event, os, version)
);

CREATE TABLE IF NOT EXISTS metrics_requests (
  reg_id UUID NOT NULL,
  event TEXT NOT NULL,
  last_request TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (reg_id, event)
);

CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  refresh TEXT NULL,
  last_verification_attempt TIMESTAMPTZ NULL,
  last_check_in DATE NULL,
  nonce TEXT NULL,
  last_callback TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  settings_key TEXT NOT NULL,
  settings_value TEXT NOT NULL,
  UNIQUE (settings_key)
);

CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_tokens (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reg_id UUID NOT NULL,
  onset_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  control TEXT NOT NULL,
  code TEXT NOT NULL,
  last_attempt TIMESTAMPTZ NULL,
  onset_date DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS check_ins_created_at_idx ON check_ins (created_at);
CREATE INDEX IF NOT EXISTS check_ins_ok_idx ON check_ins (ok);
CREATE INDEX IF NOT EXISTS exposures_key_data_idx ON exposures (key_data);
CREATE INDEX IF NOT EXISTS metrics_date ON metrics (date);
CREATE INDEX IF NOT EXISTS metrics_event ON metrics (event);
CREATE INDEX IF NOT EXISTS metrics_os ON metrics (os);
CREATE INDEX IF NOT EXISTS metrics_version ON metrics (version);
CREATE INDEX IF NOT EXISTS registrations_last_check_in_idx ON registrations (last_check_in);
CREATE INDEX IF NOT EXISTS registrations_nonce_idx ON registrations (nonce);
CREATE INDEX IF NOT EXISTS tokens_type_idx ON tokens (type);
CREATE INDEX IF NOT EXISTS upload_tokens_reg_id_idx ON upload_tokens (reg_id);
CREATE INDEX IF NOT EXISTS verifications_code_idx ON verifications (code);
CREATE INDEX IF NOT EXISTS verifications_control_idx ON verifications (control);
CREATE INDEX IF NOT EXISTS verifications_created_at_idx ON verifications (created_at);
CREATE INDEX IF NOT EXISTS verifications_last_attempt_idx ON verifications (last_attempt);
