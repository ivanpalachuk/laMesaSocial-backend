ALTER TABLE productos ADD COLUMN image_keys text NOT NULL DEFAULT '[]';
UPDATE productos SET image_keys = json_array(image_key) WHERE image_key IS NOT NULL AND trim(image_key) != '';
