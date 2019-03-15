#!/usr/bin/env node

/*
 * Usage: ./scripts/sendSegmentEvents.sh
 *
 * This script loads users, listings, and bookings from the database and
 * (on a best-effort basis) recreates the tracking events that would normally
 * be emitted.
 */

const { AnalyticsService, Properties } = require('../src/services/analytics');
const { Booking, Listing, User } = require('../src/models/sequelize');
const formatter = require('../src/util/formatter');

const sequence = async (items, fn) => {
  for (const item of items) await fn(item);
};

const trackBookings = async () => sequence(await Booking.findAll(), async booking => {
  const host = await User.findById(booking.hostId);
  const guest = await User.findById(booking.guestId);
  if (!host || !guest) {
    return; // Skip external hosts (or obsolete data)
  }
  await AnalyticsService.trackBookingStarted(guest, booking, { timestamp: booking.createdAt });
  switch (booking.status) {
  case 'started':
  case 'expired_before_guest_confirmed':
    break;
  case 'guest_confirmed':
    await AnalyticsService.trackBookingRequested(guest, booking, { timestamp: booking.createdAt });
    break;
  case 'guest_cancel_initiated':
  case 'guest_cancelled':
    await AnalyticsService.trackBookingRequested(guest, booking, { timestamp: booking.createdAt });
    await AnalyticsService.trackBookingCancelled(guest, booking, { timestamp: booking.updatedAt });
    break;
  case 'host_rejected':
  case 'expired_before_host_approved':
    await AnalyticsService.trackBookingRequested(guest, booking, { timestamp: booking.createdAt });
    await AnalyticsService.trackBookingRejected(host, booking, { timestamp: booking.updatedAt });
    break;
  case 'host_approved':
    await AnalyticsService.trackBookingRequested(guest, booking, { timestamp: booking.createdAt });
    await AnalyticsService.trackBookingAccepted(host, booking, { timestamp: booking.updatedAt });
    break;
  case 'guest_paid':
    await AnalyticsService.trackBookingRequested(guest, booking, { timestamp: booking.createdAt });
    await AnalyticsService.trackBookingAccepted(host, booking, { timestamp: booking.updatedAt });
    await AnalyticsService.trackBookingPaidByGuest(guest, booking, { timestamp: booking.updatedAt });
    break;
  case 'host_cancelled':
    await AnalyticsService.trackBookingRequested(guest, booking, { timestamp: booking.createdAt });
    await AnalyticsService.trackBookingAccepted(host, booking, { timestamp: booking.updatedAt });
    await AnalyticsService.trackBookingRescinded(host, booking, { timestamp: booking.updatedAt });
    break;
  case 'host_paid':
  case 'completed':
    await AnalyticsService.trackBookingRequested(guest, booking, { timestamp: booking.createdAt });
    await AnalyticsService.trackBookingAccepted(host, booking, { timestamp: booking.updatedAt });
    await AnalyticsService.trackBookingPaidByGuest(guest, booking, { timestamp: booking.updatedAt });
    await AnalyticsService.trackBookingPaidOut(host, booking, { timestamp: booking.updatedAt });
    break;
  };
});

const trackListings = async () => sequence(await Listing.findAll(), async listing => {
  const host = await User.findById(listing.hostId);
  if (!host) {
    return; // Skip external hosts (or obsolete data)
  }
  await AnalyticsService.trackListingStarted(host, listing, { timestamp: listing.createdAt })
  if (listing.isActive) {
    await AnalyticsService.trackListingPublished(host, listing, { timestamp: listing.updatedAt || listing.createdAt });
  }
});

const trackUsers = async () => sequence(await User.findAll(), async user => {
  if (user.listingCount > 0) {
    await AnalyticsService.trackHostSignup(user, { timestamp: user.createdAt });
  } else {
    await AnalyticsService.trackUserSignup(user, { timestamp: user.createdAt });
  }
  if (user.btcWalletAddress || user.walletAddress || user.stripeAccountInfo || user.profilePicUrl) {
    await AnalyticsService.trackUserPayoutInfoCompleted(user, {
      [Properties.BTC_WALLET_ADDRESS]: !!user.btcWalletAddress,
      [Properties.ETH_WALLET_ADDRESS]: !!user.walletAddress,
      [Properties.STRIPE_EXPRESS_ACCOUNT]: !!user.stripeAccountInfo,
      [Properties.PROFILE_PHOTO]: !!user.profilePicUrl,
      timestamp: user.updatedAt || user.createdAt
    });
  }
});

(async () => {
  try {
    await trackBookings();
    await trackListings();
    await trackUsers();
    await AnalyticsService.sleepUntilSend();
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(-1);
  }
})();

