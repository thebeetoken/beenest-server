const format = require('date-fns/format');
const icalGen = require('ical-generator');
const settings = require('../../config/settings');
const cal = icalGen({
  domain: settings.beenestHost,
  prodId: {company: 'BEENEST INC.', product: 'Beenest'},
  name: 'Beenest',
});

const ical = {
  /**
   * Creates an ICS formatted string
   * @author Andy
   * @param {array} datesBooked an array of [YYYYMMDD, YYYYMMDD]
   * @param {string} listingId
   * @return {string} string in ics format
   **/
  createContent: (datesBooked, listingId) => {
    if (!datesBooked.length) {
      cal.createEvent({
        start: new Date(2016, 0, 1),
        end: new Date(2016, 0, 2),
        timestamp: new Date(2016, 0, 1),
        uid: '1a',
        summary: 'This past event is to enable you to add Beenest ical',
      });

      return cal.toString();
    }
    let result = 'BEGIN:VCALENDAR';
    for (let i = 0, len = datesBooked.length; i < len; i++) {
      // DO NOT MODIFY THE TEMPLATE STRING
      const template = `
BEGIN:VEVENT
DTEND;VALUE=DATE:${format(datesBooked[i][1], 'YYYYMMDD')}
DTSTART;VALUE=DATE:${format(datesBooked[i][0], 'YYYYMMDD')}
SUMMARY: Booked on Beenest Platform: https://beenest.com/listings/${listingId}
END:VEVENT
`;
      result = result + template;
    }
    return result + 'END:VCALENDAR';
  },

  /*
   * Parse the Ical string into an array of date ranges
   * @author Andy
   * @param {string} ics string
   * @return {array} datesBooked an array of [YYYY-MM-DD, YYYY-MM-DD]
   **/
  parseDateRanges: (ics) => {
    const ranges = [];
    const parsedArray = ics.split("BEGIN:VEVENT");
    // Upon split, at index i = 0 is the ICAL title. To avoid including it, we start at index i = 1
    for (let i = 1, len = parsedArray.length; i < len; i++) {
      const start = parsedArray[i].indexOf("DTSTART;VALUE=DATE:");
      const end = parsedArray[i].indexOf("DTEND;VALUE=DATE:");
      ranges.push([
        format(parsedArray[i].slice(start + 19, start + 27), 'YYYY-MM-DD'),
        format(parsedArray[i].slice(end + 17, end + 25), 'YYYY-MM-DD')
      ]);
    }
    const today = format(new Date(), 'YYYY-MM-DD');
    return ranges
      .filter(dates => !(dates[1] < today))
      .sort((a, b) => (a[0] > b[0]) ? 1 : -1);
  }
};

module.exports = ical;
