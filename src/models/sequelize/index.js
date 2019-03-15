const Sequelize = require('sequelize');
const logger = require('../../services/logger');

const appSettings = require('../../../config/settings');
const settings = require('../../../config/sequelize');

logger.info(
  `Sequelize: Connected to ${appSettings.appEnv} ${settings.connection.name} ${
    settings.connection.username
  } ${settings.sequelizeOpts.dialect}`
);

const sequelize = new Sequelize(
  settings.connection.name,
  settings.connection.username,
  settings.connection.password,
  settings.sequelizeOpts
);

const db = {
  sequelize,
  Sequelize,
  PaymentSource: sequelize.import('./PaymentSource'),
  Listing: sequelize.import('./Listing'),
  Conference: sequelize.import('./Conference'),
  ContractEvent: sequelize.import('./ContractEvent'),
  CurrencyRate: sequelize.import('./CurrencyRate'),
  CreditBalance: sequelize.import('./CreditBalance'),
  CreditLedger: sequelize.import('./CreditLedger'),
  Booking: sequelize.import('./Booking'),
  User: sequelize.import('./User'),
  Calendar: sequelize.import('./Calendar'),
  Feedback: sequelize.import('./Feedback'),
  Reservation: sequelize.import('./Reservation'),
  RentivoListing: sequelize.import('./RentivoListing'),
  AgodaListing: sequelize.import('./AgodaListing'),
};

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
