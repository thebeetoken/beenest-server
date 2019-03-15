const { BeenestListingProvider } = require('../../services/listing/beenestListingProvider');
const { ListingService } = require('../listing');
const testUtils = require('../../lib/testUtils');
const { Listing, User } = require('../../models/sequelize');


describe("Beenest Listing Provider", () => {
  let listingParams;
  let userOne;

  beforeAll(() => {
    return testUtils.initializeDatabase()
      .then(() => User.build(testUtils.createTestUserOpts()).save())
      .then((savedUserOne) => {
        userOne = savedUserOne;
        listingParams = testUtils.createConsistentListingParams(userOne.email);
        return testUtils.createCurrencyRateModels();
      });
  });

  afterEach(() => (
    Listing.destroy({ where: {} })
      .then(() => User.findAll())
      .then(users => (
        Promise.all(users.map(user => user.updateListingCount(0)))
      ))
  ));

  afterAll(() => (
    testUtils.clearDatabase()
  ));



  test("able to search for listings within radius", async () => {
    const sanFranciscoListing = {
      ...listingParams
    };
    const dalyCityListing = {
      ...sanFranciscoListing,
      city: 'Daly City',
      lat: 37.687923,
      lng: -122.470207,
    };
    const losAngelesListing = {
      ...sanFranciscoListing,
      city: 'Los Angeles',
      lat: 34.052235, 
      lng: -118.243683
    };
    await Promise.all([ 
      ListingService.createListing(sanFranciscoListing, userOne).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(dalyCityListing, userOne).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(losAngelesListing, userOne).then(listing => ListingService.activateListing(listing.id)),
    ]);
    const DALY_CITY = {
      lat: 37.687923,
      lng: -122.470207,
    };
    const VENICE_BEACH = {
      lat: 33.9764002,
      lng: -118.4667452
    };
    const foundDalyCityListings = await BeenestListingProvider.searchListings({
      coordinates: {
        ...DALY_CITY,
        measurement: 'KM',
        radius: 5
      }
    });
    const foundVeniceBeachListings = await BeenestListingProvider.searchListings({
      coordinates: {
        ...VENICE_BEACH,
        measurement: 'MI',
        radius: 40
      }
    });
    expect(foundDalyCityListings.length).toBe(1);
    expect(foundVeniceBeachListings.length).toBe(1);
  });



  test("able to search without coordinates", async () => {
    const sanFranciscoListing = {
      ...listingParams
    };
    const newYorkListing = {
      ...sanFranciscoListing,
      city: 'New York',
      lat: 40.730610,
      lng: -73.935242,
    };
    const hawaiiListing = {
      ...sanFranciscoListing,
      city: 'Honolulu',
      lat: 21.289373, 
      lng: -157.917480
    };
    await Promise.all([ 
      ListingService.createListing(newYorkListing, userOne).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(hawaiiListing, userOne).then(listing => ListingService.activateListing(listing.id)),
    ]);
    const [foundNewYorkListings, foundHawaiiListings] = await Promise.all([
      BeenestListingProvider.searchListings({ locationQuery: 'brooklyn' }),
      BeenestListingProvider.searchListings({ locationQuery: 'hawaii' }),
    ]);
    expect(foundNewYorkListings.length).toBe(1);
    expect(foundHawaiiListings.length).toBe(1);
  });



  test("sorts search results by distance", async () => {
    const DALY_CITY = {
      lat: 37.687923,
      lng: -122.470207,
    };
    const SAN_FRANCISCO = {
      lat: 37.7749,
      lng: -122.4194,
    };
    const sanFranciscoListing = {
      ...listingParams,
      ...SAN_FRANCISCO
    };
    const dalyCityListing = {
      ...sanFranciscoListing,
      city: 'Daly City',
      ...DALY_CITY
    };
    const [ createdSanFranciscoListing, createdDalyCityListing ] = await Promise.all([
      ListingService.createListing(sanFranciscoListing, userOne).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(dalyCityListing, userOne).then(listing => ListingService.activateListing(listing.id)),
    ]);
    const foundDalyCityListings = await BeenestListingProvider.searchListings({
      coordinates: DALY_CITY
    });
    const foundSanFranciscoListings = await BeenestListingProvider.searchListings({
      coordinates: SAN_FRANCISCO
    });

    expect(foundDalyCityListings[0].id).toEqual(createdDalyCityListing.id);
    expect(foundDalyCityListings[1].id).toEqual(createdSanFranciscoListing.id);
    expect(foundSanFranciscoListings[0].id).toEqual(createdSanFranciscoListing.id);
    expect(foundSanFranciscoListings[1].id).toEqual(createdDalyCityListing.id);
  });



  test("getListingById should return the correct listing", async () => {
    const sanFranciscoListing = {
      ...listingParams,
      lat: 37.7749,
      lng: -122.4194,
    };

    const createdSanFranciscoListing = await ListingService.createListing(sanFranciscoListing, userOne).then(listing => ListingService.activateListing(listing.id));
    const foundSanFranciscoListing = await BeenestListingProvider.getListingById(createdSanFranciscoListing.id);

    expect(foundSanFranciscoListing.id).toEqual(createdSanFranciscoListing.id);
  });
});
