const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      email: { type: 'string', format: 'email' },
      postalCode: { type: 'string', maxLength: 10 },
      firstName: { type: 'string', maxLength: 40 },
      lastName: { type: 'string', maxLength: 40 },
      ipAddressData: {
        type: 'object',
        properties: { ip: { type: 'string', format: 'ipv4' } }
      }
    }
  };

  const Feedback = sequelize.define(
    'feedback',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      feedback: {
        type: DataTypes.TEXT,
      },
      nps: {
        type: DataTypes.FLOAT,
        validate: {
          max: 10,
          min: 0,
        }
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
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
      tableName: 'feedback',
      timestamps: false,
      freezeTableName: true
    }
  );

  /**
   * Separates fields into the meta fields
   **/
  Feedback.buildWithMetaFields = function(opts) {
    if (!opts) {
      throw new Error('No opts defined for feedback.');
    }
    const feedback = Feedback.build(opts);
    feedback.meta = {
      email: opts.email,
      postalCode: opts.postalCode || '',
      firstName: opts.firstName || '',
      lastName: opts.lastName || '',
      ipAddressData: opts.ipAddressData
    };
    return feedback;
  };

  Feedback.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };

  return Feedback;
};
