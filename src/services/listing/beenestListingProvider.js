const addDays = require('date-fns/add_days');
const differenceInDays = require('date-fns/difference_in_days');
const { Op } = require('sequelize');

const { Listing } = require('../../models/sequelize');
const LocationUtil = require('../../util/locationUtil');
const errors = require('../../util/errors');
const { ReservationService } = require('../reservation');

class BeenestListingProvider {
  async searchListings({
    bounds,
    checkInDate,
    checkOutDate,
    coordinates,
    locationQuery,
    numberOfGuests,
  }) {
    const numberOfNights = differenceInDays(checkOutDate, checkInDate); // number or NaN
    const { query, queryCoordinates } = await LocationUtil.getQueryAndQueryCoordinates({ bounds, coordinates, locationQuery });
    const listings = await Listing.findAll({
      where: {
        isActive: true,
        maxGuests: {
          [Op.gte]: numberOfGuests || 1,
        },
        ...(numberOfNights && { minimumNights: { [Op.lte]: numberOfNights } }),
        ...(query),
      },
      limit: 50,
    });
    const sortedListings = queryCoordinates ? listings.sort(
      (a, b) => a.distanceFrom(queryCoordinates) - b.distanceFrom(queryCoordinates)
    ) : listings;

    if (!checkOutDate && !checkInDate) {
      return sortedListings;
    }

    const startDate = checkInDate || addDays(checkOutDate + 'Z', -1);
    const endDate = checkOutDate || addDays(checkInDate + 'Z', 1);
    const availableListings = await Promise.all(sortedListings.map(async listing => {
      const reservations = await ReservationService.getReservations(listing.id, startDate, endDate);
      return reservations.length === 0 ? listing : undefined;
    }));

    return availableListings.filter(listing => !!listing);
  }

  async findActiveListing(listingId) {
    if (isNaN(listingId)) {
      const error = new Error('No listing identified.');
      error.code = errors.INVALID_INPUT;
      throw error;
    };
    const listing = await Listing.findById(listingId);
    if (!listing) {
      const error = new Error('No such listing.');
      error.code = errors.NOT_FOUND;
      throw error;
    }
    if (!listing.isActive) {
      const error = new Error('Inactive listing.');
      error.code = errors.INACTIVE;
      throw error;
    }
    return listing;
  }
  

  async getListingById(listingId) {
    const listing = await Listing.findById(listingId);
    if (!listing) {
      const error = new Error('No such listing.');
      error.code = errors.NOT_FOUND;
      throw error;
    }
    return listing;
  }
}

module.exports = { BeenestListingProvider: new BeenestListingProvider() };
