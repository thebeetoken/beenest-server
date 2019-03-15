const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {
  const { Op } = sequelize;

  const Reservation = sequelize.define(
    'reservation',
    {
      listingId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'listing_id'
      },
      startDate: {
        type: DataTypes.DATE,
        field: 'start_date'
      },
      endDate: {
        type: DataTypes.DATE,
        field: 'end_date'
      },
      sourceLink: {
        type: DataTypes.STRING(50),
        field: 'source_link'
      },
    },
    {
      tableName: 'reservations',
      freezeTableName: true,
      timestamps: false,
    }
  );

  Reservation.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };

  // IMPORTANT: The startDate/endDate clauses should match Booking.findOverlappingBookings
  Reservation.findInRange = function (listingId, startDate, endDate) {
    return Reservation.findAll({
      where: {
        listingId,
        startDate: { [Op.lt]: endDate },
        endDate: { [Op.gt]: startDate }
      }
    });
  };

  Reservation.bulkReplace = function (listingId, sourceLink, ranges) {
    return sequelize.transaction(transaction => Reservation.destroy(
      { where: { listingId, sourceLink } },
      { transaction }
    ).then(() => Reservation.bulkCreate(
      ranges.map(range => ({
        listingId,
        sourceLink,
        startDate: range.startDate,
        endDate: range.endDate
      })),
      { transaction }
    )));
  };

  return Reservation;
};
