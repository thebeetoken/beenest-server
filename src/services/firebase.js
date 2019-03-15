const users = require('../models/users');
const User = require('../models/sequelize').User;
const firebaseAuth = require('./firebaseAuth');

// VERIFICATION STAGES
const STAGE0 = { expired: false, verification_phase_needed: 'stage0' };
const STAGE1 = { expired: false, verification_phase_needed: 'stage1' };
const STAGE2 = { expired: false, verification_phase_needed: 'stage2' };
const STAGE3 = { expired: false, verification_phase_needed: 'stage3' };
const STAGE4 = { expired: false, verification_phase_needed: 'stage4' };
const STAGE_DONE = { expired: false, verification_phase_needed: 'done' };

// Extracts firebase jwt from a req object
function extractJWT(req) {
  // extract jwt and validate its format
  let authorization = req.headers.Authorization || req.headers.authorization;
  if (!authorization) {
    const error = new Error('Missing Authorization header');
    error.statusCode = 401;

    return Promise.reject(error);
  }

  let authParts = authorization.trim().split(' ');
  if (authParts.length != 2 || authParts[0].toLowerCase() != 'bearer' || authParts[1] === 'null') {
    const error = new Error('Invalid Authorization header format');
    error.statusCode = 401;

    return Promise.reject(error);
  }

  return Promise.resolve(authParts[1]);
}

// Fetch Firebase and dbee.user records by:
// 1. fetch the firebase record based on a jwt
// 2. fetch the dbee.user record based on the firebase.uid
// 3. return both records
function fetchAndSyncUserRecords(token) {
  return getUserByIdToken(token)
    .then((firebaseData) => {
      const id = firebaseData.uid;
      const firebaseUser = firebaseData;
      return Promise.all([firebaseUser, users.fetchAndSyncUserById(id, firebaseData)]);
    }).then(([firebaseUser, rdsData]) => ({ firebaseRecord: firebaseUser, dbRecord: rdsData }));
}

// Ensures a request is properly authenticated
function ensureAuthenticated(req, res, next) {
  extractJWT(req)
    .then((token) => fetchAndSyncUserRecords(token))
    .then((record) => {
      dbeeData = record.dbRecord;
      res.locals.user = dbeeData;
      res.locals.uuid = dbeeData.userId;
      res.locals.isAdmin = User.isAdminEmail(dbeeData.email);
      next();
    })
    .catch(next);
}

// Ensures a request is properly authenticated and TRUSTED (they've passed the user trust flow)
function ensureAuthenticatedAndTrusted(req, res, next) {
  extractJWT(req)
    .then((token) => fetchAndSyncUserRecords(token))
    .then((record) => {
      dbeeData = record.dbRecord;
      firebaseData = record.firebaseRecord;
      let firebaseSummary = {
        email: firebaseData.email,
        emailVerified: firebaseData.emailVerified,
        display: firebaseData.display,
        firstName: firebaseData.firstName,
        lastName: firebaseData.lastName,
        providerIds: firebaseData.providerIds,
        profilePicUrl: dbeeData.profilePicUrl
      }

      if (!firebaseData.email) {
        return res.status(200).send(Object.assign(firebaseSummary, STAGE0));
      }
      if (!firebaseData.emailVerified) {
        return res.status(200).send(Object.assign(firebaseSummary, STAGE1));
      }
      if (!dbeeData.profilePicUrl) {
        return res.status(200).send(Object.assign(firebaseSummary, STAGE2));
      }
      if (!firebaseData.phoneNumber) {
        return res.status(200).send(Object.assign(firebaseSummary, STAGE3));
      }
      if (dbeeData.completedVerification === 0) {
        return res.status(200).send(Object.assign(firebaseSummary, STAGE4));
      }

      res.locals.user = dbeeData;
      res.locals.uuid = dbeeData.userId;
      res.locals.isAdmin = User.isAdminEmail(dbeeData.email);
      return next();
    }).catch(next);
}

/*
 * validates jwt, then calls firebase for user object based on uid extracted from jwt.
 */
function getUserByIdToken(idToken) {
  if (!idToken || idToken === 'null') {
    const err = new Error('No token defined.');
    err.statusCode = 401;
    return Promise.reject(err);
  }

  return firebaseAuth.verifyIdToken(idToken)
    .then(({ uid }) => firebaseAuth.getUser(uid))
    .then(userRecord => {
      let displayName = userRecord.displayName;
      if (displayName) {
        userRecord = Object.assign(
          userRecord,
          extractFirstAndLastName(userRecord.displayName)
        );
      }
      if (Array.isArray(userRecord.providerData)) {
        userRecord.providerIds = userRecord.providerData.map(
          provider => provider.providerId
        );
      }
      return Promise.resolve(userRecord);
    });
}

function extractFirstAndLastName(displayName) {
  if (!displayName) {
    return {};
  }
  let nameParts = displayName.split(' ');
  let lastName = nameParts.slice(-1)[0];
  let firstName = nameParts.slice(0, -1).join(' ');
  return {lastName, firstName};
}

module.exports.extractJWT = extractJWT;
module.exports.firebaseAuth = firebaseAuth;
module.exports.fetchAndSyncUserRecords = fetchAndSyncUserRecords;
module.exports.getUserByIdToken = getUserByIdToken;
module.exports.ensureAuthenticatedAndTrusted = ensureAuthenticatedAndTrusted;
module.exports.ensureAuthenticated = ensureAuthenticated;
module.exports.extractFirstAndLastName = extractFirstAndLastName;
