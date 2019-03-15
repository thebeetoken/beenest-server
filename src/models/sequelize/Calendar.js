const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {
  // TODO move non index fields to JSON field
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
  };

  const Calendar = sequelize.define(
    'calendar',
    {
      listingId: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        field: 'listing_id'
      },
      icalUrl: {
        type: DataTypes.STRING(255),
        field: 'ical_url'
      },
    },
    {
      tableName: 'ical',
      freezeTableName: true,
      timestamps: false,
    }
  );

  Calendar.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };
  
  return Calendar;
};
