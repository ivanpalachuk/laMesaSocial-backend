CREATE TABLE `home_banners` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `eyebrow` text,
  `description` text,
  `image_key` text NOT NULL,
  `cta_label` text,
  `cta_href` text,
  `starts_at` integer,
  `expires_at` integer,
  `is_active` integer DEFAULT 1 NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `home_banners_visibility_idx` ON `home_banners` (`is_active`, `starts_at`, `expires_at`, `sort_order`);
