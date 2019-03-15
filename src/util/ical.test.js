const ical = require('./ical');
const icalGen = require('ical-generator');
const settings = require('../../config/settings');
const cal = icalGen({
  domain: settings.beenestHost,
  prodId: {company: 'BEENEST INC.', product: 'Beenest'},
  name: 'Beenest',
});

describe('ical', () => {
  test('a new ics string with no bookings should return back a formatted ics string with a past placeholder event', () => {
    expect.assertions(1);

    const dates = [];
    const listingId = '13';
    cal.createEvent({
      start: new Date(2016, 0, 1),
      end: new Date(2016, 0, 2),
      timestamp: new Date(2016, 0, 1),
      uid: '1a',
      summary: 'This past event is to enable you to add Beenest ical',
    });
    const output = ical.createContent(dates, listingId);
    expect(output).toMatch(cal.toString());
  });

  test('createContent will return back a formatted ics string', () => {
    expect.assertions(1);

    const dates = [['20180608', '20180605']];
    const listingId = '13';

    const output = ical.createContent(dates, listingId);
    expect(output).toMatch(/BEGIN:VEVENT/);
  });

  test('parse will return back an array of [checkIn, checkOut]', () => {
    expect.assertions(1);

    const dates = [['20260608', '20260612']];
    const listingId = '13';

    const ics = ical.createContent(dates, listingId);

    const output = ical.parseDateRanges(ics);

    expect(output).toEqual([['2026-06-08', '2026-06-12']]);
  });
});
