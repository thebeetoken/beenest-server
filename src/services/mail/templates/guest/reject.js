const beemail = require('../beemail');
const settings = require('../../../../../config/settings');

module.exports = ({ guest, host, booking }) => beemail({
  to: guest,
  introduction: `Your booking request for ${host.displayName}’s place has been declined.`,
  instructions: `
    <b>You have NOT been charged.</b>
    <br>
    <br>
    Not to worry though, you can still book other places on Beenest here
    <b>${settings.beenestHost}</b>
    <br>  
  `,
  bookingId: booking.id,
  listingId: booking.listingId
});
