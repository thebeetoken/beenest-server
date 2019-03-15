const routes = require('express').Router();
const { CurrencyService } = require('../../services/currency');

const SECRET = process.env.PRICE_UPDATE_SECRET || 'dev-price-update-secret';

routes.put("/:id", function (req, res, next) {
  const header = req.header('Authorization');
  if (!header || header !== `Bearer ${SECRET}`) {
    return next(new Error('Invalid secret.'));
  }
  const { id } = req.params;
  const { toUsd } = req.body;
  return CurrencyService.setExchangeRate(id, toUsd)
    .then(currencyRate => res.json({ currencyRate }))
    .catch(next);
});

module.exports = routes;
