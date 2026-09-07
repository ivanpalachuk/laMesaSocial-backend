ALTER TABLE productos ADD COLUMN slug TEXT;

-- Build URL-safe slugs one character at a time so existing Spanish titles and
-- repeated punctuation normalize the same way as newly-created products.
WITH RECURSIVE slug_chars(id, source, position, slug) AS (
  SELECT id, trim(title), 1, ''
  FROM productos

  UNION ALL

  SELECT
    id,
    source,
    position + 1,
    slug || CASE
      WHEN lower(substr(source, position, 1)) GLOB '[a-z0-9]'
        THEN lower(substr(source, position, 1))
      WHEN instr('áàäâãåÁÀÄÂÃÅ', substr(source, position, 1)) > 0 THEN 'a'
      WHEN instr('éèëêÉÈËÊ', substr(source, position, 1)) > 0 THEN 'e'
      WHEN instr('íìïîÍÌÏÎ', substr(source, position, 1)) > 0 THEN 'i'
      WHEN instr('óòöôõÓÒÖÔÕ', substr(source, position, 1)) > 0 THEN 'o'
      WHEN instr('úùüûÚÙÜÛ', substr(source, position, 1)) > 0 THEN 'u'
      WHEN instr('ñÑ', substr(source, position, 1)) > 0 THEN 'n'
      WHEN instr('çÇ', substr(source, position, 1)) > 0 THEN 'c'
      WHEN slug = '' OR substr(slug, -1) = '-' THEN ''
      ELSE '-'
    END
  FROM slug_chars
  WHERE position <= length(source)
),
base_slugs AS (
  SELECT
    id,
    CASE trim(slug, '-') WHEN '' THEN 'juego' ELSE trim(slug, '-') END AS base_slug
  FROM slug_chars
  WHERE position > length(source)
),
ranked_slugs AS (
  SELECT
    id,
    base_slug,
    row_number() OVER (PARTITION BY base_slug ORDER BY id) AS slug_rank
  FROM base_slugs
)
UPDATE productos
SET slug = (
  SELECT base_slug || CASE WHEN slug_rank = 1 THEN '' ELSE '-' || slug_rank END
  FROM ranked_slugs
  WHERE ranked_slugs.id = productos.id
);

CREATE UNIQUE INDEX productos_slug_unique ON productos(slug COLLATE NOCASE);
