const testUtils = require('../../lib/testUtils');

const {
  User,
  Listing,
  Reservation
} = require('../../models/sequelize');
const { BookingService } = require('./booking');
const StripeService = require('../stripe');
const stripeConfig = require('../../../config/stripe');
const stripe = require('stripe')(stripeConfig.secretKey);
const firebaseAuth = require('../firebaseAuth');

jest.mock('../firebaseAuth');

describe('Booking Service', () => {
  const testCryptoParams = {};
  let host;
  let nonverifiedUser;
  let paymentSource;

  beforeAll(async () => {
    firebaseAuth.getUser.mockReturnValue(
      Promise.resolve({ phoneNumber: undefined })
    );
    const hostUserOpts = testUtils.createTrustedFirebaseUserOpts();
    await testUtils.initializeDatabase()
    host = await User.create(hostUserOpts);
    user = await User.create({...testUtils.createTestUserOpts(), completedVerification: true});
    nonverifiedUser = await User.create(testUtils.createTestUserOpts());
    const stripeAccount = await stripe.accounts.create({
      type: 'custom',
      country: 'US',
      email: host.email
    });
    await host.updateStripeAccountInfo({
      ...(testUtils.createUserStripeAccountInfo().stripeAccountInfo),
      stripeUserId: stripeAccount.id
    });
    await user.updateStripeAccountInfo(testUtils.createUserStripeAccountInfo().stripeAccountInfo);
    await testUtils.createCurrencyRateModels();

    paymentSource = await StripeService.addPaymentSource(user, 'tok_visa_debit');
  });
  afterAll(() => testUtils.clearDatabase());
  
  describe('guestConfirmBooking', () => {
    let testListingOpts;
    let testBookingOpts;

    beforeEach(async () => {
      testListingOpts = {
        ...(testUtils.createTestListingOpts()),
        securityDepositUsd: 0,
        pricePerNightUsd: 44,
        hostId: host.id
      };
      testBookingOpts = {
        ...(testUtils.createTestBookingOpts()),
        numberOfGuests: 1,
        guestId: user.userId,
        hostId: host.userId,
        pricePerNight: 44,
        guestTotalAmount: 12345,
        guestDepositAmount: 44,
        transactionFee: 44,
        currency: 'USD',
        creditAmountUsdApplied: 44
      }
    });

    test('throw an error if guest has not completed verification', async () => {
      const testListing = await Listing.buildWithMetaFields(testListingOpts).save();
      const testBooking = await BookingService.createBookingWithQuotes(
        {
          ...testBookingOpts,
          listingId: testListing.id,
          paymentSourceId: paymentSource.id
        },
        nonverifiedUser
      );
      expect(
        BookingService.guestConfirmBooking({ id: testBooking.id }, nonverifiedUser)
      ).rejects.toEqual(expect.any(Error));
    });

    test('advances booking status to guest_confirmed on guestConfirmBooking', async () => {
      const testListing = await Listing.buildWithMetaFields(testListingOpts).save();
      const testBooking = await BookingService.createBookingWithQuotes(
        {
          ...testBookingOpts,
          listingId: testListing.id,
          paymentSourceId: paymentSource.id
        },
        user
      );
      const confirmedBooking = await BookingService.guestConfirmBooking({
        id: testBooking.id,
        cryptoParams: testCryptoParams
      }, user);
      expect(confirmedBooking.status).toBe('guest_confirmed');
    });

    describe("when a booking is reserved", () => {
      let testListing;

      beforeEach(async () => {
        testListing = await Listing.buildWithMetaFields(testListingOpts).save();
        await Reservation.bulkReplace(testListing.id, "https://example.com", [{
          startDate: "2019-01-02",
          endDate: "2019-01-03"
        }]);
      });

      test('rejects bookings when fully reserved', async () => {
        expect(BookingService.createBookingWithQuotes({
          ...testBookingOpts,
          listingId: testListing.id,
          paymentSourceId: paymentSource.id,
          checkInDate: "2019-01-01",
          checkOutDate: "2019-01-05"
        }, user)).rejects.toEqual(expect.any(Error));
      });

      test('respects totalQuantity', async () => {
        testListing.meta.totalQuantity = 10;
        testListing.changed("meta", true);
        await testListing.save();
        expect(testListing.meta.totalQuantity).toEqual(10);
        const confirmedBooking = await BookingService.createBookingWithQuotes({
          ...testBookingOpts,
          listingId: testListing.id,
          paymentSourceId: paymentSource.id,
          checkInDate: "2019-01-01",
          checkOutDate: "2019-01-05"
        }, user);
        // Relative to the previous test, we mostly care that we haven't
        // thrown by this point.
        expect(confirmedBooking.status).toEqual(expect.any(String));
      });
    });
  });
});
