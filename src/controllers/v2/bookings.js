const _ = require('lodash');
const firebase = require('../../services/firebase');
const authenticatedRoutes = require('express').Router();
const routes = require('express').Router();
const stripe = require('../../services/stripe');
const pricing = require('../../services/pricing');
const { Booking, Listing, PaymentSource, User } = require('../../models/sequelize');
const { BookingService } = require('../../services/booking');
const { CreditService } = require('../../services/credit');

const BOOKING_EXPIRE_SECRET = process.env.BOOKING_EXPIRE_SECRET || 'dev-booking-expire-secret';

authenticatedRoutes.use(firebase.ensureAuthenticatedAndTrusted);

/**
 * Starts a booking request
 *
 * @param booking
 *
 **/
authenticatedRoutes.post('/', (req, res, next) => {
  const opts = _.pick(req.body, [
    'checkInDate',
    'checkOutDate',
    'currency',
    'guestWalletAddress',
    'guestDepositAmount',
    'guestTotalAmount',
    'listingId',
    'numberOfGuests',
    'pricePerNight',
    'creditAmountUsdApplied',
  ]);
  
  const guest = res.locals.user;
  opts.guestId = res.locals.user.id || res.locals.user.userId;
  
  Listing.findOne({
      where: { id: parseInt(opts.listingId) }
    })
    .then(listing => {
      if (!listing) {
        const error = new Error('Listing not found.');
        error.statusCode = 400;
        return Promise.reject(error);
      }
      return BookingService.createBooking(listing, guest, opts);
    })
    .then(booking => {
      res.status(201).json({
        booking: booking.toJSON()
      });
    })
    .catch(next);
});

/**
 * Guest confirm a booking request
 *
 * @param bookingId
 * @param paymentSourceId
 *
 **/
authenticatedRoutes.post('/confirm', (req, res, next) => {
  const guest = res.locals.user;
  const {
    bookingId,
    paymentSourceId,
    guestWalletAddress,
    paymentProtocolAddress,
    tokenContractAddress,
    transactionHash
  } = req.body;

  const cryptoParams = {
    guestWalletAddress,
    paymentProtocolAddress,
    tokenContractAddress,
    transactionHash
  };

  return Promise.all([
      Booking.findById(bookingId),
      PaymentSource.findById(paymentSourceId),
    ])
    .then(([booking, paymentSource]) => {
      // verify user is the guest and the payment source is valid
      if (booking.guestId !== guest.id) {
        let error = new Error('Wrong guest.');
        error.statusCode = 401;
        return Promise.reject(error);
      }
      if (booking.status !== 'started') {
        return Promise.reject(new Error(`booking is no longer in valid state. Expected 'started', received: ${booking.status}`));
      }
      // TODO: maybe check for valid crypto source as well
      const currency = _.get(booking, 'meta.currency');
      if (currency === 'USD' && !booking.isValidPaymentSource(paymentSource)) {
        let error = new Error('Wrong payment source.');
        error.statusCode = 401;
        return Promise.reject(error);
      }
      const intervalOpts = {
        listingId: booking.listingId,
        bookingId: booking.id, // this omits the current booking from the overlap query
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
      };

      return Promise.all([
        booking,
        paymentSource,
        Booking.findOverlappingBookings(intervalOpts)
      ]);
    })
    .then(([booking, paymentSource, bookingsArray]) => {
      if (bookingsArray.length > 0) {
        return Promise.reject(new Error('Current booking overlaps with an active booking.'));
      }
      return BookingService.guestConfirmBooking({ 
        id: booking.id,
        cryptoParams,
      }, guest);
    })
    .then(booking => res.json({ booking: booking.toJSON() }))
    .catch(next);
});

/**
 * Host approves a booking request
 * Allows admin or host to approve.
 *
 * @param bookingId the booking id
 **/

authenticatedRoutes.post('/approve', (req, res, next) => {
  const { bookingId } = req.body;
  const user = res.locals.user;

  Booking.findById(bookingId)
    .then(booking => {
      if (!booking.canApprove(user)) {
        let error = new Error('Unauthorized.');
        error.statusCode = 401;
        return Promise.reject(error);
      }
      return booking;
    })
    .then(booking => BookingService.approveBooking(booking.id, user))
    .then(booking => res.json({ booking: booking.toJSON() }))
    .catch(next);
});

/**
 * Host rejects a booking request
 *
 * @param bookingId the booking id
 **/
authenticatedRoutes.post('/reject', async (req, res, next) => {
  Booking.findById(req.body.bookingId)
    .then(booking => {
      const { user } = res.locals;
      if (!booking.canApprove(user)) {
        let error = new Error('Unauthorized.');
        error.statusCode = 401;
        return Promise.reject(error);
      }
      return BookingService.rejectBooking(booking.id, user);
    })
    .then(booking => {
      return res.json({ booking: booking.toJSON() })
    })
    .catch(next);
});

/**
 * Guest rejects a booking during
 * the metamask payment stage by clicking on reject payment.
 * 
 * Endpoint resets the status and makes
 * the dates immediately available.
 *
 * @param bookingId the booking id
 **/
authenticatedRoutes.post('/guest_reject_payment', (req, res, next) => {
  const { user } = res.locals;
  Booking.findById(req.body.bookingId)
    .then(booking => {
      if (!booking.guestRejectPayment(user)) {
        let error = new Error('Unauthorized.');
        error.statusCode = 401;
        return Promise.reject(error);
      }
      if (booking.status !== 'started') {
        let error = new Error('Unauthorized. Invalid State.');
        error.statusCode = 401;
        return Promise.reject(error);
      }
      return BookingService.guestRejectPayment(booking.id, user);
    })
    .then(booking => res.json({
      booking: booking.toJSON()
    }))
    .catch(next);
});


/**
 * Guest cancel a booking request
 *
 * @param bookingId the booking id
 **/
authenticatedRoutes.post('/cancel', (req, res, next) => {
  const { bookingId } = req.body;
  const { user } = res.locals;
  Booking.findById(bookingId)
    .then(booking => {
      if (!booking.canCancel(user)) {
        let error = new Error('Unauthorized.');
        error.statusCode = 401;
        return Promise.reject(error);
      }
      return BookingService.cancelBooking(booking.id, user)
    })
    .then(booking => res.json({ booking: booking.toJSON() }))
    .catch(next);
});

/* Expire bookings that have passed their expiration window. */
routes.post('/expire', (req, res, next) => {
  if (!req.body.secret || req.body.secret != BOOKING_EXPIRE_SECRET) {
    return next(new Error('Invalid request to expire.'));
  }
  // 
  Booking.findExpired().then(bookings => {
      // update expired booking statuses and return affected booking ids
      return bookings.map(b => {
        switch (b.status) {
          case 'started':
            b.status = 'expired_before_guest_confirmed';
            b.save();
            return b.id;
          case 'guest_paid':
            // TODO: work with product to determine behavior
            // b.status = 'expired_before_host_approved';
            // TODO: notify guest + additional return logic if ETH
            return null;
          default:
            throw new Error(`invalid expired booking status (${b.status})`);
        }
      }).filter(_ => _); // remove nulls
    })
    .then((expiredBookingIds) => res.json({
      msg: 'success',
      expiredBookingIds: expiredBookingIds
    }))
    .catch(next);
});

routes.get('/unverified', async (req, res, next) => {
  const header = req.header('Authorization');
  if (!header || header !== `Bearer ${BOOKING_EXPIRE_SECRET}`) {
    return next(new Error('Invalid credentials.'));
  }
  const bookings = await BookingService.getBookingsWithUnverifiedTransactions();
  res.json(bookings.map(booking => booking.toJSON()));
});

routes.post('/verify_transactions', async (req, res, next) => {
  const header = req.header('Authorization');
  if (!header || header !== `Bearer ${BOOKING_EXPIRE_SECRET}`) {
    return next(new Error('Invalid credentials.'));
  }
  const [count] = await BookingService.confirmBuyNowTransactions(req.body);
  res.json({ count });
});

routes.post('/expire_transactions', async (req, res, next) => {
  const header = req.header('Authorization');
  if (!header || header !== `Bearer ${BOOKING_EXPIRE_SECRET}`) {
    return next(new Error('Invalid credentials.'));
  }
  const [count] = await BookingService.expireBuyNowTransactions(req.body);
  res.json({ count });
});

routes.use(authenticatedRoutes);
module.exports = routes;
