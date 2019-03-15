const {
  ForbiddenError,
  AuthenticationError,
  gql,
  makeExecutableSchema,
} = require('apollo-server');
const { MailService } = require('../../../../services/mail');
const { UserService } = require('../../../../services/user');
const stripe = require('../../../../services/stripe');
const errors = require('../../../../util/errors');

const typeDefs = gql`
  scalar Date

  type Query {
    allUsers: [User]
    getUserById(id: ID!): User
    searchUsers(input: SearchUsersInput): UserSearchResult
    searchHosts(input: SearchUsersInput): UserSearchResult
    user: User
  }

  type UserSearchResult {
    users: [User]
    count: Int
  }

  type Mutation {
    adminCreateHost(input: AdminCreateHostInput!): User
    contactUser(input: ContactUserInput!): EmailResponse
    createOrLoginWithProviders(id: ID!): User
    createUser(input: CreateUserInput!): User
    createHost(input: CreateHostInput!): User
    deleteUser(id: ID!): User
    refreshVerificationStatus: User
    updateHost(input: UpdateHostInput!): User
    updateWalletAddress(input: UpdateWalletAddressInput!): User
    updateUser(input: UpdateUserInput!): User
    createStripeLoginLink: StripeLoginLink
  }

  type StripeLoginLink {
    url: String
  }

  type User {
    about: String
    completedVerification: Boolean
    createdAt: Date
    email: String
    firstName: String
    id: ID!
    lastName: String
    listingCount: Int
    password: String
    phoneNumber: String
    profilePicUrl: String
    stripeAccountDashboardLink: String
    supportEmail: String
    btcWalletAddress: String
    ethWalletAddress: String
    walletAddress: String
    updatedAt: Date
  }

  type EmailResponse {
    bookingId: ID
    listingId: ID
    message: String
    recipient: User
    subject: String
  }

  input SearchUsersInput {
    query: String
    limit: Int
    offset: Int
  }

  input SearchHostsInput {
    query: String
    limit: Int
    offset: Int
  }

  input AdminCreateHostInput {
    about: String
    btcWalletAddress: String
    email: String!
    firstName: String!
    lastName: String!
    password: String!
    phoneNumber: String!
    profilePicUrl: String
    walletAddress: String
  }

  input ContactUserInput {
    bookingId: ID
    listingId: ID
    message: String!
    recipientId: ID!
    subject: String!
  }

  input CreateUserInput {
    about: String
    email: String!
    code: String
    firstName: String!
    lastName: String!
    password: String!
  }

  input CreateHostInput {
    about: String
    email: String!
    code: String
    firstName: String!
    lastName: String!
    password: String!
    isAlreadyListed: String
    propertiesManaged: String
  }

  input UpdateHostInput {
    about: String
    btcWalletAddress: String
    email: String
    firstName: String
    id: ID!
    lastName: String
    phoneNumber: String
    profilePicUrl: String
    walletAddress: String
  }

  input UpdateUserInput {
    about: String
    email: String
    firstName: String
    lastName: String
    phoneNumber: String
    profilePicUrl: String
  }

  input UpdateWalletAddressInput {
    btcWalletAddress: String
    ethWalletAddress: String
  }
`;

const resolvers = {
  Query: {
    user: async (_, {}, { user }) => {
      if (!user) {
        throw new AuthenticationError('You are not logged in.');
      }
      const foundUser = await UserService.getById(user.id);
      return foundUser.toJSON({requestor: user});
    },
    allUsers: async (_, {}, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('You are not authorized.');
      }
      const users = await UserService.getAllUsers();
      return users.map(user => user.toJSON({ requestor: user }));
    },
    getUserById: async (_, { id }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('You are not authorized.');
      }
      const foundUser = await UserService.getById(id);
      return foundUser.toJSON({requestor: user});
    },
    searchHosts: async (_, { input }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('You are not authorized.');
      }
      const { users, count } = await UserService.search({ ...input, isHost: true });
      return {
        users: users.map(user => user.toJSON({ requestor: user })),
        count
      };
    },
    searchUsers: async (_, { input }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('You are not authorized.');
      }
      const { users, count } = await UserService.search({ ...input });
      return {
        users: users.map(user => user.toJSON({ requestor: user })),
        count
      };
    },
  },
  Mutation: {
    adminCreateHost: async (_, { input }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('You are not authorized.');
      }
      return await UserService.adminCreateHost(input);
    },
    createOrLoginWithProviders: async (_, { id }, { user }) => {
      if (user) {
        const error = new AuthenticationError('You are already logged in.');
        error.code = errors.ALREADY_LOGGED_IN;
        throw error;
      }
      return await UserService.createOrLoginWithProviders(id);
    },
    createUser: async (_, { input }, { user }) => {
      if (user) {
        const error = new AuthenticationError('You are already logged in.');
        error.code = errors.ALREADY_LOGGED_IN;
        throw error;
      }
      return await UserService.createUser(input);
    },
    createHost: async (_, { input }, { user }) => {
      if (user) {
        const error = new AuthenticationError('You are already logged in.');
        error.code = errors.ALREADY_LOGGED_IN;
        throw error;
      }
      return await UserService.createHost(input);
    },
    deleteUser: async (_, { id }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('You are not authorized.');
      }
      const deletedUser = await UserService.deleteUser(id);
      return deletedUser.toJSON({ requestor: user });
    },
    createStripeLoginLink: async (_, { }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You are not logged in.');
      }
      return await stripe.createStripeLoginLink(user);
    },
    refreshVerificationStatus: async (_, { }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You are not logged in.');
      }
      const updatedUserVerificationStatus = await UserService.refreshVerificationStatus(user.id);
      return updatedUserVerificationStatus.toJSON();
    },
    updateHost: async (_, { input }, { user }) => {
      if (!user || !user.isAdmin()) {
        throw new ForbiddenError('You are not authorized.');
      }
      return await UserService.updateHost(input, user);
    },
    updateWalletAddress: async (_, { input }, { user }) => {
      if (!user) {
        const error = new AuthenticationError('You are not logged in.');
        error.code = errors.NOT_LOGGED_IN;
        throw error;
      }
      const { btcWalletAddress, ethWalletAddress } = input;
      const updatedUser = await UserService.updateWalletAddress({btcWalletAddress, ethWalletAddress}, user);
      return updatedUser.toJSON({ requestor: user });
    },
    updateUser: async(_, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You are not logged in.');
      }
      const updatedUser = await UserService.updateUser(input, user);
      return updatedUser.toJSON({ requestor: user });
    },
    contactUser: async(_, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You are not logged in.');
      }
      const { bookingId, listingId, message, recipientId, subject } = input;
      const recipient = await UserService.getById(recipientId);
      if (!recipient) {
        throw new ApolloError('Recipient does not exist', errors.NO_USER_FOUND);
      }
      await MailService.contact(user, recipient, input);
      return {
        bookingId,
        listingId,
        message,
        recipient: recipient.toJSON(),
        subject,
      }
    },
  },
};

module.exports = makeExecutableSchema({ typeDefs, resolvers });
