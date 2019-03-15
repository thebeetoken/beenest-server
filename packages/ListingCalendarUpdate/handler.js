'use strict';

const fetch = require('node-fetch');
const SECRET = process.env.LISTING_CALENDAR_UPDATE_SECRET;
const BEENEST_SERVER = process.env.BEENEST_SERVER || 'https://api.beenest.com';

function updateReservations(secret) {
  const url = `${BEENEST_SERVER}/beenest/v2/listings/updateReservations`;
  const body = { secret };

  console.log(`POST ${url}`);
  return fetch(url, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(body)
  });
}

module.exports.updateListingCals = (event, context, callback) => {
  if (!SECRET) {
    callback(new Error('No SECRET defined'));
  }

  return updateReservations(SECRET).then(response => {
    if (!response.ok) {
      const { body } = response;
      console.log(response);
      return callback(new Error('Not successful'), { statusCode: 500, body });
    }

    callback(null, {
      statusCode: 200,
      body: JSON.stringify({
        message: `Updated Calendars at ${new Date()}`
      })
    });
  }).catch(err => {
    return callback(err, {statusCode: 500, body: err.message});
  });
};
