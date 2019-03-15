const testUtils = require('../../lib/testUtils');
const { Conference } = require('./index');

const MANY_DAYS = 12321 * 24 * 60 * 60 * 1000;

describe('Conference', () => {
  const now = Date.now();

  beforeEach(() => testUtils.initializeDatabase());
  afterEach(() => testUtils.clearDatabase());

  test('builds and saves', async () => {
    const testId = 'foo';
    const testConference = {
      id: testId,
      startDate: new Date(now - MANY_DAYS),
      endDate: new Date(now + MANY_DAYS),
      description: "This is a description of a test. It is all just words.",
      title: "A Very Nice Title: A Very Fine Test",
      coverImage: { url: "https://thebeetoken.com/test.png" },
      listingIds: []
    };
    await Conference.buildWithMetaFields(testConference).save();

    const conference = await Conference.findById(testId);

    ['id', 'startDate', 'endDate'].forEach(
      property => expect(conference[property]).toEqual(testConference[property])
    );
    ['description', 'title', 'coverImage', 'listingIds'].forEach(
      property => expect(conference.meta[property]).toEqual(testConference[property])
    );
  });
});
