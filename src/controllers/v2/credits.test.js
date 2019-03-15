const server = require('supertest');
const app = require('../../server');
const testUtils = require('../../lib/testUtils');
const User = require('../../models/sequelize').User;
const CreditBalance = require('../../models/sequelize').CreditBalance;
const firebase = require('../../services/firebase');
const credit = require('../../services/credit');

jest.mock('../../services/firebaseAuth', () => {
  return require('../../lib/testUtils').firebaseAuthMock();
});

describe('/v2/credits', () => {
  const creditBalanceOpts = testUtils.createTestCreditBalanceOpts();
  const firebaseUserOpts = testUtils.createTrustedFirebaseUserOpts();
  const initialCreditAmountUsd = 75;
  
  let userForFirebaseAuth;
  let user;

  beforeAll(() => {
    firebase.firebaseAuth.autoFlush();
    const userFirebaseUserPromise = firebase.firebaseAuth
      .createUser(firebaseUserOpts)
      .then(u => (userForFirebaseAuth = u));
    
    return Promise.all([
      userFirebaseUserPromise,
      testUtils.initializeDatabase(),
    ])
      .then(() => {
        return User.create(firebaseUserOpts)
      })
      .then(createdUser => {
        user = createdUser;
        const creditBalance = CreditBalance.build(creditBalanceOpts);
        creditBalance.userId = user.id;
        return creditBalance.save();
      })
  });

  test('GET /v2/credits/me without valid Authorization token will fail', () => {
    expect.assertions(1);
    const path = `/beenest/v2/credits/me`;

    return server(app)
      .get(path)
      .then(response => {
        expect(response.statusCode).toBe(401);
      });
  });

  test('GET /v2/credits/me with valid authorization will fetch user creditBalance', () => {
    expect.assertions(4);
    const path = '/beenest/v2/credits/me';

    firebase.firebaseAuth.changeAuthState(userForFirebaseAuth);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      return server(app)
        .get(path)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .set('Authorization', `Bearer ${token}`)
        .then(response => {
          expect(response.statusCode).toBe(200);
          expect(response.body.creditBalance).not.toBe(null || undefined);
          expect(response.body.creditBalance.amountUsd).toBe(initialCreditAmountUsd);
          expect(response.body.creditBalance.userId).toBe(user.id);
        });
    });
  });
});
