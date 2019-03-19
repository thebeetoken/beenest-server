const beemail = require('../beemail');
const settings = require('../../../../../config/settings');
const formatter = require('../../../../util/formatter');

module.exports = ({ guest, host, booking, listing }) => beemail({
  to: host,
  introduction: `
    ${guest.firstName} would like to stay at your place:
    <br>
    <br>
    ${listing.title}
    <br>
    (${settings.beenestHost}/listings/${listing.id})
    <br>
    ${listing.fullAddress ? ('at: ' + listing.fullAddress + '<br />') : ''}
    <br>
    The booking details are as follows:
    <br>
  `,
  instructions: `
    <b>Check In: ${formatter.formatDate(booking.checkInDate)}</b>
    <br>
    <b>Check Out: ${formatter.formatDate(booking.checkOutDate)}</b>
    <br>
    <b>Guests: ${booking.numberOfGuests}</b>
    <br>
    <b>Security Deposit: ${booking.guestDepositAmount}</b>
    <br>
    <b>
      <p>
        Booking Amount Paid by Guest:
        ${booking.numberOfNights} nights X ${booking.pricePerNight} ${booking.currency} =
        ${(booking.pricePerNight * booking.numberOfNights).toFixed(2)} ${booking.currency}
      </p>
      <p>
        Your potential earnings:
        ${(booking.pricePerNight * booking.numberOfNights).toFixed(2)} ${booking.currency}
      </p>
    </b>
    <br>
    <br>
  `,
  conclusion: `
    Please visit ${settings.beenestHost}/host/bookings within 24 hours to accept this booking.
    <br>
    <br>
  `,
  notes: `
    About this guest*:
    <br>
    <b>Name: ${guest.fullName}</b>
    <br>
    <b>Contact Email: ${guest.email}</b>
  `,
  bookingId: booking.id
});
