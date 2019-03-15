const idGenerator = require('../../services/idGenerator');
const validate = require('../../util/validate');

module.exports = (sequelize, DataTypes) => {
  const CurrencyRate = sequelize.import('currency_rate', require('../sequelize/CurrencyRate'));

  const CreditBalance = sequelize.define(
    'credit_balance',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: DataTypes.STRING(60),
        field: 'user_id'
      },
      amountUsd: {
        type: DataTypes.DECIMAL,
        field: 'amount_usd'
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValues: DataTypes.NOW,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
      }
    },
    {
      tableName: 'credit_balances',
      freezeTableName: true
    }
  );

  CreditBalance.findByUserId = userId => {
    if (!validate.doesParamExist(userId)) {
      return Promise.reject(new Error('userId is invalid'));
    }

    return CreditBalance.findOne({ where: { userId } });
  }

  CreditBalance.creditToBalance = (userId, amountUsd) => {
    if (!validate.doesParamExist(userId)) {
      return Promise.reject(new Error('userId is invalid'));
    }
    if (!validate.isAmountParamValid(amountUsd)) {
      return Promise.reject(new Error('amount is invalid'));
    }

    const amountUsdFloat = parseFloat(amountUsd);
    return CreditBalance.findByUserId(userId)
      .then(creditBalance => {
        if (!creditBalance) {
          return CreditBalance.build({
            userId,
            amountUsd: amountUsdFloat
          }).save();
        }
        const newAmountUsd = creditBalance.amountUsd + amountUsdFloat;
        return creditBalance.updateAmount(newAmountUsd);
      });
  };

  CreditBalance.debitFromBalance = (userId, amountUsdToDebit) => {
    if (!validate.doesParamExist(userId)) {
      return Promise.reject(new Error('userId is invalid'));
    }
    if (!validate.isAmountParamValid(amountUsdToDebit)) {
      return Promise.reject(new Error('amount is invalid'));
    }

    return CreditBalance.findByUserId(userId)
      .then(creditBalance => {
        if (creditBalance.amountUsd < amountUsdToDebit) {
          return Promise.reject(new Error('amount to debit exceeds credit balance'));
        }
        const remainingCreditAmountUsd = creditBalance.amountUsd - amountUsdToDebit;
        return creditBalance.updateAmount(remainingCreditAmountUsd);
      });
  };

  CreditBalance.prototype.updateAmount = function(newAmountUsd) {
    if (newAmountUsd < 0) {
      return Promise.reject(new Error('amount is invalid'));
    }
    this.amountUsd = newAmountUsd;
    return this.save();
  };

  CreditBalance.prototype.updateById = (userId, amountUsd) => {
    if (!validate.doesParamExist(userId)) {
      return Promise.reject(new Error('userId is invalid'));
    }
    if (!validate.isAmountParamValid(amountUsd)) {
      return Promise.reject(new Error('amount is invalid'));
    }

    return CreditBalance.findByUserId(userId)
      .then(creditBalance => creditBalance.update({ amountUsd }));
  };

  CreditBalance.prototype.getBeeValue = function() {
    return CurrencyRate.findById(CurrencyRate.BEE)
      .then(beeCurrencyRate => beeCurrencyRate.convertFromUsd(this.amountUsd));
  };

  CreditBalance.prototype.getEthValue = function() {
    return CurrencyRate.findById(CurrencyRate.ETH)
      .then(ethCurrencyRate => ethCurrencyRate.convertFromUsd(this.amountUsd));
  };
  
  CreditBalance.prototype.getBeeAndEthValue = function () {
    return Promise.all([this.getBeeValue(), this.getEthValue()]);
  }

  return CreditBalance;
};
