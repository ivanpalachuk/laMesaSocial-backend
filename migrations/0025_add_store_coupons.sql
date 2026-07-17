CREATE TABLE `coupons` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL UNIQUE,
  `discount_type` text NOT NULL CHECK (`discount_type` IN ('percentage', 'fixed')),
  `discount_value` integer NOT NULL CHECK (`discount_value` > 0),
  `minimum_subtotal` integer CHECK (`minimum_subtotal` IS NULL OR `minimum_subtotal` >= 0),
  `maximum_discount` integer CHECK (`maximum_discount` IS NULL OR `maximum_discount` > 0),
  `usage_limit` integer CHECK (`usage_limit` IS NULL OR `usage_limit` > 0),
  `used_count` integer DEFAULT 0 NOT NULL,
  `starts_at` integer,
  `expires_at` integer,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

ALTER TABLE `pedidos` ADD `coupon_code` text;
ALTER TABLE `pedidos` ADD `discount_amount` integer DEFAULT 0 NOT NULL;

CREATE TABLE `coupon_redemptions` (
  `id` text PRIMARY KEY NOT NULL,
  `coupon_id` text NOT NULL REFERENCES `coupons`(`id`) ON DELETE restrict,
  `pedido_id` text NOT NULL UNIQUE REFERENCES `pedidos`(`id`) ON DELETE cascade,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
  `discount_amount` integer NOT NULL,
  `created_at` integer NOT NULL
);

CREATE INDEX `coupon_redemptions_coupon_id_idx` ON `coupon_redemptions` (`coupon_id`);
CREATE INDEX `coupon_redemptions_user_id_idx` ON `coupon_redemptions` (`user_id`);
