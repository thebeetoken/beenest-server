CREATE TABLE `currency_rates` (
  `id` varchar(4) NOT NULL,
  `to_usd` double NOT NULL,
  `updated_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
