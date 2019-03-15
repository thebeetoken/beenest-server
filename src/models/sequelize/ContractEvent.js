const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {
  const { Op } = sequelize;

  const ContractEvent = sequelize.define(
    'contractEvent',
    {
      blockNumber: {
        type: DataTypes.INTEGER,
        field: 'block_number'
      },
      raw: {
        type: DataTypes.JSON,
        field: 'raw'
      }
    },
    {
      tableName: 'contract_events',
      freezeTableName: true,
      timestamps: false,
    }
  );

  ContractEvent.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };

  return ContractEvent;
};
