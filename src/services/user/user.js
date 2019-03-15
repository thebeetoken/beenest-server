const { Op } = require('sequelize');
const isEmail = require('validator/lib/isEmail');

const { Booking, Listing, User } = require('../../models/sequelize');
const firebaseAuth = require('../firebaseAuth');
const { FirebaseService } = require('../firebase/firebase');
const errors = require('../../util/errors');
const { PromoCodeService } = require('../../services/promoCode');
const { CreditService } = require('../../services/credit');
const { AnalyticsService, Properties } = require('../../services/analytics');
const { BeenestUserProvider } = require('./beenestUserPovider');
const { RentivoUserProvider } = require('./rentivoUserProvider');
const UserAggregator = require('./userAggregator');

const UserAggregatorService = new UserAggregator({
  rentivo: RentivoUserProvider,
}, 
  BeenestUserProvider,
);

class UserService {
  getById(id) {
    return UserAggregatorService.getById(id);
  }

  getAllUsers() {
    return User.findAll({ limit: 50, order: [['id', 'DESC']] });
  }

  async adminCreateHost({
    about,
    email,
    firstName,
    lastName,
    password,
    phoneNumber,
    profilePicUrl,
    walletAddress
  }) {
    if (
      !isEmail(email) ||
      !firstName ||
      !lastName ||
      !password
    ) {
      return Promise.reject(new Error('input not defined.'));
    }

    const user = await User.findOne({ where: { email } });
    const hasPhone = phoneNumber && phoneNumber.length > 6;
    let firebaseUser;
    try {
      firebaseUser = await firebaseAuth.getUserByEmail(email);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }

      firebaseUser = await firebaseAuth.createUser({
        email,
        password,
        ...(hasPhone ? { phoneNumber } : {}),
        displayName: `${firstName} ${lastName}`,
        photoURL: profilePicUrl,
        emailVerified: true,
        disabled: false,
      });
    }

    if (user && firebaseUser) {
      if (user.id !== firebaseUser.uid) {
        console.log(
          `User ids not matching for ${email}, DB: ${user.id} FB: ${
            firebaseUser.uid
          }`
        );
        console.log(`Overwriting DB: ${user.id} with: ${firebaseUser.uid}`);
        const updatedUserResults = await User.update(
          { id: firebaseUser.uid },
          { where: { id: user.id }, returning: true }
        );
        return updatedUserResults[0];
      }
      return user;
    }

    if (!user && firebaseUser) {
      console.log(`No user found for ${email}, creating one.`);
      const newUser = User.buildWithMetaFields({
        about,
        firstName,
        lastName,
        id: firebaseUser.uid,
        email,
        profilePicUrl,
        completedVerification: true,
        walletAddress,
      });
      await AnalyticsService.trackUserVerified(newUser);
      return newUser.save();
    }

    return Promise.reject(new Error('Missing firebase user.'));
  }

  async createOrLoginWithProviders(id) {
    const firebaseUser = await FirebaseService.getUserById(id);
    if (!firebaseUser) {
      throw new Error('No user found.');
    }
    const foundUser = await User.findOne({ where: { id: id } });
    if (foundUser) {
      return foundUser;
    }
    const { email, displayName, photoURL, uid } = firebaseUser;
    if (email) {
      await FirebaseService.verifyFirebaseEmail(id);
    }
    const newUser = User.buildWithMetaFields({
      email: email || null,
      firstName: displayName.split(' ')[0],
      id: uid,
      lastName: displayName.split(' ')[1] || null,
      profilePicUrl: photoURL || null
    });
    return newUser.save();
  }

  async createHost(userInput) {
    const createdUser = await this.createUser(userInput);
    const { password, ...userInputWithNoPassword } = userInput;
    await AnalyticsService.trackHostSignup({id: createdUser.id, ...userInputWithNoPassword});

    return createdUser;
  }

  async createUser(user) {
    const hasCode = user.code && (user.code.length > 0);

    const validCreditCode = PromoCodeService.isCreditCodeValid(user.code);
    const validReferralCode = PromoCodeService.isReferralCodeValid(user.code);

    if (hasCode && (!validCreditCode || !validReferralCode)) {
      const error = new Error('Promotional code not found or expired.');
      error.code = errors.INVALID_INPUT;
      throw error;
    }

    const foundUser = await User.findOne({ where: { email: user.email } });
    if (foundUser) {
      throw new Error('An account with this email already exists.');
    }
    const firebaseUserExists = await FirebaseService.doesUserExist(user.email);
    if (firebaseUserExists) {
      throw new Error('An account with this email already exists.');
    }

    const newFirebaseUser = await FirebaseService.createUser(user);
    const { email, firstName, lastName } = user;
    const newUser = await User.build({
      email,
      firstName,
      lastName,
      id: newFirebaseUser.uid,
    });

    const createdUser = await newUser.save();
    await AnalyticsService.trackUserSignup(createdUser);

    if (user.code) {
      await PromoCodeService.creditUser(createdUser, user.code);
      await PromoCodeService.registerReferralCode(createdUser, user.code);
    }

    return createdUser;
  }

  async deleteUser(id) {
    try {
      const foundUser = await User.findOne({ where: { id } });
      if (!foundUser) {
        const error = new Error('No user found.');
        error.code = errors.NO_USER_FOUND;
        throw error;
      }

      const foundFirebaseUser = await FirebaseService.getUserById(id);
      if (!foundFirebaseUser) {
        const error = new Error('No Firebase user found.');
        error.code = errors.NO_USER_FOUND;
        throw error;
      }

      const foundListing = await Listing.getHostListings(id);
      if (foundListing.length > 0) {
        const error = new Error('This host is associated with at least one listing, cannot delete host.');
        error.code = errors.UNABLE_TO_DELETE;
        throw error;
      }

      const foundBookings = await Booking.getGuestBookings(id);
      if (foundBookings.length > 0) {
        const error = new Error('This user is associated with at least one booking, cannot delete user.');
        error.code = errors.UNABLE_TO_DELETE;
        throw error;
      }

      const rowDeleted = await User.destroy({
        where: {
           id: id,
        },
      });
      if (rowDeleted === 0) {
        const error = new Error('User was unsuccessfully deleted from Beenest DB.');
        error.code = errors.UNABLE_TO_DELETE;
        throw error;
      }

      await FirebaseService.deleteUser(id);
      const firebaseUserFound = await FirebaseService.getUserById(id);
      if (firebaseUserFound) {
        const error = new Error('User was unsuccessfully deleted from Firebase DB.');
        error.code = errors.UNABLE_TO_DELETE;
        throw error;
      }

      return foundUser;
    } catch (err) {
      throw err;
    }
  }

  async search(opts = {}) {
    const { isHost, limit, offset, query } = opts;
    const { count, rows } = await User.findAndCountAll({
      offset,
      limit: limit || 50,
      where: {
        ...(query ? { email: { [Op.like]: `%${query.toLowerCase()}%` } } : {}),
        ...(isHost ? { listingCount: { [Op.gt]: 0 } } : {})
      }
    });
    return { users: rows, count };
  }

  async updateHost(newHostInfo, user) {
    const foundHost = await User.findByPk(newHostInfo.id);
    if (!foundHost) {
      throw new Error('No user found.');
    }
    const hasPhone = newHostInfo.phoneNumber && newHostInfo.phoneNumber > 6;
    // If user found, no error. if user not found, error is thrown by firebase
    await firebaseAuth.getUser(foundHost.id);
    // Update firebase user
    const firebaseOpts = {
      ...newHostInfo,
      displayName: `${newHostInfo.firstName} ${newHostInfo.lastName}`,
      photoURL: newHostInfo.profilePicUrl,
      emailVerified: true,
      disabled: false,
    };
    if (!hasPhone) {
      delete firebaseOpts.phoneNumber;
    }
    await firebaseAuth.updateUser(foundHost.id, firebaseOpts);
    // Update database user
    foundHost.meta = {
      ...foundHost.meta,
      about: newHostInfo.about || undefined,
      updatedBy: user.email,
    };
    foundHost.changed('meta', true);
    const updatedHost = Object.assign(foundHost, newHostInfo);
    return await updatedHost.save();
  }

  async updateUser(newUserInfo, user) {
    const foundUser = await User.findByPk(user.id);
    if (!foundUser) {
      throw new Error('No user found.');
    }
    // If user found, no error. if user not found, error is thrown by firebase
    const firebaseUser = await firebaseAuth.getUser(foundUser.id);
    // Update firebase user

    const displayName = !(newUserInfo.firstName || newUserInfo.lastName) ? firebaseUser.displayName : `${newUserInfo.firstName} ${newUserInfo.lastName})`;

    await firebaseAuth.updateUser(foundUser.id, {
      ...newUserInfo,
      displayName,
      disabled: false,
      ...(newUserInfo.profilePicUrl && { photoURL: newUserInfo.profilePicUrl }),
    });

    // Update database user
    foundUser.meta = {
      ...foundUser.meta,
      updatedBy: user.email,
    };
    foundUser.changed('meta', true);
    const updatedUser = Object.assign(foundUser, newUserInfo);
    return await updatedUser.save();
  }

  async refreshVerificationStatus(id) {
    const firebaseUser = await FirebaseService.getUserById(id);
    const dbUser = await User.findByPk(id);

    if (!firebaseUser || !dbUser) {
      const error = new Error(`No user found with id: ${id} .`);
      error.code = errors.NO_USER_FOUND;
      throw error;
    }

    const phoneVerified = (firebaseUser.providerData || []).some((provider) => provider && provider.providerId === 'phone');
    if (!firebaseUser.emailVerified || !phoneVerified || dbUser.completedVerification) {
      return dbUser;
    }

    const updatedUser = Object.assign(dbUser, { completedVerification: true });
    await AnalyticsService.trackUserVerified(updatedUser);
    return await updatedUser.save();
  }

  async updateWalletAddress({btcWalletAddress, ethWalletAddress}, user) {
    if (!user) {
      const error = new Error(`No user specified.`);
      throw error;
    }

    user.walletAddress = ethWalletAddress;
    user.btcWalletAddress = btcWalletAddress;

    await AnalyticsService.trackUserPayoutInfoCompleted(user, {
        [Properties.ETH_WALLET_ADDRESS]: !!ethWalletAddress,
        [Properties.BTC_WALLET_ADDRESS]: !!btcWalletAddress });

    return await user.save();
  }
}

module.exports = { UserService: new UserService() };
