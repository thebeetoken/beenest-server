const beemail = require('../beemail');
const settings = require('../../../../../config/settings');

const walletDescriptions = {
  USD: 'Stripe account',
  BTC: 'Bitcoin wallet',
  BEE: 'Ethereum wallet',
  ETH: 'Ethereum wallet'
};

module.exports = ({ guest, host, booking, listing }) => beemail({
  to: guest,
  introduction: `
    ${guest.firstName} has cancelled their request to stay at your place ${settings.beenestHost}/listings/${listing.id} at ${listing.fullAddress}
  `,
  instructions: booking.cancellationFee > 0 ? `
    Because this guest cancelled their booking
    ${booking.cancellationFee === 1 ? ' less than 7 days before check in, ' : ' 7 or more days before check in, '}
    they have been assessed a ${Math.floor(booking.cancellationFee * 100)}% cancellation fee.
    <br>
    <p>This amount will be issued to your registered ${walletDescriptions[booking.currency]}.</p>
    <p>
      Cancellation Fee:
      ${booking.guestTotalAmount} x ${Math.floor(booking.cancellationFee * 100)}% = ${(booking.guestTotalAmount * booking.cancellationFee).toFixed(2)} ${booking.currency}
      <br/>
    </p>
  ` : '',
  notes: `
    About this guest:
    <br>
    <b>Name: ${guest.fullName}</b>
    <br>
    <b>Contact Email: ${guest.email}</b>
  `,
  bookingId: booking.id,
  listingId: booking.listingId
});
