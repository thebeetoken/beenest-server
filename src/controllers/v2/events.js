const routes = require('express').Router();
const { EventService } = require('../../services/events');
const EVENTS_SECRET = process.env.EVENTS_SECRET || 'dev-events-secret';

routes.get('/', (req, res, next) => {
  const header = req.header('Authorization');
  if (!header || header !== `Bearer ${EVENTS_SECRET}`) {
    return next(new Error('Invalid secret.'));
  }
  return EventService.getLatestBlockNumber()
    .then(blockNumber => res.json({ blockNumber }))
    .catch(next);
});

routes.post('/', (req, res, next) => {
  const header = req.header('Authorization');
  if (!header || header !== `Bearer ${EVENTS_SECRET}`) {
    return next(new Error('Invalid secret.'));
  }
  return EventService.dispatch(req.body)
    .then(blockNumber => res.json({ blockNumber }))
    .catch(next);
});

module.exports = routes;
