const templates = require('./templates/guest');

const { UserService } = require('../user');
const { ListingService } = require('../listing');
const { PaymentSource } = require('../../models/sequelize');
const formatter = require('../../util/formatter');

class GuestMailer {
  constructor(sender) {
    this.sender = sender;
  }

  async confirm(booking) {
    const host = await UserService.getById(booking.hostId);
    const guest = await UserService.getById(booking.guestId);
    return this.sender.send({
      to: guest.email,
      html: templates.confirm({ guest, host, booking }),
      subject: `You requested to book ${host.displayName}’s place for ${formatter.formatShortDate(booking.checkInDate)}-${formatter.formatShortDate(booking.checkOutDate)} on Beenest!`
    });
  }

  async accept(booking) {
    const host = await UserService.getById(booking.hostId);
    const guest = await UserService.getById(booking.guestId);
    const listing = await ListingService.getListingById(booking.listingId, guest);
    const paymentSource = booking.currency === 'USD' ?
      await PaymentSource.findById(booking.paymentSourceId) :
      undefined;
    return this.sender.send({
      to: guest.email,
      html: templates.accept({ booking, guest, host, listing, paymentSource }),
      subject: `Reservation Confirmed for ${listing.city} on Beenest`
    });
  }

  async reject(booking) {
    const host = await UserService.getById(booking.hostId);
    const guest = await UserService.getById(booking.guestId);
    return this.sender.send({
      to: guest.email,
      html: templates.reject({ booking, host, guest }),
      subject: `Your booking request for ${host.displayName}’s place has been declined`
    });
  }

  // TODO: Reconcile naming; this means "cancelled by host"
  async rescind(booking) {
    const host = await UserService.getById(booking.hostId);
    const guest = await UserService.getById(booking.guestId);
    return this.sender.send({
      to: guest.email,
      html: templates.rescind({ booking, host, guest }),
      subject: `Your booking for ${host.displayName}’s place has been cancelled`
    });
  }
}

module.exports = GuestMailer;
