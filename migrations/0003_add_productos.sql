CREATE TABLE `productos` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `category` text NOT NULL DEFAULT 'otros',
  `condition` text NOT NULL DEFAULT 'nuevo',
  `min_players` integer NOT NULL DEFAULT 2,
  `max_players` integer NOT NULL DEFAULT 4,
  `min_age` integer NOT NULL DEFAULT 8,
  `estimated_minutes` integer NOT NULL DEFAULT 60,
  `publisher` text,
  `price` integer NOT NULL DEFAULT 0,
  `stock` integer NOT NULL DEFAULT 1,
  `image_key` text,
  `status` text NOT NULL DEFAULT 'available',
  `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
