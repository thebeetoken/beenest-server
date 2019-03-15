const testUtils = require('../../lib/testUtils');
const snakeCaseKeys = require('snakecase-keys');
const User = require('./index').User;

describe('User', () => {
  beforeAll(() => {
    return testUtils.initializeDatabase();
  });

  afterAll(() => {
    return testUtils.clearDatabase();
  });

  test('invalid email should not validate', () => {
    const user = User.build({
      email: 'teststest.cm'
    });
    expect(user.validate()).rejects.toThrow('Validation isEmail on email failed');
  });

  test('should save', () => {
    const user = User.build(testUtils.createTestUserOpts());

    return user.save().then(() => {
      return User.findById(user.id);
    }).then(fetchedUser => {
      expect(fetchedUser.id).toBe(user.id);
      expect(fetchedUser.firstName).toBe(user.firstName);
      expect(fetchedUser.lastName).toBe(user.lastName);
      expect(fetchedUser.email).toBe(user.email);
    });
  });

  test(`updateStripeAccountInfo should save a user's stripe account information`, () => {
    const user = User.build(testUtils.createTestUserOpts());
    const stripeAccountInfo = testUtils.createUserStripeAccountInfo();

    return user.updateStripeAccountInfo(stripeAccountInfo)
      .then(() => {
        return User.findOne({
          where: {
            email: user.email
          }
        });
      })
      .then(fetchedUser => {
        const dbStripeAccountInfo = fetchedUser.dataValues.meta.stripeAccountInfo;
        expect(dbStripeAccountInfo.accessToken).toBe(stripeAccountInfo.accessToken);
        expect(dbStripeAccountInfo.livemode).toBe(stripeAccountInfo.livemode);
        expect(dbStripeAccountInfo.refreshToken).toBe(stripeAccountInfo.refreshToken);
        expect(dbStripeAccountInfo.tokenType).toBe(stripeAccountInfo.tokenType);
        expect(dbStripeAccountInfo.stripePublishableKey).toBe(stripeAccountInfo.stripePublishableKey);
        expect(dbStripeAccountInfo.stripeUserId).toBe(stripeAccountInfo.stripeUserId);
        expect(dbStripeAccountInfo.scope).toBe(stripeAccountInfo.scope);
      });
  });

  test(`updateStripeAccountInfo should save a user's stripe account information with snakecase values`, () => {
    const user = User.build(testUtils.createTestUserOpts());
    // stripe returns back info in snake case
    const stripeAccountInfo = snakeCaseKeys(testUtils.createUserStripeAccountInfo());
    return user.updateStripeAccountInfo(stripeAccountInfo)
      .then(() => {
        return User.findOne({
          where: {
            email: user.email
          }
        });
      })
      .then(fetchedUser => {
        const dbStripeAccountInfo = fetchedUser.dataValues.meta.stripeAccountInfo;
        expect(dbStripeAccountInfo.accessToken).toBe(stripeAccountInfo.accessToken);
        expect(dbStripeAccountInfo.livemode).toBe(stripeAccountInfo.livemode);
        expect(dbStripeAccountInfo.refreshToken).toBe(stripeAccountInfo.refreshToken);
        expect(dbStripeAccountInfo.tokenType).toBe(stripeAccountInfo.tokenType);
        expect(dbStripeAccountInfo.stripePublishableKey).toBe(stripeAccountInfo.stripePublishableKey);
        expect(dbStripeAccountInfo.stripeUserId).toBe(stripeAccountInfo.stripeUserId);
        expect(dbStripeAccountInfo.scope).toBe(stripeAccountInfo.scope);
      });
  });

  test('toJSON should not return email by default', () => {
    const user = User.build(testUtils.createTestUserOpts());
    expect(user.toJSON().email).toBe(undefined);
  });

  test('isAdmin should return true for beetoken emails', () => {
    const user = User.build(testUtils.createTestUserOpts());
    user.email = 'test@thebeetoken.com';
    expect(user.isAdmin()).toBe(true);
  });

  test('isAdmin should return false for non beetoken emails', () => {
    const user = User.build(testUtils.createTestUserOpts());
    user.email = 'test@betken.com';
    expect(user.isAdmin()).toBe(false);
  });

  test('toJSON should not return stripeAccountInfo by default', () => {
    const user = User.build(testUtils.createTestUserOpts());
    expect(user.toJSON().stripeAccountInfo).toBe(undefined);
  });

  test('hasStripeAccount should return true if stripe account exists', async () => {
    const user2 = await User.build(testUtils.createTestUserOpts()).save();
    const stripeAccountInfo = testUtils.createUserStripeAccountInfo();
    await user2.updateStripeAccountInfo(stripeAccountInfo.stripeAccountInfo)
      .then(stripeUser => {
        expect(stripeUser.hasStripeAccount()).toBe(true);
      });
  });

  test('hasStripeAccount should return false if stripe account does not exist', () => {
    const user = User.build(testUtils.createTestUserOpts());
    expect(user.hasStripeAccount()).toBe(false);
  });

  test('hasStripeAccount should return false if stripe_user_id does not exist', async () => {
    const user3 = await User.build(testUtils.createTestUserOpts()).save();
    const infoWithoutStripeUserId = {
      accessToken: `i_am_a_access_token`,
      livemode: `false`,
      refreshToken: `i_am_a_refresh_token`,
      tokenType: `bearer`,
      stripePublishableKey: `i_am_a_publishable_key`,
      scope: `express`
    };
    await user3.updateStripeAccountInfo(infoWithoutStripeUserId)
      .then(stripeUser => {
        expect(stripeUser.hasStripeAccount()).toBe(false);
      });
  });

  test('updateListingCount updates listingCount by given number parameter', () => {
    const user = User.build(testUtils.createTestUserOpts());
    const oldListingCount = 1;
    const newListingCount = 5;
    user.listingCount = oldListingCount;
    
    return user.updateListingCount(newListingCount)
      .then(updatedUser => {
        expect(updatedUser.listingCount).toBe(5);
      })
  });

  test('updateListingCount removes listingCount meta key if listingCount is zero', () => {
    const user = User.build(testUtils.createTestUserOpts());
    const oldListingCount = 1;
    const newListingCount = 0;
    user.listingCount = oldListingCount;
    
    return user.updateListingCount(newListingCount)
      .then(updatedUser => {
        expect(updatedUser.listingCount).toBe(0);
      })
  });

  test('updateListingCount should throw error if listingCount parameter does not exist', () => {
    const user = User.build(testUtils.createTestUserOpts());
    const oldListingCount = 1;
    user.listingCount = oldListingCount;
    
    return expect(() => user.updateListingCount()).toThrow(Error);
  });

  test('updateListingCount should throw error if listingCount parameter is negative', () => {
    const user = User.build(testUtils.createTestUserOpts());
    const oldListingCount = 1;
    user.listingCount = oldListingCount;
    
    return expect(() => user.updateListingCount(-5)).toThrow(Error);
  });
});
