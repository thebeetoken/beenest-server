const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const {
  sequelize,
  CurrencyRate
} = require('../models/sequelize');

const randomNumbers = _.shuffle(_.range(10000));

module.exports = {
  initializeDatabase: () => {
    return sequelize.sync({
      force: true
    });
  },
  clearDatabase: () => {
    return true; //return sequelize.dropAllTables();
  },

  sendGraphqlQuery: ({
    server,
    token,
    query
  }) => {
    let request = server
      .post('/graphql')
      .type('form')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/);

    if (token) {
      request = request.set('Authorization', `Bearer ${token}`);
    }

    return request.send({
      query
    });
  },

  firebaseAuthMock: () => {
    const firebasemock = require('firebase-mock');
    const mockdatabase = new firebasemock.MockFirebase();
    const mockauth = new firebasemock.MockFirebase();
    const mocksdk = new firebasemock.MockFirebaseSdk(path => {
      return path ? mockdatabase.child(path) : mockdatabase;
    }, () => {
      return mockauth;
    });

    const firebase = mocksdk.initializeApp();

    return firebase.auth();
  },

  createAllCurrencyRateOpts: () => {
    return [{
      id: 'BEE',
      toUsd: 0.02
    }, {
      id: 'ETH',
      toUsd: 500
    }, {
      id: 'BTC',
      toUsd: 2000
    }];
  },

  createCurrencyRateModels: function () {
    const self = this;
    return Promise.all(self.createAllCurrencyRateOpts().map(rate => CurrencyRate.create(rate)));
  },

  createUntrustedFirebaseUserOpts: () => {
    const randomNum = randomNumbers.pop();
    return {
      id: `untrustedId${randomNum}`,
      uid: `untrustedId${randomNum}`,
      email: `testUntrustedUser${randomNum}@test-${Date.now()}.com`,
      firstName: 'FirstTestName',
      lastName: 'LastTestName',
      password: 'abc123'
    };
  },

  createTrustedFirebaseUserOpts: (opts = {}) => {
    const randomNum = randomNumbers.pop();
    return {
      id: `trusted${randomNum}`,
      uid: `trusted${randomNum}`,
      email: opts.email || `trusted${randomNum}@test-${Date.now()}.com`,
      firstName: `FirstTest${randomNum}`,
      lastName: 'LastTest',
      password: 'abc123',
      completedVerification: true,
      emailVerified: true,
      phoneNumber: '1-555-555-5555',
      profilePicUrl: 'https://beenest.com/profile.jpg'
    };
  },

  createTestUserOpts: () => {
    const randomNum = randomNumbers.pop();
    const firstName = `FirstTest${randomNum}`;
    const lastName = `LastTest${randomNum}`;
    const email = `test${randomNum}@test-${Date.now()}.com`;

    return {
      id: `${randomNum}`,
      firstName: firstName,
      lastName: lastName,
      email: email
    };
  },
  createTestListingOpts: () => {
    const randomNum = randomNumbers.pop();
    const title = `Test listing title ${randomNum}`;

    return {
      isActive: true,
      title: title,
      houseRules: 'No running in the house',
      addressLine1: '717 Market St',
      addressLine1: 'Suite 100',
      city: 'SF',
      state: 'CA',
      country: 'USA',
      postalCode: '94103',
      pricePerNightUsd: 100,
      currency: 'USD',
      maxGuests: 5,
      listingPicUrl: 'https://s3-us-west-2.amazonaws.com/beenest-public/images/listings/01-outside-01-COVER.jpg'
    };
  },

  createConsistentListingParams: (hostEmail, hostId) => {
    return {
      isActive: true,
      homeType: 'mock home type',
      sleepingArrangement: 'sleeping',
      numberOfBathrooms: 0,
      sharedBathroom: 'no',
      maxGuests: 2,
      minimumNights: 3,
      addressLine1: '717 Market Street',
      addressLine2: '',
      amenities: ['Towels', 'Soap'],
      checkInTime: {
        from: '3:00 p.m.',
        to: '11:30 p.m.'
      },
      checkOutTime: '11:00 a.m.',
      city: 'San Francisco',
      country: 'usa',
      description: 'desc',
      houseRules: '<p>No running</p>',
      hostEmail,
      hostId,
      lat: 37.787097,
      listingPicUrl: 'http://1.com',
      lng: -122.403848,
      photos: ['http://1.com', 'http://1.com', 'http://1.com', 'http://1.com'],
      postalCode: '93918',
      pricePerNightUsd: 10,
      securityDepositUsd: 40,
      state: 'CA',
      title: 'Testing Title',
    }
  },

  createTestPaymentSourceOpts: () => {
    return {
      userId: 'f64f2940-fae4-11e7-8c5f-ef356f279131',
      meta: {
        stripeSourceId: 'test_stripe_source_id',
      }
    };
  },

  createTestBookingOpts: () => {
    const listingId = 1;
    const hostId = 'host-id';
    const guestId = 'guest-id';

    const checkInDate = new Date();
    let checkOutDate = new Date();
    checkOutDate = checkOutDate.setDate(checkInDate.getDate() + 3);

    return {
      listingId: listingId,
      hostId: hostId,
      guestId: guestId,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      meta: {},
    };
  },

  createUserStripeAccountInfo: () => {
    return {
      stripeAccountInfo: {
        accessToken: `i_am_a_access_token`,
        livemode: `false`,
        refreshToken: `i_am_a_refresh_token`,
        tokenType: `bearer`,
        stripePublishableKey: `i_am_a_publishable_key`,
        stripeUserId: `acct_kcvan123456789`,
        scope: `express`
      }
    };
  },

  createTestCreditBalanceOpts: () => {
    const id = 1234;
    const userId = 'user-id';
    const initialCreditAmountUsd = 75;

    return {
      id,
      userId,
      amountUsd: initialCreditAmountUsd,
    };
  },

  createTestCreditLedgerOpts: () => {
    const guestId = 'guest-id';
    const bookingId = 'booking-id';
    const creditAmountUsd = 0;
    const debitAmountUsd = 0;
    const meta = {};

    return {
      guestId,
      bookingId,
      creditAmountUsd,
      debitAmountUsd,
      meta,
    };
  },

  cancelPayment: (param) => {
    const {
      paymentId
    } = param;
    return {
      data: {
        transactionHash: 'fake-transaction-hash'
      }
    };
  },

  createTestRentivoMemberMappings: () => require('./test_rentivo_member_mappings.json'),
  createTestRentivoListing: () => require('./test_rentivo_listing.json'),
  createTestRentivoChannel: () => require('./test_rentivo_channel.json'),
  createTestRentivoPricing: () => require('./test_rentivo_realtime_pricing_availability.json'),
};