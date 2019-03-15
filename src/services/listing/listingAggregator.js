const idUtils = require('../../util/idUtils');
const { Timeout } = require('../../util/timeout');

const DEFAULT_LISTING_PROVIDER = 'defaultListingProvider';


class ListingAggregator {
  constructor(listingProviders, defaultListingProvider) {
    this.listingProviders = listingProviders;
    this.defaultListingProvider = defaultListingProvider;
  }

  //TODO: write test
  async searchListings(query) {
    const mergedProviders = {
      [DEFAULT_LISTING_PROVIDER]: this.defaultListingProvider,
      ...this.listingProviders,
    }

    const listings = await Promise.all(Object.keys(mergedProviders)
      .map(provider => provider === DEFAULT_LISTING_PROVIDER
        ? mergedProviders[provider].searchListings(query)
        : Promise.race([mergedProviders[provider].searchListings(query), Timeout([])])));

    return [].concat.apply([], listings);
  }


  async findActiveListing(listingId, options) {
    const namespace = idUtils.getNamespaceFromId(listingId);
    const provider = this.listingProviders.hasOwnProperty(namespace) ? this.listingProviders[namespace] : this.defaultListingProvider;

    return provider.findActiveListing(listingId, options);
  }
  

  //TODO: write test
  getListingById(listingId, options) {
    const namespace = idUtils.getNamespaceFromId(listingId);
    const provider = this.listingProviders.hasOwnProperty(namespace) ? this.listingProviders[namespace] : this.defaultListingProvider;
    
    return provider.getListingById(listingId, options);
  }
}

module.exports = ListingAggregator;