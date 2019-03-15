const { AuthenticationError, gql, makeExecutableSchema } = require('apollo-server');
const StripeService = require('../../../../services/stripe');
const { PaymentSourceService } = require('../../../../services/paymentSource');
const errors = require('../../../../util/errors');

const typeDefs = gql`
  scalar Date

  type Query {
    getPaymentSources: [PaymentSource]
  }

  type Mutation {
    createPaymentSource(stripeToken: ID!): PaymentSource
    deletePaymentSource(paymentSourceId: ID!): PaymentSource
    updatePaymentSource(input: UpdatePaymentSourceInput!): PaymentSource
  }

  type PaymentSource {
    id: ID
    userId: String
    provider: String
    stripeBrand: String
    stripeLast4: String
    stripeObject: String
    stripeSourceId: String
    stripeCustomerId: String
    stripeFingerprint: String
  }

  input UpdatePaymentSourceInput {
    addressCity: String
    addressLine1: String
    addressZip: String
    addressState: String
    expMonth: String
    expYear: String
    id: ID!
  }
`;

const resolvers = {
  Query: {
    getPaymentSources: async (_, {}, { user }) => {
      if (!user) {
        throw new AuthenticationError('You need to be logged in');
      }
      const paymentSources = await PaymentSourceService.getPaymentSourcesByUserId(user.id);
      return paymentSources.map(paymentSource => paymentSource.toJSON());
    }
  },
  Mutation: {
    createPaymentSource: (_, { stripeToken }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You need to be logged in');
      }
      return StripeService.addPaymentSource(user, stripeToken)
        .then(res => res.toJSON())
        .catch(error => {
          throw error;
        });
    },
    deletePaymentSource: (_, { paymentSourceId }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You need to be logged in');
      }
      return StripeService.removePaymentSource(user, paymentSourceId)
        .then(res => res.toJSON())
        .catch(error => {
          throw error;
        });
    },
    updatePaymentSource: (_, { input }, { user }) => {
      if (!user) {
        throw new AuthenticationError('You need to be logged in');
      }
      return StripeService.updatePaymentSource(user, input)
        .then(res => res.toJSON())
        .catch(error => {
          throw error;
        });
    },
  }
};

module.exports = makeExecutableSchema({ typeDefs, resolvers });
