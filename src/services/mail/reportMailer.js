const templates = require('./templates/report');

const format = require('date-fns/format');

const ENG = 'tommy@thebeetoken.com';
const OPS = 'amy@thebeetoken.com';
const TROUBLESHOOT = process.env.APP_ENV === 'production' ?
  'support@beenest.com' : // Keep these internal, for now.
  'vic+beenest@beetoken.com';


class ReportMailer {
  constructor(sender) {
    this.sender = sender;
  }

  reportMetrics(to = ENG, fromDate, toDate, weeklies, totals) {
    const dates = `${format(fromDate, 'MM/DD/YYYY')} to ${format(toDate, 'MM/DD/YYYY')}`;
    return this.sender.send({
      to,
      html: templates.metrics({ dates, weeklies, totals }),
      subject: `Beenest Weekly Report: ${dates}`
    });
  }

  reportOnboarding(to = OPS, hosts, listings, hasCalendar, date) {
    return this.sender.send({
      to,
      html: templates.onboarding({ hosts, listings, hasCalendar, date }),
      subject: 'Onboarding Report: Incomplete Hosts/Listings'
    });
  }

  reportContractEventMismatch(event, id, deltas) {
    return this.sender.send({
      to: TROUBLESHOOT,
      html: templates.mismatch({ event, id, deltas }),
      subject: `Warning: ${event.event} validation error for booking ${id}`
    });
  }
}

module.exports = ReportMailer;
