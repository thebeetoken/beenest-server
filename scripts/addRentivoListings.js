const { _ } = require('minimist')(process.argv.slice(2));
const { RentivoListing } = require('../src/models/sequelize');
const { saveRentivoListingsAndChannelData } = require('../src/services/rentivoAPI');

// How to run
// node scripts/addRentivoListings listingsPerPage pages

// Example
// node scripts/addRentivoListings 50 1
// node scripts/addRentivoListings 100 2

// Not entering any listingsPerPage will default to 20
// Not entering pages will result in importing all listings
// I would suggest using ~20 to not overload lycan server
async function addRentivoListings(count, pages) {
  try {
    await RentivoListing.destroy({ truncate : true, cascade: false });
  } catch (err) {
    console.error('Error in deleting Rentivo listings');
    console.error(err);
    process.exit(-1);
  }
  try {
    const listingsInPage = count || 20;
    await saveRentivoListingsAndChannelData(listingsInPage, pages);
    return console.log('Done adding Rentivo listings');
  } catch (err) {
    console.error('Error in adding Rentivo listings');
    console.error(err);
    process.exit(-1);
  }
}

addRentivoListings(_[0], _[1]).then(() => process.exit(0));