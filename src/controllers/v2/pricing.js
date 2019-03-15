const router = require('express').Router();
const firebase = require('../../services/firebase');
const pricing = require('../../services/pricing');
const { CreditService } = require('../../services/credit');
const db = require('../../models/sequelize');
const Listing = db.Listing;
const Op = db.Sequelize.Op;
const { PricingService } = require('../../services/pricing/pricing');

router.use(firebase.ensureAuthenticatedAndTrusted);

/**
 * Gets a price quote
 *
 * @param listingId
 * @param number of guests
 * @param checkInDate
 * @param checkOutDate
 *
 **/

router.post('/', (req, res, next) => {
  const { listingId } = req.body;
  Listing.findOne({ where: { id: parseInt(listingId) } })
    .then(listing => {
      if (!listing) {
        const error = new Error('Listing not found.');
        return Promise.reject(error);
      }
      return PricingService.getPriceQuote(req.body, listing, res.locals.user);
    })
    .then(price => res.json({ price }))
    .catch(next);
});

module.exports = router;
