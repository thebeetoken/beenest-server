const testUtils = require('../../lib/testUtils');
const { ConferenceService } = require('./conference');
const { Conference } = require('../../models/sequelize');

const MANY_DAYS = 12321 * 24 * 60 * 60 * 1000;

describe('ConferenceService', () => {
  const now = Date.now();

  beforeEach(() => testUtils.initializeDatabase());
  afterEach(() => testUtils.clearDatabase());

  test('finds active conferences', async () => {
    await Promise.all([
      { startDate: new Date(now - MANY_DAYS * 2), endDate: new Date(now - MANY_DAYS) },
      { startDate: new Date(now - MANY_DAYS * 3), endDate: new Date(now - MANY_DAYS) },
      { startDate: new Date(now - MANY_DAYS * 3), endDate: new Date(now + MANY_DAYS) },
      { startDate: new Date(now - MANY_DAYS * 1), endDate: new Date(now + MANY_DAYS) }
    ].map(
      (range, index) => Conference.build({ ...range, id: "text-" + index, meta: {} }).save())
    );

    const conferences = await ConferenceService.getActiveConferences();
    expect(conferences.length).toEqual(2);
  });

  test('create', async () => {
    expect.assertions(1);
    const input = {
      coverImage: { url: 'http://image.jpg' },
      description: 'conference description',
      endDate: '2022-10-01',
      startDate: '2022-10-05',
      title: 'Conference Title'
    };
    const conference = await ConferenceService.create(input);
    expect(conference.id).toEqual('conference-title');
  });

  test('getById', async () => {
    expect.assertions(1);
    const input = {
      coverImage: { url: 'http://image.jpg' },
      description: 'conference description',
      endDate: '2022-10-01',
      startDate: '2022-10-05',
      title: 'Conference Title two'
    };
    const conference = await ConferenceService.create(input);
    const found = await ConferenceService.getById(conference.id);

    expect(found.id).toEqual(conference.id);
  });
});
