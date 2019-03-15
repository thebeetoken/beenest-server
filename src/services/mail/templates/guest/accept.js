const beemail = require('../beemail');
const settings = require('../../../../../config/settings');
const formatter = require('../../../../util/formatter');

module.exports = ({ guest, host, booking, listing }) => beemail({
  to: guest,
  introduction: `${host.displayName} has confirmed your booking on Beenest! Here are the details you need for your trip:`,
  properties: {
    'Check In': formatter.formatDate(booking.checkInDate),
    'Check Out': formatter.formatDate(booking.checkOutDate),
    'Address': listing.fullAddress,
    'Host Email': host.email,
    'Host Phone': host.phoneNumber,
    'Listing': `${settings.beenestHost}/listings/${booking.listingId}`,
    'Rules': listing.houseRules
  },
  conclusion: `Trip Receipt: ${settings.beenestHost}/trips/${booking.id}/receipt`,
  bookingId: booking.id,
  listingId: listing.id
});
