const ReportService = require('../src/services/report');

const EMAIL = process.env.ANALYTICS_EMAIL_RECIPIENT;

if (!EMAIL) {
  console.log('ANALYTICS_EMAIL_RECIPIENT environment variable must be set.');
  process.exit(-1);
}

ReportService
  .sendWeeklyMetrics(EMAIL)
  .then(() => {
    console.log('Successfully notified', EMAIL);
    process.exit(0);
  })
  .catch(error => {
    console.log(error);
    process.exit(-1);
  });
