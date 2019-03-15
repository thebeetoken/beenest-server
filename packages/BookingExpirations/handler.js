'use strict';

const fetch = require('node-fetch');
const SECRET = process.env.BOOKING_EXPIRE_SECRET;
const BEENEST_SERVER = process.env.BEENEST_SERVER || 'https://api.beenest.com';

function expireBookings(secret) {
  const url = `${BEENEST_SERVER}/beenest/v2/bookings/expire`;
  const body = { secret: secret };

  console.log(`POST ${url}`);
  return fetch(url, {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    method: 'POST',
    body: JSON.stringify(body)
  });
}

module.exports.expireBookings = (event, context, callback) => {
  if (!SECRET) {
    callback(new Error('No BOOKING_EXPIRE_SECRET defined'));
  }

  return expireBookings(SECRET).then(res => {
      if (!res.ok) {
	    console.log(res);
        return callback(new Error('Not successful'), {statusCode: 500, body: res.body});
      }

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          message: `Expired Bookings at ${new Date()}`
        })
      };
      callback(null, response);
    })
    .catch(err => {
      return callback(err, {statusCode: 500, body: err.message});
    });
};

