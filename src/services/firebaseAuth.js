// @deprecated use FirebaseService instead

const { FIREBASE_CONFIG, FIREBASE_URL } = require('../../config/firebase');
const admin = require('firebase-admin');

const config = {
  credential: admin.credential.cert(FIREBASE_CONFIG),
  databaseURL: FIREBASE_URL,
};

module.exports = !admin.apps.length ? admin.initializeApp(config).auth() : admin.app();