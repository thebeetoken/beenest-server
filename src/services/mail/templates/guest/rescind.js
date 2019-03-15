const beemail = require('../beemail');
const settings = require('../../../../../config/settings');
const formatter = require('../../../../util/formatter');

module.exports = ({ guest, host, booking }) => beemail({
  to: guest,
  introduction: `
    ${host.displayName} has cancelled your booking for their place on ${formatter.formatDate(booking.checkInDate)}.
  `,
  instructions: `
    We know this is a significant inconvenience for you, and we’ve issued you a full refund.
    <br>
    <br>
    We have reduced the host’s reputation for cancelling your booking. We will also determine if a penalty fee needs to be assessed, if their calendar dates need to be blocked, and if their account warrants suspension.
    <br>
  `,
  bookingId: booking.id,
  listingId: booking.listingId
});
