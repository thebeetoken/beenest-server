const haversine = require('haversine');
const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
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
    }
  };

  const RentivoListing = sequelize.define(
    'rentivo_listing',
    {
      id: {
        type: DataTypes.STRING(255),
        primaryKey: true,
      },
      hostNameSlug: {
        type: DataTypes.STRING(50),
        field: 'host_name_slug'
      },
      idSlug: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return `${this.id}_${this.hostNameSlug}`;
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
          len: [5, 50]
        }
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      },
      currency: {
        type: DataTypes.STRING(3)
      },
      pricePerNight: {
        type: DataTypes.DOUBLE,
        field: 'price_per_night'
      },
      pricePerNightUsd: {
        type: DataTypes.DOUBLE,
        field: 'price_per_night_usd'
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
      city: { type: DataTypes.STRING(60) },
      state: { type: DataTypes.STRING(60) },
      country: { type: DataTypes.STRING(60) },
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
      tableName: 'rentivo_listings',
      timestamps: false,
      freezeTableName: true
    }
  );

  RentivoListing.prototype.distanceFrom = function ({ lat, lng }) {
    return haversine(
      { latitude: this.lat, longitude: this.lng },
      { latitude: lat, longitude: lng }
    );
  }

  RentivoListing.prototype.toJSON = function() {
    const values = dbUtils.jsonFormat(this.get());
    values.maxGuests = values.maxNumberOfGuests || values.maxGuests;
    values.minimumNights = values.minNumberOfNights || values.minimumNights;
    values.country = values.country && values.country.toUpperCase();
    
    return values;
  };

  return RentivoListing;
};
