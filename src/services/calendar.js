const axios = require('axios');
const ical = require('../util/ical');
const { Calendar, Reservation } = require('../models/sequelize');

const MAX_CONCURRENT_REQUESTS = 64;

class CalendarService {
  getIcalsByListingId(listingId) {
    return Calendar.findAll({
      where: {
        listingId
      }
    })
  }
  async updateReservations(listingId) {
    const query = listingId === undefined ? {} : { where: { listingId } };
    const calendars = await Calendar.findAll(query);
    const reservationsUpdated = [];

    // Trying to do all requests in parallel results in an OOM.
    // Trying to do one request at a time results in a timeout.
    // So, we try sequentially handling blocks of parallel requests...
    for (let start = 0; start < calendars.length; start += MAX_CONCURRENT_REQUESTS) {
      const end = Math.min(start + MAX_CONCURRENT_REQUESTS, calendars.length);
      const block = calendars.slice(start, end);
      await Promise.all(block.map(async (calendar) => {
        const { listingId, icalUrl } = calendar;

        try {
          const ics = await axios.get(icalUrl);
          const ranges = ical.parseDateRanges(ics.data).map(
            range => ({ startDate: range[0], endDate: range[1] })
          );
          const replaced = await Reservation.bulkReplace(listingId, icalUrl, ranges);
          reservationsUpdated.push(replaced);
        } catch (e) {
          reservationsUpdated.push([]);
        }
      }));
    }

    return reservationsUpdated;
  }
  async createOrUpdate({ listingId, icalUrls }) {
    if (!listingId) {
      throw new Error('Cannot modify ical entries: Missing listingId');
    }

    // delete all previous calendars
    await Calendar.destroy({ where: { listingId } });

    // create new set of provided calendars
    const calendars = (!icalUrls || (icalUrls && !icalUrls.length)) ? [] :
      await Calendar.bulkCreate(icalUrls.map(icalUrl => ({ listingId, icalUrl })));

    await this.updateReservations(listingId);

    return calendars;
  }
}

module.exports = new CalendarService();
