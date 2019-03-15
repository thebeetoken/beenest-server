const { MailService } = require('./mail');
const testUtils = require('../../lib/testUtils');
const { Booking, Listing, User } = require('../../models/sequelize');
const sender = require('./sender');
const firebaseAuth = require('../firebaseAuth');

const templates = {
  contact: require('./templates/user/contact'),
  guest: require('./templates/guest'),
  host: require('./templates/host'),
  report: require('./templates/report')
};

jest.mock('../firebaseAuth');
jest.mock('./sender');

describe('MailService', () => {
  const inputs = {};
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  beforeAll(() => testUtils.initializeDatabase());
  beforeEach(async () => {
    // UserService adds properties from firebaseAuth, but ignore that here.
    firebaseAuth.getUser.mockReturnValue(
      Promise.resolve({ phoneNumber: undefined })
    );
    inputs.host = await User.create(
      testUtils.createTrustedFirebaseUserOpts()
    );
    inputs.guest = await User.create(
      testUtils.createTestUserOpts()
    );
    inputs.listing = await Listing.create(
      testUtils.createTestListingOpts()
    );
    inputs.booking = await Booking.create({
      ...testUtils.createTestBookingOpts(),
      guestId: inputs.guest.id,
      hostId: inputs.host.id,
      listingId: inputs.listing.id
    });
  });
  afterEach(() => jest.clearAllMocks());
  afterAll(() => testUtils.clearDatabase());

  test('contact', async () => {
    const { guest, host, booking, listing } = inputs;
    const subject = "Quick Question";
    const message = "Is your property bee-friendly and if not wtf?";
    const bookingId = booking.id;
    const listingId = listing.id;
    await MailService.contact(guest, host, { message, subject, bookingId, listingId });

    expect(sender.send).toHaveBeenCalledWith({
      replyTo: guest.email,
      to: host.email,
      subject: `Beenest Inquiry from ${guest.firstName}: ${subject}`,
      html: templates.contact({ sender: guest, message, booking, listing })
    });
  });

  test('confirm', async () => {
    await MailService.confirm(inputs.booking);

    const { booking } = inputs;
    const guest = await User.findById(booking.guestId);
    const host = await User.findById(booking.hostId);
    const listing = await Listing.findById(booking.listingId);

    expect(sender.send).toHaveBeenCalledWith({
      to: guest.email,
      html: templates.guest.confirm({ guest, host, booking, listing }),
      subject: expect.stringContaining(host.displayName)
    });
    expect(sender.send).toHaveBeenCalledWith({
      to: host.email,
      html: templates.host.confirm({ guest, host, booking, listing }),
      subject: expect.stringContaining(guest.displayName)
    });
  });

  test('accept', async () => {
    await MailService.accept(inputs.booking);

    const { booking } = inputs;
    const guest = await User.findById(booking.guestId);
    const host = await User.findById(booking.hostId);
    const listing = await Listing.findById(booking.listingId);

    expect(sender.send).toHaveBeenCalledWith({
      to: guest.email,
      html: templates.guest.accept({ guest, host, booking, listing }),
      subject: expect.stringContaining(listing.city)
    });
  });

  test('reject', async () => {
    await MailService.reject(inputs.booking);

    const { booking } = inputs;
    const guest = await User.findById(booking.guestId);
    const host = await User.findById(booking.hostId);

    expect(sender.send).toHaveBeenCalledWith({
      to: guest.email,
      html: templates.guest.reject({ guest, host, booking }),
      subject: expect.stringContaining(host.displayName)
    });
  });

  test('rescind', async () => {
    await MailService.rescind(inputs.booking);

    const { booking } = inputs;
    const guest = await User.findById(booking.guestId);
    const host = await User.findById(booking.hostId);

    expect(sender.send).toHaveBeenCalledWith({
      to: guest.email,
      html: templates.guest.rescind({ guest, host, booking }),
      subject: expect.stringContaining(host.displayName)
    });
  });

  describe('for unapproved bookings', () => {
    beforeEach(async () => {
      await inputs.booking.update({
        status: 'guest_confirmed'
      });
    });
    test('cancel', async () => {
      const { booking } = inputs;
      await MailService.cancel(booking);

      const host = await User.findById(booking.hostId);
      const guest = await User.findById(booking.guestId);
      const listing = await Listing.findById(booking.listingId);

      expect(sender.send).toHaveBeenCalledWith({
        to: host.email,
        html: templates.host.cancel({ guest, host, booking, listing }),
        subject: expect.stringContaining(guest.displayName)
      });
    });
  });

  describe('for approved bookings before deadline', () => {
    beforeEach(async () => {
      await inputs.booking.update({
        status: 'host_approved',
        approvedBy: 'foo',
        cancelledAt: new Date(Date.now()),
        checkInDate: new Date(Date.now() + 8 * ONE_DAY_MS)
      });
    });
    test('cancel', async () => {
      const { booking } = inputs;
      await MailService.cancel(booking);

      const host = await User.findById(booking.hostId);
      const guest = await User.findById(booking.guestId);
      const listing = await Listing.findById(booking.listingId);

      expect(sender.send).toHaveBeenCalledWith({
        to: host.email,
        html: templates.host.cancel({ guest, host, booking, listing }),
        subject: expect.stringContaining(guest.displayName)
      });
    });
  });

  describe('for approved bookings after deadline', () => {
    beforeEach(async () => {
      await inputs.booking.update({
        status: 'host_approved',
        approvedBy: 'foo',
        cancelledAt: new Date(Date.now()),
        checkInDate: new Date(Date.now() + 6 * ONE_DAY_MS)
      });
    });
    test('cancel', async () => {
      const { booking } = inputs;
      await MailService.cancel(booking);

      const host = await User.findById(booking.hostId);
      const guest = await User.findById(booking.guestId);
      const listing = await Listing.findById(booking.listingId);

      expect(sender.send).toHaveBeenCalledWith({
        to: host.email,
        html: templates.host.cancel({ guest, host, booking, listing }),
        subject: expect.stringContaining(guest.displayName)
      });  
    });
  });

  test('reportOnboarding', async () => {
    const { host, listing } = inputs;
    const to = 'vic+test@thebeetoken.com';
    const date = new Date();
    await MailService.reportOnboarding(to, [host], [listing], {}, date);

    expect(sender.send).toHaveBeenCalledWith({
      to,
      html: templates.report.onboarding({ hosts: [host], listings: [listing], hasCalendar: {}, date }),
      subject: 'Onboarding Report: Incomplete Hosts/Listings'
    });
  });

  test('reportContractEventMismatch', async () => {
    const event = { event: 'foo' };
    const id = 'some-id';
    const deltas = [];
    await MailService.reportContractEventMismatch(event, id, deltas);

    expect(sender.send).toHaveBeenCalledWith({
      to: expect.stringContaining('@beetoken.com'),
      html: templates.report.mismatch({ event, id, deltas }),
      subject: expect.stringContaining(event.event)
    });
  });
});
