CREATE TABLE `encuentro_comments` (
  `id` text PRIMARY KEY NOT NULL,
  `encuentro_id` text NOT NULL,
  `user_id` text NOT NULL,
  `content` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `moderation_note` text,
  `moderated_by` text,
  `moderated_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`encuentro_id`) REFERENCES `encuentros`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `idx_encuentro_comments_encuentro_id` ON `encuentro_comments` (`encuentro_id`);
CREATE INDEX `idx_encuentro_comments_status` ON `encuentro_comments` (`status`);
CREATE INDEX `idx_encuentro_comments_user_id` ON `encuentro_comments` (`user_id`);
