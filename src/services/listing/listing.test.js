const testUtils = require('../../lib/testUtils');

const { Listing, User, Reservation, CurrencyRate } = require('../../models/sequelize');
const { ListingService } = require('./listing');
const CalendarService = require('../calendar');
const { ReservationService } = require('../reservation')

describe('Listing Service', () => {
  let admin;
  let userOne;
  let userTwo;
  let userUnverified;
  let listingParams;

  beforeAll(() => {
    return testUtils.initializeDatabase()
      .then(() => (
        Promise.all([
          User.buildWithMetaFields(testUtils.createTrustedFirebaseUserOpts({
            email: 'test@beetoken.com'
          })).save(),
          User.buildWithMetaFields(testUtils.createTrustedFirebaseUserOpts()).save(),
          User.buildWithMetaFields(testUtils.createTrustedFirebaseUserOpts()).save(),
          User.buildWithMetaFields(testUtils.createUntrustedFirebaseUserOpts()).save(),
        ])
      ))
      .then(([savedAdmin, savedUserOne, savedUserTwo, savedUserUnverified]) => {
        admin = savedAdmin;
        userOne = savedUserOne;
        userTwo = savedUserTwo;
        userUnverified = savedUserUnverified;
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

  test('createListing should create a listing given valid params', async () => {
    const listing = {
      ...listingParams
    };
    const savedListing = await ListingService.createListing(listing, userTwo);
    
    expect(savedListing).toBeDefined();
    expect(savedListing.id).toBeGreaterThan(0);
    expect(savedListing.maxGuests).toBe(2);
    expect(savedListing.minimumNights).toBe(3);
    expect(savedListing.meta.maxNumberOfGuests).toBe(2);
  });

  test('duplicateListing should create a new copy of a listing', async () => {
    const listing = {
      ...listingParams
    };
    const createdListing = await ListingService.createListing(listing, userTwo);
    const duplicatedListing = await ListingService.duplicateListing(createdListing.id, userTwo);

    expect(duplicatedListing.id).not.toEqual(createdListing.id);
    expect(duplicatedListing.isActive).toBe(false);
    expect(duplicatedListing.title).toEqual(`Copy of ${createdListing.title}`);
    Object.keys(listing).filter(key => !['id', 'isActive', 'title'].includes(key)).forEach(
      key => expect(duplicatedListing[key]).toEqual(createdListing[key])
    );
  });

  test('duplicateListing should truncate long titles', async () => {
    const listing = {
      ...listingParams,
      title: '12345678901234567890123456789012345678901234567890'
    };
    const createdListing = await ListingService.createListing(listing, userTwo);
    const duplicatedListing = await ListingService.duplicateListing(createdListing.id, userTwo);
    expect(duplicatedListing.title.length).toEqual(50);
  });

  test('updateListing should update a listing given all params', async () => {
    expect.assertions(6);
    
    const listing = {
      ...listingParams,
      icalUrls: ['https://www.google.com'],
    };
    const savedListing = await ListingService.createListing(listing, userTwo);
    const id = savedListing.id;
    const updatedListing = await ListingService.updateListing({
      ...listing,
      title: 'updated title',
      homeType: 'updated',
      sleepingArrangement: 'updated',
      numberOfBathrooms: 99,
      sharedBathroom: 'updated',
      maxGuests: 99,
      minimumNights: 99,
      id
    }, userTwo);

    expect(updatedListing.title).toBe('updated title');
    expect(updatedListing.state).toBe('CA');
    expect(updatedListing.meta.homeType).toBe('updated');
    expect(updatedListing.maxGuests).toBe(99);
    expect(updatedListing.meta.maxNumberOfGuests).toBe(99);
    expect(updatedListing.meta.updatedBy).toBe(userTwo.email);
  });

  test('updateListing should update both hosts listingCount if listing is reassigned', async () => {
    expect.assertions(3);
    
    const listing = {
      ...listingParams,
      icalUrls: ['https://www.google.com'],
    };
    const savedListing = await ListingService.createListing(listing, userOne);

    const transferredListing = await ListingService.updateListing({
      ...listing,
      hostEmail: userTwo.email,
      id: savedListing.id,
    }, admin);

    const [oldHost, newHost] = await Promise.all([
      User.findById(userOne.id),
      User.findById(userTwo.id)
    ]);

    expect(oldHost.listingCount).toBe(0);
    expect(newHost.listingCount).toBe(oldHost.listingCount + 1);
    expect(transferredListing.meta.updatedBy).toBe(admin.email);
  });

  test('updateListing should not allow a user to reassign listing to another user', async () => {
    expect.assertions(4);
    
    const listing = {
      ...listingParams,
      hostEmail: userOne.email,
      icalUrls: ['https://www.google.com'],
    };

    const savedListing = await ListingService.createListing(listing, userOne);
    
    const attemptedTransferListing = await ListingService.updateListing({
      ...listing,
      hostEmail: userTwo.email,
      id: savedListing.id,
    }, userOne);

    const [userWithListing, userWithoutListing] = await Promise.all([
      User.findById(userOne.id),
      User.findById(userTwo.id)
    ]);
    
    expect(userWithListing.listingCount).toBe(1);
    expect(userWithoutListing.listingCount).toBe(0);
    expect(attemptedTransferListing.meta.updatedBy).toBe(userOne.email);
    expect(attemptedTransferListing.hostId).toBe(userOne.id);
  });

  test('updateListing should allow admin to reassign listing to another user by specifying the user email', async () => {
    expect.assertions(3);
    
    const listing = {
      ...listingParams,
      hostEmail: userOne.email,
      icalUrls: ['https://www.google.com'],
    };

    const savedListing = await ListingService.createListing(listing, userOne);
    
    const transferredListing = await ListingService.updateListing({
      ...listing,
      hostEmail: userTwo.email,
      id: savedListing.id,
    }, admin);

    const [oldHost, newHost] = await Promise.all([
      User.findById(userOne.id),
      User.findById(userTwo.id)
    ]);
    
    expect(oldHost.listingCount).toBe(0);
    expect(newHost.listingCount).toBe(1);
    expect(transferredListing.meta.updatedBy).toBe(admin.email);
  });

  test('updateListing should not automatically reassign listing to admin', async () => {
    expect.assertions(1);
    
    const listing = {
      ...listingParams,
      hostEmail: userOne.email,
    };

    const savedListing = await ListingService.createListing(listing, userOne);
    
    const updatedListing = await ListingService.updateListing({
      ...listing,
      id: savedListing.id,
    }, admin);
    
    expect(updatedListing.hostId).toBe(userOne.id);
  });

  test('updateListing should not reassign listing via hostId', async () => {
    expect.assertions(1);
    
    const listing = {
      ...listingParams,
      hostEmail: userOne.email,
    };

    const savedListing = await ListingService.createListing(listing, userOne);
    
    const updatedListing = await ListingService.updateListing({
      ...listing,
      id: savedListing.id,
      hostId: userTwo.id,
    }, admin);
    
    expect(updatedListing.hostId).toBe(userOne.id);
  });

  test('updateListing should add an ical Url if it did not exist yet', async () => {
    expect.assertions(1);

    const listing = {
      ...listingParams
    };
    const savedListing = await ListingService.createListing(listing, userTwo);
    const id = savedListing.id;
    const updatedListing = await ListingService.updateListing({
      ...listing,
      icalUrls: ['https://www.google.com'],
      id
    }, userTwo);

    expect(updatedListing.icalUrls[0]).toBe('https://www.google.com');
  });

  test('updateListing should remove previous ical when passing in none/null/undefined/empty icalUrls', async () => {
    expect.assertions(4);

    const oldListing1 = {
      ...listingParams,
      icalUrls: ['https://www.validIcalUrl.com']
    };
    const oldListing2 = {
      ...listingParams,
      icalUrls: ['https://www.validIcalUrl.com']
    };
    const oldListing3 = {
      ...listingParams,
      icalUrls: ['https://www.validIcalUrl.com']
    };
    const oldListing4 = {
      ...listingParams,
      icalUrls: ['https://www.validIcalUrl.com']
    };

    const savedListing1 = await ListingService.createListing(oldListing1, userTwo);
    const savedListing2 = await ListingService.createListing(oldListing2, userTwo);
    const savedListing3 = await ListingService.createListing(oldListing3, userTwo);
    const savedListing4 = await ListingService.createListing(oldListing4, userTwo);

    const updatedListingNone = await ListingService.updateListing({
      ...listingParams,
      id: savedListing1.id,
    }, userTwo);
    const updatedListingNull = await ListingService.updateListing({
      ...listingParams,
      id: savedListing2.id,
      icalUrls: null
    }, userTwo);
    const updatedListingUndefined = await ListingService.updateListing({
      ...listingParams,
      id: savedListing3.id,
      icalUrls: undefined
    }, userTwo);
    const updatedListingEmpty = await ListingService.updateListing({
      ...listingParams,
      id: savedListing4.id,
      icalUrls: []
    }, userTwo);

    const fetchedCalendarsNone = await CalendarService.getIcalsByListingId(updatedListingNone.id);
    const fetchedCalendarsNull = await CalendarService.getIcalsByListingId(updatedListingNull.id);
    const fetchedCalendarsUndefined = await CalendarService.getIcalsByListingId(updatedListingUndefined.id);
    const fetchedCalendarsEmpty = await CalendarService.getIcalsByListingId(updatedListingEmpty.id);

    expect(fetchedCalendarsNone.length).toBe(0);
    expect(fetchedCalendarsNull.length).toBe(0);
    expect(fetchedCalendarsUndefined.length).toBe(0);
    expect(fetchedCalendarsEmpty.length).toBe(0);
  });
  

  test('createListing should throw error if ical Urls are invalid', async () => {
    const listing = {
      ...listingParams,
      icalUrls: ['www.google.com']
    };

    await expect(ListingService.createListing(listing, userTwo)).rejects.toThrow(Error);
  });

  test('updateListing should throw error if ical Urls are invalid', async () => {
    const listing = {
      ...listingParams
    };

    const savedListing = await ListingService.createListing(listing, userTwo);
    const id = savedListing.id;

    await expect(ListingService.updateListing({
      ...listing,
      icalUrls: ['http://www.badurlwithnoS.com', 'https://www.validical.com'],
      id
    }, userTwo)).rejects.toThrow(Error);
  });

  test('deleteListing should delete a listing', async () => {
    expect.assertions(1);

    const listing = {
      ...listingParams,
      hostEmail: userOne.email,
      icalUrls: ['https://www.google.com'],
    };

    const savedListing = await ListingService.createListing(listing, userOne);
    const deletedListing = await ListingService.deleteListing(savedListing.id);
    expect(deletedListing.id).toEqual(savedListing.id);
  });

  test('getReservations should shows all matching reservations', async () => {
    const testReservations = [
      { startDate: new Date("2017-09-30"), endDate: new Date("2017-10-13") },
      { startDate: new Date("2017-09-30"), endDate: new Date("2018-10-25") },
      { startDate: new Date("2018-08-30"), endDate: new Date("2018-09-15") },
      { startDate: new Date("2018-07-30"), endDate: new Date("2018-10-05") },
      { startDate: new Date("2018-11-30"), endDate: new Date("2019-12-25") },
      { startDate: new Date("2019-11-30"), endDate: new Date("2019-12-23") }
    ];
    const testId = 123;
    const testUrl = "https://localhost";

    await Reservation.bulkReplace(testId, testUrl, testReservations);

    const reservations = await ReservationService.getReservations(
      testId,
      new Date("2018-01-01"),
      new Date("2018-12-31")
    );

    // Two testReservations should have fallen out of range...
    expect(reservations.length).toBe(testReservations.length - 2);
  });

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
      ListingService.createListing(sanFranciscoListing, userTwo).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(dalyCityListing, userTwo).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(losAngelesListing, userTwo).then(listing => ListingService.activateListing(listing.id)),
    ]);
    const DALY_CITY = {
      lat: 37.687923,
      lng: -122.470207,
    };
    const VENICE_BEACH = {
      lat: 33.9764002,
      lng: -118.4667452
    };
    const foundDalyCityListings = await ListingService.searchListings({
      coordinates: {
        ...DALY_CITY,
        measurement: 'KM',
        radius: 5
      }
    });
    const foundVeniceBeachListings = await ListingService.searchListings({
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
      ListingService.createListing(newYorkListing, userTwo).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(hawaiiListing, userTwo).then(listing => ListingService.activateListing(listing.id)),
    ]);
    const [foundNewYorkListings, foundHawaiiListings] = await Promise.all([
      ListingService.searchListings({ locationQuery: 'brooklyn' }),
      ListingService.searchListings({ locationQuery: 'hawaii' }),
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
      ListingService.createListing(sanFranciscoListing, userTwo).then(listing => ListingService.activateListing(listing.id)),
      ListingService.createListing(dalyCityListing, userTwo).then(listing => ListingService.activateListing(listing.id)),
    ]);
    const foundDalyCityListings = await ListingService.searchListings({
      coordinates: DALY_CITY
    });
    const foundSanFranciscoListings = await ListingService.searchListings({
      coordinates: SAN_FRANCISCO
    });
    expect(foundDalyCityListings[0].id).toEqual(createdDalyCityListing.id);
    expect(foundDalyCityListings[1].id).toEqual(createdSanFranciscoListing.id);
    expect(foundSanFranciscoListings[0].id).toEqual(createdSanFranciscoListing.id);
    expect(foundSanFranciscoListings[1].id).toEqual(createdDalyCityListing.id);
  });

  test("activates and deactivates listings", async () => {
    const listing = {
      ...listingParams
    };
    const { id } = await ListingService.createListing(listing, admin);

    const listingsWhenActive = await ListingService.getAllActiveListings();
    expect(listingsWhenActive.some(l => l.id === id)).toBe(true);

    await ListingService.deactivateListing(id);
    const listingsWhenInactive = await ListingService.getAllActiveListings();
    expect(listingsWhenInactive.some(l => l.id === id)).toBe(false);

    await ListingService.activateListing(id);
    const listingsWhenActivated = await ListingService.getAllActiveListings();
    expect(listingsWhenActivated.some(l => l.id === id)).toBe(true);
  });

  test("createListing allows admins and verified hosts to set isActive to true", async () => {
    const listing = {
      ...listingParams,
      isActive: true,
    };

    const [adminListing, userListing, userUnverifiedListing] = await Promise.all([
      ListingService.createListing(listing, admin),
      ListingService.createListing(listing, userOne),
      ListingService.createListing(listing, userUnverified),
    ]);
    
    expect(adminListing.isActive).toEqual(true);
    expect(userListing.isActive).toEqual(true);
    expect(userUnverifiedListing.isActive).toEqual(false);
  });

  test("updateListing allows admins and verified hosts to set isActive to true", async () => {
    const listing = {
      ...listingParams,
      isActive: false,
    };
    const [adminListing, userListing, userUnverifiedListing] = await Promise.all([
      ListingService.createListing(listing, admin),
      ListingService.createListing(listing, userOne),
      ListingService.createListing(listing, userUnverified),
    ]).then(([adminListing, userListing, userUnverifiedListing]) => {
      return Promise.all([
        ListingService.updateListing({ ...adminListing.get(), isActive: true }, admin),
        ListingService.updateListing({ ...userListing.get(), isActive: true }, userOne),
        ListingService.updateListing({ ...userUnverifiedListing.get(), isActive: true }, userUnverified),
      ]);
    });

    expect(adminListing.isActive).toEqual(true);
    expect(userListing.isActive).toEqual(true);
    expect(userUnverifiedListing.isActive).toEqual(false);
  });
});
