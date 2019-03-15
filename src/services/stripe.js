const _ = require('lodash');

const stripeConfig = require('../../config/stripe');
const stripe = require('stripe')(stripeConfig.secretKey);
const pricing = require('../services/pricing');

const { User, PaymentSource } = require('../models/sequelize');

const service = {
  createStripeLoginLink: (user) => {
    if (!user.stripeAccountInfo || !user.stripeAccountInfo.stripeUserId) {
      const error = new Error('User missing Stripe info.');
      return Promise.reject(error);
    }

    // Only available for Stripe Express; use dasboard login as fallback.
    return user.stripeAccountInfo.scope === 'express' ?
      stripe.accounts.createLoginLink(user.stripeAccountInfo.stripeUserId) :
      Promise.resolve({ url: 'https://dashboard.stripe.com/login' });
  },
  removePaymentSource: (user, paymentSourceId) => {
    const userId = user.id || user.userId;

    return PaymentSource.findById(paymentSourceId).then(paymentSource => {
      if (paymentSource.userId !== userId) {
        const error = new Error('Unauthorized');
        error.statusCode = 401;
        return Promise.reject(error);
      }

      return Promise.all([
          paymentSource,
          stripe.customers.deleteCard(paymentSource.meta.stripeCustomerId, paymentSource.meta.stripeSourceId)
      ]);
    }).then(([paymentSource, deleteConfirm]) => {
      if (!deleteConfirm.deleted) {
        return Promise.reject(new Error('Unable to remove card.'));
      }

      return paymentSource.destroy();
    });
  },

  addPaymentSource: async (user, stripeToken) => {
    const userId = user.id || user.userId;
    // find stripe customer or create a new one
    const [paymentSources, token] = await Promise.all([
      PaymentSource.findAll({ 
        where: { userId }
      }),
      stripe.tokens.retrieve(stripeToken)
    ]);
    const fingerprint = paymentSources.map(paymentSource => {
      return _.get(paymentSource, 'meta.stripeFingerprint');
    });
    if (fingerprint.includes(token.card.fingerprint)) {
      let error = new Error('Credit card already found');
      error.statusCode = 400;
      return Promise.reject(error);
    }
    const customer = await findOrCreateStripeCustomer(user, stripe);
    const stripeSource = await stripe.customers.createSource(customer.id, {
      source: stripeToken,
    });
    return PaymentSource.create({
      userId,
      provider: PaymentSource.providers.STRIPE,
      meta: {
        stripeSourceId: stripeSource.id,
        stripeObject: stripeSource.object,
        stripeCustomerId: stripeSource.customer,
        stripeLast4: stripeSource.last4,
        stripeExpMonth: stripeSource.month,
        stripeExpYear: stripeSource.year,
        stripeBrand: stripeSource.brand,
        stripeFingerprint: stripeSource.fingerprint
      },
    });
  },

  updatePaymentSource: (user, newData) => {
    const newPaymentSource = {
      address_city: newData.addressCity,
      address_line1: newData.addressLine1,
      address_zip: newData.addressZip,
      address_state: newData.addressState,
      exp_month: newData.expMonth,
      exp_year: newData.expYear,
    };
    const paymentSourceId = newData.id;
    const userId = user.id || user.userId;

    return PaymentSource.findById(paymentSourceId)
      .then(dbPaymentSource => {
        if (!dbPaymentSource) {
          const error = new Error('Credit card not found');
          error.statusCode = 400;
          throw Promise.reject(error);
        }
        if (!user.meta || !user.meta.stripeCustomerId) {
          const error = new Error('Stripe user not found');
          error.statusCode = 400;
          throw Promise.reject(error);
        }
        return Promise.all([
          stripe.customers.retrieve(user.meta.stripeCustomerId),
          dbPaymentSource,
        ]);
      })
      .then(([customer, dbPaymentSource]) => {
        if (!dbPaymentSource.meta || !dbPaymentSource.meta.stripeSourceId) {
          const error = new Error('Stripe payment source id not found');
          error.statusCode = 400;
          throw Promise.reject(error);
        }
        return stripe.customers.updateCard( customer.id, dbPaymentSource.meta.stripeSourceId, newPaymentSource );
      })
      .then(updatedStripeSource => {
        return PaymentSource.update({
          provider: PaymentSource.providers.STRIPE,
          userId: userId,
          meta: {
            stripeSourceId: updatedStripeSource.id,
            stripeObject: updatedStripeSource.object,
            stripeCustomerId: updatedStripeSource.customer,
            stripeLast4: updatedStripeSource.last4,
            stripeExpMonth: updatedStripeSource.month,
            stripeExpYear: updatedStripeSource.year,
            stripeBrand: updatedStripeSource.brand,
            stripeFingerprint: updatedStripeSource.fingerprint,
          },
        }, { 
          where: { id: paymentSourceId }, returning: true,
        })
        .then(() => PaymentSource.findById(paymentSourceId));
      });
  },

  chargeBooking: async (booking, paymentSource) => {
    if (!paymentSource) {
      throw new Error('Missing paymentSource');
    }
    if (booking.currency !== 'USD') {
      throw new Error('Stripe cannot charge a non-usd booking');
    }
    const allowedChargeStates = [
      'started',
      'guest_confirmed',
      'host_approved',
      'payment_failed',
    ];
    if (!allowedChargeStates.includes(booking.status)) {
      throw new Error(`Booking ${booking.id} is not in a valid state to be charged ${booking.status}`);
    }
    // does not charge stripe if guest total amount is zero
    const guestTotalAmount = _.get(booking, 'meta.guestTotalAmount')
    if (!guestTotalAmount) {
      return await booking.update({ status: 'host_paid' });
    }
    const host = await User.findById(booking.hostId);
    if (!host) {
      throw new Error('Host does not exists in our system!');
    }
    const hostStripeAccountId = _.get(host, 'meta.stripeAccountInfo.stripeUserId', null);
    const hostPayout = pricing.computeHostPayout(booking);
    const charge = await stripe.charges.create({
      amount: service.decimalAmountToInt(booking.meta.guestTotalAmount),
      currency: 'USD',
      customer: paymentSource.meta.stripeCustomerId,
      metadata: {
        bookingId: booking.id,
        guestId: booking.guestId,
        hostId: booking.hostId,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
      },
      ...(hostStripeAccountId && {
        destination: {
          amount: service.decimalAmountToInt(hostPayout),
          account: hostStripeAccountId
        }
      })
    });
    await booking.update({ status: 'host_paid' });
    return booking.updateStripeCharge(charge);
  },

  refundBookingCancellation: (booking, paymentSource, isHost) => {
    if (!paymentSource) {
      return Promise.reject(new Error('Missing paymentSource'));
    }

    if (!paymentSource.meta || !paymentSource.meta.stripeCustomerId) {
      return Promise.reject(new Error('Missing stripe customer id'));
    }

    const amount = isHost ?
      booking.getCancelRefundAmountForHost() :
      booking.getCancelRefundAmountForGuest();

    if (amount === 0) {
      return Promise.resolve(booking);
    }

    if (!booking.meta || !booking.meta.stripeChargeId) {
      return Promise.reject(new Error('Missing stripe charge'));
    }

    return stripe.refunds
      .create({
        charge: booking.meta.stripeChargeId,
        amount: service.decimalAmountToInt(amount),
        metadata: {
          customer: paymentSource.meta.stripeCustomerId,
          bookingId: booking.id,
          guestId: booking.guestId,
          hostId: booking.hostId,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          bookingCancelStatus: booking.getCancelStatus()
        },
      })
      .then(refund => booking.updateStripeRefund(refund));
  },

  decimalAmountToInt: decimalAmount => parseInt(decimalAmount * 100, 10),
  
};

module.exports = service;

// Move back into service once it's converted to class
async function findOrCreateStripeCustomer(user, stripe) {
  const userId = user.id || user.userId;
  if (user.meta && user.meta.stripeCustomerId) {
    return stripe.customers.retrieve(user.meta.stripeCustomerId);
  }
  const customer = await stripe.customers.create({ 
    email: user.email,
    metadata: { userId }
  });
  await user.updateStripeCustomerId(customer);
  return customer;
};
