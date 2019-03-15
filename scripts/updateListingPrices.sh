#!/usr/bin/env node

const program = require('commander');
const {Listing, CurrencyRate} = require('../src/models/sequelize');

function updatePrices(currency) {
  return Promise.all([
    Listing.findAll({limit: 10000}),
    CurrencyRate.findById(currency)
  ]).then(([listings, currencyRate]) => {
     return Promise.all(listings.map(listing => listing.updatePrices(currencyRate)));
  }).then(listings => {
     return Promise.resolve(listings.map(listing => {
        return `${listing.id}: pricePerNightUsd: ${listing.pricePerNightUsd} pricePerNightBee: ${listing.pricePerNight} securityDepositUsd: ${listing.securityDepositUsd} securityDepositBee: ${listing.securityDeposit}`;
     }));
  });
};
function main(opts) {
  const ethToUsd = opts.ethToUsd;
  const beeToUsd = opts.beeToUsd;

  let promises = [];
  if (ethToUsd) {
    const updateEth = CurrencyRate.upsert(
          { id: CurrencyRate.ETH, toUsd: ethToUsd, updatedAt: new Date() },
          { returning: true }
        ).then(currencyRate => {
            return updatePrices(CurrencyRate.ETH)
        });
    promises.push(updateEth);
  }

  if (beeToUsd) {
    const updateBee = CurrencyRate.upsert(
          { id: CurrencyRate.BEE, toUsd: beeToUsd, updatedAt: new Date() },
          { returning: true }
        ).then(currencyRate => {
            return updatePrices(CurrencyRate.BEE)
        });
    promises.push(updateBee);
  }

  Promise.all(promises).then(results => {
    results.forEach(result => console.log(result));

    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(-1);
  });
}

program
  .version('1.0')
  .option('--ethToUsd <n>', 'ethToUsd', parseFloat)
  .option('--beeToUsd <n>', 'beeToUsd', parseFloat)
  .parse(process.argv);

main(program);
