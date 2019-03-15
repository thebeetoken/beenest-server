const testUtils = require('../lib/testUtils');
const datefns = require('date-fns');
const stripeConfig = require('./../../config/stripe');
const stripe = require('stripe')(stripeConfig.secretKey);
const StripeService = require('./stripe');
const User = require('../models/sequelize').User;
const Booking = require('../models/sequelize').Booking;
const PaymentSource = require('../models/sequelize').PaymentSource;
const CreditBalance = require('../models/sequelize').CreditBalance;

describe('StripeService', () => {
  let user;
  let creditBalance;

  beforeAll(() => {
    return testUtils.initializeDatabase().then(() => {
      user = User.build(testUtils.createTestUserOpts());
      creditBalance = CreditBalance.build({
        userId: user.id,
        amountUsd: 25
      });

      return Promise.all([
        user.save(),
        creditBalance.save()
      ]);
    });
  });

  // we cannot test a positive case since we can only create express users via oauth
  test('createStripeServiceLoginLink should not return back a login url for a non express account', async () => {
    expect.assertions(1);

    try {
      const loginInfo = await StripeService.createStripeLoginLink(user);
      expect(loginInfo.url).toBe('');
    } catch (e) {
      expect(e).not.toBe(null);
    }
  });

  test('addPaymentSource should not create two customer ids if called twice', () => {
    expect.assertions(2);
    const stripeToken = 'tok_visa';

    return StripeService.addPaymentSource(user, stripeToken).then(firstSource => {
      return StripeService.addPaymentSource(user, 'tok_ca').then(secondSource => {
        expect(firstSource.meta.stripeCustomerId).toBe(secondSource.meta.stripeCustomerId);
        expect(user.meta.stripeCustomerId).toBe(firstSource.meta.stripeCustomerId);
      });
    });
  });

  test('addPaymentSource should not add the same card twice', () => {
    expect.assertions(1);
    const stripeToken = 'tok_visa_debit';

    return StripeService.addPaymentSource(user, stripeToken).then(firstSource => {
      return expect(StripeService.addPaymentSource(user, 'tok_visa_debit')).rejects.toThrow('Credit card already found');
    });
  });

  test('removePaymentSource should fail if user does not own the payment source', () => {
    expect.assertions(1);
    const stripeToken = 'tok_mastercard';

    return StripeService.addPaymentSource(user, stripeToken).then(source => {
        const nonOwnedUser = User.build(testUtils.createTestUserOpts());
        return expect(StripeService.removePaymentSource(nonOwnedUser, source.id)).rejects.not.toBe(undefined)
    });
  });

  test('removePaymentSource should delete StripeService record and delete db entry', () => {
    expect.assertions(1);
    const stripeToken = 'tok_mastercard_debit';

    let paymentSourceId;
    return StripeService.addPaymentSource(user, stripeToken).then(source => {
      paymentSourceId = source.id;
      return StripeService.removePaymentSource(user, source.id);
    }).then(() => {
      return PaymentSource.findById(paymentSourceId);
    }).then(source => {
      expect(source).toBe(null);
    });
  });

  test('refundBookingCancellation should not fail if status is in a cancel without penalty state', () => {
    expect.assertions(1);

    const stripeToken = 'tok_jcb';
    const creditAmountUsdApplied = 5;
    const today = new Date();
    let checkInDate = datefns.addDays(today, 8);
    let checkOutDate = datefns.addDays(today, 10);

    const bookingUsdOpts = {
      listingId: 1,
      checkInDate,
      checkOutDate,
      hostId: '123',
      guestId: user.id,
      pricePerNight: 1000,
      guestTotalAmount: 3120,
      guestDepositAmount: 300,
      currency: 'USD',
      numberOfGuests: 2,
      creditAmountUsdApplied
    };

    let booking = Booking.buildWithMetaFields(bookingUsdOpts);
    booking.status = 'guest_confirmed';

    return StripeService.addPaymentSource(user, stripeToken).then(source => {
      return StripeService.refundBookingCancellation(booking, source, user);
    }).then(booking => {
      expect(booking.status).toEqual('guest_confirmed');
    });
  });
});
