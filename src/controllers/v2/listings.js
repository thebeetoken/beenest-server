const listings = require('express').Router();
const routes = require('express').Router();
const format = require('date-fns/format');
const firebase = require('../../services/firebase');
const calendar = require('../../services/calendar');
const ical = require('../../util/ical');
const { ReservationService } = require('../../services/reservation')
const {
  Listing,
  Booking,
  User,
  Calendar,
  CurrencyRate,
  Sequelize
} = require('../../models/sequelize');
const { Op } = Sequelize;
const { ListingService } = require('../../services/listing');

const PRICE_UPDATE_SECRET = process.env.PRICE_UPDATE_SECRET || 'dev-price-update-secret';
const ICAL_UPDATE_SECRET = process.env.ICAL_UPDATE_SECRET || 'dev-listing-calendar-update-secret';

function parseListingRequest(req) {
  const { id } = req.params;
  const listingId = parseInt(id, 10);

  if (!listingId || isNaN(listingId)) {
    throw new Error('Invalid id');
  }

  const startDate = new Date(req.query.startDate);
  const endDate = new Date(req.query.endDate);

  if (isNaN(startDate.valueOf()) || isNaN(endDate.valueOf())) {
    throw new Error('Invalid startDate and endDate query parameters; ISO 8601 dates expected.');
  }

  if (endDate < startDate) {
    throw new Error('Invalid parameters; startDate must come before endDate.');
  }

  return { listingId, startDate, endDate };
}

routes.get("/", function (req, res, next) {
  ListingService.getAllActiveListings().then(listings => {
    return res.json({listings});
  }).catch(next);
});

routes.get('/:id/reservations', (req, res, next) => {
  try {
    const { listingId, startDate, endDate } = parseListingRequest(req);
    return ReservationService.getReservations(listingId, startDate, endDate)
      .then(reservations => res.json({ reservations }));
  } catch (err) {
    err.statusCode = 400;
    return next(err);
  }
});

/**
 * A listing's booked dates
 *
 **/
routes.get('/:id.ics', function(req, res, next) {
  const { id } = req.params;
  const listingId = parseInt(id, 10);

  if (!listingId || isNaN(listingId)) {
    const err = new Error(`Invalid id: ${listingId}`);
    err.statusCode = 400;
    return next(err);
  }

  res.set({
    'x-timestamp': Date.now(),
    'x-sent': true,
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="listing-${listingId}.ics"`
  });

  Booking.findAll({
    where: {
      listingId,
      status: {
        [Op.notIn]: [
          'expired_before_guest_confirmed',
          'guest_cancelled',
          'guest_rejected_payment',
          'host_rejected',
          'host_approved',
          'host_cancelled',
          'expired_before_host_approved',
          'completed'
        ]
      }
    }
  })
    .then(bookings => {
      return (bookings || []).map(book => [
        format(new Date(book.checkInDate), 'YYYYMMDD'),
        format(new Date(book.checkOutDate), 'YYYYMMDD')
      ]);
    })
    .then(bookedDates => {
      const ics = ical.createContent(bookedDates, listingId);
      res.status(200).send(ics);
    })
    .catch(next);
});

routes.get('/:id', function(req, res, next) {
  const { id } = req.params;
  const listingId = parseInt(id, 10);

  if (!listingId || isNaN(listingId)) {
    const err = new Error(`Invalid id: ${listingId}`);
    err.statusCode = 400;
    return next(err);
  }

  return ListingService.getListingById(listingId).then(listing => {
      return res.json({listing});
  });
});

routes.post('/updateReservations', function(req, res, next) {
  if (!req.body.secret || req.body.secret != ICAL_UPDATE_SECRET) {
    return next(new Error('Invalid request to update.'));
  }
  return calendar.updateReservations().then(
    reservations => res.status(200).json({ msg: 'Updated reservations', reservations })
  ).catch(next);
});

/**
 * Create a new listing
 *
 **/
routes.post('/', firebase.ensureAuthenticated, function(req, res, next) {
  if (!res.locals.isAdmin) {
    return res.status(401).json({
      msg: 'not allowed'
    });
  }

  if (!res.locals || !res.locals.user || !res.locals.user.email) {
    const err = new Error('Unable to get user.');
    err.status = 401;
    return next(err);
  }

  const { listing } = req.body;
  if (!listing) {
    const err = new Error('Missing input');
    err.status = 400;
    return next(err);
  }

  let required = [
    'title',
    'description',
    'pricePerNight',
    'securityDeposit',
    'listingPicUrl',
    'addressLine1',
    'city',
    'state',
    'country',
    'postalCode',
    'accomodations',
    'amenities',
    'photos',
    'houseRules'
  ];
  required.forEach( field => {
    if (!listing[field]) {
      const err = new Error(`missing param ${field}`);
      err.status = 400;
      return next(err);
    }
  });

  const hostEmail = listing.hostEmail || res.locals.user.email;
  const photos = listing.photos;
  const accomodations = listing.accomodations;
  const amenities = listing.amenities;

  // HARD CODED PARAMS -- TODO: change when currency is customizable on form
  const currency = 'USD';

  // TODO: validate body paramters
  const listingData = {
    title: listing.title,
    description: listing.description,
    currency,
    pricePerNight: listing.pricePerNight,
    pricePerNightUsd: listing.pricePerNight,
    securityDeposit: listing.securityDeposit,
    securityDepositUsd: listing.securityDeposit,
    listingPicUrl: listing.listingPicUrl,
    addressLine1: listing.addressLine1,
    addressLine2: listing.addressLine2,
    city: listing.city,
    state: listing.state,
    country: listing.country,
    postalCode: listing.postalCode,
    lat: listing.lat,
    lng: listing.lng,
    amenities,
    photos,
    accomodations,
    houseRules: listing.houseRules,
    hostEmail: listing.hostEmail || res.locals.user.email
  };

  ListingService.createListing(listingData, res.locals.user)
    .then(listing => res.status(201).json({ listing: listing.toJSON(), error: null }))
    .catch(next);
});

// make authenticated routes visible
listings.use('/', routes);

module.exports = listings;
