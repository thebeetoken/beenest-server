const addDays = require('date-fns/add_days');
const differenceInDays = require('date-fns/difference_in_days');
const { Op } = require('sequelize');

const AgodaAPI = require('../agodaAPI');
const LocationUtil = require('../../util/locationUtil');
const { AgodaListing, Listing, User } = require('../../models/sequelize');
const { ReservationService } = require('../reservation');
const errors = require('../../util/errors');
const { agodaHostEmail } = require('../../../config/settings');

const queryMap = {
  lat: 'latitude',
  lng: 'longitude'
};

const rewrite = query => Object.keys(query).reduce((rewritten, key) => ({
  ...rewritten,
  [queryMap[key] || key]: query[key]
}), {});

class AgodaListingProvider {
  async searchListings({
    bounds,
    checkInDate,
    checkOutDate,
    coordinates,
    locationQuery,
    numberOfGuests,
  }) {
    const { query, queryCoordinates } = await LocationUtil.getQueryAndQueryCoordinates({ bounds, coordinates, locationQuery });
    const listings = await AgodaListing.findAll({
      where: {
        ...rewrite(query),
        ratesCurrency: 'USD',
        ratesFrom: { [Op.gt]: 0 },
        photo1: { [Op.not]: '' }
      },
      limit: 50,
    });
    const hotelIds = listings.map(listing => listing.hotelId);
    const pricing = await AgodaAPI.getPricing({
      hotelIds,
      checkInDate,
      checkOutDate,
      numberOfGuests
    });

    const filteredListings = (checkInDate && checkOutDate) ?
      listings.filter(listing => !!pricing[listing.hotelId]) :
      listings;
    const sortedListings = queryCoordinates ? filteredListings.sort(
      (a, b) => a.distanceFrom(queryCoordinates) - b.distanceFrom(queryCoordinates)
    ) : filteredListings;
    const host = await User.findOne({ where: { email: agodaHostEmail } });

    if (!host) {
      return [];
    }

    const convertedListings = sortedListings.map(
      listing => Listing.build(listing.toListing(host, pricing))
    );

    if (!checkOutDate && !checkInDate) {
      return convertedListings;
    }

    const startDate = checkInDate || addDays(checkOutDate + 'Z', -1);
    const endDate = checkOutDate || addDays(checkInDate + 'Z', 1);
    const availableListings = (await Promise.all(convertedListings.map(async listing => {
      const reservations = await ReservationService.getReservations(listing.id, startDate, endDate);
      return reservations.length === 0 ? listing : undefined;
    }))).filter(listing => !!listing);

    return availableListings;
  }

  async findActiveListing(listingId, opts) {
    return this.getListingById(listingId, opts);
  }

  async getListingById(listingId, opts) {
    const id = parseInt(listingId.replace(/^.*_/, ''));
    const agodaListing = await AgodaListing.findOne({ where: { id } });
    const host = await User.findOne({ where: { email: agodaHostEmail } });

    if (!host || !agodaListing) {
      const error = new Error(`No ${!host ? 'Agoda host found' : 'such listing'}.`);
      error.code = !host ? errors.NO_USER_FOUND : errors.NOT_FOUND;
      throw error;
    }

    const pricing = await AgodaAPI.getPricing({ hotelIds: [id], ...opts });
    return Listing.build(agodaListing.toListing(host, pricing));
  }
}

module.exports = { AgodaListingProvider: new AgodaListingProvider() };
