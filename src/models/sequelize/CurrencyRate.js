const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {

  const CurrencyRate = sequelize.define(
    'currency_rate',
    {
      id: {
        type: DataTypes.CHAR(3),
        primaryKey: true,
      },
      toUsd: {
        type: DataTypes.DOUBLE,
        field: 'to_usd'
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
      }
    },
    {
      tableName: 'currency_rates',
      freezeTableName: true,
      timestamps: false,
    }
  );

  CurrencyRate.BEE = 'BEE';
  CurrencyRate.BTC = 'BTC';
  CurrencyRate.ETH = 'ETH';
  CurrencyRate.USD = 'USD';

  CurrencyRate.prototype.convertFromUsd = function (value) {
    if (!value) {
      return 0;
    }
    if (!this.toUsd) {
      throw new Error('No conversion rate found.');
    }

    if (this.id === CurrencyRate.BEE) {
      return parseInt(value / this.toUsd, 10);
    }

    return value / this.toUsd;
  }

  CurrencyRate.prototype.convertToUsd = function (value) {
    if (!value) {
      return 0;
    }
    if (!this.toUsd) {
      throw new Error('No conversion rate found.');
    }

    if (this.id === CurrencyRate.BEE) {
      return parseInt(value * this.toUsd, 10);
    }

    return value * this.toUsd;
  }

  CurrencyRate.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };

  return CurrencyRate;
};
