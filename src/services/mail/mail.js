const sender = require('./sender'); // Just wraps AWS.SES(...).sendEmail(...).promise()

const MailerAggregator = require('./mailerAggregator');
const HostMailer = require('./hostMailer');
const GuestMailer = require('./guestMailer');
const ReportMailer = require('./reportMailer');
const UserMailer = require('./userMailer');

module.exports = { MailService: MailerAggregator(
  [ HostMailer, GuestMailer, ReportMailer, UserMailer ].map(
    Mailer => new Mailer(sender)
  )
) };
