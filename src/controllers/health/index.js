const AWSXRay = require('../../services/tracer');
const axios = require('axios');
const routes = require('express').Router();
const { sequelize } = require('../../models/sequelize');

routes.get('/', (req, res, next) => {
  res.json({msg: 'ok'});
});

routes.get('/cra0h', (req, res, next) => {
  return next(new Error('crash test'));
});

routes.get('/trace', (req, res, next) => {
  const segment = AWSXRay.getSegment();
  if (segment) {
    segment.addMetadata('testKey', 'testValue');
  }

  const subsegment = segment ? segment.addNewSubsegment('/trace') : null;
  if (subsegment) {
    subsegment.addMetadata('testKeySub', 'testValueSub');
  }

  axios.get('https://www.beetoken.com').then(response => {
    if (subsegment) {
      subsegment.close();
    }

    res.json({msg: 'ok'});
  }).catch(next);
});

routes.get('/dbstatus', (req, res, next) => {
  sequelize.query("SELECT count(1) as num FROM `users`", { type: sequelize.QueryTypes.SELECT})
  .then(results => {
      return res.status(200).json({ num: results[0].num });
  }).catch(next);
});

module.exports = routes;
