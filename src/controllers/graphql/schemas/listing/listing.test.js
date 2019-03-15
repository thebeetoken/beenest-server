const server = require('supertest');
const app = require('../../../../server');
const { User, Conference, Listing, CurrencyRate } = require('../../../../models/sequelize');
const testUtils = require('../../../../lib/testUtils');
const firebase = require('../../../../services/firebase');

jest.mock('../../../../services/firebaseAuth', () => {
  return require('../../../../lib/testUtils').firebaseAuthMock();
});

describe('listings', () => {
  const adminFirebaseUserOpts = testUtils.createTrustedFirebaseUserOpts({
    email: 'test@thebeetoken.com'
  });
  const firebaseUserOpts = testUtils.createTrustedFirebaseUserOpts();

  let adminForFirebaseAuth;
  let otherUserForFirebaseAuth;

  let listingOpts;

  beforeAll(() => {
    firebase.firebaseAuth.autoFlush();
    const adminFirebaseUserPromise = firebase.firebaseAuth
      .createUser(adminFirebaseUserOpts)
      .then(u => (adminForFirebaseAuth = u));
    const otherFirebaseUserPromise = firebase.firebaseAuth
      .createUser(firebaseUserOpts)
      .then(u => (otherUserForFirebaseAuth = u));

    return Promise.all([
      adminFirebaseUserPromise,
      otherFirebaseUserPromise,
      testUtils.initializeDatabase()
    ])
      .then(() => {
        const createCurrencyRatesPromises = testUtils
          .createAllCurrencyRateOpts()
          .map(rate => CurrencyRate.create(rate));
        return Promise.all([
          User.create(adminFirebaseUserOpts),
          User.create(firebaseUserOpts),
          ...createCurrencyRatesPromises
        ]);
      })
      .then(users => {
        admin = users[0];
        otherUser = users[1];
      });
  });

  test('allListings will load', async () => {
    expect.assertions(3);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    listing.hostId = 'fakeHostId';
    let savedListing = await listing.save();
    let query = `
      query allListings {
        allListings {
          listings {
            id
            title
          }
        }
      }`;


    firebase.firebaseAuth.changeAuthState(adminForFirebaseAuth);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
        return testUtils.sendGraphqlQuery({server: server(app), token, query})
               .then(response => {
                 expect(response.statusCode).toBe(200);
                 const parsed = JSON.parse(response.text);
                 expect(parsed.errors).toEqual(undefined);
                 expect(parsed.data.allListings.listings[0].id).toEqual(String(savedListing.id));
               });
    });
  });

  test('listing(id) with valid listing will load', async () => {
    expect.assertions(3);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    listing.hostId = 'fakeHostId';
    let savedListing = await listing.save();

    let query = `{
            listing(id: "${listing.id}"){
              id
              title
            }
          }`;

    return testUtils.sendGraphqlQuery({server: server(app), query})
      .then(response => {
        expect(response.statusCode).toBe(200);
        const parsed = JSON.parse(response.text);
        expect(parsed.data.listing.id).toEqual(String(savedListing.id));
        expect(parsed.data.listing.title).toEqual(savedListing.title);
      });
  });

  test('reservations will load', async () => {
    expect.assertions(1);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    await listing.save();

    const query = `{
      reservations(input: {
        listingId: "${listing.id}"
        startDate: "2018-01-01"
        endDate: "2018-10-10"
      }) {
        startDate
        endDate
      }
    }`;
    return testUtils.sendGraphqlQuery({ server: server(app), query })
      .then(response => expect(response.statusCode).toBe(200));
  });

  test('conferenceListings will load', async () => {
    expect.assertions(3);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    await listing.save();

    const conference = Conference.buildWithMetaFields({
      title: 'test conference 2019',
      listingIds: [listing.id],
    });
    await conference.save();

    const query = `{
      conferenceListings(conferenceId:"test-conference-2019") {
        id
        title
        description
      }
    }`;
    const response = await testUtils.sendGraphqlQuery({ server: server(app), query });

    expect(response.statusCode).toBe(200);
    const parsed = JSON.parse(response.text);
    expect(parsed.errors).toEqual(undefined);
    expect(parsed.data.conferenceListings.length).toEqual(1);
  });
});
