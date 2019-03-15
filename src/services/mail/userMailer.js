const contact = require('./templates/user/contact');

const { ListingService } = require('../listing');
const { Booking } = require('../../models/sequelize');

class UserMailer {
  constructor(sender) {
    this.sender = sender;
  }

  async contact(sender, recipient, { message, subject, bookingId, listingId }) {
    const booking = bookingId && await Booking.findById(bookingId);
    const listing = listingId && await ListingService.getListingById(listingId, sender);
    return this.sender.send({
      replyTo: sender.email,
      to: recipient.email,
      html: contact({ sender, message, booking, listing }),
      subject: `Beenest Inquiry from ${sender.firstName}: ${subject}`
    });
  }
}

module.exports = UserMailer;
