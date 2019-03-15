const errors = require('./errors');
const NAMESPACE_SEPARATOR = '_';

const idUtils = {
  getCanonicalProviderId: (listingId) => {
    const splitListingIdArray = listingId.split(NAMESPACE_SEPARATOR);
    if (!splitListingIdArray > 1 || !splitListingIdArray[1]) {
      const error = new Error('ListingId is not of external provider');
      error.code = errors.INVALID_INPUT;
      throw error;
    }

    return splitListingIdArray[1];
  },
  getNamespaceFromId: (listingId) => {
    if (!listingId) {
      const error = new Error('No listingId provided.');
      error.code = errors.INVALID_INPUT;
      throw error;
    }
    return typeof listingId === 'string' && listingId.split(NAMESPACE_SEPARATOR)[0];
  }
}

module.exports = idUtils;