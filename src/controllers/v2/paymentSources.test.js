const server = require('supertest');
const testUtils = require('../../lib/testUtils');
const User = require('../../models/sequelize').User;
const PaymentSource = require('../../models/sequelize').PaymentSource;
const firebase = require('../../services/firebase');
const stripe = require('../../services/stripe');
const app = require('../../server');

jest.mock('../../services/firebaseAuth', () => {
  return require('../../lib/testUtils').firebaseAuthMock();
});

describe('/v2/payment_sources', () => {
  const trustedFirebaseUserOpts = testUtils.createTrustedFirebaseUserOpts();
  let trustedFirebaseUser;
  let trustedUser;

  beforeAll(() => {
    firebase.firebaseAuth.autoFlush();
    const createTrustedFirebaseUserPromise = firebase.firebaseAuth
      .createUser(trustedFirebaseUserOpts)
      .then(user => {
        trustedFirebaseUser = user;
      });

    return Promise.all([
      createTrustedFirebaseUserPromise,
      testUtils.initializeDatabase()
    ]).then(() => {
      trustedUser = User.build(trustedFirebaseUserOpts);
      return trustedUser.save();
    });
  });

  test('GET /v2/payment_sources without valid Authorization token will fail', () => {
    const path = '/beenest/v2/payment_sources';
    return server(app)
      .get(path)
      .then(response => {
        expect(response.statusCode).toBe(401);
      });
  });

  test('GET /v2/payment_sources with a valid Authorization token will return a list of payment sources', () => {
    expect.assertions(1);
    const path = '/beenest/v2/payment_sources';

    firebase.firebaseAuth.changeAuthState(trustedFirebaseUser);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      return server(app)
      .get(path)
      .set("Accept", "application/json")
      .expect("Content-Type", /json/)
      .set("Authorization", `Bearer ${token}`)
      .then(response => {
        expect(response.statusCode).toBe(200);
      });
    });
  });

  test('POST /v2/payment_sources with a valid stripe token will create a payment source', () => {
      expect.assertions(2);
      const path = '/beenest/v2/payment_sources';
      const opts = {stripeToken: 'tok_visa'};
      firebase.firebaseAuth.changeAuthState(trustedFirebaseUser);
      return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
        return server(app)
        .post(path)
        .send(opts)
        .set("Accept", "application/json")
        .expect("Content-Type", /json/)
        .set("Authorization", `Bearer ${token}`)
        .then(response => {
          expect(response.statusCode).toBe(200);

          return PaymentSource.findOne({where: {userId: trustedFirebaseUserOpts.id}}).then(paymentSource => {
            expect(paymentSource.userId).toBe(trustedFirebaseUserOpts.id);
          });
        });
      });
  });

  test('DELETE /beenest/v2/payment_sources/:id with a valid stripe token will delete the payment source', () => {
      expect.assertions(2);
      const stripeToken = 'tok_mastercard';

      firebase.firebaseAuth.changeAuthState(trustedFirebaseUser);
      return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
        return Promise.all([
            token, stripe.addPaymentSource(trustedUser, stripeToken)
        ]);
      }).then(([token, source]) => {
        const path = '/beenest/v2/payment_sources/' + source.id;

        return server(app)
        .delete(path)
        .set("Accept", "application/json")
        .expect("Content-Type", /json/)
        .set("Authorization", `Bearer ${token}`)
        .then(response => {
          return Promise.all([response, PaymentSource.findById(source.id)]);
        }).then(([response, paymentSource]) => {
          expect(response.statusCode).toBe(200);
          expect(paymentSource).toBe(null);
        });
      });
  });
});
