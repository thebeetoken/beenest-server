const server = require('supertest');
const testUtils = require('../../lib/testUtils');
const User = require('../../models/sequelize').User;
const Listing = require('../../models/sequelize').Listing;
const CreditBalance = require('../../models/sequelize').CreditBalance;
const firebase = require('../../services/firebase');

const app = require('../../server');

jest.mock('../../services/firebaseAuth', () => {
  return require('../../lib/testUtils').firebaseAuthMock();
});

describe('/v2/pricing', () => {
  const currencyRates = {};
  const guestFirebaseUserOpts = testUtils.createTrustedFirebaseUserOpts();
  const hostFirebaseUserOpts = testUtils.createTrustedFirebaseUserOpts();
  const adminFirebaseUserOpts = testUtils.createTrustedFirebaseUserOpts({
    email: 'test@thebeetoken.com',
  });
  const firebaseUserOpts = testUtils.createTrustedFirebaseUserOpts();

  let guestForFirebaseAuth;
  let hostForFirebaseAuth;
  let adminForFirebaseAuth;
  let otherUserForFirebaseAuth;

  let guest;
  let host;
  let admin;
  let otherUser;
  let creditBalance;
  let listing;

  beforeAll(() => {
    firebase.firebaseAuth.autoFlush();
    const guestFirebaseUserPromise = firebase.firebaseAuth
      .createUser(guestFirebaseUserOpts)
      .then(u => (guestForFirebaseAuth = u));
    const hostFirebaseUserPromise = firebase.firebaseAuth
      .createUser(hostFirebaseUserOpts)
      .then(u => (hostForFirebaseAuth = u));
    const adminFirebaseUserPromise = firebase.firebaseAuth
      .createUser(adminFirebaseUserOpts)
      .then(u => (adminForFirebaseAuth = u));
    const otherFirebaseUserPromise = firebase.firebaseAuth
      .createUser(firebaseUserOpts)
      .then(u => (otherUserForFirebaseAuth = u));

    return Promise.all([
        guestFirebaseUserPromise,
        hostFirebaseUserPromise,
        adminFirebaseUserPromise,
        otherFirebaseUserPromise,
        testUtils.initializeDatabase(),
      ])
      .then(() => {
        return Promise.all([
          User.create(guestFirebaseUserOpts),
          User.create(hostFirebaseUserOpts),
          User.create(adminFirebaseUserOpts),
          User.create(firebaseUserOpts),
        ]);
      })
      .then(users => {
        guest = users[0];
        host = users[1];
        admin = users[2];
        otherUser = users[3];

        const listing = Listing.build(testUtils.createTestListingOpts());
        listing.hostId = host.id;
        listing.currency = 'BEE';
        listing.pricePerNightUsd = 10.0;
        listing.securityDepositUsd = 5.0;

        const creditBalance = CreditBalance.build({
          userId: guest.id,
          amountUsd: 0
        });

        return Promise.all([listing.save(), creditBalance.save()]);
      })
      .then(([savedListing, savedCreditBalance]) => {
        listing = savedListing;
        creditBalance = savedCreditBalance;
        return testUtils.createCurrencyRateModels();
      })
      .then(rates => rates.forEach(rate => currencyRates[rate.id] = rate));
  });

  test('POST /v2/pricing without valid Authorization token will fail', () => {
    const path = '/beenest/v2/pricing';
    return server(app)
      .get(path)
      .then(response => {
        expect(response.statusCode).toBe(401);
      });
  });

  test('POST /v2/pricing will return with logged in user', () => {
    const path = '/beenest/v2/pricing';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return server(app)
          .post(path)
          .set('Authorization', `Bearer ${token}`)
          .send({listingId: listing.id, numberOfGuests: 2, checkInDate: '01/02/2018', checkOutDate: '01/06/2018'})
          .then(response => {
            expect(response.statusCode).toBe(200);

            const price = response.body.price;
            const beePrice = price.paymentPrices.find(p => p.currency === 'BEE');
            const usdPrice = price.paymentPrices.find(p => p.currency === 'USD');
            const ethPrice = price.paymentPrices.find(p => p.currency === 'ETH');

            expect(price.listingId).toEqual(listing.id);

            expect(price.numberOfNights).toEqual(4);
            expect(price.numberOfGuests).toEqual(2);

            expect(beePrice.total).toEqual(currencyRates.BEE.convertFromUsd(45));
            expect(beePrice.totalUsd).toEqual(45);
            expect(usdPrice.total).toEqual(40.0);
            expect(usdPrice.totalUsd).toEqual(40.0);
        });
      });
  });

});
