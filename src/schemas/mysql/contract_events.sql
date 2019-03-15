CREATE TABLE `contract_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `block_number` INT NULL,
  `raw` JSON NULL,
  PRIMARY KEY (`id`));
