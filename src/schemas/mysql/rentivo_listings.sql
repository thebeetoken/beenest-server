CREATE TABLE `rentivo_listings` (
  `id` VARCHAR(255) NOT NULL,
  `host_name_slug` varchar(50) DEFAULT NULL,
  `host_id` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `currency` varchar(3) NOT NULL,
  `price_per_night` double NOT NULL,
  `price_per_night_usd` double NOT NULL,
  `listing_pic_url` varchar(255) DEFAULT NULL,
  `city` varchar(60) DEFAULT NULL,
  `state` varchar(60) DEFAULT NULL,
  `country` varchar(60) DEFAULT NULL,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `max_guests` int(11) DEFAULT NULL,
  `minimum_nights` int(11) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `is_active` tinyint(4) NOT NULL DEFAULT '1',
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

