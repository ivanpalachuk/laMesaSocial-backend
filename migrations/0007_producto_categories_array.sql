ALTER TABLE productos ADD COLUMN categories text NOT NULL DEFAULT '["otros"]';
UPDATE productos SET categories = json_array(category);
ALTER TABLE productos DROP COLUMN category;
