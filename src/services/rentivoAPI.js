const _ = require('lodash');
const axios = require('axios');
const dashify = require('dashify');
const format = require('date-fns/format'); 
const addDays = require('date-fns/add_days')
 
const { LYCAN_API_ENDPOINT, RENTIVO_CHANNEL_ID, RENTIVO_RESOURCE_KEY } = require('../../config/rentivo');
const { getCanonicalProviderId } = require('../util/idUtils');
const errors = require('../util/errors');
const { Listing, User, RentivoListing } = require('../models/sequelize');
const { iso2ToCountryName } = require('../util/countyCodeUtils');
const { createRentivoHostFallback, createRentivoListingFallback } = require('../util/rentivoFallback');

const RENTIVO_DATE_FORMAT = 'YYYY-MM-DD';
const DEFAULT_SUPPORT_EMAIL = 'support@beenest.com';
const rentivoHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'Authorization': `ResourceKey ${RENTIVO_RESOURCE_KEY}`,
};

const rentivoListingArrangementDisplay = {
  ENTIRE_LISTING: 'Entire Listing',
  ROOM_OWN_FACILITIES: 'Private room and facilities',
  ROOM_SHARED_FACILITIES: 'Private room and shared facilities',
};

const rentivoListingDescriptionDisplay = {
  BOOKING_TERMS: 'Booking Terms',
  HOUSE_RULES: 'House Rules',
  GROUP_BOOKINGS: 'Group Bookings',
  OTHER: 'Other',
  CANCELLATION_TERMS: 'Cancellation Terms',
  RATE_INCLUDES: 'Rate Includes',
  RATE_EXCLUDES: 'Rate Excludes',
};

const rentivoAPI = {
  getRentivoListingsAndChannel: ({ page, count }) => {
    const rentivoListingEndpoint = `${LYCAN_API_ENDPOINT}/api/channels/${RENTIVO_CHANNEL_ID}/listings?page=${page}&count=${count}&expand=schemaObject,channel`;
    return axios.get(rentivoListingEndpoint, { headers: rentivoHeaders });
  },
  getRentivoListingAndChannelById: (listingId) => {
    const rentivoListingEndpoint = `${LYCAN_API_ENDPOINT}/api/channels/${RENTIVO_CHANNEL_ID}/listings/${getCanonicalProviderId(listingId)}?expand=schemaObject,channel`;
    return axios.get(rentivoListingEndpoint, { headers: rentivoHeaders });
  },
  getRentivoRealtimePricingAvailability: ({ currency = 'USD', checkInDate, checkOutDate, listingId, numberOfGuests }) => {
    const formattedCheckInDate = checkInDate ? format(checkInDate, RENTIVO_DATE_FORMAT) : format(addDays(new Date(), 1), RENTIVO_DATE_FORMAT);
    const formattedCheckOutDate = checkOutDate ? format(checkOutDate, RENTIVO_DATE_FORMAT) : format(addDays(new Date(), 2), RENTIVO_DATE_FORMAT);
    const guests = numberOfGuests || 2;
    const rentivoListingEndpoint = `${LYCAN_API_ENDPOINT}/api/public/listing/${listingId}/pricing?arrival=${formattedCheckInDate}&currency=${currency}&departure=${formattedCheckOutDate}&guests=${guests}`
    return axios.get(rentivoListingEndpoint, { headers: rentivoHeaders });
  },
  getRentivoChannelMemberMappings: () => {
    const rentivoUserEndpoint = `${LYCAN_API_ENDPOINT}/api/channels/${RENTIVO_CHANNEL_ID}?expand=memberMappings`;
    return axios.get(rentivoUserEndpoint, { headers: rentivoHeaders });
  },



  // custom implementation
  getRentivoListingAndChannel: (listingId) => {
    return rentivoAPI.getRentivoListingAndChannelById(listingId);
  },
  convertRentivoListingJsonToDetailedListingObject: (rentivoJson) => {
    const { data } = rentivoJson;
    const description = rentivoAPI.getRentivoListingDescription(data.schemaObject.texts);
    const policies = rentivoAPI.getRentivoListingPolicies(data.schemaObject.policies);
    const photos = data.schemaObject.media.filter(media => media.category === 'PHOTO');
    return {
      autoApprove: false,
      amenities: rentivoAPI.getRentivoListingAmenities(data.schemaObject._debug.unmapped.features, data.schemaObject.features),
      checkInTime: {
        from: data.schemaObject.arrival && data.schemaObject.arrival.checkInStartTime || '3:00 p.m.',
        to: data.schemaObject.arrival && data.schemaObject.arrival.checkInEndTime || '10:00 p.m.',
      },
      checkOutTime: data.schemaObject.departure && data.schemaObject.departure.checkOutTime || '11:00 a.m.',
      city: data.schemaObject.address.city,
      country: iso2ToCountryName(data.schemaObject.address.countryISO2),
      description: rentivoAPI.getRentivoListingDescriptionAndPolicies(description, policies),
      pricePerNightUsd: 0,
      homeType: rentivoAPI.getRentivoListingArrangementDisplay(data.schemaObject.listing.arrangement),
      id: `rentivo_${data.id}`,
      idSlug: dashify(data.channel.defaultSettings.brandCompanyName),
      houseRules: policies,
      hostId: `rentivo_${data.channel.defaultSettings.id}`,
      hostNameSlug: dashify(data.channel.defaultSettings.brandCompanyName),
      lat: data.schemaObject.location.latitude,
      lng: data.schemaObject.location.longitude,
      maxGuests: data.schemaObject.listing.maxOccupancy,
      maxNumberOfGuests: data.schemaObject.listing.maxOccupancy,
      minNumberOfNights: 1,
      minimumNights: 1,
      numberOfBathrooms: data.schemaObject.listing.bathrooms,
      numberOfBedrooms: data.schemaObject.listing.bedrooms,
      sharedBathroom: 'no',
      sleepingArrangement: '',
      state: data.schemaObject.address.stateProvince,
      title: data.descriptiveName,
      listingPicUrl: rentivoAPI.getRentivoListingCoverPhoto(photos),
      photos: rentivoAPI.getRentivoListingCarouselPhotos(photos),
    }
  },
  createListingFromRentivo: (listing) => {
    return Listing.build(listing);
  },
  buildRentivoListing: async (listingId) => {
    try {
      const rentivoListingAndChannel = await rentivoAPI.getRentivoListingAndChannel(listingId);
      const convertedRentivoListing = rentivoAPI.convertRentivoListingJsonToDetailedListingObject(rentivoListingAndChannel);
      const updatedPricingAndAvailabilityObject = await rentivoAPI.getRentivoUpdatedPricing({ listingId: getCanonicalProviderId(listingId) });
      const updatedPricingAndAvailability = rentivoAPI.getRentivoListingPriceUsdAndAvailability(updatedPricingAndAvailabilityObject);
      const convertedRentivoListingWithPricing = {
        ...convertedRentivoListing,
        ...updatedPricingAndAvailability,
      };
      const createdListing = rentivoAPI.createListingFromRentivo(convertedRentivoListingWithPricing);
      return createdListing;
    } catch (e) {
      console.error(e);
      return Listing.build(createRentivoListingFallback());
    }
  },


  getRentivoMemberMappings: () => {
    return rentivoAPI.getRentivoChannelMemberMappings();
  },
  getRentivoMemberMapping: (memberMappingsResponse) => {
    const { defaultSettings, memberMappings } = memberMappingsResponse.data;
    return (memberMappings || []).length > 0 ? memberMappings.map(memberMapping => memberMapping.settings) : [...defaultSettings];
  },
  convertRentivoMemberMappingsJsonToUser: (memberMapping) => ({
    about: memberMapping.biography,
    id: `rentivo_${memberMapping.id}`,
    firstName: memberMapping.brandCompanyName,
    lastName: ' ', // what to do about last name?
    profilePicUrl: memberMapping.logo.publicUrl,
    // email: (process.env.APP_ENV === 'production' && memberMapping.emails.length > 0) ? memberMapping.emails[0] : DEFAULT_SUPPORT_EMAIL,
    email: DEFAULT_SUPPORT_EMAIL, // using this because we have not implemented rentivo bookings yet so we will reject on our end
    completedVerification: true,
  }),
  createUserfromMemberMapping: (user) => {
    return User.build(user);
  },
  buildUserFromMemberMapping: async (memberMappingId) => {
    try {
      const memberMappingsResponse = await rentivoAPI.getRentivoMemberMappings();
      const memberMappings = rentivoAPI.getRentivoMemberMapping(memberMappingsResponse);
      const memberMapping = memberMappings.find(member => member.id === getCanonicalProviderId(memberMappingId));
      const convertedRentivoUser = rentivoAPI.convertRentivoMemberMappingsJsonToUser(memberMapping);
      const createdUser = rentivoAPI.createUserfromMemberMapping(convertedRentivoUser);

      return createdUser;
    } catch (e) {
      console.error(e);
      return User.build(createRentivoHostFallback());
    }
  },


  convertRentivoListingJsonToShortListingObject: (rentivoJson) => {
    const { schemaObject } = rentivoJson;
    const photos = schemaObject.media.filter(media => media.category === 'PHOTO');
    return {
      city: schemaObject.address.city,
      country: iso2ToCountryName(schemaObject.address.countryISO2),
      pricePerNightUsd: 0,
      id: `rentivo_${rentivoJson.id}`,
      idSlug: dashify(rentivoJson.channel.defaultSettings.brandCompanyName),
      hostId: `rentivo_${rentivoJson.channel.defaultSettings.id}`,
      hostNameSlug: dashify(rentivoJson.channel.defaultSettings.brandCompanyName),
      lat: schemaObject.location.latitude,
      lng: schemaObject.location.longitude,
      maxGuests: schemaObject.listing.maxOccupancy,
      maxNumberOfGuests: schemaObject.listing.maxOccupancy,
      minNumberOfNights: 1,
      minimumNights: 1,
      numberOfBathrooms: schemaObject.listing.bathrooms,
      numberOfBedrooms: schemaObject.listing.bedrooms,
      state: schemaObject.address.stateProvince,
      country: iso2ToCountryName(schemaObject.address.countryISO2),
      title: rentivoJson.descriptiveName,
      listingPicUrl: rentivoAPI.getRentivoListingCoverPhoto(photos),
      isActive: true,
    }
  },
  saveRentivoListingsAndChannelData: async (count, pages) => {
    const listing = await rentivoAPI.getRentivoListingsAndChannel({ page: 1, count: 1 });
    const { total } = listing.data;

    const pickedPages = pages || Math.ceil(total / count);
    
    for (let page = 1; page <= pickedPages; page++) {
      let listingsAndPricing = [];
      const listingsResponse = await rentivoAPI.getRentivoListingsAndChannel({ page, count });
      const listings = listingsResponse.data._embedded['channels:listings'];
      const convertedlistings = listings.map(listing => rentivoAPI.convertRentivoListingJsonToShortListingObject(listing));

      const listingIds = rentivoAPI.getRentivoListingIdsFromListings(listings);
      const pricingAndAvailability = await rentivoAPI.getRentivoPricingsAndAvailability(listingIds);
      listingsAndPricing.push(rentivoAPI.mergeRentivoListingsAndPrices(convertedlistings, pricingAndAvailability));
      const mergedListingsAndPricing = _.flatten(listingsAndPricing);
      console.log('mergedListingsAndPricing',mergedListingsAndPricing);
      console.log(`Saving page ${page} out of ${pickedPages}.`);
      await RentivoListing.bulkCreate(mergedListingsAndPricing);
      console.log(`Saved page ${page} out of ${pickedPages}.`);
    }
  },
  getRentivoPricingsAndAvailability: async (listingIds) => {
    if (!listingIds || (Array.isArray(listingIds) && listingIds.length < 1)) {
      const error = new Error('No listing ID array provided');
      error.code = errors.INVALID_INPUT;
      throw error;
    }
    const pricingAndAvailability = await Promise.all(listingIds.map(async (id, index) => {
      console.log(`Pricing of ${index + 1} out of ${listingIds.length} done.`);
      return {
        id,
        ...await rentivoAPI.getRentivoRealtimePricingAvailability({ listingId: id })
      }
    }));
    return pricingAndAvailability.map(pricingAndAvailability => rentivoAPI.getRentivoListingPriceUsdAndAvailability(pricingAndAvailability));
  },
  getRentivoListingIdsFromListings: (listings) => {
    return (listings || []).map(listing => listing.id);
  },
  mergeRentivoListingsAndPrices: (listings, pricesAndAvailability) => {
    if (!listings || (Array.isArray(listings) && listings.length < 1)) {
      const error = new Error('No listings array provided');
      error.code = errors.INVALID_INPUT;
      throw error;
    }

    if (!pricesAndAvailability || (Array.isArray(pricesAndAvailability) && pricesAndAvailability.length < 1)) {
      const error = new Error('No pricing array provided');
      error.code = errors.INVALID_INPUT;
      throw error;
    }

    const pricesCollection = rentivoAPI.convertArrayToObjectById(pricesAndAvailability);
    return listings.map(listing => {
      const { id, ...pricing } = pricesCollection[getCanonicalProviderId(listing.id)];
      return {
        ...listing,
        ...pricing,
      }
    });
  },
  getRentivoUpdatedPricing: async ({ currency, checkInDate, checkOutDate, listingId, numberOfGuests }) => {
    // TODO
    // implement pricing by date and guests
    if (!listingId) {
      const error = new Error('No listingId found.');
      error.code = errors.INVALID_INPUT;
      throw error;
    }
    
    return rentivoAPI.getRentivoRealtimePricingAvailability({ listingId });
  },
  getRentivoListingPriceUsdAndAvailability: (pricingObject) => {
    const minStay = rentivoAPI.getRentivoListingMinimumNights(_.get(pricingObject, 'data.origin.rates'));
    return {
      ...(pricingObject.id && { id: pricingObject.id }),
      pricePerNightUsd: pricingObject.data.total / pricingObject.data.stayBreakdown.noNights,
      isActive: pricingObject.data.isAvailable,
      minNumberOfNights: minStay,
      minimumNights: minStay,
    };
  },
  getRentivoListingAmenities: (unmappedAmenities, mappedAmenities) => {
    const flatMappedAmenities = mappedAmenities.map(amenity => amenity['+mappedFrom'].name);
    const mergedAmenities = [
      ...flatMappedAmenities,
      ...unmappedAmenities,
    ];

    return [...new Set(mergedAmenities)];
  },
  getRentivoListingArrangementDisplay : (arrangementEnum) => {
    return rentivoListingArrangementDisplay[arrangementEnum] || rentivoListingArrangementDisplay.ENTIRE_LISTING;
  },
  getRentivoListingCarouselPhotos: (media) => {
    const photos = media.map(singleMedia => singleMedia.uri);
    return photos.length > 1 ? photos.slice(1, photos.length - 1) : [];
  },
  getRentivoListingCoverPhoto: (media) => {
    return media[0].uri;
  },
  rentivoListingDescriptionDisplay: (descriptionEnum) => {
    return rentivoListingDescriptionDisplay[descriptionEnum] || rentivoListingDescriptionDisplay.OTHER;
  },
  getRentivoListingDescription: (texts) => {
    const descriptionsArray = texts.map(text => `<p>${text.description.en.content}</p>`);
    return descriptionsArray.join('<br />');
  },
  getRentivoListingPolicies: (policies) => {
    const policiesArray = policies
      .map(policy => `<h2>${rentivoAPI.rentivoListingDescriptionDisplay(policy.type)}</h2><br /><p>${policy.description.en.content}<p></p>`);
    return policiesArray.join('<br />');
  },
  getRentivoListingDescriptionAndPolicies: (texts, policies) => {
    return `${texts} <br /> ${policies}`.replace(/(?:\r\n|\r|\n)/g, '<br />');
  },
  getRentivoListingMinimumNights: (rates) => {
    if (rates.length < 1) {
      return 1;
    }
    // rentivo has a rates array of objects that contain minimum nights, if not we take 1 as minimum night
    const minStay = rates.map(rate => parseInt(rate.minStay))
      .reduce((a, b) => Math.min(a, b));
    return minStay;
  },
  convertArrayToObjectById: array => array.reduce((obj, item) => ({ ...obj, [item.id]: item }), {}),
  hasPrice: (listing) => {
    return listing && listing.pricePerNightUsd > 0;
  }
}

module.exports = rentivoAPI;