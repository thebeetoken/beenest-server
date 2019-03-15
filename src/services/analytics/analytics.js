const settings = require('../../../config/settings');

const SegmentAnalytics = require('analytics-node');
const analytics = new SegmentAnalytics(settings.segmentApiKey);

/**
 * @see https://docs.google.com/spreadsheets/d/1QWndoKohGPnKjmnnqRbif39woao22Kp4M_cnZv5I9N4/edit#gid=639423297
 **/
const Event = {
  // core
  SIGNUP: 'signup',
  LISTING_STARTED: 'listingStarted',
  LISTING_PUBLISHED: 'listingPublished',

  // additional
  LISTING_FIELDS_COMPLETED: 'listingFieldsCompleted',
  USER_FIELDS_COMPLETED: 'userFieldsCompleted',
  USER_PAYOUT_INFO_COMPLETED: 'userPayoutInfoCompleted',
  SIGNUP_REFERRAL_CODE_USED: 'signupReferralCodeUsed',

  USER_VERIFIED: 'userVerified',
  BOOKING_STARTED: 'bookingStarted',
  BOOKING_REQUESTED: 'bookingRequested',
  BOOKING_PAID_BY_GUEST: 'bookingPaidByGuest',
  BOOKING_PAID_OUT: 'bookingPaidOut',
  BOOKING_CONFIRMED: 'bookingConfirmed',
  BOOKING_ACCEPTED: 'bookingAccepted',
  BOOKING_REJECTED: 'bookingRejected',
  BOOKING_RESCINDED: 'bookingRescinded',
  BOOKING_CANCELLED: 'bookingCancelled',

  SEARCH: 'search'
};

const Properties = {
  STRIPE_EXPRESS_ACCOUNT: 'stripeExpressAcount',
  PROFILE_PHOTO: 'profilePhoto',
  BTC_WALLET_ADDRESS: 'btcWalletAddress',
  ETH_WALLET_ADDRESS: 'ethWalletAddress',
  CALENDAR_LINK: 'calendarLink',
  REFERRAL_CODE: 'referralCode'
};

const canSend = process.env.APP_ENV !== 'test';

class AnalyticsService {
  async trackUserSignup(user, extraProperties = {}) {
    if (!canSend) {
      return user;
    }

    try {
      await analytics.identify({
        userId: user.id,
        traits: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          adminUserLink: `${settings.beenestHost}/admin/users/${user.id}`,
          createdAt: user.createdAt,
        }
      });

      await analytics.track({
        userId: user.id,
        event: Event.SIGNUP,
        ...(extraProperties.timestamp ? { timestamp: extraProperties.timestamp } : {}),
        properties: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          isAlreadyListed: user.isAlreadyListed,
          propertiesManaged: user.propertiesManaged,
          promoCode: user.code,
          adminUserLink: `${settings.beenestHost}/admin/users/${user.id}`,
          adminListingsLink: `${settings.beenestHost}/admin/listings?userId=${user.id}`,
          isHost: extraProperties.isHost || false, // Ensure a boolean is present here
          ...extraProperties
        }
      });

      return user;
    } catch (error) {
      console.error(error);
      return user;
    }
  }

  async trackHostSignup(user, extraProperties = {}) {
    return this.trackUserSignup(user, { ...extraProperties, isHost: true });
  }

  async trackReferralCode(user, fields = {}) {
    return this.trackUserEvent(
      user,
      Event.SIGNUP_REFERRAL_CODE_USED,
      fields
    );
  }

  async trackUserPayoutInfoCompleted(user, fields = {}) {
    return this.trackUserEvent(
      user,
      Event.USER_PAYOUT_INFO_COMPLETED,
      fields
    );
  }

  async trackUserFieldsCompleted(user, fields = {}) {
    return this.trackUserEvent(
      user,
      Event.USER_FIELDS_COMPLETED,
      fields
    );
  }

  async trackUserVerified(user, fields = {}) {
    return this.trackUserEvent(
      user,
      Event.USER_VERIFIED,
      fields
    );
  }

  async trackListingStarted(user, listing, extraProperties) {
    return this.trackListingEvent(user, listing, Event.LISTING_STARTED, extraProperties);
  }

  async trackListingPublished(user, listing, extraProperties) {
    return this.trackListingEvent(user, listing, Event.LISTING_PUBLISHED, extraProperties);
  }

  async trackListingFieldsCompleted(user, listing, fields = {}) {
    return this.trackListingEvent(user, listing, Event.LISTING_FIELDS_COMPLETED, fields);
  }

  async trackBookingStarted(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_STARTED, extraProperties);
  }

  async trackBookingRequested(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_REQUESTED, extraProperties);
  }

  async trackBookingAccepted(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_ACCEPTED, extraProperties);
  }

  async trackBookingPaidByGuest(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_PAID_BY_GUEST, extraProperties);
  }

  async trackBookingPaidOut(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_PAID_OUT, extraProperties);
  }

  async trackBookingRejected(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_REJECTED, extraProperties);
  }

  async trackBookingRescinded(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_RESCINDED, extraProperties);
  }

  async trackBookingCancelled(user, booking, listing, extraProperties) {
    return this.trackBookingEvent(user, booking, listing, Event.BOOKING_CANCELLED, extraProperties);
  }

  async trackUserEvent(user, event, extraProperties = {}) {
    if (!canSend) {
      return user;
    }

    try {
      const result = await analytics.track({
        userId: user.id,
        event,
        ...(extraProperties.timestamp ? { timestamp: extraProperties.timestamp } : {}),
        properties: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          adminUserLink: `${settings.beenestHost}/admin/users/${user.id}`,
          ...extraProperties
        }
      });

      return user;
    } catch (error) {
      // this shouldn't crash the original user request
      console.error(error);
      return user;
    }
  }

  async trackListingEvent(user, listing, event, extraProperties = {}) {
    if (!canSend) {
      return listing;
    }

    if (!user || !event) {
      return listing;
    }

    try {
      await analytics.track({
        userId: user.id,
        event,
        ...(extraProperties.timestamp ? { timestamp: extraProperties.timestamp } : {}),
        properties: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          listingId: listing.id,
          adminUserLink: `${settings.beenestHost}/admin/users/${user.id}`,
          adminListingLink: `${settings.beenestHost}/admin/listings/${listing.id}/edit`,
          lat: listing.lat,
          lng: listing.lng,
          ...extraProperties
        }
      });

      return listing;
    } catch (error) {
      console.error(error);
      return listing;
    }
  }

  async trackBookingEvent(user, booking, listing, event, extraProperties = {}) {
    if (!canSend || !user || !event) {
      return booking;
    }

    try {
      await analytics.track({
        userId: user.id,
        event,
        ...(extraProperties.timestamp ? { timestamp: extraProperties.timestamp } : {}),
        properties: {
          name: user.fullName,
          email: user.email,
          bookingId: booking.id,
          listingId: booking.listingId,
          adminUserLink: `${settings.beenestHost}/admin/users/${user.id}`,
          adminListingLink: `${settings.beenestHost}/admin/listings/${booking.listingId}/edit`,
          adminBookingLink: `${settings.beenestHost}/admin/bookings/${booking.id}`,
          lat: listing.lat,
          lng: listing.lng,
          currency: booking.currency,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          numberOfNights: booking.numberOfNights,
          ...extraProperties
        }
      });

      return booking;
    } catch (error) {
      console.error(error);
      return booking;
    }
  }

  async trackSearch(query, user, extraProperties = {}) {
    if (!canSend) {
      return;
    }

    const userProperties = user ? {
      name: user.fullName,
      email: user.email,
    } : {};

    try {
      await analytics.track({
        userId: user.id,
        event: Event.SEARCH,
        ...(extraProperties.timestamp ? { timestamp: extraProperties.timestamp } : {}),
        properties: {
          name: user.fullName,
          email: user.email,
          ...query,
          ...extraProperties
        }
      });

      return query;
    } catch (error) {
      console.error(error);
      return query;
    }
  }

  /**
   * We need to sleep since AnalyticsService flushes at certain interval.
   * Use this in command line scripts.
   **/
  async sleepUntilSend() {
    const sleep = (ms) => ( new Promise(resolve => setTimeout(resolve, ms)));
    await sleep(10000);
  }
}

module.exports = { AnalyticsService: new AnalyticsService(), Properties: Properties };
