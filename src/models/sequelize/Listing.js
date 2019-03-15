const _ = require('lodash');
const haversine = require('haversine');
const format = require('date-fns/format');
const isDate = require('date-fns/is_date');
const parse = require('date-fns/parse');
const dbUtils = require('./dbUtils');
const { formatAddress, formatGeolocationAddress } = require('../../util/formatter');

const PUBLISH_PROPERTIES = [
  'checkInTime',
  'checkOutTime',
  'country',
  'title',
  'description',
  'pricePerNightUsd',
  'listingPicUrl',
  'addressLine1',
  'postalCode',
  'sleepingArrangement',
  'sharedBathroom',
  'minimumNights',
  'maxGuests',
  'photos',
  'amenities',
  'houseRules'
];

module.exports = (sequelize, DataTypes) => {
  const { Op } = sequelize;
  const Booking = sequelize.import('booking', require('../sequelize/Booking'));

  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      airbnbLink: {
        type: 'string',
      },
      amenities: {
        type: 'array',
        items: [{ type: 'string' }],
      },
      adminNotes: {
        type: 'string',
      },
      autoApprove: {
        type: 'boolean'
      },
      bookingUrl: {
        type: 'string'
      },
      checkInTime: {
        type: 'object',
        properties: {
          from: {
            type: 'string',
          },
          to: {
            type: 'string',
          }
        }
      },
      checkOutTime: {
        type: 'string',
      },
      checkOutDate: {
        type: 'string',
        format: 'date'
      },
      homeType: {
        type: 'string',
      },
      houseRules: {
        type: 'string',
      },
      listingPicUrl: {
        type: 'string',
        format: 'url',
      },
      maxNumberOfGuests: {
        type: 'number',
      },
      minNumberOfNights: {
        type: 'number',
      },
      numberOfBathrooms: {
        type: 'number',
      },
      numberOfBedrooms: {
        type: 'number',
      },
      photos: {
        type: 'array',
        items: { type: 'string',
        format: 'url' }
      },
      rating: {
        type: 'object',
        properties: {
          average: {
            type: 'number'
          },
          count: {
            type: 'number'
          }
        }
      },
      sleepingArrangement: {
        type: 'string',
      },
      sharedBathroom: {
        type: 'string',
      },
      checkInDate: {
        type: 'string',
        format: 'date'
      },
      totalQuantity: {
        type: 'number'
      },
      updatedBy: {
        type: 'string',
      },
      wifi: {
        type: 'object',
        properties: {
          mbps: {
            type: 'number',
          },
          photoUrl: {
            type: 'string',
            format: 'url',
          }
        }
      }
    }
  };

  const Listing = sequelize.define(
    'listing',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      hostNameSlug: {
        type: DataTypes.STRING(50),
        field: 'host_name_slug'
      },
      idSlug: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return !!this.hostNameSlug ? `${this.id}_${this.hostNameSlug}` : this.id;
        }
      },
      hostId: {
        type: DataTypes.STRING(50),
        field: 'host_id',
        index: true
      },
      title: {
        type: DataTypes.STRING(50),
        defaultValue: 'Untitled',
        validate: {
          len: {
            args: [5, 50],
            msg: 'Title must be between 5 and 50 characters'
          }
        }
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
      },
      welcomeMessage: {
        type: DataTypes.TEXT,
        field: 'welcome_message'
      },
      description: {
        type: DataTypes.TEXT
      },
      currency: {
        type: DataTypes.STRING(3)
      },
      pricePerNightUsd: {
        type: DataTypes.DOUBLE,
        field: 'price_per_night_usd'
      },
      securityDepositUsd: {
        type: DataTypes.DOUBLE,
        field: 'security_deposit_usd'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_active'
      },
      minimumNights: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        field: 'minimum_nights'
      },
      maxGuests: {
        type: DataTypes.INTEGER(11),
        field: 'max_guests'
      },
      addressLine1: {
        type: DataTypes.STRING,
        field: 'address_line_1'
      },
      addressLine2: {
        type: DataTypes.STRING,
        field: 'address_line_2'
      },
      city: { type: DataTypes.STRING(60) },
      state: { type: DataTypes.STRING(60) },
      country: { type: DataTypes.STRING(60) },
      postalCode: {
        type: DataTypes.STRING(45),
        field: 'postal_code'
      },
      lat: { 
        type: DataTypes.DECIMAL(9, 6),
        validate: {
          min: -90,
          max: 90,
        },
      },
      lng: { 
        type: DataTypes.DECIMAL(9, 6),
        validate: {
          min: -180,
          max: 180,
        },
      },
      fullAddress: {
        type: DataTypes.VIRTUAL,
        get: function () {
          const { addressLine1, addressLine2, city, state, country, postalCode, lat, lng } = this;
          return addressLine1 ?
            formatAddress(addressLine1, addressLine2, city, state, country, postalCode) :
            formatGeolocationAddress({ lat, lng, city, country });
        }
      },
      canPublish: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return PUBLISH_PROPERTIES.every(key => !!this[key]) && this.photos.length > 0;
        }
      },
      meta: {
        type: DataTypes.JSON,
        validate: {
          isValidField(value) {
            dbUtils.validateMetaFields(META_JSON_SCHEMA, value);
          }
        }
      },
      ...(dbUtils.virtualProperties(META_JSON_SCHEMA))
    },
    {
      tableName: 'listings',
      freezeTableName: true
    }
  );

  /**
   * Separates fields into the meta fields
   **/
  Listing.buildWithMetaFields = function(opts) {
    const listing = Listing.build(opts);
    
    const hotelOpts = opts.homeType === 'Hotel Room'
      ? {
          autoApprove: opts.autoApprove,
          checkOutDate: opts.checkOutDate ? format(opts.checkOutDate, 'YYYY-MM-DD') : undefined,
          checkInDate: opts.checkInDate ? format(opts.checkInDate, 'YYYY-MM-DD') : undefined,
          totalQuantity: opts.totalQuantity,
        }
      : {};
    
    const wifi = _.some(opts.wifi)
      ? {
          photoUrl: opts.wifi && opts.wifi.photoUrl ? opts.wifi.photoUrl : undefined,
          mbps: opts.wifi && opts.wifi.mbps ? opts.wifi.mbps : undefined,
        }
      : undefined;
      
    listing.meta = {
      ...hotelOpts,
      airbnbLink: opts.airbnbLink,
      adminNotes: opts.adminNotes,
      amenities: opts.amenities,
      checkInTime: opts.checkInTime,
      checkOutTime: opts.checkOutTime,
      homeType: opts.homeType,
      houseRules: opts.houseRules,
      listingPicUrl: opts.listingPicUrl,
      maxNumberOfGuests: opts.maxGuests,
      minNumberOfNights: opts.minimumNights,
      numberOfBathrooms: opts.numberOfBathrooms,
      numberOfBedrooms: opts.numberOfBedrooms,
      photos: opts.photos,
      sharedBathroom: opts.sharedBathroom,
      sleepingArrangement: opts.sleepingArrangement,
      wifi,
    };

    return listing;
  };

  Listing.prototype.updateWithMetaFields = function(opts) {
    const updatedListing = Object.assign(this, opts, {
      amenities: JSON.stringify(opts.amenities),
      photos: JSON.stringify(opts.photos),
      accomodations: JSON.stringify(opts.accomodations),
    });

    const hotelOpts = opts.homeType === 'Hotel Room'
      ?
        {
          autoApprove: opts.autoApprove,
          checkOutDate: opts.checkOutDate ? format(opts.checkOutDate, 'YYYY-MM-DD') : undefined,
          checkInDate: opts.checkInDate ? format(opts.checkInDate, 'YYYY-MM-DD') : undefined,
          totalQuantity: opts.totalQuantity,
        }
      : {};

    const wifi = _.some(opts.wifi)
      ? {
          photoUrl: opts.wifi && opts.wifi.photoUrl ? opts.wifi.photoUrl : undefined,
          mbps: opts.wifi && opts.wifi.mbps ? opts.wifi.mbps : undefined,
        }
      : undefined;

    updatedListing.meta = {
      ...updatedListing.meta,
      autoApprove: undefined, // removes old 'Hotel Room' opts if they existed previously
      checkOutDate: undefined,
      checkInDate: undefined,
      totalQuantity: undefined,
      ...hotelOpts,
      adminNotes: opts.adminNotes || undefined,
      airbnbLink: opts.airbnbLink || undefined,
      homeType: opts.homeType || undefined,
      maxNumberOfGuests: opts.maxGuests || updatedListing.meta.maxNumberOfGuests,
      minNumberOfNights: opts.minimumNights || updatedListing.meta.minNumberOfNights,
      numberOfBathrooms: opts.numberOfBathrooms || updatedListing.meta.numberOfBathrooms,
      numberOfBedrooms: opts.numberOfBedrooms || updatedListing.meta.numberOfBedrooms,
      sleepingArrangement: opts.sleepingArrangement || updatedListing.meta.sleepingArrangement,
      sharedBathroom: opts.sharedBathroom || updatedListing.meta.sharedBathroom,
      listingPicUrl: opts.listingPicUrl || undefined,
      amenities: opts.amenities || updatedListing.meta.amenities,
      photos: opts.photos || updatedListing.meta.photos,
      houseRules: opts.houseRules || updatedListing.meta.houseRules,
      wifi,
    }

    return updatedListing.save();
  }

  Listing.prototype.distanceFrom = function ({ lat, lng }) {
    return haversine(
      { latitude: this.lat, longitude: this.lng },
      { latitude: lat, longitude: lng }
    );
  }

  Listing.getHostListings = (id) => {
    return Listing.findAll({
      where: { hostId: id },
    });
  }

  Listing.prototype.toJSON = function(opts = {}) {
    const { requestor, booking } = opts;
    const values = dbUtils.jsonFormat(this.get());
    values.maxGuests = values.maxNumberOfGuests || values.maxGuests;
    values.minimumNights = values.minNumberOfNights || values.minimumNights;
    values.amenities = typeof values.amenities === 'string' ? JSON.parse(values.amenities) : values.amenities;
    values.photos = typeof values.photos === 'string' ? JSON.parse(values.photos) : values.photos;
    values.country = values.country && values.country.toUpperCase();

    const showFullAddress = requestor
      && (requestor.isAdmin()
      || requestor.id === this.hostId
      || Booking.isAddressAllowed(requestor, booking));


    if (!showFullAddress) {
      values.lat = _.floor(values.lat, 3);
      values.lng = _.floor(values.lng, 3);
    }

    if (!showFullAddress) {
      values.addressLine1 = null;
      values.addressLine2 = null;
    }
    
    return values;
  };

  return Listing;
};
