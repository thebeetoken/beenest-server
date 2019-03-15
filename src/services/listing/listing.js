const _ = require('lodash');
const snake = require('to-snake-case');
const differenceInDays = require('date-fns/difference_in_days');
const { BeenestListingProvider } = require('./beenestListingProvider');
const { RentivoListingProvider } = require('./rentivoListingProvider');
const { AgodaListingProvider } = require('./agodaListingProvider');
const LocationUtil = require('../../util/locationUtil');

const ListingAggregator = require('./listingAggregator');

const ListingAggregatorService = new ListingAggregator({
  agoda: AgodaListingProvider,
  rentivo: RentivoListingProvider,
}, 
  BeenestListingProvider,
);

const {
  Calendar,
  Conference,
  CurrencyRate,
  Listing,
  User,
  Booking,
  Reservation,
} = require('../../models/sequelize');
const CalendarService = require('../../services/calendar');
const { AnalyticsService } = require('../../services/analytics');
const { UserService } = require('../user');
const { CurrencyService } = require('../currency');
const { Op } = require('sequelize');
const errors = require('../../util/errors');

const isValidiCalUrl = (icalUrl) => icalUrl.startsWith('http://') || icalUrl.startsWith('https://');
const hasInvalidiCalUrl = (icalUrls) => {
    if (!icalUrls || icalUrls.length === 0) {
      return false;
    }

    return icalUrls.find(icalUrl => !isValidiCalUrl(icalUrl));
};

class ListingService {
  getAllActiveListings() {
    return Listing.findAll({
      where: { isActive: true },
      order: [['id', 'DESC']],
    });
  }

  async getAllListings(input = {}) {
    const { limit, offset } = input;
    const user = input.userEmail ?
      await User.findOne({ where: { email: input.userEmail } }) :
      undefined;
    if (input.userEmail && !user) {
      return [];
    }
    const hostId = user ? user.id : input.userId;
    const { count, rows } = await Listing.findAndCountAll({
      order: [['id', 'DESC']],
      where: hostId ? { hostId } : {},
      limit,
      offset
    });
    return { listings: rows, count };
  }

  async getConferenceListings(conferenceId) {
    const conference = await Conference.findById(conferenceId);
    if (!conference) {
      return [];
    }
    return Listing.findAll({ 
      where: {
        id: conference.meta.listingIds,
        isActive: true,
      },
    });
  }

  async deleteListing(id) {
    try {
      const foundListing = await Listing.findOne({ where: { id } });
      if (!foundListing) {
        const error = new Error('No listing found in DB.');
        error.code = errors.NOT_FOUND;
        throw error;
      }

      const foundBooking = await Booking.findOne({ where: { listingId: id } });
      if (foundBooking) {
        const error = new Error('This listing is associated with at least one booking, cannot delete listing.');
        error.code = errors.UNABLE_TO_DELETE;
        throw error;
      }

      const rowDeleted = await Listing.destroy({
        where: {
           id: id,
        },
      });

      if (rowDeleted === 0) {
        const error = new Error('Listing was unsuccessfully deleted from DB.');
        error.code = errors.UNABLE_TO_DELETE;
        throw error;
      }

      return foundListing;
    } catch (err) {
      throw err;
    }
  }

  getListingById(listingId, options) {
    return ListingAggregatorService.getListingById(listingId, options);
  }

  async searchListings(query, user) {
    await AnalyticsService.trackSearch(query, user);
    const listings = await ListingAggregatorService.searchListings(query);
    const filteredListings = query.homeType ? listings.filter(
      ({ homeType }) => homeType === query.homeType
    ) : listings;
    return query.near ? filteredListings.sort(
      (a, b) => a.distanceFrom(query.near) - b.distanceFrom(query.near)
    ) : filteredListings;
  }

  async getFeaturedListings() {
    const coordinates = {
      losAngeles: { lat: 34.052235, lng: -118.243683 },
      newYork: { lat: 40.730610, lng: -73.935242 },
      sanFrancisco: { lat: 37.787097, lng: -122.403848 },
    };
    const sanFrancisco = Listing.findOne({
      order: [['createdAt', 'DESC']],
      where: { 
        isActive: true,
        ...LocationUtil.handleCoordinates(coordinates.sanFrancisco),
      },
    });
    const losAngeles = Listing.findOne({
      order: [['createdAt', 'DESC']],
      where: { 
        isActive: true,
        ...LocationUtil.handleCoordinates(coordinates.losAngeles),
      },
    });
    const newYork = Listing.findOne({
      order: [['createdAt', 'DESC']],
      where: { 
        isActive: true,
        ...LocationUtil.handleCoordinates(coordinates.newYork),
      },
    });

    return Promise.all([ sanFrancisco, losAngeles, newYork ])
      .then(result => result.filter(listing => listing));
  }

  async getHostListings(id) {
    return Listing.findAll({
      where: { hostId: id },
      order: [['createdAt', 'DESC']],
    });
  }

  async getHostListingsCount(id) {
    return Listing.count({
      where: { hostId: id },
    });
  }

  async findActiveListing(listingId, options) {
    return ListingAggregatorService.findActiveListing(listingId, options);
  }

  activateListing(id, user) {
    return Listing.findById(id).then(listing => {
      return Promise.all([AnalyticsService.trackListingPublished(user, listing), listing.update({ isActive: true })]);
    }).then(([listing, listingUpdateResult]) => {
      return Promise.resolve(listingUpdateResult);
    });
  }

  deactivateListing(id) {
    return Listing.findById(id).then(listing => listing.update({
      isActive: false
    }));
  }

  async createListing(listing, user) {
    const listingParams = listing || {};
    const host = await User.findOne({ where: { email: (user.isAdmin() && listingParams.hostEmail) || user.email } });
    if (!host) {
      throw new Error('HOST_DOES_NOT_EXIST_IN_DB');
    };
    const listingCount = await Listing.count({ where: { hostId: user.id }});
    if (listingCount > 99) {
      throw new Error('You reached the maximum amount of listings you can create');
    }
    const { icalUrls } = listingParams;

    if (hasInvalidiCalUrl(icalUrls)) {
      throw new Error(`ICAL URL: ${icalUrls} are invalid`);
    }

    const { isActive, pricePerNightUsd, securityDepositUsd, state } = listingParams;
    const newListing = Listing.buildWithMetaFields({
      ...listingParams,
      isActive: false, // Set below, based on canPublish
      state: state && state.toUpperCase(),
      currency: 'BEE',
      hostId: host.id || user.id,
      hostNameSlug: host && snake(host.firstName),
    });
    const savedListing = await newListing.save();

    const [numberOfListings] = await Promise.all([
      this.getHostListingsCount(host.id),
      CalendarService.createOrUpdate({ listingId: savedListing.id, icalUrls }),
      AnalyticsService.trackListingStarted(host, savedListing)
    ]);
    await host.updateListingCount(numberOfListings);

    return isActive && user.canPublish(savedListing) ?
      savedListing.update({ isActive }) :
      savedListing.save();
  }

  async duplicateListing(id, user) {
    const listing = await this.getListingById(id);
    const title = `Copy of ${listing.title}`;
    return this.createListing({
      ..._.omit(listing.get(), ['id', 'isActive']),
      title: title.length < 50 ? title : `${title.slice(0, 47)}...`
    }, user);
  }

  async updateListing(listingParams, user) {
    const foundListing = await this.getListingById(listingParams.id);
    if (!foundListing) {
      throw new Error('LISTING_DOES_NOT_EXIST');
    }

    const host = await User.findOne({
      where: {
        ...(user.isAdmin() && listingParams.hostEmail)
          ? { email: listingParams.hostEmail }
          : { id: foundListing.hostId }
      }
    });
    if (!host) {
      throw new Error('HOST_DOES_NOT_EXIST_IN_DB');
    }

    const prevHost = await User.findById(foundListing.hostId);
    if (!user.isAdmin() && (prevHost.id !== user.id)) {
      const error = new Error('USER_CANNOT_EDIT_THIS_LISTING.');
      error.code = errors.NOT_AUTHORIZED;
      throw error;
    }

    const { icalUrls } = listingParams;

    if (hasInvalidiCalUrl(icalUrls)) {
      throw new Error(`ICAL URLs: ${icalUrls} are invalid`);
    }

    const { isActive, pricePerNightUsd, securityDepositUsd, state } = listingParams;

    const updatedListing = await foundListing.updateWithMetaFields({
      ...listingParams,
      isActive: false, // Set below, based on canPublish
      state: state && state.toUpperCase(),
      currency: 'BEE',
      hostId: host.id,
      hostNameSlug: host && snake(host.firstName),
    });

    if (prevHost.id !== host.id) {
      await Promise.all([
        this.getHostListingsCount(host.id),
        this.getHostListingsCount(prevHost.id),
      ]).then(([currentHostListingsCount, prevHostListingsCount]) => ([
        host.updateListingCount(currentHostListingsCount),
        prevHost.updateListingCount(prevHostListingsCount),
      ]));
    }

    await CalendarService.createOrUpdate({ listingId: updatedListing.id, icalUrls }),

    updatedListing.meta.updatedBy = user.email;
    updatedListing.changed('meta', true);

    return isActive && user.canPublish(updatedListing) ?
      updatedListing.update({ isActive }) :
      updatedListing.save();
  }
}

module.exports = { ListingService: new ListingService() };