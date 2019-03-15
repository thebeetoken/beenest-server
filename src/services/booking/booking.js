const _ = require('lodash');
const Sequelize = require('sequelize');
const {
  Booking,
  Listing,
  PaymentSource,
  User,
} = require('../../models/sequelize');
const { AnalyticsService } = require('../analytics');
const { CreditService } = require('../credit');
const { ListingService } = require('../listing');
const { PricingService } = require('../pricing/pricing');
const { UserService } = require('../user');
const logger = require('../logger');
const stripe = require('../stripe');
const pricing = require('../pricing');
const errors = require('../../util/errors');
const { MailService } = require('../mail');
const { ReservationService } = require('../reservation');
const settings = require('../../../config/settings');

const { Op } = Sequelize;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

const BookingAggregator = require('./bookingAggregator');
const { RentivoBookingProvider } = require('./rentivoBookingProvider');
const { BeenestBookingProvider } = require('./beenestBookingProvider');

const BookingAggregatorService = new BookingAggregator({
  rentivo: RentivoBookingProvider,
}, 
BeenestBookingProvider,
);

class BookingService {
  getById(id, user) {
    return BookingAggregatorService.getById(id, user );
  }

  getAllBookings({ limit }) {
    return Booking.getAllBookings({limit});
  }

  getHostBookings(hostId, opts) {
    if (opts && opts.status) {
      return Booking.findAll({
        order: [['checkInDate', 'DESC']],
        where: {
          hostId,
          status: opts.status, 
        },
      });
    }

    return Booking.findAll({
      order: [['checkInDate', 'DESC']],
      where: { 
        hostId,
        status: {
          [Op.notIn]: [
            'started',
            'expired_before_guest_confirmed',
            'expired_before_host_approved',
          ],
        }
      },
    });
  }

  getGuestBookings(guestId) {
    return Booking.findAll({
      order: [['checkInDate', 'DESC']],
      where: { guestId },
    });
  }

  getGuestBookingsByStatus({ guestId, tripStatus }) {
    return Booking.findGuestBookingsByStatus({ guestId, tripStatus });
  }

  async isHostToBooking(hostId, bookingId) {
    if (!hostId || !bookingId) {
      const error = new Error("Host ID or booking ID missing.");
      error.code = errors.INVALID_INPUT;
      throw error;
    }
    const foundBooking = await Booking.findOne({
      where: { hostId, id: bookingId },
    });
    return !!(foundBooking && foundBooking.id);
  }

  async getBookingsWithUnverifiedTransactions() {
    const bookings = await Booking.findAll({
      where: { status: 'guest_paid' },
      order: [['createdAt', 'ASC']],
      limit: 100
    });
    const isBuyNow = {};
    await Promise.all(bookings.map(async booking => {
      const listing = await Listing.findById(booking.listingId);
      isBuyNow[booking.id] = !!listing && listing.autoApprove;
    }));
    return bookings.filter(({ id, meta }) => isBuyNow[id] && !!meta.guestTxHash);
  }

  async createBooking(listing, guest, opts) {
    const activeListing = await ListingService.findActiveListing(listing.id, {
      checkInDate: new Date(opts.checkInDate),
      checkOutDate: new Date(opts.checkOutDate),
      numberOfGuests: opts.numberOfGuests
    });
    const creditBalance = await CreditService.getBalance(guest);
    const price = await pricing.compute({
      listing,
      checkInDate: new Date(opts.checkInDate),
      checkOutDate: new Date(opts.checkOutDate),
      numberOfGuests: opts.numberOfGuests,
      creditBalance,
    });
    const bookingOpts = await pricing.validate(
      price,
      listing,
      creditBalance,
      opts
    );
    const booking = Booking.buildWithMetaFields(bookingOpts);
    await AnalyticsService.trackBookingStarted(guest, booking, activeListing);
    return booking.save();
  }


  async createBookingWithQuotes(booking, user) {
    // When we depreciate :post /booking, we'll replace createBooking with this one
    const listing = await ListingService.findActiveListing(booking.listingId, {
      checkInDate: new Date(booking.checkInDate),
      checkOutDate: new Date(booking.checkOutDate),
      numberOfGuests: booking.numberOfGuests
    });
    const reservations = await ReservationService.getReservations(
      listing.id,
      booking.checkInDate,
      booking.checkOutDate
    );
    const maxReservations = (listing.meta && listing.meta.totalQuantity) || 1;
    if (reservations.length >= maxReservations) {
      const error = new Error(
        'Cannot create booking; listing is fully reserved for these dates.'
      );
      error.code = errors.LISTING_RESERVED;
      throw error;
    }
    const newBooking = Booking.buildWithMetaFields({
      ...booking,
      guestId: user.id,
      hostId: listing.hostId,
    });
    const { paymentPrices } = await PricingService.getPriceQuote(
      booking,
      listing,
      user
    );
    const priceQuotes = paymentPrices.map(price => {
      return PricingService.flattenPrice(price, price.currency);
    });
    newBooking.meta = {
      ...newBooking.meta,
      priceQuotes,
    };
    newBooking.changed('meta', true);
    await AnalyticsService.trackBookingStarted(user, newBooking, listing);
    return newBooking.save();
  }

  async guestConfirmBooking({ id, cryptoParams }, guest) {
    if (!guest.completedVerification) {
      throw new Error('You need to verify your email and phone number to confirm a booking.');
    }
    const [booking, creditBalance] = await Promise.all([
      Booking.findById(id),
      CreditService.getBalance(guest),
    ]);
    if (booking.status !== 'started') {
      const error = new Error('Unable to change booking at this time.');
      error.code = errors.INVALID_STATUS;
      throw error;
    }
    const listing = await ListingService.getListingById(booking.listingId);
    // // WIP
    // const hasPriceChanged = await PricingService.hasPriceChanged(booking, listing, guest);
    // if (hasPriceChanged) {
    //   const error = new Error('Prices are mismatched.');
    //   error.code = errors.PRICE_MISMATCH;
    //   throw error;
    // };
    const bookingWithCreditsApplied = await CreditService.confirm(
      creditBalance,
      booking,
      guest
    );
    await bookingWithCreditsApplied.update({ status: 'guest_confirmed' });
    const confirmedBooking = await (() => {
      switch (booking.currency) {
      case 'BEE':
        return BookingAggregatorService.guestConfirmBookingWithCrypto(
          bookingWithCreditsApplied,
          listing,
          guest,
          cryptoParams
        );
      case 'ETH':
        return BookingAggregatorService.guestConfirmBookingWithCrypto(
          bookingWithCreditsApplied,
          listing,
          guest,
          cryptoParams
        );
      case 'USD':
        return BookingAggregatorService.guestConfirmBookingWithUSD(
          bookingWithCreditsApplied,
          listing,
          guest
        );
      case 'BTC':
        return BookingAggregatorService.guestConfirmBookingWithBTC(
          bookingWithCreditsApplied,
          listing,
          guest
        );
      default:
        throw new Error('INVALID_CURRENCY');
      }
    })();
    await AnalyticsService.trackBookingRequested(guest, confirmedBooking, listing);
    await MailService.confirm(confirmedBooking);
    return confirmedBooking;
  }

  async guestCancelBooking(id, user) {
    const booking = await this.getById(id, user);
    const listing = await ListingService.getListingById(booking.listingId);
    await AnalyticsService.trackBookingCancelled(user, booking, listing);
    switch (booking.currency) {
      case 'BEE':
      case 'ETH':
        return await this.guestCancelCryptoBooking(booking, user);
      case 'USD':
        return await this.guestCancelUsdBooking(booking, user);
      default:
        const error = new Error(`Invalid currency: ${booking.currency}`);
        error.code = errors.INVALID_INPUT;
        throw error;
    }
  }

  async guestRejectPayment(id, user) {
    const booking = await this.getById(id, user);
    booking.status = 'guest_rejected_payment';
    return booking.save();
  }

  async guestSelectPayment({ id, currency, paymentSourceId }, guest) {
    const booking = await this.getById(id, guest);
    if (booking.guestId !== guest.id) {
      const error = new Error('Guest does not match booking.');
      error.code = errors.NOT_AUTHORIZED;
      throw error;
    }
    if (booking.status !== 'started') {
      const error = new Error('Booking status is not started.');
      error.code = errors.INVALID_STATUS;
      throw error;
    }
    const { priceQuotes } = booking.meta;
    const priceQuote = priceQuotes.find(p => p.currency === currency);
    if (!priceQuote) {
      const error = new Error(`Invalid currency selection ${currency}`);
      error.code = errors.INVALID_INPUT;
      throw error;
    }
    if (currency === 'BTC') {
      // TODO: Generate new addresses per-booking
      await booking.update({ btcWalletAddress: settings.btcWalletAddress });
    }
    const {
      guestTotalAmount,
      pricePerNight,
      securityDeposit,
    } = priceQuotes.find(p => p.currency === currency);
    const updatedBooking = Object.assign(booking, {
      currency,
      guestTotalAmount,
      pricePerNight,
      guestDepositAmount: securityDeposit,
    });
    if (!!paymentSourceId && currency === 'USD') {
      updatedBooking.meta = {
        ...updatedBooking.meta,
        paymentSourceId,
      };
    } else {
      delete updatedBooking.meta.paymentSourceId;
    }
    updatedBooking.changed('meta', true);
    return updatedBooking.save();
  }


  async approveBooking(id, user) {
    const booking = await this.getById(id, user);
    const updatedBooking = await booking.update({ approvedBy: user.email });
    const listing = await ListingService.getListingById(booking.listingId);
    await AnalyticsService.trackBookingAccepted(user, updatedBooking, listing);
    switch (updatedBooking.currency) {
      case 'BEE':
      case 'BTC':
      case 'ETH':
        return await this.approveBookingWithoutPayment(updatedBooking);
      case 'USD':
        return await this.approveUsdBooking(updatedBooking);
      default:
        throw new Error('INVALID_CURRENCY');
    }
  }

  async approveBookingWithoutPayment(booking) {
    await booking.update({ status: 'host_approved' });
    await MailService.accept(booking);
    return booking;
  }

  async approveUsdBooking(booking) {
    const paymentSource = await PaymentSource.findById(
      booking.meta.paymentSourceId
    );
    if (!paymentSource) {
      const error = `Payment not found for bookingId ${booking.id}`;
      throw new Error(error);
    }
    if (!booking.isValidPaymentSource(paymentSource)) {
      const error = `Payment not authorized ${booking.guestId} ${
        paymentSource.userId
      }`;
      throw new Error(error);
    }
    if (paymentSource.provider !== PaymentSource.providers.STRIPE) {
      const error = `Payment not supported ${paymentSource.provider}`;
      throw new Error(error);
    }
    const [guest, host, listing] = await Promise.all([
      UserService.getById(booking.guestId),
      UserService.getById(booking.hostId),
      ListingService.getListingById(booking.listingId),
    ]);
    if (!guest) {
      const error = 'Guest no longer exists';
      throw new Error(error);
    }
    if (!host) {
      const error = 'Host no longer exists';
      throw new Error(error);
    }

    booking.status = 'host_approved';
    const approvedBooking = await booking.save();
    const chargedBooking = await stripe.chargeBooking(
      approvedBooking,
      paymentSource
    );
    await AnalyticsService.trackBookingPaidByGuest(guest, chargedBooking, listing);
    await MailService.accept(chargedBooking);
    return chargedBooking;
  }

  async cancelBooking(id, user) {
    const booking = await this.getById(id, user);
    const listing = await ListingService.getListingById(booking.listingId);
    if (user.isAdmin() || booking.hostId === user.id) {
      await AnalyticsService.trackBookingRescinded(user, booking, listing);
      switch (booking.currency) {
        case 'BEE':
        case 'ETH':
          return await this.hostCancelCryptoBooking(booking, user);
        case 'USD':
          return await this.hostCancelUsdBooking(booking, user);
        default:
          throw new Error('INVALID_CURRENCY');
      }
    }
    return await this.guestCancelBooking(id, user);
  }

  async hostCancelCryptoBooking(booking, user) {
    // TODO: Store txHash from Refund event
    const guest = await UserService.getById(booking.guestId);
    await Promise.all([
      booking.setCancelBy(user, true),
      CreditService.refundFull(guest, booking),
      MailService.rescind(booking)
    ]);
    return booking.update({ status: 'refund_initiated' });
  }

  async hostCancelUsdBooking(booking, user) {
    const paymentSourceId = _.get(booking, 'meta.paymentSourceId');
    const [guest, paymentSource] = await Promise.all([
      UserService.getById(booking.guestId),
      paymentSourceId ? PaymentSource.findById(paymentSourceId) : null,
    ]);
    let host = await UserService.getById(booking.hostId);
    host = host.toJSON();
    let bookingToCancel = await CreditService.refundFull(guest, booking);
    if (paymentSource) {
      bookingToCancel = await stripe.refundBookingCancellation(
        bookingToCancel,
        paymentSource,
        true
      );
    }
    const cancelledBooking = await bookingToCancel.setCancelBy(user, true);
    logger.info(`END updateBooking on: ${booking.id}`);
    logger.info('--(email) notifying guest of cancellation--');
    await MailService.rescind(cancelledBooking);
    return cancelledBooking;
  }

  async guestCancelCryptoBooking(booking, user) {
    // TODO: Record cancelTxHash when this comes from a Cancel event
    const guest = await UserService.getById(booking.guestId);
    await Promise.all([
      booking.setCancelBy(user, false),
      CreditService.refundGuestCancel(guest, booking),
      MailService.cancel(booking)
    ]);
    return booking.update({ status: 'guest_cancel_initiated' });
  }

  guestCancelUsdBooking(booking, user) {
    const paymentSourceId = _.get(booking, 'meta.paymentSourceId', null);
    const previousBookingCancelStatus = booking.getCancelStatus();
    return Promise.all([
      UserService.getById(booking.guestId),
      UserService.getById(booking.hostId),
      ListingService.getListingById(booking.listingId),
      paymentSourceId ? PaymentSource.findById(paymentSourceId) : null,
      booking,
    ])
      .then(([guest, host, listing, paymentSource, booking]) => {
        return Promise.all([
          guest,
          host,
          listing,
          paymentSource,
          CreditService.refundGuestCancel(guest, booking),
        ]);
      })
      .then(([guest, host, listing, paymentSource, booking]) => {
        const cancelPromise = (paymentSource && booking.stripeChargeId)
          ? stripe.refundBookingCancellation(booking, paymentSource, false)
          : booking;
        return Promise.all([
          guest,
          host,
          listing,
          paymentSource,
          cancelPromise,
        ]);
      })
      .then(([guest, host, listing, paymentSource, booking]) => {
        const updatedBookingStatus = previousBookingCancelStatus === Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY
          ? booking.setGuestRejected(user) : booking.setCancelBy(user, false);
        return Promise.all([
          guest,
          host,
          listing,
          paymentSource,
          updatedBookingStatus
        ]);
      })
      .then(([guest, host, listing, paymentSource, booking]) => {
        return Promise.all([booking, MailService.cancel(booking)]);
      })
      .then(([booking]) => booking);
  }

  async rejectBooking(id, user) {
    const booking = await this.getById(id, user);
    const listing = await ListingService.getListingById(booking.listingId);
    await AnalyticsService.trackBookingRejected(user, booking, listing);
    return BookingAggregatorService.rejectBooking(id, user);
  }

  async payoutBooking(id, user) {
    const booking = await this.getById(id, user);
    const listing = await ListingService.getListingById(booking.listingId);
    await AnalyticsService.trackBookingPaidOut(user, booking, listing);
    return booking.update({ status: 'host_paid' });
  }
}

module.exports = { BookingService: new BookingService() };
