const routes = require('express').Router();
const users = require('./users');
const listings = require('./listings');
const bookings = require('./bookings');
const paymentSources = require('./paymentSources');
const pricing = require('./pricing');
const stripeExpressAccounts = require('./stripeExpress');
const events = require('./events');
const credits = require('./credits');
const currencies = require('./currencies');

routes.use('/listings', listings);
routes.use('/users', users);
routes.use('/bookings', bookings);
routes.use('/payment_sources', paymentSources);
routes.use('/pricing', pricing);
routes.use('/stripe_express_accounts', stripeExpressAccounts);
routes.use('/events', events);
routes.use('/credits', credits);
routes.use('/currencies', currencies);

module.exports = routes;
