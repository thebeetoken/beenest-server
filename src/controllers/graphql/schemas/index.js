const { mergeSchemas } = require('apollo-server');

const BookingSchema = require('./booking');
const ConferenceSchema = require('./conference');
const CreditSchema = require('./credit');
const { FeedbackSchema } = require('./feedback');
const ListingSchema = require('./listing');
const PaymentSourceSchema = require('./paymentSource');
const UserSchema = require('./user');

const schema = mergeSchemas({
  schemas: [
    BookingSchema,
    ConferenceSchema,
    CreditSchema,
    FeedbackSchema,
    ListingSchema,
    PaymentSourceSchema,
    UserSchema
  ],
});

module.exports = schema;
