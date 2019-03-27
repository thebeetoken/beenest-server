require('dotenv').config();

let settings = {
  appEnv: process.env.APP_ENV || 'development',
  sentryUrl: process.env.SENTRY_URL,
  segmentApiKey: process.env.SEGMENT_API_KEY,
  keenProjectId: process.env.KEEN_PROJECT_ID,
  keenApiKey: process.env.KEEN_API_KEY,
  beenestHost: 'https://dev01.beenest.io',
  btcWalletAddress: '3AxdWezuK1yLbZni56y7EzxUS7rjJnPL6U',
  paymentsContractAddress: '0x6bC080D7dFfacF4E04F6a0FC46DCe0c459A6C004', // Ropsten
  agodaHostEmail: process.env.AGODA_HOST_EMAIL,
  agodaSiteId: process.env.AGODA_SITE_ID,
  agodaApiKey: process.env.AGODA_API_KEY
}

if (process.env.APP_ENV === 'testnet') {
  settings.beenestHost = 'https://testnet.beenest.io';
}

if (process.env.APP_ENV === 'staging') {
  settings.beenestHost = 'https://staging.beenest.io';
  settings.paymentsContractAddress = '0x5f72bd79e315da1d58e8a23cdb98a9e02085dacf';
}

if (process.env.APP_ENV === 'production') {
  settings.beenestHost = 'https://www.beenest.com';
  settings.paymentsContractAddress = '0x5f72bd79e315da1d58e8a23cdb98a9e02085dacf';
}

module.exports = settings;
