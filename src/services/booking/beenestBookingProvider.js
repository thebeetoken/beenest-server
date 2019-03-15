const { UserService } = require('../user');

class BeenestBookingProvider {
  async guestConfirmBookingWithUSD(booking) {
    const { paymentSourceId } = booking.meta;
    const [host, chargedBooking] = await Promise.all([
      UserService.getById(booking.hostId),
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

module.exports = { BeenestBookingProvider: new BeenestBookingProvider() };