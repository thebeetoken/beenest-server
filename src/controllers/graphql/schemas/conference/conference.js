const {
  ApolloError,
  ForbiddenError,
  gql,
  makeExecutableSchema
} = require('apollo-server');
const { ConferenceService } = require('../../../../services/conference');
const { ListingService } = require('../../../../services/listing');
const { PricingService } = require('../../../../services/pricing/pricing');
const errors = require('../../../../util/errors');

const typeDefs = gql`
  scalar Date

  type Query {
    conferences: [Conference]
    conference(id: ID!): Conference
    allConferences: [Conference]
    featuredConference: Conference
  }

  type Mutation {
    createConference(input: ConferenceInput!): Conference
    updateConference(id: ID!, input: ConferenceInput!): Conference
    deleteConference(id: ID!): DeleteResponse
  }

  type Conference {
    city: String
    country: String
    coverImage: Image
    createdAt: Date
    description: String
    endDate: Date
    id: ID!
    link: String
    listingIds: [Int]
    listings: [Listing]
    startDate: Date
    title: String
    state: String
    venue: String
  }

  type Image {
    url: String
  }

  type DeleteResponse {
    deleted: Boolean
  }

  type Listing {
    city: String
    country: String
    homeType: String
    id: ID!
    idSlug: String
    isActive: Boolean
    listingPicUrl: String
    pricePerNightUsd: Float
    prices: [Price]
    sleepingArrangement: String
    state: String
    title: String
  }

  type Price {
    currency: String
    pricePerNight: Float
    securityDeposit: Float
  }

  input ImageInput {
    url: String
  }

  input ConferenceInput {
    city: String
    country: String
    coverImage: ImageInput
    description: String
    endDate: Date
    startDate: Date
    link: String
    listingIds: [Int]
    state: String
    title: String!
    venue: String
  }
`;

const resolvers = {
  Conference: {
    listings: async ({ id }) => {
      const listings = await ListingService.getConferenceListings(id);
      return listings.map(listing => listing.toJSON());
    },
  },
  Listing: {
    prices: (listing) => PricingService.getPrices(listing)
  },
  Query: {
    conferences: async (_, {}, { user }) => {
      const conferences = await ConferenceService.getActiveConferences();
      return conferences.map(conference => conference.toJSON());
    },
    conference: async (_, { id }) => {
      const conference = await ConferenceService.getById(id);
      if (!conference) {
        throw new ApolloError('Not found', errors.NOT_FOUND);
      }
      return conference.toJSON();
    },
    allConferences: async (_, {}, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('Unauthorized');
      }
      const conferences = await ConferenceService.getAll();
      return conferences.map(conference => conference.toJSON());
    },
    featuredConference: async (_, {}, { }) => {
      const featuredConference = await ConferenceService.getFeaturedConference();
      return featuredConference && featuredConference.toJSON();
    },
  },
  Mutation: {
    createConference: async (root, { input }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('Unauthorized');
      }
      await ConferenceService.create(input)
        .then(conference => {
          return conference.toJSON();
        })
        .catch(error => {
          if (error.parent) {
            const betterError = new Error(error.parent.message);
            betterError.code = error.parent.code;
            throw betterError;
          }
          throw error;
        });
    },
    updateConference: async (root, { id, input }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('Unauthorized');
      }
      const conference = await ConferenceService.update({ id, ...input });
      return conference.toJSON();
    },
    deleteConference: async (root, { id }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('Unauthorized');
      }
      const result = await ConferenceService.delete(id);
      return {deleted: result > 0};
    },
  }
};

module.exports = makeExecutableSchema({ typeDefs, resolvers });
