ALTER TABLE verifications ADD COLUMN test_type TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE upload_tokens ADD COLUMN test_type TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE exposures ADD COLUMN test_type TEXT NOT NULL DEFAULT 'confirmed';
