#!/usr/bin/env node

const program = require('commander');

const { Listing, User, Sequelize} = require('../src/models/sequelize');

function updateListingCount() {
  const hostListingCounter = {};
  return Listing.findAll({
      type: Sequelize.QueryTypes.SELECT,
      attributes: ['host_id', [Sequelize.fn('count', Sequelize.col('host_id')), 'listing_count']],
      group: ['host_id']
    })
    .then(results => {
      results.forEach(result => {
        hostListingCounter[result.dataValues.host_id] = result.dataValues.listing_count;
      })
      return Promise.all(Object.keys(hostListingCounter).map(hostId => User.findById(hostId)));
    })
    .then(hosts => {
      return Promise.all(hosts.map(host => {
        host.meta = {
          ...host.meta,
          listingCount: undefined
        };
        return host.updateListingCount(hostListingCounter[host.id])}
      ));
    })
    .then(hosts => {
      return Promise.resolve(hosts.map(host => {
        return `${host.id}: listingCount: ${host.listingCount}`;
      }))
    });
}

function main() {
  updateListingCount()
    .then(results => {
      results.forEach(result => console.log(result));

      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(-1);
    });
}

program
  .version('1.0')
  .parse(process.argv);

main(program);