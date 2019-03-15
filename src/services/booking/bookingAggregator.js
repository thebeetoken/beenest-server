const idUtils = require('../../util/idUtils');
const { CreditService } = require('../credit');
const { UserService } = require('../user');
const { MailService } = require('../mail');
const settings = require('../../../config/settings');
const { Booking } = require('../../models/sequelize');
const errors = require('../../util/errors');

class BookingAggregator {
  constructor(bookingProviders, defaultBookingProvider) {
    this.bookingProviders = bookingProviders;
    this.defaultBookingProvider = defaultBookingProvider;
  }

  async getById(id, user) {
    const booking = await Booking.findOne({ where: { id } });
    if (!booking) {
      const error = new Error('Booking does not exist.');
      error.code = errors.NOT_FOUND;
      throw error;
    }
    if (user.id === booking.guestId || user.id === booking.hostId || user.isAdmin()) {
      return booking;
    }
    const error = new Error('User is unauthorized to access this booking.');
    error.code = errors.NOT_AUTHORIZED;
    throw error;
  }

  async rejectBooking(id, user) {
    const booking = await this.getById(id, user);
    switch (booking.currency) {
      case 'BEE':
        if (
          booking.status !== 'guest_confirmed' &&
          booking.status !== 'init_pay_submitted'
        ) {
          return new Error(`The booking state of ${id} in invalid.`);
        }
        return await this.hostReject(booking, user);
      case 'ETH':
        if (
          booking.status !== 'guest_confirmed' &&
          booking.status !== 'init_pay_submitted'
        ) {
          return new Error(`The booking state of ${id} in invalid.`);
        }
        return await this.hostReject(booking, user);
      case 'USD':
        return await this.hostReject(booking, user);
      default:
        throw new Error(`The currency: ${booking.currency} is invalid.`);
    }
  }


  async hostReject(booking, user) {
    booking.meta = {
      ...booking.meta,
      rejectedBy: user.email,
    };
    booking.changed('meta', true);
    booking.status = 'host_rejected';
    const [guest, rejectedBooking] = await Promise.all([
      UserService.getById(booking.guestId),
      booking.save(),
    ]);
    await MailService.reject(rejectedBooking);
    if (rejectedBooking.hasCreditApplied()) {
      return CreditService.reject(guest, rejectedBooking);
    }
    return rejectedBooking;
  }


  async guestConfirmBookingWithUSD(booking, listing, guest) {
    const namespace = idUtils.getNamespaceFromId(booking.listingId);
    const provider = this.bookingProviders.hasOwnProperty(namespace) ? this.bookingProviders[namespace] : this.defaultBookingProvider;    
    const hostAndBooking = await provider.guestConfirmBookingWithUSD(booking, listing, guest);
    return hostAndBooking.booking;
  }


  async guestConfirmBookingWithCrypto(booking, listing, guest, cryptoParams) {
    const {
      guestWalletAddress,
      paymentProtocolAddress,
      tokenContractAddress,
      transactionHash,
    } = cryptoParams;
    const hostWalletAddress = settings.adminHostWalletAddress;
    const [host, updatedBooking] = await Promise.all([
      UserService.getById(booking.hostId),
      booking.updateCryptoSource({
        guestWalletAddress,
        hostWalletAddress,
        paymentProtocolAddress,
        tokenContractAddress,
        guestTxHash: transactionHash,
        status: 'guest_confirmed',
      }),
    ]);
    return updatedBooking;
  }


  async guestConfirmBookingWithBTC(booking, listing, guest) {
    const host = await UserService.getById(booking.hostId);
    return booking;
  }
}

module.exports = BookingAggregator;