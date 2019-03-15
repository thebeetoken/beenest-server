const admin = require('firebase-admin');
const { FIREBASE_CONFIG, FIREBASE_URL } = require('../../../config/firebase');

const USER_NOT_FOUND = 'auth/user-not-found';

class FirebaseService {
  constructor() {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(FIREBASE_CONFIG),
        databaseURL: FIREBASE_URL,
      });
    }
    this.admin = admin.auth();
  }

  async getUserByEmail(email) {
    try {
      return await this.admin.getUserByEmail(email);
    } catch (error) {
      console.error('The email associated to the error is', email);
      throw error;
    }
  }

  async doesUserExist(email) {
    try {
      await this.admin.getUserByEmail(email);
      return true;
    } catch (err) {
      switch (err.code) {
        case USER_NOT_FOUND:
          return false;
        default:
          throw err;
      }
    }
  }

  async getUserById(id) {
    try {
      return await this.admin.getUser(id);
    } catch (err) {
      switch (err.code) {
        case USER_NOT_FOUND:
          return null;
        default:
          throw err;
      }
    }
  }

  async deleteUser(id) {
    return await this.admin.deleteUser(id);
  }

  async verifyFirebaseEmail(id) {
    return await this.admin.updateUser(id, { emailVerified: true });
  }

  async createUser({ email, password, firstName, lastName }) {
    return await this.admin.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });
  }

  async setAdmin(uid) {
    try {
      await this.admin.setCustomUserClaims(uid, {
        roles: ['admin'],
      });
      const { displayName } = await this.admin.getUser(uid);
      console.log('Added admin privileges to', displayName);
    } catch (error) {
      console.error(error);
    }
  }
}

module.exports = {
  FirebaseService: new FirebaseService(),
};
