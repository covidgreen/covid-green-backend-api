ALTER TABLE verifications 
ADD COLUMN test_method TEXT NULL;

ALTER TABLE exposures 
ADD COLUMN test_method TEXT NULL;

ALTER TABLE upload_tokens 
ADD COLUMN test_method TEXT NULL;