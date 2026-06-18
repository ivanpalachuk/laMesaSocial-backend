CREATE TABLE `encyclopedia_articles` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `summary` text NOT NULL,
  `content` text NOT NULL,
  `topic` text NOT NULL DEFAULT 'general',
  `related_producto_ids` text NOT NULL DEFAULT '[]',
  `image_key` text,
  `image_keys` text NOT NULL DEFAULT '[]',
  `status` text NOT NULL DEFAULT 'draft',
  `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX `idx_encyclopedia_articles_status` ON `encyclopedia_articles` (`status`);
CREATE INDEX `idx_encyclopedia_articles_topic` ON `encyclopedia_articles` (`topic`);
