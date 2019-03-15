const testUtils = require('../../lib/testUtils');
const { User } = require('../../models/sequelize');
const { UserService } = require('./user');

jest.mock('../firebaseAuth', () => {
  return require('../../lib/testUtils').firebaseAuthMock();
});

const firebaseAuth = require('../firebaseAuth');

describe('UserService', () => {
  beforeAll(() => {
    firebaseAuth.autoFlush();
    return testUtils.initializeDatabase();
  });

  afterAll(() => {
    return testUtils.clearDatabase();
  });

  test('createUser should save', async () => {
    expect.assertions(6);

    const user = await UserService.createUser(testUtils.createUntrustedFirebaseUserOpts());
    expect(user).not.toEqual(undefined);
    const fetchedUser = await User.findById(user.id);

    expect(fetchedUser).not.toEqual(undefined);
    expect(fetchedUser.id).toBe(user.id);
    expect(fetchedUser.firstName).toBe(user.firstName);
    expect(fetchedUser.lastName).toBe(user.lastName);
    expect(fetchedUser.email).toBe(user.email);
  });

  // add createUserWithPromo test after credit query is created

  test('createHost should save', async () => {
    expect.assertions(6);

    const user = await UserService.createHost(testUtils.createUntrustedFirebaseUserOpts());
    expect(user).not.toEqual(undefined);
    const fetchedUser = await User.findById(user.id);

    expect(fetchedUser).not.toEqual(undefined);
    expect(fetchedUser.id).toBe(user.id);
    expect(fetchedUser.firstName).toBe(user.firstName);
    expect(fetchedUser.lastName).toBe(user.lastName);
    expect(fetchedUser.email).toBe(user.email);
  });

  test('adminCreateHost should save', async () => {
    expect.assertions(6);

    const user = await UserService.adminCreateHost(testUtils.createTrustedFirebaseUserOpts());
    expect(user).not.toEqual(undefined);
    const fetchedUser = await User.findById(user.id);

    expect(fetchedUser).not.toEqual(undefined);
    expect(fetchedUser.id).toBe(user.id);
    expect(fetchedUser.firstName).toBe(user.firstName);
    expect(fetchedUser.lastName).toBe(user.lastName);
    expect(fetchedUser.email).toBe(user.email);
  });

  test('updateWalletAddress should update wallet address', async () => {
    expect.assertions(5);
    const btcWalletAddress = '1K2xWPtGsvg5Sa2X7URZ5VfU8xS62McbXz';
    const ethWalletAddress = '0x61038614bFbB80F2Bf169A7c846c482CC0367B33';
    const user = await UserService.adminCreateHost(testUtils.createTrustedFirebaseUserOpts());
    expect(user).not.toEqual(undefined);

    await UserService.updateWalletAddress({btcWalletAddress, ethWalletAddress }, user);
    const fetchedUser = await User.findById(user.id);

    expect(fetchedUser).not.toEqual(undefined);
    expect(fetchedUser.id).toBe(user.id);
    expect(fetchedUser.btcWalletAddress).toBe(btcWalletAddress);
    expect(fetchedUser.walletAddress).toBe(ethWalletAddress);
  });
});
