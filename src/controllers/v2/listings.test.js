const server = require('supertest');
const app = require('../../server');
const { User, Listing, CurrencyRate } = require('../../models/sequelize');
const testUtils = require('../../lib/testUtils');
const firebase = require('../../services/firebase');

jest.mock('../../services/firebaseAuth', () => {
  return require('../../lib/testUtils').firebaseAuthMock();
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
    const adminFirebaseUserPromise = firebase.firebaseAuth.createUser(adminFirebaseUserOpts).then(u => adminForFirebaseAuth = u);
    const otherFirebaseUserPromise = firebase.firebaseAuth.createUser(firebaseUserOpts).then(u => otherUserForFirebaseAuth = u);

    return Promise.all([
        adminFirebaseUserPromise,
        otherFirebaseUserPromise,
        testUtils.initializeDatabase()
      ])
      .then(() => {
        const createCurrencyRatesPromises = testUtils.createAllCurrencyRateOpts().map(rate => CurrencyRate.create(rate));
        return Promise.all([
          User.create(adminFirebaseUserOpts),
          User.create(firebaseUserOpts),
          ...createCurrencyRatesPromises,
        ]);
      })
      .then(users => {
        admin = users[0];
        otherUser = users[1];
      });
  });

  test('GET /v2/listings with valid listings will load', async () => {
    expect.assertions(1);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    listing.hostId = 'fakeHostId';
    let savedListing = await listing.save();

    const path = `/beenest/v2/listings`;
    return server(app)
        .get(path)
        .then(response => {
          expect(response.statusCode).toBe(200);
        });
  });

  test('GET /v2/listings/:id with valid listing will load', async () => {
    expect.assertions(1);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    listing.hostId = 'fakeHostId';
    let savedListing = await listing.save();

    const path = `/beenest/v2/listings/${savedListing.id}`;
    return server(app)
        .get(path)
        .then(response => {
          expect(response.statusCode).toBe(200);
        });
  });

  test('GET /v2/listings/:id with an invalid listing will respond with an error', async () => {
    expect.assertions(1);
    const path = `/beenest/v2/listings/this-is-not-a-host-id`;
    return server(app).get(path)
      .then(response => expect(response.statusCode).toBe(400));
  });

  test('GET /v2/listings/:id/reservations with valid listing will load', async () => {
    expect.assertions(1);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    listing.hostId = 'fakeHostId';
    let savedListing = await listing.save();

    const path = `/beenest/v2/listings/${savedListing.id}/reservations?startDate=2018-01-01&endDate=2018-12-01`;
    return server(app)
        .get(path)
        .then(response => {
          expect(response.statusCode).toBe(200);
        });
  });

  test('GET /v2/listings/:id.ics with valid listing will load', async () => {
    expect.assertions(1);

    listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
    listing.hostId = 'fakeHostId';
    let savedListing = await listing.save();

    const path = `/beenest/v2/listings/${savedListing.id}.ics`;
    return server(app)
        .get(path)
        .then(response => {
          expect(response.statusCode).toBe(200);
        });
  });

  test('GET /v2/listings/:id.ics with an invalid listing will respond with an error', async () => {
    expect.assertions(1);
    const path = `/beenest/v2/listings/this-is-not-a-host-id.ics`;
    return server(app).get(path)
      .then(response => expect(response.statusCode).toBe(400));
  });

  test('POST /v2/listings/updateReservations will succeed', async () => {
    expect.assertions(1);

    const path = `/beenest/v2/listings/updateReservations`;
    return server(app)
        .post(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .send({
          secret: 'dev-listing-calendar-update-secret'
        })
        .then(response => {
          expect(response.statusCode).toBe(200);
        });
  });

  test('POST /v2/listings with invalid amenities will fail', () => {
    expect.assertions(1);
    const path = '/beenest/v2/listings';

    const listingOpts = {
      hostEmail: otherUserForFirebaseAuth.email,
      title: 'Calm Beach House by the Sea Side',
      description: 'Find yourself. Escape completely',
      currency: 'USD',
      pricePerNight: 80,
      pricePerNightUsd: 80,
      securityDeposit: 20,
      securityDepositUsd: 20,
      listingPicUrl: 'https://farm1.staticflickr.com/571/32892931330_2e2b912709_z.jpg',
      addressLine1: '493 B Street',
      addressLine2: 'Suite 403',
      city: 'Washington D.C.',
      state: 'CA',
      country: 'USA',
      postalCode: '89403',
      amenities: '["Smoke detector","First aid kit","Safety cards"...',
      photos: ["https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql"],
      accomodations: {"homeType":"Entire Place","sleepingArrangement":"9878","numberOfBathrooms":987,"sharedBathroom":"8987","minNumberOfNights":89,"maxNumberOfGuests":8789},
      houseRules: "<p>Check-in: 12:00pm</p><p>Check-out: 10:00am</p><p>No play fighting</p><br><br><p>Call me at (583) 439-3948 so I can unlock the key box</p>",
      maxGuests: 5,
      minimumNights: 3,
    };

    const opts = Object.assign(listingOpts);

    firebase.firebaseAuth.changeAuthState(adminForFirebaseAuth);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      return server(app)
        .post(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .set('Authorization', `Bearer ${token}`)
        .send({
          listing: opts
        })
        .then(response => {
          expect(response.statusCode).toBe(500);
        });
    });
  });

  test('POST /v2/listings with valid data will create a listing', () => {
    expect.assertions(4);
    const path = '/beenest/v2/listings';

    const listingOpts = {
      hostEmail: otherUser.email,
      title: 'Calm Beach House by the Sea Side',
      description: 'Find yourself. Escape completely',
      currency: 'USD',
      pricePerNight: 80,
      pricePerNightUsd: 80,
      securityDeposit: 20,
      securityDepositUsd: 20,
      listingPicUrl: 'https://farm1.staticflickr.com/571/32892931330_2e2b912709_z.jpg',
      addressLine1: '493 B Street',
      addressLine2: 'Suite 403',
      city: 'Washington D.C.',
      state: 'CA',
      country: 'USA',
      postalCode: '89403',
      amenities: ["Smoke detector","First aid kit","Safety cards","Fire extinguisher"],
      photos: ["https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql"],
      accomodations: {"homeType":"Entire Place","sleepingArrangement":"9878","numberOfBathrooms":987,"sharedBathroom":"8987","minNumberOfNights":89,"maxNumberOfGuests":8789},
      houseRules: "<p>Check-in: 12:00pm</p><p>Check-out: 10:00am</p><p>No play fighting</p><br><br><p>Call me at (583) 439-3948 so I can unlock the key box</p>",
      maxGuests: 5,
      minimumNights: 3,
    };

    const opts = Object.assign(listingOpts);

    firebase.firebaseAuth.changeAuthState(adminForFirebaseAuth);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      return server(app)
        .post(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .set('Authorization', `Bearer ${token}`)
        .send({
          listing: opts
        })
        .then(response => {
          expect(response.statusCode).toBe(201);
          expect(response.body.listing.id).not.toBe(null);
          expect(response.body.listing.hostId).toEqual(otherUser.id);
          expect(response.body.listing.title).toEqual(opts.title);
        });
    });
  });

  test('POST /v2/listings with invalid user will not create listing', () => {
    expect.assertions(1);
    const path = '/beenest/v2/listings';

    const listingOpts = {
      hostId: 'ocNBeg363CWsStv44vS20KE7rXu1',
      title: 'Calm Beach House by the Sea Side',
      description: 'Find yourself. Escape completely',
      currency: 'USD',
      pricePerNight: 80,
      pricePerNightUsd: 80,
      securityDeposit: 20,
      securityDepositUsd: 20,
      listingPicUrl: 'https://farm1.staticflickr.com/571/32892931330_2e2b912709_z.jpg',
      addressLine1: '493 B Street',
      addressLine2: 'Suite 403',
      city: 'Washington D.C.',
      state: 'CA',
      country: 'USA',
      postalCode: '89403',
      amenities: ["Smoke detector","First aid kit","Safety cards","Fire extinguisher"],
      photos: ["https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql","https://stackoverflow.com/questions/4633321/how-do-i-delete-blank-rows-in-mysql"],
      accomodations: {"homeType":"Entire Place","sleepingArrangement":"9878","numberOfBathrooms":987,"sharedBathroom":"8987","minNumberOfNights":89,"maxNumberOfGuests":8789},
      houseRules: "<p>Check-in: 12:00pm</p><p>Check-out: 10:00am</p><p>No play fighting</p><br><br><p>Call me at (583) 439-3948 so I can unlock the key box</p>",
      maxGuests: 5,
      minimumNights: 3,
    };

    const opts = Object.assign(listingOpts);

    firebase.firebaseAuth.changeAuthState(otherUserForFirebaseAuth);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      return server(app)
        .post(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .set('Authorization', `Bearer ${token}`)
        .send({
          listing: opts
        })
        .then(response => {
          expect(response.statusCode).toBe(401);
        });
    });
  });


});
