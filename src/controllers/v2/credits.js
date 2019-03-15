const routes = require('express').Router();
const authenticatedRoutes = require('express').Router();
const firebase = require('../../services/firebase');
const { CreditService } = require('../../services/credit');

authenticatedRoutes.use(firebase.ensureAuthenticatedAndTrusted);

authenticatedRoutes.get('/me', (req, res, next) => {
  const user = res.locals.user;
  
  CreditService.getBalance(user)
    .then(creditBalance => {
      if (!creditBalance) {
        return res.json({ creditBalance: { amountUsd: 0 } });
      }
      res.json({ creditBalance: creditBalance.toJSON() });
    }).catch(next);
});

routes.use(authenticatedRoutes);
module.exports = routes;