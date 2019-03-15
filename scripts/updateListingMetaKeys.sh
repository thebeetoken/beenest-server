#!/usr/bin/env node

const program = require('commander');

const { Listing } = require('../src/models/sequelize');

function updateListingMetaKeys() {
  return Listing.findAll()
    .then(listings => {
      return Promise.all(listings.map(listing => {
        listing.meta = {
          ...listing.meta,
          houseRules: listing.meta.houseRules || listing.meta.house_rules,
          listingPicUrl: listing.meta.listingPicUrl || listing.meta.listing_pic_url,
          minNumberOfNights: listing.meta.minNumberOfNights || (listing.meta.accomodations && listing.meta.accomodations.minNumberOfNights),
          maxNumberOfGuests: listing.meta.maxNumberOfGuests || (listing.meta.accomodations && listing.meta.accomodations.maxNumberOfGuests),
          homeType: listing.meta.homeType || (listing.meta.accomodations && listing.meta.accomodations.homeType),
          sharedBathroom: listing.meta.sharedBathroom || (listing.meta.accomodations && listing.meta.accomodations.sharedBathroom),
          numberOfBathrooms: listing.meta.numberOfBathrooms || (listing.meta.accomodations && listing.meta.accomodations.numberOfBathrooms),
          sleepingArrangement: listing.meta.sleepingArrangement || (listing.meta.accomodations && listing.meta.accomodations.sleepingArrangement),
        }
        delete listing.meta.house_rules;
        delete listing.meta.listing_pic_url;
        delete listing.meta.accomodations;

        return listing.save();
      }));
    })
    .then(listings => {
      return Promise.resolve(listings.map(listing => {
        return `${listing.id}: listing.meta: ${JSON.stringify(listing.meta)}`;
      }))
    });
}

function main() {
  updateListingMetaKeys()
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