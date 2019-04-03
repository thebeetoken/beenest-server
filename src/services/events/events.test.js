const testUtils = require('../../lib/testUtils');
const { EventService } = require('./events');
const { Booking } = require('../../models/sequelize');
const { paymentsContractAddress } = require('../../../config/settings');
const { MailService } = require('../mail');

jest.mock('../mail');

describe('EventService', () => {
  const testHost = "0x4057405740574057405740574057405740574057";
  const testGuest = "0xC4357C4357C4357C4357C4357C4357C4357C4357";
  const price = 84800;
  const deposit = 4200;
  const checkIn = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;
  const checkOut = checkIn + 48 * 60 * 60;
  const testBookingOpts = {
    ...(testUtils.createTestBookingOpts()),
    guestWalletAddress: testGuest,
    hostWalletAddress: testHost,
    guestTotalAmount: price + deposit,
    guestDepositAmount: deposit,
    checkInDate: new Date(checkIn * 1000),
    checkOutDate: new Date(checkOut * 1000)
  };
  const commonReturnValues = {
    supplier: testHost,
    purchaser: testGuest,
    deposit: `${deposit}000000000000000000`,
    price: `${price}000000000000000000`,
  };
  const cancelReturnValues = {
    ...commonReturnValues,
    cancellationFee: `${Math.floor(price / 10)}000000000000000000`
  };
  const invoiceReturnValues = {
    ...cancelReturnValues,
    cancelDeadline: checkIn,
    disputeDeadline: checkOut
  };
  const mismatchedReturnValues = {
    supplier: testGuest,
    purchaser: testHost,
    deposit: '1000000000000000000',
    price: '1000000000000000000',
    cancellationFee: `${Math.floor(price / 9)}000000000000000000`,
    cancelDeadline: checkOut,
    disputeDeadline: checkIn
  };
  const testReturnValues = {
    Refund: commonReturnValues,
    Cancel: cancelReturnValues,
    Payout: commonReturnValues,
    Dispute: commonReturnValues,
    Invoice: invoiceReturnValues
  };

  beforeAll(() => testUtils.initializeDatabase());
  afterAll(() => testUtils.clearDatabase());
  beforeEach(() => MailService.reportContractEventMismatch.mockClear());

  test('initially shows latest block number as zero', async () => {
    const blockNumber = await EventService.getLatestBlockNumber();
    expect(blockNumber).toBe(0);
  });

  test('updates block number to reflect seen events', async () => {
    const testNumber = 42;
    await EventService.dispatch({
      address: paymentsContractAddress,
      blockNumber: testNumber,
      event: 'Foo'
    });
    expect(MailService.reportContractEventMismatch).not.toBeCalled();
    const blockNumber = await EventService.getLatestBlockNumber();
    expect(blockNumber).toBe(testNumber);
  });

  [
    { event: 'Invoice', from: 'host_approved', to: 'guest_paid' },
    { event: 'Refund', from: 'refund_initiated', to: 'refunded' },
    { event: 'Cancel', from: 'guest_cancel_initiated', to: 'guest_cancelled' },
    { event: 'Dispute', from: 'dispute_initiated', to: 'disputed' },
    { event: 'Payout', from: 'host_paid', to: 'completed' }
  ].forEach(({ event, from, to }, i) => describe(`on ${event} event`, () => {
    let testId;
    beforeEach(async () => {
      const { id } = await Booking.create({ ...testBookingOpts, status: from });
      testId = id;
    });

    describe('with matching details', () => {
      beforeEach(async () => {
        await EventService.dispatch({
          address: paymentsContractAddress,
          blockNumber: i,
          event,
          returnValues: { ...(testReturnValues[event]), id: testId }
        });
      });

      test(`updates status to ${to}`, async () => {
        const booking = await Booking.findById(testId);
        expect(booking.status).toEqual(to);
      });

      test('does not send email notifications', () => {
        expect(MailService.reportContractEventMismatch).not.toBeCalled();
      });
    });

    Object.keys(
      testReturnValues[event]
    ).forEach(key => describe(`with incorrect ${key}`, () => {
      beforeEach(async () => {
        await EventService.dispatch({
          address: paymentsContractAddress,
          blockNumber: i,
          event,
          returnValues: {
            ...(testReturnValues[event]),
            [key]: mismatchedReturnValues[key],
            id: testId
          }
        });
      });

      test(`updates status to ${to}`, async () => {
        const booking = await Booking.findById(testId);
        expect(booking.status).toEqual(to);
      });

      test('sends email notification', () => {
        expect(MailService.reportContractEventMismatch).toBeCalled();
      });
    }));
  }));

  test('throws an error on an unknown contract address', async () => {
    let err;
    try {
      await EventService.dispatch({
        address: '0x0000000000000000000000000000000000000000',
        blockNumber: 48,
        event: 'Foo'
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
  });
});
