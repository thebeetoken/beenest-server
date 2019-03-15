CREATE TABLE `credit_ledger` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50),
  `booking_id` varchar(50),
  `debit_amount_usd` decimal(11, 2),
  `credit_amount_usd` decimal(11, 2),
  `meta` json,
  `expires_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;