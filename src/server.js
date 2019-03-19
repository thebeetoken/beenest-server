const Raven = require('raven');
const { ApolloServer } = require('apollo-server-express');
const { ApolloError, AuthenticationError } = require('apollo-server');
const bodyParser = require('body-parser');
const express = require('express');
const httpLogger = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const { sentryUrl } = require('../config/settings');
const corsOptions = require('../config/cors');
const routes = require('./controllers');
const logger = require('./services/logger');
const schema = require('./controllers/graphql/schemas');
const admin = require('./services/firebaseAuth');
const { User } = require('./models/sequelize');

const app = express();

const isProfileErrorHandlerEnabled = process.env.NODE_ENV === 'production' && !!sentryUrl;

// Apollo GraphQL
const server = new ApolloServer({
  cacheControl: true,
  context: async ({ req }) => {
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      if (!token) {
        return {}; // Return an empty object, users can still access public queries
      }
      // Validate token with Firesbase & refreshes firebase token as user remains active on client
      const { email, name, uid } = await admin.verifyIdToken(token);
      // Get User model from db and pass through context for secure queries/mutations
      // Firebase is our source of truth, so create a user if we can't find one.
      const user =
        (await User.findById(uid)) ||
        (await User.create({
          email,
          firstName: name.split(' ')[0],
          id: uid,
          lastName: name.split(' ')[1] || ' ',
        }));
      return { user };
    } catch (e) {
      switch (e.code) {
        case 'auth/argument-error':
          throw new AuthenticationError('EXPIRED_TOKEN');
        default:
          throw new ApolloError('SERVER ERROR');
      }
    }
  },
  formatError: error => {
    const extras = {
      source: error.source && error.source.body,
      positions: error.positions,
    };

    if (error.name === 'GraphQLError') {
      extras.path = error.path;
    }

    if (isProfileErrorHandlerEnabled) {
      Raven.captureException(error);
    }

    logger.error('GraphQL Error: ', error.message);
    return error;
  },
  schema,
});

// sentry is remote error reporting
if (isProfileErrorHandlerEnabled) {
  logger.info('Sentry Enabled.');
  Raven.config(sentryUrl, {
    parseUser: req => {
      const userData = {
        ipAddress: req.headers['x-forwarded-for'],
        user_agent: req.headers['user-agent'],
      };
      if (req.locals && req.locals.user) {
        userData.email = req.locals.user.email;
      }

      return userData;
    },
  }).install();
}

app.disable('x-powered-by');

if (isProfileErrorHandlerEnabled) {
  app.use(Raven.requestHandler());
}

// security middleware
app.use(cors(corsOptions), helmet());
app.use(httpLogger('combined'));

// Parsers
app.use(bodyParser.json({ limit: '50mb' }), bodyParser.urlencoded({ extended: false }));

if (isProfileErrorHandlerEnabled) {
  app.use(Raven.errorHandler());
}

// Apollo Server Middleware
server.applyMiddleware({ app });

// Connect all our routes to our application
app.use('/', routes);

app.use((req, res) => res.status(404).json({ msg: '404: Sorry cant find that!' }));

app.use((err, req, res, next) => {
  logger.error(err.stack);
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({ msg: err.message });
});

module.exports = app;
