const server = require('supertest');
const app = require('../../../../server');
const { Listing, User } = require('../../../../models/sequelize');
const { BookingService } = require('../../../../services/booking');

const testUtils = require('../../../../lib/testUtils');
const firebase = require('../../../../services/firebase');

jest.mock('../../../../services/firebaseAuth', () => {
  return require('../../../../lib/testUtils').firebaseAuthMock();
});

describe('bookings', () => {
  let adminFirebaseAuth;
  let hostFirebaseAuth;
  let userOneFirebaseAuth;
  let userTwoFirebaseAuth;

  let admin;
  let host;
  let userOne;
  let userTwo;

  let listing;

  beforeAll(() => {
    firebase.firebaseAuth.autoFlush();

    const adminFirebaseOpts = testUtils.createTrustedFirebaseUserOpts({
      email: 'test@thebeetoken.com'
    });
    const hostFirebaseOpts = testUtils.createTrustedFirebaseUserOpts();
    const userOneFirebaseOpts = testUtils.createTrustedFirebaseUserOpts();
    const userTwoFirebaseOpts = testUtils.createTrustedFirebaseUserOpts();
  
    const adminFirebasePromise = firebase.firebaseAuth
      .createUser(adminFirebaseOpts)
      .then(u => (adminFirebaseAuth = u));
    const hostFirebasePromise = firebase.firebaseAuth
      .createUser(hostFirebaseOpts)
      .then(u => (hostFirebaseAuth = u));
    const userOneFirebasePromise = firebase.firebaseAuth
      .createUser(userOneFirebaseOpts)
      .then(u => (userOneFirebaseAuth = u));
    const userTwoFirebasePromise = firebase.firebaseAuth
      .createUser(userTwoFirebaseOpts)
      .then(u => (userTwoFirebaseAuth = u));

    return Promise.all([
      adminFirebasePromise,
      hostFirebasePromise,
      userOneFirebasePromise,
      userTwoFirebasePromise,
      testUtils.initializeDatabase()
    ])
      .then(() => {
        return Promise.all([
          User.create(adminFirebaseOpts),
          User.create(hostFirebaseOpts),
          User.create(userOneFirebaseOpts),
          User.create(userTwoFirebaseOpts),
        ]);
      })
      .then(results => {
        admin = results[0];
        host = results[1];
        userOne = results[2];
        userTwo = results[3];
        const listingOpts = testUtils.createConsistentListingParams(host, host.id);
        return Listing.buildWithMetaFields(listingOpts).save();
      })
      .then((savedListing) => {
        listing = savedListing;
      });
  });

  afterEach(() => testUtils.clearDatabase());

  test('createBooking with create a valid booking', async () => {
    expect.assertions(7);

    const checkInDate = "07-03-19";
    const checkOutDate = "07-06-19";
    const numberOfGuests = 1;

    const createBookingMutation = `
      mutation {
        createBooking(input: {
          checkInDate: "${checkInDate}",
          checkOutDate: "${checkOutDate}",
          listingId: "${listing.id}",
          numberOfGuests: ${numberOfGuests},
        }) {
          id
          checkInDate
          checkOutDate
          numberOfGuests
          host {
            id
          }
          guest {
            id
          }
        }
      }
    `;
    
    firebase.firebaseAuth.changeAuthState(userOneFirebaseAuth);
    const token = await firebase.firebaseAuth.currentUser.getIdToken();
    const response = await testUtils.sendGraphqlQuery({ server: server(app), token, query: createBookingMutation });
    const parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.createBooking.id).toBeTruthy();
    expect(new Date(parsed.data.createBooking.checkInDate)).toEqual(new Date(checkInDate));
    expect(new Date(parsed.data.createBooking.checkOutDate)).toEqual(new Date(checkOutDate));
    expect(parsed.data.createBooking.numberOfGuests).toEqual(numberOfGuests);
    expect(parsed.data.createBooking.host.id).toEqual(String(host.id));
    expect(parsed.data.createBooking.guest.id).toEqual(String(userOne.id));
  });

  test('booking(:id) query by admin, host, and guest should return the booking', async () => {
    expect.assertions(8);

    const checkInDate = "07-03-19";
    const checkOutDate = "07-06-19";
    const numberOfGuests = 1;

    const booking = await BookingService.createBookingWithQuotes({
      checkInDate,
      checkOutDate,
      listingId: listing.id,
      numberOfGuests,
    }, userOne);

    const query = `
      query {
        booking(id: "${booking.id}") {
          id
          checkInDate
          checkOutDate
          numberOfGuests
          host {
            id
          }
          guest {
            id
          }
        }
      }
    `;
    
    firebase.firebaseAuth.changeAuthState(adminFirebaseAuth);
    let token = await firebase.firebaseAuth.currentUser.getIdToken();
    let response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    let parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();

    firebase.firebaseAuth.changeAuthState(hostFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();

    firebase.firebaseAuth.changeAuthState(userOneFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();

    firebase.firebaseAuth.changeAuthState(userTwoFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking).toBeNull();
  });

  test('booking(:id) query for unapproved booking by non-affiliated user or host should not return guest phoneNumber ', async () => {
    const checkInDate = "07-03-19";
    const checkOutDate = "07-06-19";
    const numberOfGuests = 1;

    const unapprovedBooking = await BookingService.createBookingWithQuotes({
      checkInDate,
      checkOutDate,
      listingId: listing.id,
      numberOfGuests,
    }, userOne);

    const query = `
      query {
        booking(id: "${unapprovedBooking.id}") {
          id
          checkInDate
          checkOutDate
          numberOfGuests
          host {
            id
            phoneNumber
          }
          guest {
            id
            phoneNumber
          }
        }
      }
    `;
    
    firebase.firebaseAuth.changeAuthState(hostFirebaseAuth);
    let token = await firebase.firebaseAuth.currentUser.getIdToken();
    let response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    let parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();
    expect(parsed.data.booking.guest.phoneNumber).toBeFalsy();

    firebase.firebaseAuth.changeAuthState(userOneFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();
    expect(parsed.data.booking.host.phoneNumber).toBeFalsy();

    firebase.firebaseAuth.changeAuthState(userTwoFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking).toBeNull();

    firebase.firebaseAuth.changeAuthState(adminFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();
    expect(parsed.data.booking.guest.phoneNumber).toBeTruthy();
  });

  test('booking(:id) query for approved booking by host should return guest phoneNumber ', async () => {
    const checkInDate = "07-03-19";
    const checkOutDate = "07-06-19";
    const numberOfGuests = 1;

    const booking = await BookingService.createBookingWithQuotes({
      checkInDate,
      checkOutDate,
      listingId: listing.id,
      numberOfGuests,
    }, userOne);

    const approvedBooking = await booking.update({ status: 'host_approved' });
    const query = `
      query {
        booking(id: "${approvedBooking.id}") {
          id
          checkInDate
          checkOutDate
          numberOfGuests
          host {
            id
            phoneNumber
          }
          guest {
            id
            phoneNumber
          }
        }
      }
    `;
    
    firebase.firebaseAuth.changeAuthState(hostFirebaseAuth);
    let token = await firebase.firebaseAuth.currentUser.getIdToken();
    let response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    let parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();
    expect(parsed.data.booking.guest.phoneNumber).toBeTruthy();

    firebase.firebaseAuth.changeAuthState(userOneFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();
    expect(parsed.data.booking.guest.phoneNumber).toBeTruthy();

    firebase.firebaseAuth.changeAuthState(userTwoFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking).toBeNull();

    firebase.firebaseAuth.changeAuthState(adminFirebaseAuth);
    token = await firebase.firebaseAuth.currentUser.getIdToken();
    response = await testUtils.sendGraphqlQuery({ server: server(app), token, query });
    parsed = JSON.parse(response.text);
    expect(response.statusCode).toBe(200);
    expect(parsed.data.booking.id).toBeTruthy();
    expect(parsed.data.booking.guest.phoneNumber).toBeTruthy();
  });
});


