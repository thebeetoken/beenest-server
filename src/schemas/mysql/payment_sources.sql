CREATE TABLE `payment_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(60) DEFAULT NULL,
  `provider` varchar(16) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `meta` json DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=latin1;

