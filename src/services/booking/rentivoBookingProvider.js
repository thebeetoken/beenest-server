const { UserService } = require('../user');

class RentivoBookingProvider {
  async guestConfirmBookingWithUSD(booking) {
    const { paymentSourceId } = booking.meta;
    const [host, chargedBooking] = await Promise.all([
      UserService.getById(booking.hostId), // substitute hostId with our support id here so all bookings will go to us
      booking.updatePaymentSource({
        id: paymentSourceId,
        provider: 'stripe',
      }),
    ]);

    return {
      host,
      booking: chargedBooking,
    }
  }
}

module.exports = { RentivoBookingProvider: new RentivoBookingProvider() };