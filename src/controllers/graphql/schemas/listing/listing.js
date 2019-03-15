const {
  ApolloError,
  AuthenticationError,
  gql,
  makeExecutableSchema,
  UserInputError,
} = require('apollo-server');
const { ListingService } = require('../../../../services/listing');
const { UserService } = require('../../../../services/user');
const CalendarService = require('../../../../services/calendar');
const errors = require('../../../../util/errors');
const { ReservationService } = require('../../../../services/reservation');
const { PricingService } = require('../../../../services/pricing/pricing');
const imageHandler = require('../../../../services/imageHandler');

const typeDefs = gql`
  scalar Date
  enum Measurement {
    KM #Kilometers
    MI #Miles
  }

  directive @isAuthorized on FIELD | FIELD_DEFINITION
  directive @isVerified on FIELD | FIELD_DEFINITION

  type Query {
    allListings(input: AllListingsInput): ListingSearchResult
    conferenceListings(conferenceId: String!): [Listing]
    featuredListings: [Listing]
    hostListings: [Listing]
    listing(id: ID!, input: ViewListingInput): Listing
    reservations(input: ReservationQuery!): [Reservation]
    searchListings(input: SearchListingsInput!): [Listing]
  }

  type Mutation {
    activateListing(id: ID!): Listing
    createListing(input: ListingInput): Listing
    deactivateListing(id: ID!): Listing
    deleteListing(id: ID!): Listing
    duplicateListing(id: ID!): Listing
    updateListing(id: ID!, input: ListingInput): Listing
  }

  type TimeRange {
    from: String
    to: String
  }

  type Listing {
    addressLine1: String
    addressLine2: String
    adminNotes: String
    amenities: [String]
    airbnbLink: String
    autoApprove: Boolean
    bookingUrl: String
    canPublish: Boolean
    checkInDate: Date
    checkInTime: TimeRange
    checkOutDate: Date
    checkOutTime: String
    city: String
    country: String
    createdAt: Date
    currency: String
    description: String
    homeType: String
    host: Host
    hostNameSlug: String
    hostId: String
    houseRules: String
    icalUrls: [String]
    id: ID!
    idSlug: ID!
    isActive: Boolean
    lat: Float
    lng: Float
    maxGuests: Int
    minimumNights: Int
    numberOfBathrooms: Float
    numberOfBedrooms: Int
    listingPicUrl(width: Int, height: Int): String
    photos: [String]
    postalCode: String
    pricePerNightUsd: Float
    prices: [Price]
    rating: Rating
    reservations: [Reservation]
    securityDepositUsd: Float
    sharedBathroom: String
    sleepingArrangement: String
    state: String
    title: String
    totalQuantity: Int
    updatedAt: Date
    wifi: Wifi
  }

  type Rating {
    average: Float
    count: Int
  }

  type Price {
    currency: String
    pricePerNight: Float
    securityDeposit: Float
  }

  type Reservation {
    startDate: Date
    endDate: Date
  }

  type Wifi {
    mbps: Float
    photoUrl: String
  }

  type Host @cacheControl(maxAge: 600) {
    about: String
    createdAt: Date
    displayName: String
    email: String @isAuthorized
    firstName: String # TODO: Deprecate
    fullName: String @isAuthorized
    id: ID!
    lastName: String @isAuthorized # TODO: Deprecate
    profilePicUrl(width: Int, height: Int): String
  }

  type ListingSearchResult {
    listings: [Listing]
    count: Int
  }

  input SearchListingsInput {
    bounds: Bounds
    checkInDate: Date
    checkOutDate: Date
    coordinates: Coordinates
    homeType: String
    locationQuery: String
    near: Coordinates
    numberOfGuests: Int
  }

  input Bounds {
    east: Float
    north: Float
    south: Float
    west: Float
  }

  input Coordinates {
    lat: Float!
    lng: Float!
    measurement: Measurement
    radius: Float
  }

  input ReservationQuery {
    listingId: ID!
    startDate: Date!
    endDate: Date!
  }

  input TimeRangeInput {
    from: String
    to: String
  }

  input WifiInput {
    mbps: Float
    photoUrl: String
  }

  input ViewListingInput {
    checkInDate: Date
    checkOutDate: Date
    numberOfGuests: Int
  }

  input ListingInput {
    addressLine1: String
    addressLine2: String
    adminNotes: String
    airbnbLink: String
    amenities: [String]
    autoApprove: Boolean
    checkInDate: Date
    checkInTime: TimeRangeInput
    checkOutDate: Date
    checkOutTime: String
    city: String
    country: String
    description: String
    homeType: String
    hostEmail: String
    houseRules: String
    icalUrls: [String]
    isActive: Boolean
    lat: Float
    listingPicUrl: String
    lng: Float
    maxGuests: Int
    minimumNights: Int
    numberOfBathrooms: Float
    numberOfBedrooms: Int
    photos: [String]
    postalCode: String
    pricePerNightUsd: Float
    securityDepositUsd: Float
    sharedBathroom: String
    sleepingArrangement: String
    state: String
    title: String
    totalQuantity: Int
    wifi: WifiInput
  }

  input AllListingsInput {
    limit: Int
    offset: Int
    userId: String
    userEmail: String
  }
`;

const directiveResolvers = {
  isAuthorized: (next, source, args, { user }) => {
    if (user && user.isAdmin()) return next();
    return null;
  },
  isVerified: (next, source, args, { user }) => {
    if (user && (user.completedVerification || user.isAdmin())) return next();
    return null;
  },
};

const resolvers = {
  Host: {
    profilePicUrl: ({ profilePicUrl }, { width, height }) =>
      imageHandler.getResizedImageUrl(profilePicUrl, width, height)
  },
  Listing: {
    host: async ({ id, hostId }, _, { user }) => {
      const foundHost = await UserService.getById(hostId);
      if (!foundHost) {
        return null;
      }

      const host = foundHost.toJSON({ requestor: user });
      return {
        ...host,
        supportEmail: host.supportEmail || `support+${id}@beenest.com`,
      };
    },
    listingPicUrl: async ({ listingPicUrl }, { width, height }) => {
      try {
        return await imageHandler.getResizedImageUrl(
          listingPicUrl,
          width,
          height
        );
      } catch (error) {
        throw error;
      }
    },
    reservations: ({ id }) => ReservationService.getReservations(id),
    icalUrls: async ({ id, hostId }, _, { user }) => {
      if (!user || ((user.id !== hostId) && !user.isAdmin())) {
        return null;
      }
      const calendars = await CalendarService.getIcalsByListingId(id);
      return calendars.map(calendar => calendar.icalUrl);
    },
    prices: (listing) => PricingService.getPrices(listing)
  },
  Query: {
    allListings: async (_, { input }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new AuthenticationError('You are not authorized to see all listings.');
      }
      const { listings, count } = await ListingService.getAllListings(input);
      return {
        listings: listings.map(listing => listing.toJSON({ requestor: user })),
        count
      };
    },
    hostListings: async (_, {}, { user }) => {
      if (!user) {
        throw new AuthenticationError('You are not logged in.');
      }
      const listings = await ListingService.getHostListings(user.id);
      return listings.map(listing => listing.toJSON());
    },
    searchListings: async (_, { input }, { user }) => {
      if (!(input.locationQuery || input.coordinates || input.bounds)) {
        throw new UserInputError('Search arguments invalid', {
          invalidArgs: ['locationQuery', 'coordinates', 'bounds'],
        });
      }

      const listings = await ListingService.searchListings(input, user);
      return listings.map(listing => listing.toJSON());
    },
    conferenceListings: async (_, { conferenceId }) => {
      const listings = await ListingService.getConferenceListings(conferenceId);
      return listings.map(listing => listing.toJSON());
    },
    featuredListings: async (_, {}, {}) => {
      const featuredListings = await ListingService.getFeaturedListings();
      return featuredListings.map(listing => listing.toJSON());
    },
    listing: async (_, { id, input }, { user }) => {
      const listing = await ListingService.getListingById(id, input);
      if (!listing) {
        throw new ApolloError('Not found', errors.NOT_FOUND);
      }
      return listing.toJSON({ requestor: user });
    },
    reservations: (_, { input }) => {
      const { listingId, startDate, endDate } = input;
      return ReservationService.getReservations(listingId, startDate, endDate);
    },
  },
  Mutation: {
    activateListing: async (_, { id }, { user }) => {
      const listing = await ListingService.getListingById(id);
      if (!user || !user.canPublish(listing)) {
        throw new AuthenticationError('You are not authorized to activate this listing.');
      }
      return await ListingService.activateListing(id, user);
    },
    createListing: async (_, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You are not logged in.');
      }
      const listing = await ListingService.createListing(input, user);
      return listing.toJSON({ requestor: user });
    },
    deactivateListing: async (_, { id }, { user }) => {
      const listing = await ListingService.getListingById(id);
      if (!user || !user.canPublish(listing)) {
        throw new AuthenticationError('You are not authorized to deactivate this listing.');
      }
      return await ListingService.deactivateListing(id);
    },
    deleteListing: async (_, { id }, { user }) => {
      const listing = await ListingService.getListingById(id);
      if (!user || !user.canEdit(listing)) {
        throw new AuthenticationError('You are not authorized to delete this listing.');
      }
      const deletedListing = await ListingService.deleteListing(id);
      return deletedListing.toJSON({ requestor: user });
    },
    duplicateListing: async (_, { id }, { user }) => {
      const listing = await ListingService.getListingById(id);
      if (!user || !user.canEdit(listing)) {
        throw new AuthenticationError('You are not authorized to duplicate this listing.');
      }
      const duplicatedListing = await ListingService.duplicateListing(id, user);
      return duplicatedListing.toJSON({ requestor: user });
    },
    updateListing: async (_, { id, input }, { user }) => {
      const listing = await ListingService.getListingById(id);
      if (!user || !user.canEdit(listing)) {
        throw new AuthenticationError('You are not logged in.');
      }
      const updatedListing = await ListingService.updateListing(
        { id, ...input },
        user
      );
      return updatedListing.toJSON({ requestor: user });
    },
  },
};

module.exports = makeExecutableSchema({
  typeDefs,
  resolvers,
  directiveResolvers,
});
