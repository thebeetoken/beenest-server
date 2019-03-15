'use strict'

process.env.PRICE_UPDATE_SECRET = 'a12e05b9454889e95d3d384a6b2d1b9aeacq';
process.env.BEENEST_API_SERVER = 'https://api-staging.beetoken.com';

const handler = require('./handler');

(async () => {
  try {
    let output = await handler.updateRates();
  } catch(e) {
    console.error(e);
    process.exit(-1);
  }
  process.exit(0);
})();
