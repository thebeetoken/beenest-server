const { formatToTimeZone } = require('date-fns-timezone');
const utc = { timeZone: 'Etc/UTC' };

module.exports = {
  formatISODate: date => formatToTimeZone(date, 'YYYY-MM-DD HH:mm:ssZ', utc),
  formatDate: date => formatToTimeZone(date, 'dddd, MMMM D, YYYY', utc),
  formatShortDate: date => formatToTimeZone(date, 'M/D', utc),
  formatAgodaDate: date => formatToTimeZone(date, 'YYYY-MM-DD', utc),
  formatAddress: (...args) => {
    const clean = args.filter(str => !!str && !(str.toUpperCase() === 'US' || str.toUpperCase() === 'USA'));
    return /^([0-9]|-)+$/.test(clean[clean.length - 1]) ? // No comma before postal code, if present
      clean.slice(0, -1).join(', ') + ' ' + clean.slice(-1) :
      clean.join(', ');
  },
  formatGeolocationAddress: ({ lat, lng, city, country }) => `Latitude & Longitude: ${lat}, ${lng}, ${city}, ${country}`
};
