const fetch = require('node-fetch');
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const CURRENCY_CAPS = { BEE: 2000, BTC: 0.001, ETH: 0.05 };
const CURRENCIES = Object.keys(CURRENCY_CAPS);
const SECRET = process.env.PRICE_UPDATE_SECRET;

if (!SECRET) {
  throw new Error('PRICE_UPDATE_SECRET needs to be defined.');
}

const BEENEST_SERVER = process.env.BEENEST_API_SERVER || 'https://api-staging.beenest.com';
const HEADERS = {
  Accept: 'application/json',
  Authorization: `Bearer ${SECRET}`,
  'Content-Type': 'application/json'
};

function fetchPrice(currency, timestamp) {
  const url = `https://min-api.cryptocompare.com/data/pricehistorical?fsym=USD&tsyms=${currency}&ts=${timestamp}`;

  return fetch(url).then(res => res.json()).then(body => body.USD[currency]);
}

async function fetchAverage(currency, days) {
  if (!days || days < 1) {
    throw new Error('An average over zero days in not computable.');
  }
  const now = Date.now();
  const timestamps = [];
  while (timestamps.length < days) {
    timestamps.push(now - ONE_DAY_IN_MS * timestamps.length);
  }
  const prices = await Promise.all(timestamps.map(
    timestamp => fetchPrice(currency, timestamp)
  ));
  return prices.reduce((sum, price) => sum + price) / prices.length;
}

async function updateRates() {
  for (let currency of CURRENCIES) {
    const average = await fetchAverage(currency, 7);
    const rate = Math.min(CURRENCY_CAPS[currency], average);

    const url = `${BEENEST_SERVER}/beenest/v2/currencies/${currency}`;
    console.log(`PUT ${url}`);
    const response = await fetch(url, {
      body: JSON.stringify({ toUsd: (1 / rate) }),
      headers: HEADERS,
      method: 'PUT'
    });
    if (response.status != 200) {
      throw new Error(response.statusText);
    }
    const body = await response.text();
    console.log(body);
  }
}

module.exports = { fetchPrice, updateRates };
