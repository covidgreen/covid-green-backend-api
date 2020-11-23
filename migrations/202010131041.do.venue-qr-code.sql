CREATE TABLE IF NOT EXISTS email_addresses (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email_address TEXT NOT NULL,
  verification_code TEXT NULL
);

CREATE TABLE IF NOT EXISTS risky_venues (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  venue_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS venue_types (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  name TEXT NOT NULL,
  details TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qr_code (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  venue_type TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  venue_address TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL
);

DELETE FROM venue_types;
INSERT INTO venue_types (name, details)
VALUES
  ('Accommodation', 'For example, hotels, bed & breakfast accommodation and campsites'),
  ('Medical facility', 'For example, hospitals, GP practices and veterinary clinics'),
  ('Non-residential institutions', 'For example, community ceonters, libraries, crematoria and funeral homes'),
  ('Personal care', 'For example, hair salons and barbers, spas and beauty salons');
