const allowedOrigins = [
  'https://dev01.beenest.io',
  'https://dev02.beenest.io',
  'https://dev03.beenest.io',
  'https://testnet.beenest.io',
  'http://staging.beenest.io',
  'https://staging.beenest.io',
  'http://www.beenest.io',
  'https://www.beenest.io',
  'http://beenest.com',
  'http://www.beenest.com',
  'https://www.beenest.com',
  'http://nest.beetoken.com',
  'https://nest.beetoken.com',
  'http://nest.thebeetoken.com',
  'https://nest.thebeetoken.com',
];

if (process.env.APP_ENV !== 'production' || process.env.APP_ENV !== 'staging') {
  allowedOrigins.push('http://localhost:4200');
  allowedOrigins.push('http://127.0.0.1:8000');
  allowedOrigins.push('http://localhost:8000');
}

module.exports = {
  origin: allowedOrigins
};
