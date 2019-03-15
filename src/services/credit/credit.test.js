const testUtils = require('../../lib/testUtils');
const datefns = require('date-fns');
const { User, CreditBalance, CurrencyRate, Booking } = require('../../models/sequelize');
const { CreditService } = require('./credit');

describe('Credit Service', () => {
  let guest, initialBalanceUsd;

  beforeAll(() => {
    return testUtils.initializeDatabase()
      .then(() => (
        User.create(testUtils.createTestUserOpts())
      ))
      .then(savedGuest => {
        guest = savedGuest;
        return testUtils.createCurrencyRateModels();
      });
  });

  afterAll(() => (
    testUtils.clearDatabase()
  ));

  beforeEach(() => {
    const opts = testUtils.createTestCreditBalanceOpts();
    opts.userId = guest.id;
    initialBalanceUsd = opts.amountUsd;
    return CreditBalance.build(opts).save();
  });

  afterEach(() => {
    return CreditBalance.destroy({
      where: { userId: guest.id }
    });
  });

  test('getBalance given a invalid values should return null', () => {
    expect.assertions(5);

    expect(CreditService.getBalance()).toBe(null);
    expect(CreditService.getBalance(undefined)).toBe(null);
    expect(CreditService.getBalance(null)).toBe(null);
    expect(CreditService.getBalance({})).toBe(null);
    expect(CreditService.getBalance('984a233b')).toBe(null);
  });

  test('getBalance with a user should return the user credit balance', () => {
    expect.assertions(1);
    return CreditService.getBalance(guest)
      .then(guestCreditBalance => {
        expect(guestCreditBalance.amountUsd).toEqual(initialBalanceUsd);
      });
  });

  test('debitFromBalance and creditToBalance with a null value should throw user undefined error', async () => {
    expect.assertions(2);
    
    await expect(CreditService.debitFromBalance()).rejects.toThrow(/invalid user parameter/);
    await expect(CreditService.creditToBalance()).rejects.toThrow(/invalid user parameter/);
  });

  test('debitFromBalance and creditToBalance should throw user.id undefined if user.id doesnt exist', async () => {
    expect.assertions(2);
    
    await expect(CreditService.debitFromBalance({})).rejects.toThrow(/invalid user parameter/);
    await expect(CreditService.creditToBalance({})).rejects.toThrow(/invalid user parameter/);
  });

  test('debitFromBalance is able to debit entire balance if available', () => {
    expect.assertions(1);

    const amountToDebit = 75;

    return CreditService.debitFromBalance(guest, amountToDebit, 'fake-booking-id')
      .then(creditBalance => {
        expect(creditBalance.amountUsd).toEqual(initialBalanceUsd - amountToDebit);
      });
  });

  test('debitFromBalance should debit amount from user credit balance', () => {
    expect.assertions(1);

    const amountToDebit = 50;

    return CreditService.debitFromBalance(guest, amountToDebit, 'fake-booking-id')
      .then(creditBalance => {
        expect(creditBalance.amountUsd).toEqual(initialBalanceUsd - amountToDebit);
      });
  });

  test('debitFromBalance should not debit amount if debit value is negative', async () => {
    expect.assertions(1);

    const amountToDebit = -100;

    await expect(CreditService.debitFromBalance(guest, amountToDebit, 'fake-booking-id')).rejects.toThrow(/amount is invalid/);
  });

  test('debitFromBalance should not debit amount if it exceeds current balance', async () => {
    expect.assertions(1);

    const amountToDebit = 1000;
    await expect(CreditService.debitFromBalance(guest, amountToDebit, 'fake-booking-id')).rejects.toThrow(/amount to debit exceeds credit balance/);
  });

  test('creditToBalance should credit amount to user credit balance', async () => {
    expect.assertions(1);

    const amountToCredit = 40;
    const bookingId = 'fake-booking-id';

    await CreditService.creditToBalance(guest, amountToCredit, bookingId)
      .then(creditBalance => {
        expect(creditBalance.amountUsd).toEqual(initialBalanceUsd + amountToCredit);
      });
  });

  test('creditToBalance should not credit amount if credit value is negative', async () => {
    expect.assertions(1);

    const amountToCredit = -500;

    await expect(CreditService.creditToBalance(guest, amountToCredit)).rejects.toThrow(/amount is invalid/);
  });

  test('refund should refund credits fully if cancelled before deadline and before approval', async () => {
    expect.assertions(1);

    const creditAmountUsdApplied = 5;
    const today = new Date();
    let checkInDate = datefns.addDays(today, 8);
    let checkOutDate = datefns.addDays(today, 10);

    const bookingUsdOpts = {
      listingId: 1,
      checkInDate,
      checkOutDate,
      hostId: '123',
      guestId: guest.id,
      pricePerNight: 1000,
      guestTotalAmount: 3120,
      guestDepositAmount: 300,
      currency: 'USD',
      numberOfGuests: 2,
      creditAmountUsdApplied
    }; 
    
    let booking = await Booking.buildWithMetaFields(bookingUsdOpts).save();
    return CreditService.refundFull(guest, booking)
      .then(booking => {
        return CreditService.getBalance(guest);
      })
      .then(creditBalance => {
        expect(creditBalance.amountUsd).toEqual(initialBalanceUsd + creditAmountUsdApplied);
      });
  });

  test('refund should refund 90% of credits when guest cancels an approved booking before the deadline', async () => {
    expect.assertions(1);
    
    const refundRate = 0.9;
    const creditAmountUsdApplied = 5;
    const today = new Date();
    let checkInDate = datefns.addDays(today, 8);
    let checkOutDate = datefns.addDays(today, 16);
    
    const bookingUsdOpts = {
      listingId: 1,
      checkInDate,
      checkOutDate,
      hostId: '123',
      guestId: guest.id,
      pricePerNight: 1000,
      guestTotalAmount: 3120,
      guestDepositAmount: 300,
      currency: 'USD',
      numberOfGuests: 2,
      creditAmountUsdApplied
    };
    
    let booking = await Booking.buildWithMetaFields(bookingUsdOpts).save();
    await booking.updateStatus('host_approved', booking.hostId);
    return CreditService.refundGuestCancel(guest, booking)
      .then(booking => {
        return CreditService.getBalance(guest);
      })
      .then(creditBalance => {
        expect(creditBalance.amountUsd).toEqual(initialBalanceUsd + creditAmountUsdApplied * refundRate);
      });
  });

  test('refund function should refund no credits if cancelled after deadline', () => {
    expect.assertions(2);
    
    const creditAmountUsdApplied = 5;
    const today = new Date();
    let checkInDate = datefns.addDays(today, 3);
    let checkOutDate = datefns.addDays(today, 9);

    const bookingUsdOpts = {
      listingId: 1,
      checkInDate,
      checkOutDate,
      hostId: '123',
      guestId: guest.id,
      pricePerNight: 1000,
      guestTotalAmount: 3120,
      guestDepositAmount: 300,
      currency: 'USD',
      numberOfGuests: 2,
      creditAmountUsdApplied
    };


    return Booking.buildWithMetaFields(bookingUsdOpts).save()
      .then(booking => {
        return booking.updateStatus('host_approved', booking.hostId);
      })
      .then(booking => {
        return CreditService.refundGuestCancel(guest, booking)
      })
      .then(booking => {
        return Promise.all([CreditService.getBalance(guest), booking]);
      })
      .then(([creditBalance, booking]) => {
        expect(creditBalance.amountUsd).toBe(initialBalanceUsd);
        expect(booking.meta.creditAmountUsdApplied).toBe(0);
      });
  });
});
