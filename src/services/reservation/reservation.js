const addMonths = require('date-fns/add_months');
const { Booking, Reservation } = require('../../models/sequelize');

class ReservationService {
  async getReservations(listingId, checkInDate = new Date(), checkOutDate = addMonths(new Date(), 6)) {
    const [reservations, bookings] = await Promise.all([
      Reservation.findInRange(listingId, checkInDate, checkOutDate),
      Booking.findOverlappingBookings({
        listingId,
        checkInDate,
        checkOutDate,
      })
    ]);
    return reservations.map(reservation => ({
      startDate: reservation.startDate,
      endDate: reservation.endDate
    })).concat(bookings.map(booking => ({
      startDate: booking.checkInDate,
      endDate: booking.checkOutDate
    })));
  }
}

module.exports = {
  ReservationService: new ReservationService(),
};