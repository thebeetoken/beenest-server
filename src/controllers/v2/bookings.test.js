const server = require('supertest');
const datefns = require('date-fns');

const testUtils = require('../../lib/testUtils');
const app = require('../../server');
const { Booking, CreditBalance, CurrencyRate, Listing, PaymentSource, User } = require('../../models/sequelize');
const firebase = require('../../services/firebase');
const stripe = require('../../services/stripe');
const stripeConfig = require('../../../config/stripe');
const stripeAPI = require('stripe')(stripeConfig.secretKey);
const { CreditService } = require('../../services/credit');

jest.mock('../../services/firebaseAuth', () => {
  return require('../../lib/testUtils').firebaseAuthMock();
});

describe('/v2/bookings', () => {
  const walletAddress = '0x1234123412341234123412341234123412341234';
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

  let listing;
  let bookingUsdOpts;
  let bookingBeeOpts;
  let bookingEthOpts;

  const initialCreditAmountUsd = 75;

  beforeAll(async () => {
    firebase.firebaseAuth.autoFlush();
    guestForFirebaseAuth = await firebase.firebaseAuth
      .createUser(guestFirebaseUserOpts);
    hostForFirebaseAuth = await firebase.firebaseAuth
      .createUser(hostFirebaseUserOpts);
    adminForFirebaseAuth = await firebase.firebaseAuth
      .createUser(adminFirebaseUserOpts);
    otherUserForFirebaseAuth = await firebase.firebaseAuth
      .createUser(firebaseUserOpts);

    await testUtils.initializeDatabase();

    guest = await User.create({...guestFirebaseUserOpts, completedVerification: true});
    host = await User.create({ ...hostFirebaseUserOpts, walletAddress });
    admin = await User.create(adminFirebaseUserOpts);
    otherUser = await User.create(firebaseUserOpts);

    listing = Listing.build(testUtils.createTestListingOpts());
    listing.hostId = host.id;
    listing.pricePerNight = 50.0;
    listing.pricePerNightUsd = 10.0;
    listing.securityDeposit = 50.0;
    listing.securityDepositUsd = 5.0;

    listing = await listing.save();

    const numberOfNights = 3;
    const priceTotalNightsUsd = listing.pricePerNightUsd * numberOfNights;
    const creditAmountUsdApplied = 0;
    const transactionFee = 0;
    bookingUsdOpts = {
      listingId: listing.id,
      checkInDate: '2018-03-15',
      checkOutDate: '2018-03-18',
      hostId: listing.hostId,
      guestId: guest.id,
      pricePerNight: listing.pricePerNightUsd,
      guestTotalAmount: (priceTotalNightsUsd - creditAmountUsdApplied) + transactionFee,
      guestDepositAmount: listing.securityDepositUsd,
      transactionFee,
      currency: CurrencyRate.USD,
      numberOfGuests: 2,
      creditAmountUsdApplied,
      houseRules: listing.houseRules || '',
    };

    bookingBeeOpts = {
      ...bookingUsdOpts,
      pricePerNight: listing.pricePerNight,
      guestTotalAmount: listing.pricePerNight * numberOfNights,
      guestDepositAmount: listing.securityDeposit,
      currency: CurrencyRate.BEE,
      houseRules: listing.houseRules || '',
    };
    bookingEthOpts = {
      ...bookingUsdOpts,
      pricePerNight: listing.pricePerNight,
      guestTotalAmount: listing.pricePerNight * numberOfNights,
      guestDepositAmount: listing.securityDeposit,
      currency: CurrencyRate.ETH,
      houseRules: listing.houseRules || '',
    };

    await testUtils.createCurrencyRateModels();
  });

  afterEach(() => {
    CreditBalance.destroy({ where: {} });
  });

  test('GET /v2/bookings without valid Authorization token will fail', () => {
    const path = '/beenest/v2/bookings';
    return server(app)
      .get(path)
      .then(response => {
        expect(response.statusCode).toBe(401);
      });
  });

  test('POST /v2/bookings with valid data will create a booking with started status', () => {
    expect.assertions(3);
    const path = '/beenest/v2/bookings';

    const opts = { ...bookingUsdOpts };

    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      return server(app)
        .post(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .set('Authorization', `Bearer ${token}`)
        .send(opts)
        .then(response => {
          expect(response.statusCode).toBe(201);
          expect(response.body.booking.id).not.toBe(null);
          expect(response.body.booking.currency).toEqual('USD');
        });
    });
  });

  test('POST /v2/bookings with mismatched price will fail', () => {
    expect.assertions(1);
    const path = '/beenest/v2/bookings';

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-03-19',
      checkOutDate: '2018-03-22'
    };
    opts.pricePerNight = listing.pricePerNight - 10;

    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      return server(app)
        .post(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .set('Authorization', `Bearer ${token}`)
        .send(opts)
        .then(response => {
          expect(response.statusCode).toBe(400);
        });
    });
  });

  test('POST /v2/bookings/confirm as non-guest will fail', () => {
    expect.assertions(1);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(otherUserForFirebaseAuth);

     const opts = {
       ...bookingUsdOpts,
       checkInDate: '2018-03-23',
       checkOutDate: '2018-03-26'
     };
    
    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([token, Booking.buildWithMetaFields(opts).save()]);
      })
      .then(([token, booking]) => {
        const opts = { bookingId: booking.id };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            expect(response.statusCode).toBe(401);
          });
      });
  });

  test('POST /v2/bookings/confirm with invalid payment source will fail', () => {
    expect.assertions(1);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const paymentSourceOpts = {
      provider: 'stripe',
      userId: 'otherId',
    };

     const opts = {
       ...bookingUsdOpts,
       checkInDate: '2018-03-27',
       checkOutDate: '2018-03-30'
     };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          PaymentSource.create(paymentSourceOpts),
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = {
          bookingId: booking.id,
          paymentSourceId: paymentSource.id,
        };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            expect(response.statusCode).toBe(401);
          });
      });
  });
  
  test('POST /v2/bookings/confirm will set status to guest_confirmed status', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = { 
      ...bookingUsdOpts,
      checkInDate: '2018-04-01',
      checkOutDate: '2018-04-04'
    };

    const paymentSourceOpts = {
      provider: 'stripe',
      userId: guest.id,
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          PaymentSource.create(paymentSourceOpts),
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = {
          bookingId: booking.id,
          paymentSourceId: paymentSource.id,
        };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('guest_confirmed');
          });
      });
  });

  test('POST /v2/bookings/confirm with bee will set status to guest_confirmed', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = {
      ...bookingBeeOpts,
      checkInDate: '2018-05-11',
      checkOutDate: '2018-05-18'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save()
        ]);
      })
      .then(([token, booking]) => {
        const opts = {
          bookingId: booking.id
        };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('guest_confirmed');
          });
      })
  });

  test('POST /v2/bookings/confirm will debit credits from guest', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-04-05',
      checkOutDate: '2018-04-09'
    };

    const paymentSourceOpts = {
      provider: 'stripe',
      userId: guest.id
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          PaymentSource.create(paymentSourceOpts),
          CreditBalance.build({ userId: guest.id, amountUsd: 75 }).save(),
        ]);
      })
      .then(([token, booking, paymentSource, creditBalance]) => {
        return Promise.all([
          token,
          booking.updateCreditAmountAppliedFromUsd(10),
          paymentSource,
          creditBalance
        ]);
      })
      .then(([token, booking, paymentSource, creditBalance]) => {
        const opts = {
          bookingId: booking.id,
          paymentSourceId: paymentSource.id
        };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([
              response,
              Booking.findById(booking.id),
              CreditService.getBalance({ id: booking.guestId }),
            ]);
          })
          .then(([response, foundBooking, foundCreditBalance]) => {
            expect(response.statusCode).toBe(200);
            expect(foundCreditBalance.amountUsd).toBe(65);
          });
      });
  });

  test('POST /v2/bookings/confirm will create a booking successfully given a zero credit balance', () => {
    expect.assertions(3);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-04-11',
      checkOutDate: '2018-04-15'
    };

    const paymentSourceOpts = {
      provider: 'stripe',
      userId: guest.id
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          PaymentSource.create(paymentSourceOpts),
          CreditBalance.build({
            userId: guest.id,
            amountUsd: 0
          }).save(),
        ]);
      })
      .then(([token, booking, paymentSource, creditBalance]) => {
        const opts = {
          bookingId: booking.id,
          paymentSourceId: paymentSource.id
        };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([
              response,
              Booking.findById(booking.id),
              CreditService.getBalance({
                id: booking.guestId
              }),
            ]);
          })
          .then(([response, foundBooking, foundCreditBalance]) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.booking.creditAmountUsdApplied).toBe(0);
            expect(foundCreditBalance.amountUsd).toBe(0);
          });
      });
  });

  test('POST /v2/bookings/confirm with eth will set status to guest_confirmed', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = {
      ...bookingEthOpts,
      checkInDate: '2018-05-20',
      checkOutDate: '2018-05-21'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save()
        ]);
      })
      .then(([token, booking]) => {
        const opts = {
          bookingId: booking.id
        };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('guest_confirmed');
          });
      })
  });

  test('POST /v2/bookings/confirm will fail if an active overlapping booking exists', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/confirm';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts1 = {
      ...bookingUsdOpts,
      checkInDate: '2018-01-10',
      checkOutDate: '2018-01-12'
    };
    const opts2 = {
      ...bookingUsdOpts,
      status: 'host_paid',
      checkInDate: '2018-01-11',
      checkOutDate: '2018-01-12'
    };

    const paymentSourceOpts = {
      provider: 'stripe',
      userId: guest.id
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts1).save(),
          Booking.buildWithMetaFields(opts2).save(),
          PaymentSource.create(paymentSourceOpts),
        ]);
      })
      .then(([token, booking1, booking2, paymentSource]) => {
        const opts = {
          bookingId: booking1.id,
          paymentSourceId: paymentSource.id
        };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            const textObj = JSON.parse(response.text);
            expect(response.statusCode).toBe(500);
            expect(textObj.msg).toBe('Current booking overlaps with an active booking.');
          });
      });[]
  });

  test('POST /v2/bookings/cancel as random user will fail', () => {
    expect.assertions(1);
    const path = '/beenest/v2/bookings/cancel';
    firebase.firebaseAuth.changeAuthState(otherUserForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-04-11',
      checkOutDate: '2018-04-15'
    };

    const paymentSourceOpts = {
      provider: 'stripe',
      userId: guest.id,
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          PaymentSource.create(paymentSourceOpts),
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        booking.meta.paymentSourceId = paymentSource.id;
        return Promise.all([token, booking.save(), paymentSource]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = {
          bookingId: booking.id,
          paymentSourceId: paymentSource.id,
        };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(401);
          });
      });
  });

  // TODO: We need to mock out Geth for this test to work
  test('POST /v2/bookings/cancel with BEE after approval will set status to guest_cancelled status and refund 90% of the money', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/cancel';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    // create test booking
    const opts = {
      ...bookingBeeOpts,
      checkInDate: '2018-04-16',
      checkOutDate: '2018-04-18',
      status: 'host_paid'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([token, Booking.build(opts).save()]);
      })
      .then(([token, booking]) => {
        return Promise.all([token, booking]);
      })
      .then(([token, booking]) => {
        const opts = {
          bookingId: booking.id,
          transactionHash: 'fake_bee_cancel_transactionHash',
        };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('guest_cancel_initiated');
          });
      });
  });

  test('POST /v2/bookings/cancel with STRIPE after approval will set status to guest_cancelled status and refund 90% of the money', () => {
    expect.assertions(4);
    const path = '/beenest/v2/bookings/cancel';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);


    const opts = { ...bookingUsdOpts };
    const today = new Date();

    let checkInDate = datefns.addDays(today, 8);
    let checkOutDate = datefns.addDays(today, 11);
    opts.status = 'host_approved';
    opts.checkInDate = checkInDate;
    opts.checkOutDate = checkOutDate;
    
    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          stripe.addPaymentSource(guest, 'tok_visa'),
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        return Promise.all([
          token,
          booking.updatePaymentSource(paymentSource),
          paymentSource,
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        return Promise.all([
          token,
          stripe.chargeBooking(booking, paymentSource),
          paymentSource,
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = { bookingId: booking.id };
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('guest_cancelled');
            expect(foundBooking.meta.stripeRefundId.startsWith('re_')).toBe(
              true
            );
            expect(foundBooking.meta.stripeRefundAmount).toEqual(
              (booking.guestTotalAmount - booking.meta.transactionFee) * 0.9
            );
          });
      });
  });

  test('POST /v2/bookings/cancel before approval will set status to guest_rejected status and refund 100% of the money', () => {
    expect.assertions(3);
    const path = '/beenest/v2/bookings/cancel';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    // create test booking
    const opts = { ...bookingUsdOpts };
    let checkInDate = new Date();
    opts.checkInDate = checkInDate.setMonth(checkInDate.getMonth() + 3);
    opts.checkoutDate = checkInDate.setDate(checkInDate.getDate() + 2);
    opts.status = 'guest_confirmed';

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token =>
        Promise.all([token, Booking.buildWithMetaFields(opts).save()])
      )
      .then(([token, booking, paymentSource]) =>
        server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send({ bookingId: booking.id })
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('guest_rejected');
            expect(foundBooking.meta.stripeRefundAmount).toBe(undefined);
          })
      );
  });

  test('POST /v2/bookings/cancel will allow an admin to cancel a booking with started status', () => {
    expect.assertions(3);
    const path = '/beenest/v2/bookings/cancel';
    firebase.firebaseAuth.changeAuthState(adminForFirebaseAuth);

    // create test booking
    const opts = { ...bookingUsdOpts };
    let checkInDate = new Date();
    opts.checkInDate = checkInDate.setMonth(checkInDate.getMonth() + 3);
    opts.checkoutDate = checkInDate.setDate(checkInDate.getDate() + 2);
    opts.status = 'started';

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token =>
        Promise.all([token, Booking.buildWithMetaFields(opts).save()])
      )
      .then(([token, booking]) =>
        server(app)
        .post(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .set('Authorization', `Bearer ${token}`)
        .send({
          bookingId: booking.id
        })
        .then(response => {
          return Promise.all([response, Booking.findById(booking.id)]);
        })
        .then(([response, foundBooking]) => {
          expect(response.statusCode).toBe(200);
          expect(foundBooking.status).toBe('host_cancelled');
          expect(foundBooking.meta.stripeRefundAmount).toBe(undefined);
        })
      );
  });

  // we just default to pay to our account if host doesn't have an account
  test.skip('POST /v2/bookings/approve as admin cannot approve booking if host does not have a stripe account', () => {
    expect.assertions(3);
    const path = '/beenest/v2/bookings/approve';
    firebase.firebaseAuth.changeAuthState(adminForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-01',
      checkOutDate: '2018-05-05'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          stripe.addPaymentSource(guest, 'tok_discover'),
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        booking.meta = { ...booking.meta,
          ...{
            paymentSourceId: paymentSource.id,
          }
        };
        return Promise.all([token, booking.save(), paymentSource]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = {
          bookingId: booking.id
        };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(500);
            expect(foundBooking.status).not.toBe('host_approved');
            expect(foundBooking.meta.stripeChargeId).toBeUndefined();
          });
      });
  });

  test('POST /v2/bookings/approve as admin with stripe payment and host stripe account exists will set status to host_paid', () => {
    expect.assertions(3);
    const path = '/beenest/v2/bookings/approve';
    firebase.firebaseAuth.changeAuthState(adminForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-06',
      checkOutDate: '2018-05-09'
    };

    const stripeAccountInfo = testUtils.createUserStripeAccountInfo();

    // create test host stripe account
    const createHostStripeAccountPromise = stripeAPI.accounts.create({
      type: 'custom',
      country: 'US',
      email: host.email
    });

    // create test booking
    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          stripe.addPaymentSource(guest, 'tok_visa_debit'),
          createHostStripeAccountPromise,
        ]);
      })
      .then(([token, booking, paymentSource, hostStripeAccount]) => {
        booking.meta = { ...booking.meta, ...{
          paymentSourceId: paymentSource.id,
        }};
        
        const updatedStripeAccountOpts = {
          ...stripeAccountInfo.stripeAccountInfo,
          stripeUserId: hostStripeAccount.id
        }
        return Promise.all([
          token,
          booking.save(),
          paymentSource,
          host.updateStripeAccountInfo(updatedStripeAccountOpts)
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = { bookingId: booking.id };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('host_paid');
            expect(foundBooking.meta.stripeChargeId.startsWith('ch_')).toBe(
              true
            );
          });
      });
  });

  test('POST /v2/bookings/approve as guest will fail', () => {
    expect.assertions(1);
    const path = '/beenest/v2/bookings/approve';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-10',
      checkOutDate: '2018-05-11'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
        ]);
      })
      .then(([token, booking]) => {
        return Promise.all([token, booking.save()]);
      })
      .then(([token, booking]) => {
        const opts = { bookingId: booking.id };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(401);
          });
      });
  });
  
  test('POST /v2/bookings/reject as host will set status to host_rejected', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/reject';
    firebase.firebaseAuth.changeAuthState(hostForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-12',
      checkOutDate: '2018-05-14'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          stripe.addPaymentSource(guest, 'tok_mastercard'),
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        booking.meta = { ...booking.meta, ...{
          paymentSourceId: paymentSource.id,
        }};
        return Promise.all([token, booking.save(), paymentSource]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = { bookingId: booking.id };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(200);
            expect(foundBooking.status).toBe('host_rejected');
          });
      });
  });

  test('POST /v2/bookings/reject as guest will fail', () => {
    expect.assertions(1);
    const path = '/beenest/v2/bookings/reject';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-13',
      checkOutDate: '2018-05-15'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
        ]);
      })
      .then(([token, booking]) => {
        return Promise.all([token, booking.save()]);
      })
      .then(([token, booking]) => {
        const opts = { bookingId: booking.id };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            expect(response.statusCode).toBe(401);
          });
      });
  });

  test('POST /v2/bookings/guest_reject_payment as guest will update status to guest_rejected_payment', async () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/guest_reject_payment';
    firebase.firebaseAuth.changeAuthState(guestForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-16',
      checkOutDate: '2018-05-18'
    };

    const [token, booking] = await Promise.all([
      firebase.firebaseAuth.currentUser.getIdToken(),
      Booking.buildWithMetaFields(opts).save(),
    ]);
    const bookingId = booking.id;
    const response = await server(app)
      .post(path)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId });
    const foundBooking = await Booking.findById(bookingId);
    expect(response.statusCode).toBe(200);
    expect(foundBooking.status).toBe('guest_rejected_payment');
  });

  test('POST /v2/bookings/reject as host will refund credit applied if credit was used', () => {
    expect.assertions(3);
    const path = '/beenest/v2/bookings/reject';
    firebase.firebaseAuth.changeAuthState(hostForFirebaseAuth);

    
    const paymentSourceOpts = {
      provider: 'stripe',
      userId: guest.id
    };

    const bookingOpts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-19',
      checkOutDate: '2018-05-21'
    };
    
    const amountToDebit = 10;
    
    return firebase.firebaseAuth.currentUser
    .getIdToken()
    .then(token => {
      return Promise.all([
        token,
        Booking.buildWithMetaFields(bookingOpts).save(),
        PaymentSource.create(paymentSourceOpts)
      ]);
    })
    .then(([token, booking, paymentSource]) => {
        const newCreditBalance = CreditBalance.build({ userId: booking.guestId, amountUsd: initialCreditAmountUsd });
        return Promise.all([
          token,
          booking.updatePaymentSource(paymentSource),
          paymentSource,
          newCreditBalance.save()
        ]);
      })
      .then(([token, booking, paymentSource, savedCreditBalance]) => {
        return Promise.all([
          token,
          booking,
          paymentSource,
          CreditBalance.findByUserId(booking.guestId)
        ]);
      })
      .then(([token, booking, paymentSource, foundCreditBalance]) => {
        return Promise.all([
          token,
          booking,
          paymentSource,
          // manually debitting from balance to "fake" that the guest has paid for the booking using credits
          CreditService.debitFromBalance(
            { id: booking.guestId },
            amountToDebit,
            booking.id
          )
        ]);
      })
      .then(([token, booking, paymentSource, debitedCreditBalance]) => {
        return Promise.all([
          token,
          booking.updateCreditAmountAppliedFromUsd(amountToDebit),
          paymentSource,
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        const opts = { bookingId: booking.id };
  
        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            return Promise.all([
              response,
              foundBooking,
              CreditBalance.findByUserId(foundBooking.guestId)
            ]);
          })
          .then(([response, foundBooking, newCreditBalance]) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.booking.creditAmountUsdApplied).toBe(0);
            expect(newCreditBalance.dataValues.amountUsd).toBe(initialCreditAmountUsd);
          });
      })
  });

  test('POST /v2/bookings/reject as host will not refund credit if credit was not used', () => {
    expect.assertions(2);
    const path = '/beenest/v2/bookings/reject';
    firebase.firebaseAuth.changeAuthState(hostForFirebaseAuth);

    const opts = {
      ...bookingUsdOpts,
      checkInDate: '2018-05-22',
      checkOutDate: '2018-05-24'
    };

    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return Promise.all([
          token,
          Booking.buildWithMetaFields(opts).save(),
          stripe.addPaymentSource(guest, 'tok_mastercard_debit')
        ]);
      })
      .then(([token, booking, paymentSource]) => {
        booking.meta = { ...booking.meta, ...{ paymentSourceId: paymentSource.id }};
        return Promise.all([
          token,
          booking.save(),
          paymentSource,
          CreditBalance.findByUserId(booking.guestId),          
        ]);
      })
      .then(([token, booking, paymentSource, previousCreditBalance]) => {
        const opts = { bookingId: booking.id };

        return server(app)
          .post(path)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .set('Authorization', `Bearer ${token}`)
          .send(opts)
          .then(response => {
            return Promise.all([response, Booking.findById(booking.id)]);
          })
          .then(([response, foundBooking]) => {
            return Promise.all([
              response,
              foundBooking,
              CreditBalance.findByUserId(foundBooking.guestId)
            ]);
          })
          .then(([response, foundBooking, newCreditBalance]) => {
            expect(response.statusCode).toBe(200);
            expect(response.body.booking.creditAmountUsdApplied).toBe(0);
          });
      });
  });
});
