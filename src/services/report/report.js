const KeenAnalysis = require('keen-analysis');
const subDays = require('date-fns/sub_days');
const startOfWeek = require('date-fns/start_of_week');
const endOfWeek = require('date-fns/end_of_week');
const differenceInDays = require('date-fns/difference_in_days');
const format = require('date-fns/format');
const { Op } = require('sequelize');
const { MailService } = require('../mail');
const { AnalyticsService, Properties } = require('../analytics');
const { Booking, Calendar, Listing, User, Sequelize } = require('../../models/sequelize');
const { keenProjectId, keenApiKey } = require('../../../config/settings');

const percent = (part, whole) => whole === 0 ? '--.--%' : `${(100 * part / whole).toFixed(2)}%`;
const ratio = (part, whole) => whole === 0 ? '--.--' : `${(part/whole).toFixed(2)}`;

const keen = new KeenAnalysis({
  projectId: keenProjectId,
  readKey: keenApiKey
});

class ReportService {

  static async sendOnboardingReport(to) {
    const limit = 1000;
    const allHosts = await User.findAll({ where: { listingCount: { [Op.gt]: 0 } }, limit: limit});
    const allListings = await Listing.findAll();
    const calendars = await Calendar.findAll();
    const hasCalendar = calendars.reduce(
      (acc, { listingId }) => ({ ...acc, [listingId]: true }),
      {}
    );
    const listings = allListings.filter(listing => (
      [
        'addressLine1',
        'city',
        'country',
        'photos'
      ].some(property => !listing[property]) ||
      listing.photos.length < 2 ||
      !hasCalendar[listing.id]
    ));
    const hosts = allHosts.filter(host => [
      'about',
      'profilePicUrl',
      'stripeCustomerId',
      'walletAddress'
    ].some(property => !host[property]));
    return Promise.all([
      MailService.reportOnboarding(to, hosts, listings, hasCalendar, new Date()),
      this.sendEvents({ hosts, listings, hasCalendar })
    ]);
  }

  /**
   * called from sendOnboardingReport
   * @params is {hosts: [], listings: [], hasCalendar: {}}
   **/
  static async sendEvents(params) {
    const required = ['hosts', 'listings'];
    required.forEach(key => {
      if (!params[key]) {
        throw new Error(`reportOnboarding missing param ${key}`);
      }
    });
    const { hosts, listings, hasCalendar } = params;
    hosts.forEach(async (host) => {
      await AnalyticsService.trackUserPayoutInfoCompleted(
        host,
        { [Properties.STRIPE_EXPRESS_ACCOUNT]: !!host.stripeAccountInfo,
          [Properties.ETH_WALLET_ADDRESS]: !!host.walletAddress }
      );
      await AnalyticsService.trackUserFieldsCompleted(
        host,
        { [Properties.PROFILE_PHOTO]: !!host.profilePicUrl }
      );
    });

    listings.filter(listing => !hasCalendar[listing.id]).forEach(async (listing) => {
      await AnalyticsService.trackListingFieldsCompleted(
        hosts.find(host => host.id === listing.hostId),
        listing,
        {[Properties.CALENDAR_LINK]: false}
      );
    });

    await AnalyticsService.sleepUntilSend();
  }

  static async sendWeeklyMetrics(to = 'tommy@thebeetoken.com') {
    const today = new Date();
    const previousWeek = subDays(today, 7);
    const dateRange = [startOfWeek(previousWeek), endOfWeek(previousWeek)];
    const [
      newUsers,
      onboardedHosts,
      totalUsers,
      verifiedNewUsers,
      newListings,
      activeListings,
      startedBookings,
      guestPaidBookings,
      hostPaidBookings,
      cryptoBookings,
      nightsStayed,
    ] = await Promise.all([
      this._getNewUsersFromDateRange(dateRange),
      this._getOnboardedHostsFromDateRange(dateRange),
      this._getTotalUsers(),
      this._getVerifiedNewUsersFromDateRange(dateRange),
      this._getNewListingsFromDateRange(dateRange),
      this._getAllActiveListings(),
      this._getBookingsFromDateRange(dateRange, 'Started'),
      this._getBookingsFromDateRange(dateRange, 'PaidByGuest'),
      this._getBookingsFromDateRange(dateRange, 'PaidOut'),
      this._getCryptoBookingsFromDateRange(dateRange),
      this._getNightsStayed(dateRange),
    ]);
    const env = (process.env.RDS_HOSTNAME || '').split('.')[0];
    const weeklies = {
      'new users': newUsers,
      'onboarded hosts': `${onboardedHosts} (${percent(onboardedHosts, newUsers)})`,
      'verified users': `${verifiedNewUsers} (${percent(verifiedNewUsers, newUsers)})`,
      'new listings': newListings,
      'started bookings': startedBookings,
      'guest paid bookings': guestPaidBookings,
      'host paid bookings': hostPaidBookings,
      'crypto bookings': `${cryptoBookings} (${percent(cryptoBookings, hostPaidBookings)})`,
      'nights stayed': `${nightsStayed} (${ratio(nightsStayed, hostPaidBookings)} per completed booking)`
    };
    const totals = {
      'total users': totalUsers,
      'total active listings': activeListings
    };
    return MailService.reportMetrics(to, dateRange[0], dateRange[1], weeklies, totals);
  }

  static async _getNewUsersFromDateRange(dateRange) {
    return (await keen.query('count', {
      event_collection: 'signup',
      timeframe: { start: dateRange[0], end: dateRange[1] }
    })).result;
  }

  static _getTotalUsers() {
    return User.count();
  }

  static async _getVerifiedNewUsersFromDateRange(dateRange) {
    return (await keen.query('count', {
      event_collection: 'userVerified',
      timeframe: { start: dateRange[0], end: dateRange[1] }
    })).result;
  }

  static async _getOnboardedHostsFromDateRange(dateRange) {
    return (await keen.query('count', {
      event_collection: 'userPayoutInfoCompleted',
      timeframe: { start: dateRange[0], end: dateRange[1] },
      filters: ['ethWalletAddress', 'profilePhoto', 'stripeExpressAccount']
        .map(property => ({
          property_name: property,
          operator: 'eq',
          property_value: true
        }))
    })).result;
  }

  static async _getNewListingsFromDateRange(dateRange) {
    return (await keen.query('count', {
      event_collection: 'listingPublished',
      timeframe: { start: dateRange[0], end: dateRange[1] }
    })).result;
  }

  static _getAllActiveListings() {
    return Listing.count({
      order: [['createdAt', 'ASC']],
      where: {
        isActive: true,
      },
    });
  }

  static async _getBookingsFromDateRange(dateRange, suffix) {
    return (await keen.query('count', {
      event_collection: `booking${suffix}`,
      timeframe: { start: dateRange[0], end: dateRange[1] }
    })).result;
  }

  static async _getNightsStayed(dateRange) {
    const bookings = await Booking.findAll({
      order: [['createdAt', 'ASC']],
      where: {
        status: 'completed',
        createdAt: {
          [Op.between]: dateRange,
        },
      },
    });
    return bookings.reduce(
      (nights, { checkInDate, checkOutDate }) => nights + differenceInDays(checkOutDate, checkInDate),
      0
    );
  }

  static async _getCryptoBookingsFromDateRange(dateRange) {
    const bookings = await Booking.findAll({
      order: [['createdAt', 'ASC']],
      where: {
        status: 'completed',
        createdAt: {
          [Op.between]: dateRange,
        },
      },
    });
    return bookings.filter(({ currency }) => ['BEE', 'ETH'].includes(currency)).length;
  }
}

module.exports = ReportService;
