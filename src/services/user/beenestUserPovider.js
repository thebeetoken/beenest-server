const { User } = require('../../models/sequelize');
const firebaseAuth = require('../firebaseAuth');

class BeenestUserProvider {
  async getById(userId) {
    const [user, firebaseUser] = await Promise.all([
      User.findById(userId),
      firebaseAuth.getUser(userId),
    ]);

    return Object.assign(user, {
      phoneNumber: firebaseUser.phoneNumber,
    });
  }
}

module.exports = { BeenestUserProvider: new BeenestUserProvider() };