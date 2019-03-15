const testUtils = require('../../lib/testUtils');
const { CreditBalance, CurrencyRate } = require('./index');

describe('CreditBalance', () => {
  beforeAll(() => {
    return testUtils.initializeDatabase()
      .then(() => {
        testUtils.createCurrencyRateModels();
      });
  });

  afterAll(() => {
    return testUtils.clearDatabase();
  });

  let creditBalance;

  beforeEach(() => {
    creditBalance = CreditBalance.build(testUtils.createTestCreditBalanceOpts());
    return creditBalance.save();
  });

  afterEach(() => {
    return CreditBalance.destroy({ where: {} });
  });

  test('save() should save', () => {
    expect.assertions(3);

    const creditBalanceToSave = CreditBalance.build({
      id: 11,
      userId: 'savemepls',
      amountUsd: 14,
    });
    return creditBalanceToSave.save().then(creditBalance => {
      expect(creditBalance.id).toBe(11);
      expect(creditBalance.userId).toBe('savemepls');
      expect(creditBalance.amountUsd).toBe(14);
    });
  });

  test('findUserById, creditToBalance, debitFromBalance should throw error if userId is undefined', () => {
    expect.assertions(4);

    expect(CreditBalance.findByUserId(undefined)).rejects.toThrow(/userId is invalid/);
    expect(CreditBalance.creditToBalance(undefined, 0)).rejects.toThrow(/userId is invalid/);
    expect(CreditBalance.debitFromBalance(undefined, 0)).rejects.toThrow(/userId is invalid/);
    expect(creditBalance.updateById(undefined, 0)).rejects.toThrow(/userId is invalid/);
  });

  test('creditToBalance, debitFromBalance, and updateById should throw error updated credit balance given a userId and an invalid amount to be credited', () => {
    expect.assertions(3);

    expect(CreditBalance.creditToBalance(1234, undefined)).rejects.toThrow(/amount is invalid/);
    expect(CreditBalance.debitFromBalance(1234, undefined)).rejects.toThrow(/amount is invalid/);
    expect(creditBalance.updateById(1234, undefined)).rejects.toThrow(/amount is invalid/);
  });

  test('findByUserId() should return the user given the user id if user exists', () => {
    expect.assertions(2);

    return CreditBalance.findByUserId('user-id')
      .then(foundCreditBalance => {
        expect(foundCreditBalance.userId).toBe('user-id');
        expect(foundCreditBalance.amountUsd).toBe(75);
      });
  });

  test('findByUserId() should return null given the user id if user does not exist', () => {
    expect.assertions(1);

    return CreditBalance.findByUserId('nonexistantUser')
      .then(foundCreditBalance => {
        expect(foundCreditBalance).toBe(null);
      });
  });

  test('creditToBalance() should create a new credit balance if a user does not have one', () => {
    expect.assertions(2);

    return CreditBalance.creditToBalance('user-with-no-credit-balance', 200)
      .then(updatedCreditBalance => {
        expect(updatedCreditBalance.userId).toBe('user-with-no-credit-balance');
        expect(updatedCreditBalance.amountUsd).toBe(200);
      });
  });

  test('creditToBalance() should return updated credit balance given a userId and amount to be credited', () => {
    expect.assertions(2);

    return CreditBalance.creditToBalance('user-id', 40)
      .then(updatedCreditBalance => {
        expect(updatedCreditBalance.userId).toBe('user-id');
        expect(updatedCreditBalance.amountUsd).toBe(115);
      });
  });

  test('debitFromBalance() should return updated credit balance given a userId and amount to be debited', () => {
    expect.assertions(2);

    return CreditBalance.debitFromBalance('user-id', 20)
      .then(updatedCreditBalance => {
        expect(updatedCreditBalance.userId).toBe('user-id');
        expect(updatedCreditBalance.amountUsd).toBe(55);
      });
  });

  test('getBeeValue() should return converted bee value from usd', () => {
    expect.assertions(1);

    const initialCreditBalance = 75;
    const usdToBeeConversionRate = 0.02;

    return creditBalance.getBeeValue()
      .then(beeValue => {
        expect(beeValue).toBe(initialCreditBalance / usdToBeeConversionRate);
      });
  });

  test('getEthValue() should return converted eth value from usd', () => {
    expect.assertions(1);

    const initialCreditBalance = 75;
    const usdToEthConversionRate = 500;

    return creditBalance.getEthValue()
      .then(ethValue => {
        expect(ethValue).toBe(initialCreditBalance / usdToEthConversionRate);
      });
  });

  test('getBeeAndEthValue() should return converted bee and eth value from usd', () => {
    expect.assertions(2);

    const initialCreditBalance = 75;
    const usdToBeeConversionRate = 0.02;
    const usdToEthConversionRate = 500;

    return creditBalance.getBeeAndEthValue()
      .then(([beeValue, ethValue]) => {
        expect(beeValue).toBe(initialCreditBalance / usdToBeeConversionRate);
        expect(ethValue).toBe(initialCreditBalance / usdToEthConversionRate);
      });
  });
});
