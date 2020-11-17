CREATE TYPE notice_status AS ENUM (
  'unverified',
  'available',
  'reserved',
  'used'
);

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY NOT NULL DEFAULT GEN_RANDOM_UUID(),
  nonce TEXT NULL,
  created_at DATE NOT NULL DEFAULT CURRENT_DATE,
  self_isolation_end_date DATE,
  status notice_status NOT NULL DEFAULT 'unverified',

  CONSTRAINT if_verified_self_isolation_end_date_not_null
   CHECK ((status = 'unverified') OR (self_isolation_end_date IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS notices_nonce ON notices(nonce);
CREATE INDEX IF NOT EXISTS notices_status ON notices(status);