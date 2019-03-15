CREATE TABLE `bookings` (
  `id` varchar(60) NOT NULL,
  `listing_id` varchar(255) NOT NULL,
  `guest_id` varchar(50) NOT NULL,
  `host_id` varchar(255) NOT NULL,
  `check_in_date` datetime NULL DEFAULT NULL,
  `check_out_date` datetime NULL DEFAULT NULL,
  `status` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `meta` json DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
