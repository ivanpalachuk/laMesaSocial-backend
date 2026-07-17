UPDATE productos
SET status = 'available',
    updated_at = unixepoch()
WHERE status = 'sold_out';
