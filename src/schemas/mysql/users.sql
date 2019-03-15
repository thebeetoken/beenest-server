CREATE TABLE `users` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `wallet_address` varchar(50) DEFAULT NULL,
  `profile_pic_url` varchar(255) DEFAULT NULL,
  `about` longtext,
  `support_email` varchar(255) DEFAULT NULL,
  `completed_verification` tinyint(4) DEFAULT '0',
  `listing_count` int(11) NOT NULL DEFAULT '0',
  `meta` json DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

