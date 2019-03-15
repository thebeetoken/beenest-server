const { CurrencyRate } = require('../../models/sequelize');

class CurrencyService {
  setExchangeRate(currency, toUsd) {
    return CurrencyRate.upsert({ id: currency, toUsd, updatedAt: new Date() }).then(() => {
      return this.getCurrencyRate(currency);
    });
  }

  getCurrencyRate(currency) {
    return CurrencyRate.findByPk(currency);
  }

  getRates() {
    return CurrencyRate.findAll();
  }
}

module.exports = { CurrencyService: new CurrencyService() };
