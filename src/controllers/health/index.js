const axios = require('axios');
const routes = require('express').Router();
const { sequelize } = require('../../models/sequelize');

routes.get('/', (req, res, next) => {
  res.json({msg: 'ok'});
});

routes.get('/cra0h', (req, res, next) => {
  return next(new Error('crash test'));
});

routes.get('/dbstatus', (req, res, next) => {
  sequelize.query("SELECT count(1) as num FROM `users`", { type: sequelize.QueryTypes.SELECT})
  .then(results => {
      return res.status(200).json({ num: results[0].num });
  }).catch(next);
});

module.exports = routes;
