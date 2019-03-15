const {
  AuthenticationError,
  gql,
  makeExecutableSchema,
} = require('apollo-server');
const { BookingService } = require('../../../../services/booking');
const { ListingService } = require('../../../../services/listing');
const { UserService } = require('../../../../services/user');

const typeDefs = gql`
  scalar Date
  enum Currency {
    BEE
    BTC
    ETH
    USD
  }

  type Query {
    allBookings: [Booking]
    booking(id: ID!): Booking
    guestBookings(status: String): [Booking]
    hostBookings(input: HostBookingsInput): [Booking]
  }

  type Mutation {
    createBooking(input: CreateBookingInput!): Booking
    guestCancelBooking(id: ID!): Booking
    guestConfirmBooking(input: GuestConfirmInput!): Booking
    guestRejectPayment(id: ID!): Booking
    guestSelectPayment(input: GuestSelectPaymentInput!): Booking
    approveBooking(id: ID!): Booking
    cancelBooking(id: ID!): Booking
    rejectBooking(id: ID!): Booking
    payoutBooking(id: ID!): Booking
  }

  type Booking {
    approvedBy: String
    btcWalletAddress: String
    cancelledBy: String
    checkInDate: Date
    checkOutDate: Date
    createdAt: Date
    currency: String
    guest: User
    guestDepositAmount: Float
    guestTotalAmount: Float
    guestTxHash: String
    guestWalletAddress: String
    host: User
    hostWalletAddress: String
    id: ID!
    initpayTxHash: String
    listing: Listing
    listingId: String
    numberOfGuests: Int
    paymentSourceId: Int
    payTxHash: String
    pricePerNight: Float
    priceQuotes: [PriceQuote]
    rejectedBy: String
    status: String
  }

  type Listing @cacheControl(maxAge: 600) {
    addressLine1: String
    addressLine2: String
    city: String
    createdAt: Date
    country: String
    currency: String
    homeType: String
    houseRules: String
    hostNameSlug: String
    hostId: String
    id: ID!
    idSlug: ID!
    isActive: Boolean
    lat: String
    lng: String
    maxGuests: Int
    minimumNights: Int
    listingPicUrl: String
    postalCode: String
    pricePerNightUsd: Float
    securityDepositUsd: Float
    state: String
    title: String
    user: User
    updatedAt: Date
  }

  type User @cacheControl(maxAge: 600) {
    createdAt: String
    email: String
    firstName: String
    id: ID!
    lastName: String
    phoneNumber: String
    profilePicUrl: String
    walletAddress: String
  }

  type PriceQuote {
    creditAmountApplied: Float
    currency: Currency
    guestTotalAmount: Float
    guestTotalAmountUsd: Float
    pricePerNight: Float
    priceTotalNights: Float
    securityDeposit: Float
    transactionFee: Float
  }

  input CreateBookingInput {
    checkInDate: Date!
    checkOutDate: Date!
    listingId: ID!
    numberOfGuests: Int!
  }

  input HostBookingsInput {
    status: String
  }

  input GuestConfirmInput {
    id: ID!
    cryptoParams: CryptoParams
  }

  input CryptoParams {
    guestWalletAddress: String!
    paymentProtocolAddress: String!
    tokenContractAddress: String
    transactionHash: String!
  }

  input GuestSelectPaymentInput {
    currency: Currency!
    id: ID!
    paymentSourceId: Int
  }
`;

const resolvers = {
  Booking: {
    listing: async (booking, _, { user }) => {
      const listing = await ListingService.getListingById(booking.listingId);
      return listing.toJSON({ requestor: user, booking });
    },
    host: async ({ hostId }) => {
      const foundHost = await UserService.getById(hostId);
      return foundHost ? foundHost.toJSON() : null;
    },
    guest: async (booking, _, { user }) => {
      const foundGuest = await UserService.getById(booking.guestId);
      return foundGuest ? foundGuest.toJSON({ requestor: user, booking }) : null;
    },
  },
  Query: {
    allBookings: async (_, {}, { user }) => {
      if (!user || !user.isAdmin()) {
        return new AuthenticationError('You are not authorized to view all bookings.');
      }
      const bookings = await BookingService.getAllBookings({limit: 100});
      return bookings.map(booking => booking.toJSON());
    },
    booking: async (_, { id }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to view this booking.');
      }
      const booking = await BookingService.getById(id, user);
      return booking.toJSON();
    },
    guestBookings: async (_, { status }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to view these bookings.');
      }
      if (!status) {
        const bookings = await BookingService.getGuestBookings(user.id);
        return bookings.map(booking => booking.toJSON());
      }
      const bookings = await BookingService.getGuestBookingsByStatus({ guestId: user.id, tripStatus: status });
      return bookings.map(booking => booking.toJSON());
    },
    hostBookings: async (_, { input }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to view these bookings.');
      }
      const bookings = await BookingService.getHostBookings(user.id, input);
      return bookings.map(booking => booking.toJSON());
    },
  },
  Mutation: {
    approveBooking: async (_, { id }, { user }) => {
      if (!user || !(user.isAdmin() || await BookingService.isHostToBooking(user.id, id))) {
        return new AuthenticationError('You are not authorized to approve this booking.');
      }

      const booking = await BookingService.approveBooking(id, user);
      return booking.toJSON();
    },
    cancelBooking: async (_, { id }, { user }) => {
      if (!user || !(user.isAdmin() || await BookingService.isHostToBooking(user.id, id))) {
        return new AuthenticationError('You are not authorized to cancel this booking.');
      }
      const booking = await BookingService.cancelBooking(id, user);
      return booking.toJSON();
    },
    createBooking: async (_, { input }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to create this booking');
      }
      const booking = await BookingService.createBookingWithQuotes(input, user);
      return booking.toJSON();
    },
    guestCancelBooking: async (_, { id }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to cancel this booking.');
      }
      const booking = await BookingService.guestCancelBooking(id, user);
      return booking.toJSON();
    },
    guestConfirmBooking: async (_, { input }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to confirm this booking.');
      }
      const booking = await BookingService.guestConfirmBooking(input, user);
      return booking.toJSON();
    },
    guestRejectPayment: async (_, { id }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to reject this payment.');
      }
      const booking = await BookingService.guestRejectPayment(id, user);
      return booking.toJSON();
    },
    guestSelectPayment: async (_, { input }, { user }) => {
      if (!user) {
        return new AuthenticationError('You are not authorized to select this payment.');
      }
      const booking = await BookingService.guestSelectPayment(input, user);
      return booking.toJSON();
    },
    rejectBooking: async (_, { id }, { user }) => {
      if (!user || !(user.isAdmin() || await BookingService.isHostToBooking(user.id, id))) {
        return new AuthenticationError('You are not authorized to reject this booking.');
      }
      const booking = await BookingService.rejectBooking(id, user);
      return booking.toJSON();
    },
    payoutBooking: async (_, { id }, { user }) => {
      if (!user || !user.isAdmin()) {
        return new AuthenticationError('You are not authorized to payout this booking.');
      }
      const booking = await BookingService.payoutBooking(id, user);
      return booking.toJSON();
    }
  },
};

module.exports = makeExecutableSchema({ typeDefs, resolvers });
