const routes = require('express').Router();
const health = require('./health');
const photos = require('./photos');
const v2 = require('./v2');

routes.use('/beenest/v2', v2);
routes.use('/beenest/v1/health', health);
routes.use('/beenest/v1/photos', photos);
routes.use('/', (req, res) => {
  return res.json({message: 'hello world'});
});

module.exports = routes;
