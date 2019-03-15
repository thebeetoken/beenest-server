const testUtils = require('../../lib/testUtils');
const Booking = require('./index').Booking;
const CurrencyRate = require('./index').CurrencyRate;
const datefns = require('date-fns');
const User = require('./index').User;

describe('Booking', () => {
  let bookingUsdOpts;
  const today = new Date();

  beforeAll(() => {

    let checkInDate = datefns.addDays(today, 8);
    checkInDate = datefns.addMinutes(checkInDate, 5);
    let checkOutDate = datefns.addDays(today, 10);
    checkOutDate = datefns.addMinutes(checkOutDate, 6);

    const pricePerNight = 1000;
    const numberOfNights = datefns.differenceInDays(checkOutDate, checkInDate);
    const priceTotalNights = numberOfNights * pricePerNight;
    const transactionFee = 0;
    const guestTotalAmount = priceTotalNights;

    bookingUsdOpts = {
      ...testUtils.createTestBookingOpts(),
      checkInDate,
      checkOutDate,
      pricePerNight,
      guestTotalAmount,
      guestDepositAmount: 300,
      currency: 'USD',
      numberOfGuests: 2,
      transactionFee,
    };

    bookingBeeOpts = {
      ...bookingUsdOpts,
      currency: 'BEE',
    };

    return testUtils.initializeDatabase();
  });

  afterAll(() => {
    return testUtils.clearDatabase();
  });

  afterEach(() => (
    Booking.destroy({ where: {} })
  ));

  test('should save', () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());

    return booking
      .save()
      .then(() => {
        return Booking.findById(booking.id);
      })
      .then(fetchedBooking => {
        expect(fetchedBooking.id).toBe(booking.id);
        expect(fetchedBooking.status).toBe('started');
      });
  });

  test('getCancelStatus should return CANCEL_WITHOUT_PENALTY if host has not approved', () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());
    expect(booking.getCancelStatus()).toBe(
      Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY
    );
  });

  test('getCancelStatus should return CANCEL_BEFORE_DEADLINE if host approved and before deadline date', () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());

    let checkInDate = new Date();
    checkInDate = checkInDate.setDate(checkInDate.getDate() + 30);
    let checkOutDate = new Date();
    checkOutDate = checkOutDate.setDate(checkOutDate.getDate() + 33);

    booking.checkInDate = checkInDate;
    booking.checkOutDate = checkOutDate;
    booking.status = 'host_approved';

    expect(booking.getCancelStatus()).toBe(
      Booking.cancelStatuses.CANCEL_BEFORE_DEADLINE
    );
  });

  test('getCancelStatus should return CANCEL_AFTER_DEADLINE if host approved and after deadline date', () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());

    let checkInDate = new Date();
    checkInDate = checkInDate.setDate(checkInDate.getDate() + 2);
    let checkOutDate = new Date();
    checkOutDate = checkOutDate.setDate(checkOutDate.getDate() + 3);

    booking.checkInDate = checkInDate;
    booking.checkOutDate = checkOutDate;
    booking.status = 'host_approved';

    expect(booking.getCancelStatus()).toBe(
      Booking.cancelStatuses.CANCEL_AFTER_DEADLINE
    );
  });

  test('canCancel should return true if user is the guest', () => {
    const user = User.build(testUtils.createTestUserOpts());
    const booking = Booking.build(testUtils.createTestBookingOpts());
    booking.guestId = user.id;

    expect(booking.canCancel(user)).toBe(true);
  });

  test('canCancel should return false if user is not the guest', () => {
    const user = User.build(testUtils.createTestUserOpts());
    const booking = Booking.build(testUtils.createTestBookingOpts());
    booking.guestId = 'not-the-user';

    expect(booking.canCancel(user)).toBe(false);
  });

  test('setCancelBy should return booking with a cancelled status and cancelled by host attribute', async () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());
    const user = User.build(testUtils.createTestUserOpts());
    booking.hostId = user.id;

    let checkInDate = new Date();
    checkInDate = checkInDate.setDate(checkInDate.getDate() + 50);
    let checkOutDate = new Date();
    checkOutDate = checkOutDate.setDate(checkOutDate.getDate() + 51);

    booking.checkInDate = checkInDate;
    booking.checkOutDate = checkOutDate;
    booking.status = 'host_approved';

    const savedBooking = await booking.save();
    const cancelledBooking = await booking.setCancelBy(user, true);
    expect(cancelledBooking.status).toBe('host_cancelled');
    expect(cancelledBooking.meta.cancelledBy).toBe(user.email);
  });

  test('setCancelBy should return booking with a cancelled status and cancelled by guest attribute', async () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());
    const user = User.build(testUtils.createTestUserOpts());
    booking.guestId = user.id;

    let checkInDate = new Date();
    checkInDate = checkInDate.setDate(checkInDate.getDate() + 50);
    let checkOutDate = new Date();
    checkOutDate = checkOutDate.setDate(checkOutDate.getDate() + 51);

    booking.checkInDate = checkInDate;
    booking.checkOutDate = checkOutDate;
    booking.status = 'host_approved';

    const savedBooking = await booking.save();
    const cancelledBooking = await booking.setCancelBy(user, false);
    expect(cancelledBooking.status).toBe('guest_cancelled');
    expect(cancelledBooking.meta.cancelledBy).toBe(user.email);
  });


  test('setCancelBy should set status to host cancelled', async () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());
    const user = User.build(testUtils.createTestUserOpts());
    booking.hostId = user.id;

    let checkInDate = new Date();
    checkInDate = checkInDate.setDate(checkInDate.getDate() + 52);
    let checkOutDate = new Date();
    checkOutDate = checkOutDate.setDate(checkOutDate.getDate() + 53);

    booking.checkInDate = checkInDate;
    booking.checkOutDate = checkOutDate;
    booking.status = 'host_approved';

    const savedBooking = await booking.save();
    const cancelledBooking = await booking.setCancelBy(user, true);
    expect(cancelledBooking.status).toBe('host_cancelled');
    expect(cancelledBooking.meta.cancelledBy).toBe(user.email);
  });

  test('setCancelBy should fail if user is invalid', () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());
    const user = User.build(testUtils.createTestUserOpts());

    let checkInDate = new Date();
    checkInDate = checkInDate.setDate(checkInDate.getDate() + 54);
    let checkOutDate = new Date();
    checkOutDate = checkOutDate.setDate(checkOutDate.getDate() + 55);

    booking.checkInDate = checkInDate;
    booking.checkOutDate = checkOutDate;
    booking.status = 'host_approved';
    
    expect(() => booking.setCancelBy(user, false)).toThrow();
  });

  test('getCancelRefundAmountForGuest should return 0 if only credits were used for the booking before the cancel deadline', () => {
    return testUtils.createCurrencyRateModels()
      .then(() => {
        return Booking.build(testUtils.createTestBookingOpts()).save();
      })
      .then(booking => {
        booking.updateCreditAmountAppliedFromUsd(300);
        booking.meta.guestTotalAmount = 0;
  
        expect(booking.getCancelRefundAmountForGuest()).toBe(0);
      });
  });

  test('getCancelRefundAmountForGuest should return guest total amount if no credits were applied before the cancel deadline', async () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());

    await booking.updateCreditAmountAppliedFromUsd(0);
    booking.meta.guestTotalAmount = 300;

    // a charge was never performed; no need to refund anything
    expect(booking.getCancelRefundAmountForGuest()).toBe(0);
  });

  test('getCancelRefundAmountForGuest should return 90% of priceTotalNights minus credits applied when approved booking is cancelled before deadline', async () => {
    const refundRate = 0.9;
    const creditAmountUsdApplied = 5;
    const priceTotalNights = bookingUsdOpts.guestTotalAmount - bookingUsdOpts.transactionFee;
    const guestTotalAmount = (priceTotalNights - creditAmountUsdApplied) * 1.04;

    const opts = { ...bookingUsdOpts,
      guestTotalAmount,
      creditAmountUsdApplied
    };

    let booking = await Booking.buildWithMetaFields(opts).save();
    await booking.updateStatus('host_approved', booking.hostId);
    const amount = (guestTotalAmount - bookingUsdOpts.transactionFee) * refundRate;

    expect(booking.getCancelRefundAmountForGuest()).toBe(amount);
  });

  test('getCancelRefundAmountForGuest should refund 0 amount if passed cancellation deadline', async () => {
    let checkInDate = datefns.addDays(today, 3);
    let checkOutDate = datefns.addDays(today, 5);
    const creditAmountUsdApplied = 5;
    const priceTotalNights = bookingUsdOpts.guestTotalAmount - bookingUsdOpts.transactionFee;
    const guestTotalAmount = (priceTotalNights - creditAmountUsdApplied) * 1.04;

    const opts = { ...bookingUsdOpts,
      checkInDate,
      checkOutDate,
      guestTotalAmount,
      creditAmountUsdApplied
    };

    const booking = Booking.buildWithMetaFields(opts);
    await booking.updateStatus('host_approved', booking.hostId);

    expect(booking.getCancelRefundAmountForGuest()).toBe(0);
  });

  test('getCreditRefundAmountForGuest should return 0 if no credits were used for the booking', async () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());

    expect(booking.getCancelRefundAmountForGuest()).toBe(0);
  });

  test('getCreditRefundAmountForGuest should return 90% credit refund amount when approved booking is cancelled before deadline', async () => {
    const refundRate = 0.9;
    const creditAmountUsdApplied = 5;
    const priceTotalNights = bookingUsdOpts.guestTotalAmount - bookingUsdOpts.transactionFee;
    const guestTotalAmount = (priceTotalNights - creditAmountUsdApplied) * 1.04;

    const opts = { ...bookingUsdOpts,
      guestTotalAmount,
      creditAmountUsdApplied
    };

    let booking = await Booking.buildWithMetaFields(opts).save();
    await booking.updateStatus('host_approved', booking.hostId);

    expect(booking.getCreditRefundAmountForGuest()).toBe(creditAmountUsdApplied * refundRate);
  });

  test('getCreditRefundAmountForGuest should refund 0 amount if passed cancellation deadline', async () => {
    let checkInDate = datefns.addDays(today, 3);
    let checkOutDate = datefns.addDays(today, 5);
    const creditAmountUsdApplied = 5;
    const priceTotalNights = bookingUsdOpts.guestTotalAmount - bookingUsdOpts.transactionFee;
    const guestTotalAmount = (priceTotalNights - creditAmountUsdApplied) * 1.04;

    const opts = { ...bookingUsdOpts,
      checkInDate,
      checkOutDate,
      guestTotalAmount,
      creditAmountUsdApplied
    };

    const booking = Booking.buildWithMetaFields(opts);

    await booking.updateStatus('host_approved', booking.hostId);

    expect(booking.getCreditRefundAmountForGuest()).toBe(0);
  });

  test('getCreditRefundAmountForGuest should refund partial card and partial credits', async () => {
    const refundRate = 0.9;
    const creditAmountUsdApplied = 5;
    const priceTotalNights = bookingUsdOpts.guestTotalAmount - bookingUsdOpts.transactionFee;
    const guestTotalAmount = (priceTotalNights - creditAmountUsdApplied) * 1.04;

    const opts = {
      ...bookingUsdOpts,
      guestTotalAmount,
      creditAmountUsdApplied
    };

    const booking = Booking.buildWithMetaFields(opts);
    await booking.updateStatus('host_approved', booking.hostId);

    expect(booking.getCreditRefundAmountForGuest()).toBe(creditAmountUsdApplied * refundRate);
  });

  test('hasCreditApplied returns true if credit applied exists', () => {
    const creditAmountUsdApplied = 5;
    const opts = {
      ...bookingUsdOpts,
      creditAmountUsdApplied
    };

    const booking = Booking.buildWithMetaFields(opts);
    expect(booking.hasCreditApplied()).toBe(true);
  });

  test('hasCreditApplied returns false if credit applied does not exist', () => {
    const booking = Booking.buildWithMetaFields(bookingUsdOpts);
    expect(booking.hasCreditApplied()).toBe(false);
  });

  test('hasCreditApplied returns false if credit applied is zero', () => {
    const creditAmountUsdApplied = 0;
    const opts = {
      ...bookingUsdOpts,
      creditAmountUsdApplied
    };

    const booking = Booking.buildWithMetaFields(opts);
    expect(booking.hasCreditApplied()).toBe(false);
  });

  test('findOverlappingBookings returns array of overlapping bookings if they exist', async () => {
    const firstBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('07-11-11'),
      checkOutDate: new Date('07-17-11'),
      status: 'host_paid',
    };
    const secondBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('07-11-11'),
      checkOutDate: new Date('07-15-11'),
      status: 'host_paid',
    };
    const thirdBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('07-13-11'),
      checkOutDate: new Date('07-14-11'),
      status: 'guest_confirmed'
    };
    const fourthBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('07-17-11'),
      checkOutDate: new Date('07-18-11'),
      status: 'guest_confirmed'
    };
    const fifthBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('07-10-11'),
      checkOutDate: new Date('07-11-11'),
      status: 'host_paid'
    }

    const [booking1, booking2, booking3, booking4, booking5] = await Promise.all([
      Booking.buildWithMetaFields(firstBookingOpts).save(),
      Booking.buildWithMetaFields(secondBookingOpts).save(),
      Booking.buildWithMetaFields(thirdBookingOpts).save(),
      Booking.buildWithMetaFields(fourthBookingOpts).save(),
      Booking.buildWithMetaFields(fifthBookingOpts).save()
    ]);
    const { listingId } = bookingUsdOpts;
    const interval1 = {
      listingId,
      bookingId: booking1.id,
      checkInDate: booking1.checkInDate,
      checkOutDate: booking1.checkOutDate
    };
    const interval2 = {
      listingId,
      bookingId: booking2.id,
      checkInDate: booking2.checkInDate,
      checkOutDate: booking2.checkOutDate
    };
    const interval3 = {
      listingId,
      bookingId: booking3.id,
      checkInDate: booking3.checkInDate,
      checkOutDate: booking3.checkOutDate
    };
    const interval4 = {
      listingId,
      bookingId: booking4.id,
      checkInDate: booking4.checkInDate,
      checkOutDate: booking4.checkOutDate
    };
    const interval5 = {
      listingId,
      bookingId: booking5.id,
      checkInDate: booking5.checkInDate,
      checkOutDate: booking5.checkOutDate
    };
    const [bookingArray1, bookingArray2, bookingArray3, bookingArray4, bookingArray5] = await Promise.all([
      Booking.findOverlappingBookings(interval1),
      Booking.findOverlappingBookings(interval2),
      Booking.findOverlappingBookings(interval3),
      Booking.findOverlappingBookings(interval4),
      Booking.findOverlappingBookings(interval5)
    ]);
    expect(bookingArray1.length).toBe(2);
    expect(bookingArray2.length).toBe(2);
    expect(bookingArray3.length).toBe(2);
    expect(bookingArray4.length).toBe(0);
    expect(bookingArray5.length).toBe(0);
  });

  test('findOverlappingBookings can be used without providing a booking id', async () => {
    const firstBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('08-11-11'),
      checkOutDate: new Date('08-14-11'),
      status: 'host_paid',
    };
    const secondBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('08-14-11'),
      checkOutDate: new Date('08-15-11'),
      status: 'host_paid',
    };
    const thirdBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: new Date('08-15-11'),
      checkOutDate: new Date('08-17-11'),
      status: 'guest_paid'
    };

    const [booking1, booking2, booking3] = await Promise.all([
      Booking.buildWithMetaFields(firstBookingOpts).save(),
      Booking.buildWithMetaFields(secondBookingOpts).save(),
      Booking.buildWithMetaFields(thirdBookingOpts).save()
    ]);
    const { listingId } = bookingUsdOpts;
    const interval1 = {
      listingId,
      checkInDate: new Date('08-10-11'),
      checkOutDate: new Date('08-11-11')
    };
    const interval2 = {
      listingId,
      checkInDate: new Date('08-10-11'),
      checkOutDate: new Date('08-15-11')
    };
    const interval3 = {
      listingId,
      checkInDate: new Date('08-11-11'),
      checkOutDate: new Date('08-17-11'),
    };
    const interval4 = {
      listingId,
      checkInDate: new Date('08-15-11'),
      checkOutDate: new Date('08-18-11'),
    };
    const [bookingArray1, bookingArray2, bookingArray3, bookingArray4] = await Promise.all([
      Booking.findOverlappingBookings(interval1),
      Booking.findOverlappingBookings(interval2),
      Booking.findOverlappingBookings(interval3),
      Booking.findOverlappingBookings(interval4)
    ]);
    
    expect(bookingArray1.length).toBe(0);
    expect(bookingArray2.length).toBe(2);
    expect(bookingArray3.length).toBe(3);
    expect(bookingArray4.length).toBe(1);
  });

  test('findGuestBookingsByStatus does not fetch duplicate bookings', async () => {
    const firstBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: datefns.subDays(today, 8),
      checkOutDate: datefns.subDays(today, 6),
      status: 'host_paid',
    };
    const secondBookingOpts = {
      ...bookingUsdOpts,
      status: 'started',
    };
    const thirdBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: datefns.subDays(today, 8),
      checkOutDate: datefns.subDays(today, 6),
      status: 'completed'
    };
    const fourthBookingOpts = {
      ...bookingBeeOpts,
      checkInDate: datefns.subDays(today, 8),
      checkOutDate: datefns.subDays(today, 6),
      status: 'host_paid',
    };
    const fifthBookingOpts = {
      ...bookingBeeOpts,
      status: 'guest_confirmed',
    };
    const sixthBookingOpts = {
      ...bookingBeeOpts,
      status: 'guest_paid',
    };
    await Promise.all([
      Booking.buildWithMetaFields(firstBookingOpts).save(),
      Booking.buildWithMetaFields(secondBookingOpts).save(),
      Booking.buildWithMetaFields(thirdBookingOpts).save(),
      Booking.buildWithMetaFields(fourthBookingOpts).save(),
      Booking.buildWithMetaFields(fifthBookingOpts).save(),
      Booking.buildWithMetaFields(sixthBookingOpts).save(),
    ]);
    
    const tripStatuses = [
      'started',
      'cancelled',
      'current',
      'past',
      'upcoming',
    ];
    const arrayOfBookingArrays = await Promise.all(tripStatuses.map(status =>
      Booking.findGuestBookingsByStatus({ guestId: 'guest-id', tripStatus: status })));

    const idSet = new Set();
    arrayOfBookingArrays.forEach(bookingArray => {
      bookingArray.forEach(booking => {
        idSet.add(booking.id);
      });
    });

    expect(idSet.size).toBe(6);
  });

  test('findGuestBookingsByStatus does not classify host_paid status using USD as past trip ', async () => {
    const firstBookingOpts = {
      ...bookingUsdOpts,
      status: 'host_paid',
    };
    const secondBookingOpts = {
      ...bookingUsdOpts,
      status: 'host_paid',
    };
    const thirdBookingOpts = {
      ...bookingBeeOpts,
      status: 'host_paid',
    };
    const [firstBooking, secondBooking, thirdBooking] = await Promise.all([
      Booking.buildWithMetaFields(firstBookingOpts).save(),
      Booking.buildWithMetaFields(secondBookingOpts).save(),
      Booking.buildWithMetaFields(thirdBookingOpts).save(),
    ])
    const tripStatuses = ['past', 'upcoming'];
    const [past, upcoming] = await Promise.all(tripStatuses.map(status =>
      Booking.findGuestBookingsByStatus({ guestId: 'guest-id', tripStatus: status })));
    
    const pastBookingIds = past.map(booking => booking.id);
    const upcomingBookingIds = upcoming.map(booking => booking.id);
    
    expect(upcoming.length).toBe(3);
    expect(upcomingBookingIds.includes(thirdBooking.id)).toBe(true);
    expect(upcomingBookingIds.includes(firstBooking.id)).toBe(true);
    expect(upcomingBookingIds.includes(secondBooking.id)).toBe(true);
  });

  test('findGuestBookingsByStatus fetches host_paid status using USD when checkOutdate already passed as `past` instead of `upcoming`', async () => {
    const firstBookingOpts = {
      ...bookingUsdOpts,
      checkInDate: datefns.subDays(today, 8),
      checkOutDate: datefns.subDays(today, 5),
      status: 'host_paid',
    };
    const secondBookingOpts = {
      ...bookingUsdOpts,
      status: 'host_paid',
    };
    const [firstBooking, secondBooking] = await Promise.all([
      Booking.buildWithMetaFields(firstBookingOpts).save(),
      Booking.buildWithMetaFields(secondBookingOpts).save(),
    ])
    const tripStatuses = ['past', 'upcoming'];
    const [past, upcoming] = await Promise.all(tripStatuses.map(status =>
      Booking.findGuestBookingsByStatus({ guestId: 'guest-id', tripStatus: status })));
    
    const pastBookingIds = past.map(booking => booking.id);
    const upcomingBookingIds = upcoming.map(booking => booking.id);
    expect(past.length).toBe(1);
    expect(upcoming.length).toBe(1);
    expect(pastBookingIds.includes(firstBooking.id)).toBe(true);
    expect(upcomingBookingIds.includes(secondBooking.id)).toBe(true);
  });

  test('toJSON matches inputs used to build', () => {
    const booking = Booking.build(bookingUsdOpts);
    const json = booking.toJSON();
    Object.keys(bookingUsdOpts)
      .filter(prop => prop !== 'meta')
      .forEach(prop => expect(json[prop]).toEqual(bookingUsdOpts[prop]));
  });
});
