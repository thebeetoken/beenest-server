const haversine = require('haversine');
const { formatAddress } = require('../../util/formatter');

module.exports = (sequelize, DataTypes) => {
  const AgodaListing = sequelize.define(
    'agoda_listing',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true
      },
      hotelId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'hotel_id'
      },
      chainId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'chain_id'
      },
      chainName: {
        type: DataTypes.STRING,
        field: 'chain_name'
      },
      brandId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'brand_id'
      },
      brandName: {
        type: DataTypes.STRING,
        field: 'brand_name'
      },
      hotelName: {
        type: DataTypes.STRING,
        field: 'hotel_name'
      },
      addressline1: {
        type: DataTypes.STRING
      },
      addressline2: {
        type: DataTypes.STRING
      },
      zipcode: {
        type: DataTypes.STRING
      },
      city: {
        type: DataTypes.STRING
      },
      state: {
        type: DataTypes.STRING
      },
      country: {
        type: DataTypes.STRING
      },
      latitude: {
        type: DataTypes.FLOAT
      },
      longitude: {
        type: DataTypes.FLOAT
      },
      url: {
        type: DataTypes.STRING
      },
      checkin: {
        type: DataTypes.STRING
      },
      checkout: {
        type: DataTypes.STRING
      },
      numberrooms: {
        type: DataTypes.INTEGER.UNSIGNED
      },
      numberfloors: {
        type: DataTypes.INTEGER.UNSIGNED
      },
      yearopened: {
        type: DataTypes.INTEGER.UNSIGNED
      },
      yearrenovated: {
        type: DataTypes.INTEGER.UNSIGNED
      },
      photo1: {
        type: DataTypes.STRING
      },
      photo2: {
        type: DataTypes.STRING
      },
      photo3: {
        type: DataTypes.STRING
      },
      photo4: {
        type: DataTypes.STRING
      },
      photo5: {
        type: DataTypes.STRING
      },
      overview: {
        type: DataTypes.TEXT
      },
      ratesFrom: {
        type: DataTypes.FLOAT,
        field: 'rates_from'
      },
      continentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'continent_id'
      },
      continentName: {
        type: DataTypes.STRING,
        field: 'continent_name'
      },
      cityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'city_id'
      },
      countryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'country_id'
      },
      numberOfReviews: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'number_of_reviews'
      },
      ratingAverage: {
        type: DataTypes.FLOAT,
        field: 'rating_average'
      },
      ratesCurrency: {
        type: DataTypes.STRING,
        field: 'rates_currency'
      }
    },
    {
      tableName: 'agoda_listings',
      freezeTableName: true,
      timestamps: false
    }
  );

  AgodaListing.prototype.distanceFrom = function ({ lat, lng }) {
    return haversine(
      { latitude: this.lat, longitude: this.lng },
      { latitude: lat, longitude: lng }
    );
  }

  AgodaListing.prototype.toListing = function (host, pricing) {
    return {
      id: `agoda_${this.id}`,
      idSlug: `agoda_${this.id}`,
      hostId: host.id,
      bookingUrl: pricing[this.id] ? pricing[this.id].landingURL : undefined,
      checkInTime: {
        from: this.checkin,
        to: this.checkin
      },
      checkOutTime: this.checkout,
      country: this.country,
      city: this.city,
      state: this.state,
      title: this.hotelName,
      description: this.overview,
      homeType: 'Hotel Room',
      isActive: !!pricing[this.id],
      pricePerNightUsd: pricing[this.id] ? pricing[this.id].dailyRate : this.ratesFrom,
      securityDepositUsd: 0,
      listingPicUrl: this.photo1.replace('?s=312x', ''),
      addressLine1: this.addressline1,
      addressLine2: this.addressline2,
      postalCode: this.zipcode,
      numberOfBedrooms: 1,
      numberOfBathrooms: 1,
      rating: {
        average: pricing[this.id] ? pricing[this.id].reviewScore : this.ratingAverage,
        count: pricing[this.id] ? pricing[this.id].reviewCount : this.numberOfReviews
      },
      sleepingArrangement: '1+ Beds',
      sharedBathroom: 'No',
      minimumNights: 1,
      maxGuests: 6,
      photos: [ this.photo2, this.photo3, this.photo4, this.photo5 ]
        .filter(photo => !!photo)
        .map(photo => photo.replace('?s=312x', '')),
      amenities: [],
      houseRules: '',
      lat: this.latitude,
      lng: this.longitude,
      fullAddress: formatAddress(
        this.addressline1,
        this.addressline2,
        this.city,
        this.state,
        this.country,
        this.postalCode
      )
    };
  };

  return AgodaListing;
};
