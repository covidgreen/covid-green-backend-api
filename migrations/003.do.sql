ALTER TABLE registrations ADD COLUMN IF NOT EXISTS callback_rate_count INTEGER NULL;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS callback_request_total INTEGER NULL;
