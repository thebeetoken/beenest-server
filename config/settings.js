require('dotenv').config();

let settings = {
  appEnv: process.env.APP_ENV || 'development',
  sentryUrl: process.env.SENTRY_URL,
  segmentApiKey: process.env.SEGMENT_API_KEY,
  keenProjectId: process.env.KEEN_PROJECT_ID,
  keenApiKey: process.env.KEEN_API_KEY,
  beenestHost: 'https://dev01.beenest.io',
  btcWalletAddress: '3AxdWezuK1yLbZni56y7EzxUS7rjJnPL6U',
  paymentsContractAddress: '0x3a5ad6a52582c18dad0a7d300f3a2beac3e762e4', // Ropsten
  adminHostWalletAddress: '0xC711e5d504347E086022a82A72511F4CF4184fe2',
  agodaHostEmail: process.env.AGODA_HOST_EMAIL,
  agodaSiteId: process.env.AGODA_SITE_ID,
  agodaApiKey: process.env.AGODA_API_KEY
}

if (process.env.APP_ENV === 'testnet') {
  settings.beenestHost = 'https://testnet.beenest.io';
}

if (process.env.APP_ENV === 'staging') {
  settings.beenestHost = 'https://staging.beenest.io';
  settings.paymentsContractAddress = '0xb3C348c4a6D95fee050bF8A770fC91EC60aa4ab2';
}

if (process.env.APP_ENV === 'production') {
  settings.beenestHost = 'https://www.beenest.com';
  settings.paymentsContractAddress = '0xb3C348c4a6D95fee050bF8A770fC91EC60aa4ab2';
}

module.exports = settings;
