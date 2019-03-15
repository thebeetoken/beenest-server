const testUtils = require('../../lib/testUtils');
const { CreditLedger } = require('./index');

describe('CreditLedger', () => {
  beforeAll(() => {
    return testUtils.initializeDatabase();
  });

  afterAll(() => {
    return testUtils.clearDatabase();
  });

  let creditLedger;

  beforeEach(() => {
    creditLedger = CreditLedger.build(testUtils.createTestCreditLedgerOpts());
    return creditLedger.save();
  });

  afterEach(() => {
    return CreditLedger.destroy({ where: {} });
  });

  test('createCredit with invalid params should throw error', () => {
    expect.assertions(1);

    return expect(CreditLedger.createCredit(null, null)).rejects.toThrow(/user id is invalid/);
  });

  test('createDebit with invalid params should throw error', () => {
    expect.assertions(1);

    return expect(CreditLedger.createDebit(null, null, null)).rejects.toThrow(/user id is invalid/);
  });
  
  test('createCredit should create ledger entry with valid params', () => {
    expect.assertions(4);
    
    const userId = 'fake-user-id';
    const amountToCredit = 75;
    const bookingId = 'fake-booking-id';

    return CreditLedger.createCredit(userId, amountToCredit, bookingId)
      .then(newCreditLedger => {
        expect(newCreditLedger.userId).toBe(userId);
        expect(newCreditLedger.bookingId).toBe(bookingId);
        expect(newCreditLedger.creditAmountUsd).toBe(amountToCredit);
        expect(newCreditLedger.debitAmountUsd).toBe(undefined);
      });
  });

  test('createDebit should create ledger entry with valid params', () => {
    expect.assertions(4);

    const userId = 'fake-user-id';
    const bookingId = 'fake-booking-id';
    const amountToDebit = 75;

    return CreditLedger.createDebit(userId, amountToDebit, bookingId)
      .then(newCreditLedger => {
        expect(newCreditLedger.userId).toBe(userId);
        expect(newCreditLedger.bookingId).toBe(bookingId);
        expect(newCreditLedger.creditAmountUsd).toBe(undefined);
        expect(newCreditLedger.debitAmountUsd).toBe(amountToDebit);
      });
  });
});