const beemail = require('../beemail');
const settings = require('../../../../../config/settings');
const formatter = require('../../../../util/formatter');

module.exports = ({ guest, host, booking }) => beemail({
  to: guest,
  introduction: `We have notified ${host.displayName} that you’d like to stay at their place for the following dates:`,
  instructions: `
    <b>Check In: ${formatter.formatDate(booking.checkInDate)}</b><br>
    <b>Check Out: ${formatter.formatDate(booking.checkOutDate)}</b>
  `,
  conclusion: `
    <b>This is not a confirmed booking.</b>
    You will receive a response from ${host.displayName} within 24 hours.
    Please go to your Trips page at ${settings.beenestHost}/trips if you would like to cancel this request.
  `,
  bookingId: booking.id,
  listingId: booking.listingId
});
