const testUtils = require('../lib/testUtils');
const User = require('./../models/sequelize').User;
const firebase = require('./firebase');

jest.mock('./firebaseAuth', () => {
  return require('../lib/testUtils').firebaseAuthMock();
});

describe('firebase', () => {
  const firebaseUserOpts = testUtils.createUntrustedFirebaseUserOpts();
  const trustedFirebaseUserOpts = testUtils.createTrustedFirebaseUserOpts();
  let untrustedFirebaseUser;
  let trustedFirebaseUser;

  beforeAll(() => {
    firebase.firebaseAuth.autoFlush();
    const createFirebaseUserPromise = firebase.firebaseAuth
      .createUser(firebaseUserOpts)
      .then(user => {
        untrustedFirebaseUser = user;
      });
    const createTrustedFirebaseUserPromise = firebase.firebaseAuth
      .createUser(trustedFirebaseUserOpts)
      .then(user => {
        trustedFirebaseUser = user;
      });

    return Promise.all([
      createFirebaseUserPromise,
      createTrustedFirebaseUserPromise,
      testUtils.initializeDatabase()
    ]).then(() => {
      const user = User.build(firebaseUserOpts);
      const trustedUser = User.build(trustedFirebaseUserOpts);
      return Promise.all([user.save(), trustedUser.save()]);
    });
  });

  test('extractJWT should return token', () => {
    expect.assertions(1);
    const token = 'JWT_TOKEN';
    const req = { headers: { Authorization: `Bearer ${token}` } };

    return firebase.extractJWT(req).then(output => {
      expect(output).toBe(token);
    });
  });

  test('getUserByIdToken should return user', () => {
    expect.assertions(1);
    firebase.firebaseAuth.changeAuthState(untrustedFirebaseUser);
    return firebase.firebaseAuth.currentUser
      .getIdToken()
      .then(token => {
        return firebase.getUserByIdToken(token);
      })
      .then(userRecord => {
        expect(userRecord.uid).toBe(firebaseUserOpts.uid);
      });
  });

  test('ensureAuthenticated should add a user to req.locals with a valid token', () => {
    expect.assertions(1);

    firebase.firebaseAuth.changeAuthState(untrustedFirebaseUser);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      const req = { headers: { Authorization: `Bearer ${token}` } };
      const res = { locals: {} };

      return new Promise((resolve, reject) => {
        firebase.ensureAuthenticated(req, res, () => {
          expect(res.locals.user.email).toBe(firebaseUserOpts.email);
          return resolve();
        });
      });
    });
  });

  test('ensureAuthenticated should not add a user to req.locals with an invalid token', () => {
    expect.assertions(1);

    const token = 'JWT_TOKEN';
    const req = { headers: { Authorization: `Bearer ${token}` } };
    const res = { locals: {} };

    return new Promise((resolve, reject) => {
      firebase.ensureAuthenticated(req, res, () => {
        expect(res.locals.user).toBe(undefined);
        return resolve();
      });
    });
  });

  test('ensureAuthenticatedAndTrusted should add a user to the res.locals with a verified email', () => {
    expect.assertions(1);

    firebase.firebaseAuth.changeAuthState(trustedFirebaseUser);
    return firebase.firebaseAuth.currentUser.getIdToken().then(token => {
      const req = { headers: { Authorization: `Bearer ${token}` } };
      const res = { locals: {} };

      return new Promise((resolve, reject) => {
        firebase.ensureAuthenticatedAndTrusted(req, res, () => {
          expect(res.locals.user.email).toBe(trustedFirebaseUserOpts.email);
          return resolve();
        });
      });
    });
  });

  test('extractFirstAndLastName with valid name returns first and last names', () => {
    let names = firebase.extractFirstAndLastName('tommy chheng');
    expect(names.firstName).toBe('tommy');
    expect(names.lastName).toBe('chheng');
  });

  test('extractFirstAndLastName with empty name should not crash', () => {
    let names = firebase.extractFirstAndLastName('');
    expect(names.firstName).toBe(undefined);
    expect(names.lastName).toBe(undefined);

    names = firebase.extractFirstAndLastName();
    expect(names.firstName).toBe(undefined);
    expect(names.lastName).toBe(undefined);
  });
});
