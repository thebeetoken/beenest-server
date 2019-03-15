const axios = require('axios');
const stripeExpressAccounts = require('express').Router();
const db = require('./../../models/sequelize');
const { AnalyticsService, Properties } = require('./../../services/analytics');
const stripeConfig = require('./../../../config/stripe');
const stripe = require('stripe')(stripeConfig.secretKey);
const User = db.User;

const errors = require('../../util/errors');

stripeExpressAccounts.post('/', (req, res, next) => {
  let stripeResponseData;
  const stripeExpressEndpoint = `https://connect.stripe.com/oauth/token`;
  const stripeVerificationObject = {
    code: req.query.code || req.body.code,
    client_secret: stripeConfig.secretKey,
    grant_type: 'authorization_code'
  }

  axios.post(stripeExpressEndpoint, stripeVerificationObject)
    .then(stripeResponse => {
      console.log('stripe response data: ', stripeResponse.data);
      stripeResponseData = stripeResponse.data;
      return stripe.accounts.retrieve(stripeResponseData.stripe_user_id)
    })
    .then(account => {
      return User.findOne({
        where: {
          email: account.email
        }
      });
    })
    .then(user => {
      if (!user) {
        const error = new Error("The email you are trying to use is not valid.");
        error.code = errors.NO_USER_FOUND;
        throw error;
      }

      return user.updateStripeAccountInfo(stripeResponseData);
    })
    .then(savedUser => {
      AnalyticsService.trackUserPayoutInfoCompleted(savedUser, { [Properties.STRIPE_EXPRESS_ACOUNT]: !!savedUser.stripeAccountInfo });

      res.json({
        stripeExpressAccountStatus: 'Verified'
      });
    })
    .catch(next);
});

module.exports = stripeExpressAccounts;
