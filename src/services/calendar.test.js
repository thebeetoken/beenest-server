const testUtils = require('../lib/testUtils');
const { Calendar, Listing } = require('../models/sequelize');
const calendar = require('./calendar');
const axios = require('axios');

jest.mock('axios');

describe('Calendar Service', () => {

  beforeAll(() => (
    Promise.all([testUtils.initializeDatabase()])
  ));

  test('updateReservations should work with no entries', async () => {
    expect.assertions(1);

    let results = await calendar.updateReservations();
    expect(results).toEqual([]);
  });

  test('updateReservations should handle 404 errors', async () => {
    expect.assertions(1);

    const testListingId = 12321;
    const testUrl = 'https://some.test/calendar.ics';
    const test404Url = 'https://some.next.test/calendar.ics';
    const testResponses = { [testUrl]: 'resolve', [test404Url]: 'reject' };

    axios.get.mockImplementation(
      path => Promise[testResponses[path]]({ data: '' })
    );

    await Promise.all([testUrl, test404Url].map((url, index) => Calendar.build({
      listingId: testListingId + index,
      icalUrls: [url]
    }).save()));

    let results = await calendar.updateReservations();
    expect(results).toEqual([[], []]);
  });

  test('createOrUpdate should create a ical entry if it does not exist', async () => {
    expect.assertions(2);

    const testListingId = 12322;
    const testUrl = 'https://some.test/calendar.ics';
    
    const newCalendars = await calendar.createOrUpdate({
      listingId: testListingId,
      icalUrls: [testUrl]
    })
    
    expect(newCalendars[0].listingId).toBe(testListingId);
    expect(newCalendars[0].icalUrl).toBe(testUrl);
  });

  test('createOrUpdate should replace an ical entry if listingId already exists', async () => {
    expect.assertions(2);

    const testListingId = 14569;
    const testUrl = 'https://www.before.com/calendar.ics';
    const updatedUrl = 'https://www.after.com/calendar.ics';

    await calendar.createOrUpdate({
      listingId: testListingId,
      icalUrls: [testUrl]
    });

    const updatedCalendars = await calendar.createOrUpdate({
      listingId: testListingId,
      icalUrls: [updatedUrl]
    });

    expect(updatedCalendars[0].icalUrl).toBe(updatedUrl);
    expect(updatedCalendars.length).toBe(1);
  });

  test('createOrUpdate should not create an ical entry if ical link does not exist', async () => {
    const testListingId = 12345;

    const newCalendars = await calendar.createOrUpdate({
      listingId: testListingId,
    });

    const fetchedCalendars = await calendar.getIcalsByListingId(testListingId);

    expect(newCalendars.length).toBe(0);
    expect(fetchedCalendars.length).toBe(0);
  });

  test('createOrUpdate should remove all ical previous entries when passing in any empty icalUrls array', async () => {
    const testListingId = 12346;
    const testUrl = 'https://www.before.com/calendar.ics';

    await calendar.createOrUpdate({
      listingId: testListingId,
      icalUrls: [testUrl]
    });

    const result = await calendar.createOrUpdate({
      listingId: testListingId,
      icalUrls: []
    });

    const currentCalendars = await calendar.getIcalsByListingId(testListingId);

    expect(result.length).toBe(0);
    expect(currentCalendars.length).toBe(0);
  });

  test('createOrUpdate triggers an updateReservations call', async () => {
    const realUpdateReservations = calendar.updateReservations;
    calendar.updateReservations = jest.fn();
    const testListingId = 12346;
    await calendar.createOrUpdate({ listingId: testListingId, icalUrls: [] });
    expect(calendar.updateReservations).toHaveBeenCalledWith(testListingId);
    calendar.updateResevations = realUpdateReservations;
  });

  // This test cannot pass because listingId is primary key on ical table
  // This means only 1 listingId entry can exist at a time
  // When we want to accommodate multiple ical links, we can remove the primary key restriction and add an id column

  // test('createOrUpdate should create multiple ical entries when given multiple links', async () => {
  //   expect.assertions(2);

  //   const testListingId = 12300;
  //   const testUrls = ['https://www.before1.com/calendar.ics', 'https://www.before2.com/calendar.ics'];
  //   const updatedUrls = ['https://www.after1.com/calendar.ics', 'https://www.after2.com/calendar.ics', 'https://www.after3.com/calendar.ics'];

  //   await calendar.createOrUpdate({
  //     listingId: testListingId,
  //     icalUrls: testUrls
  //   });

  //   await calendar.createOrUpdate({
  //     listingId: testListingId,
  //     icalUrls: updatedUrls
  //   });

  //   const foundCalendars = await calendar.getIcalsByListingId(testListingId);

  //   expect(foundCalendars.some(calendar => calendar.icalUrl === 'https://www.after2.com/calendar.ics')).toBe(true);
  //   expect(foundCalendars.length).toBe(3);
  // });
});
