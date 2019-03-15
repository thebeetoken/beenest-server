const templates = require('./templates/host');

const { UserService } = require('../user');
const { ListingService } = require('../listing');
const { Booking, PaymentSource } = require('../../models/sequelize');

class HostMailer {
  constructor(sender) {
    this.sender = sender;
  }

  async confirm(booking) {
    const host = await UserService.getById(booking.hostId);
    const guest = await UserService.getById(booking.guestId);
    const listing = await ListingService.getListingById(booking.listingId, host);
    return this.sender.send({
      to: host.email,
      html: templates.confirm({ host, guest, booking, listing }),
      subject: `${guest.displayName} would like to book your place on Beenest!`
    });
  }

  async cancel(booking) {
    const host = await UserService.getById(booking.hostId);
    const guest = await UserService.getById(booking.guestId);
    const listing = await ListingService.getListingById(booking.listingId, host);
    const paymentSource = booking.currency === 'USD' ?
      await PaymentSource.findById(booking.paymentSourceId) :
      undefined;
    return this.sender.send({
      to: host.email,
      html: templates.cancel({ host, guest, booking, listing }),
      subject: `${guest.displayName} has cancelled their request to stay at your place`
    })
  }
}

module.exports = HostMailer;
