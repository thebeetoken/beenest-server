const dbUtils = require('./dbUtils');
const idGenerator = require('../../services/idGenerator');
const validate = require('../../util/validate');

module.exports = (sequelize, DataTypes) => {
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      source: { type: 'string' },
      notes: { type: 'string' }
    }
  };

  const CreditLedger = sequelize.define(
    'credit_ledger',
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
      bookingId: {
        type: DataTypes.STRING(60),
        field: 'booking_id'
      },
      debitAmountUsd: {
        type: DataTypes.DECIMAL,
        field: 'debit_amount_usd'
      },
      creditAmountUsd: {
        type: DataTypes.DECIMAL,
        field: 'credit_amount_usd'
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      },
      expiresAt: {
        type: DataTypes.DATE,
        field: 'expires_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
      },
      meta: {
        type: DataTypes.JSON,
        validate: {
          isValidField(value) {
            dbUtils.validateMetaFields(META_JSON_SCHEMA, value);
          }
        }
      }
    },
    {
      tableName: 'credit_ledger',
      freezeTableName: true
    }
  );

  CreditLedger.createDebit = (userId, amount, bookingId) => {
    if (!validate.doesParamExist(userId)) {
      return Promise.reject(new Error('user id is invalid'));
    }

    if (!validate.isAmountParamValid(amount)) {
      return Promise.reject(new Error('amount is invalid'));
    }

    if (!validate.doesParamExist(bookingId)) {
      return Promise.reject(new Error('booking id is invalid'));
    }

    return CreditLedger.create({
      userId,
      bookingId,
      debitAmountUsd: amount
    }, {
      silent: true // prevents attempt to insert into an updated_at column
    });
  };

  CreditLedger.createCredit = (userId, amount, bookingId) => {
    if (!validate.doesParamExist(userId)) {
      return Promise.reject(new Error('user id is invalid'));
    }

    if (!validate.isAmountParamValid(amount)) {
      return Promise.reject(new Error('amount is invalid'));
    }

    return CreditLedger.create({
      userId,
      bookingId,
      creditAmountUsd: amount,
    }, {
      silent: true  // prevents attempt to insert into an updated_at column
    });
  };

  return CreditLedger;
}
