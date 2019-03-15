const fetch = require('node-fetch');
const { agodaApiKey, agodaSiteId } = require('../../config/settings');
const { formatAgodaDate } = require('../util/formatter');

module.exports = {
  getPricing: async ({
    checkInDate,
    checkOutDate,
    hotelIds,
    numberOfGuests
  }) => {
    const pricingResponse = await fetch('http://affiliateapi7643.agoda.com/affiliateservice/lt_v1', {
      method: 'POST',
      headers: {
        'Accept-Encoding': 'gzip,deflate',
        'Authorization': `${agodaSiteId}:${agodaApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        criteria: {
          additional: {
            currency: 'USD',
            language: 'en-us',
            occupancy: {
              numberOfAdult: numberOfGuests,
              numberOfChildren: 0
            }
          },
          checkInDate: formatAgodaDate(checkInDate),
          checkOutDate: formatAgodaDate(checkOutDate),
          hotelId: hotelIds
        }
      })
    });
    const pricing = await pricingResponse.json();
    const results = pricing.results || [];
    return results.reduce(
      (obj, result) => ({ ...obj, [result.hotelId]: result }),
      {}
    );
  }
};
