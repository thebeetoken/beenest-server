const {
  ForbiddenError,
  AuthenticationError,
  gql,
  makeExecutableSchema,
} = require('apollo-server');
const { CreditService } = require('../../../../services/credit');
const errors = require('../../../../util/errors');

const typeDefs = gql`
  scalar Date

  type Query {
    creditBalance: CreditBalance
  }

  type CreditBalance {
    userId: String
    amountUsd: Float
    createdAt: Date
    updatedAt: Date
  }
`;

const resolvers = {
  Query: {
    creditBalance: async (_, {}, { user }) => {
      if (!user) {
        throw new ForbiddenError('You are not authorized.');
      }
      const balance = await CreditService.getBalance(user);
      return (balance || CreditService.getEmptyBalance()).toJSON({});
    },
  },
};

module.exports = makeExecutableSchema({ typeDefs, resolvers });
