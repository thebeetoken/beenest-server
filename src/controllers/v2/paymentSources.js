const authenticatedRoutes = require('express').Router();
const firebase = require('../../services/firebase');
const stripe = require('../../services/stripe');
const PaymentSource = require('../../models/sequelize').PaymentSource;

authenticatedRoutes.use(firebase.ensureAuthenticatedAndTrusted);

/**
 * Shows a user's payment sources
 **/
authenticatedRoutes.get('/', (req, res, next) => {
  const userId = res.locals.user.id;

  return PaymentSource
    .findAll({where: {userId: userId}, limit: 10})
    .then(paymentSources => {
      const paymentSourcesJson = paymentSources.map(paymentSource => paymentSource.toJSON());
      res.json({paymentSources: paymentSourcesJson});
    })
    .catch(next);
});

/**
 * Adds a payment source for a user
 *
 * @param paymentSource.stripeToken
 *
 **/
authenticatedRoutes.post('/', (req, res, next) => {
  const user = res.locals.user;
  const { stripeToken } = req.body;

  if (!stripeToken) {
    let error = new Error('Invalid Stripe Token');
    error.statusCode = 400;
    return next(error);
  }

  return stripe.addPaymentSource(user, stripeToken)
    .then(paymentSource => {
      res.json({paymentSource: paymentSource.toJSON()});
    })
    .catch(next);
});

/**
 * Removes a payment source from a user
 *
 * @param :id paymentSourceId
 *
 **/
authenticatedRoutes.delete('/:id', (req, res, next) => {
  const user = res.locals.user;
  const paymentSourceId = req.params.id;

  return stripe
    .removePaymentSource(user, paymentSourceId)
    .then(() => {
      res.json({msg: "Deleted"});
    })
    .catch(next);
});

module.exports = authenticatedRoutes;
