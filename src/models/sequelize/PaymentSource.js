const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      stripeSourceId: {type: 'string'},
      stripeObject: {type: 'string'},
      stripeCustomerId: {type: 'string'},
      stripeLast4: {type: 'string', maxLength: 4},
      stripeExpMonth: {type: 'integer', maxLength: 2},
      stripeExpYear: {type: 'integer', maxLength: 4},
      stripeBrand: {type: 'string'},
      stripeFingerprint: {type: 'string'}
    }
  };

  const PaymentSource = sequelize.define(
    'payment_source',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: DataTypes.STRING(60),
        field: 'user_id',
        index: true
      },
      provider: {
        type: DataTypes.STRING(16),
        validate: {
          len: [1, 16]
        }
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
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
      tableName: 'payment_sources',
      freezeTableName: true
    }
  );

  PaymentSource.providers = {
    STRIPE: 'stripe',
    BEE: 'BEE'
  }

  PaymentSource.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };

  return PaymentSource;
};
