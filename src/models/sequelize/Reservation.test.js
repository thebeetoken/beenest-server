const testUtils = require('../../lib/testUtils');
const Reservation = require('./index').Reservation;

describe('Reservation', () => {
  beforeAll(() => {
    return testUtils.initializeDatabase();
  });

  afterAll(() => {
    return testUtils.clearDatabase();
  });

  test('bulkReplace replaces rows', async () => {
    const testId = 123;
    const testUrl = "https://localhost";
    
    for (var i = 1; i < 10; i += 1) {
      let testReservations = [];
      while (testReservations.length < i) {
        testReservations.push({
          startDate: new Date("2018-10-0" + i),
          endDate: new Date("2018-10-1" + i)
        });
      }
      await Reservation.bulkReplace(testId, testUrl, testReservations);
      let allReservations = await Reservation.findAll({ 
        where: { listingId: testId }
      });
      expect(allReservations.length).toEqual(i);
    }
  });
});
