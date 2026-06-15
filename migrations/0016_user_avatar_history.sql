ALTER TABLE users ADD COLUMN avatar_image_keys TEXT NOT NULL DEFAULT '[]';

UPDATE users
SET avatar_image_keys = json_array(avatar_image_key)
WHERE avatar_image_key IS NOT NULL;
