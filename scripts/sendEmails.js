const { _ } = require('minimist')(process.argv.slice(2));
const { User, Booking, Listing } = require('../src/models/sequelize');
const { MailService } = require('../src/services/mail');

// send host/guest notification
async function sendEmails(email) {
  const user = await User.findOne({ where: { email } });
  const booking = await Booking.findOne({ where: { hostId: user.id } });
  return Promise.all([
    MailService.confirm(booking),
    MailService.reject(booking),
    MailService.cancel(booking),
    MailService.accept(booking),
    MailService.rescind(booking)
  ]);
}

if (!_[0]) {
  console.log("Usage: node ./scripts/sendEmails you@thebeetoken.com");
} else {
  sendEmails(_[0]).then(() => process.exit(0));
}
