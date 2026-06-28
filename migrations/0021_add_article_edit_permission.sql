ALTER TABLE users ADD COLUMN can_edit_articles INTEGER NOT NULL DEFAULT 0;

UPDATE users
SET can_edit_articles = 1,
    updated_at = unixepoch()
WHERE lower(email) = 'andresasnicar@gmail.com'
  AND role <> 'admin';
