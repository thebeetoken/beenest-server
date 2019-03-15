CREATE TABLE `listings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `host_name_slug` varchar(50) DEFAULT NULL,
  `host_id` varchar(50) NOT NULL,
  `welcome_message` text,
  `title` varchar(255) NOT NULL,
  `description` text,
  `currency` varchar(3) NOT NULL,
  `listing_pic_url` varchar(255) DEFAULT NULL,
  `physical_address_id` varchar(50) DEFAULT NULL,
  `address_line_1` varchar(255) DEFAULT NULL,
  `address_line_2` varchar(255) DEFAULT NULL,
  `city` varchar(60) DEFAULT NULL,
  `state` varchar(60) DEFAULT NULL,
  `country` varchar(60) DEFAULT NULL,
  `postal_code` varchar(45) DEFAULT NULL,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `max_guests` int(11) DEFAULT NULL,
  `amenities` text,
  `photos` text,
  `accomodations` text,
  `house_rules` text,
  `is_active` tinyint(4) NOT NULL DEFAULT '1',
  `minimum_nights` int(11) NOT NULL DEFAULT '1',
  `price_per_night_usd` double NOT NULL DEFAULT '0',
  `security_deposit_usd` double NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=latin1;

