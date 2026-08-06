ALTER TABLE `coupons` ADD `maximum_quantity` integer
  CHECK (`maximum_quantity` IS NULL OR `maximum_quantity` > 0);
