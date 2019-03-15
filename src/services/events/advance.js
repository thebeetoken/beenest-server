const { Booking } = require('../../models/sequelize');
const { MailService } = require('../mail');
const format = require('./format');
const verify = require('./verify');

module.exports = async (event, properties, from, to) => {
  const details = { status: from, ...(format(event, properties)) };
  const booking = await Booking.findById(details.id);
  const mismatches = verify(booking, details);
  if (Object.keys(mismatches).length > 0) {
    await MailService.reportContractEventMismatch(event.event, details.id, mismatches);
  }
  return booking.update({ status: to });
};
