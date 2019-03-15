const winston = require('winston');
const { APP_ENV } = process.env;

const logger = winston.createLogger({
transports: [
  new (winston.transports.Console)()
]
});

logger.on('error', function (err) {
    console.error(err);
});

logger.level = APP_ENV !== 'test' ? 'info' : -1;
module.exports = logger;
