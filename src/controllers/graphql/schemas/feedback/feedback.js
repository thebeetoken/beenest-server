const {
  AuthenticationError,
  gql,
  makeExecutableSchema,
} = require('apollo-server');
const { FeedbackService } = require('../../../../services/feedback');
const errors = require('../../../../util/errors');

const typeDefs = gql`
  scalar Date

  type Query {
    allFeedback: [Feedback]
  }

  type Mutation {
    createFeedback(input: FeedbackInput!): Feedback
  }

  input FeedbackInput {
    feedback: String
    email: String
    nps: Float
  }

  type Feedback {
    createdAt: Date
    email: String
    feedback: String
    id: ID!
    nps: Float
  }
`;

const resolvers = {
  Query: {
    allFeedback: async (_, {}, { user }) => {
      if (!user || !user.isAdmin()) {
        return new AuthenticationError('You are not authorized to view feedback.');
      }
      const feedback = await FeedbackService.getAll();
      return feedback.map(feedback => feedback.toJSON());
    },
  },
  Mutation: {
    createFeedback: async (root, { input }, { user }) => {
      const feedback = await FeedbackService.create(input);
      return feedback.toJSON();
    },
  },
};

const FeedbackSchema = makeExecutableSchema({ typeDefs, resolvers });

module.exports = {
  FeedbackSchema,
};
