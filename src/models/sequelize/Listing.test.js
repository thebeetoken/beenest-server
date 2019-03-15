const testUtils = require('../../lib/testUtils');
const { Booking, User, Listing, CurrencyRate } = require('./index');

describe('Listing', () => {

    beforeAll(() => {
      return testUtils.initializeDatabase();
    });

    afterAll(() => {
      return testUtils.clearDatabase();
    });

    afterEach(() => (
      Promise.all([
        Booking.destroy({ where: {} }),
        Listing.destroy({ where: {} }),
        User.destroy({ where: {} }),
      ])
    ))

    test('save() should save', () => {
      expect.assertions(5);

      const host = User.build(testUtils.createTestUserOpts());
      const guest = User.build(testUtils.createTestUserOpts());
      let listing;

      return Promise.all([host.save(), guest.save()]).then(() => {
          listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
          listing.hostId = host.id;

          return listing.save();
      }).then(() => {
          return Listing.findById(listing.id);
      }).then(fetchedListing => {
          expect(fetchedListing.id).toBe(listing.id);

          const json = fetchedListing.toJSON();
          expect(json.hostId).toBe(host.id);
          expect(json.idSlug).not.toBe(null);
          expect(json.listingPicUrl).not.toBe(null);
          expect(json.pricePerNightUsd).not.toBe(null);
      });
    });

    test('updateWithMetaFields() should update given a valid field parameter', () => {
      expect.assertions(3);

      listing = Listing.buildWithMetaFields(testUtils.createTestListingOpts());
      const prevCity = listing.city;
      const opts = {
        title: 'updated title',
        addressLine1: 'updated address'
      };

      return listing.updateWithMetaFields(opts)
        .then(fetchedListing => {
          expect(fetchedListing.title).toBe(opts.title);
          expect(listing.addressLine1).toBe(opts.addressLine1);
          expect(listing.city).toBe(prevCity);
        });
    });

    test('updateWithMetaFields() should update an array', () => {
      expect.assertions(1);

      const listing = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
        photos: ['http://1.com', 'http://1.com', 'http://1.com', 'http://1.com'],
      });
      const newPhotos = ['http://2.com', 'http://2.com', 'http://2.com', 'http://2.com'];
      const opts = {
        photos: newPhotos
      };
      return listing.updateWithMetaFields(opts)
        .then(fetchedListing => {
          expect(fetchedListing.photos).toEqual(newPhotos);
        });
    });

    test('updateWithMetaFields() should update an object (ex. accomodations)', () => {
      expect.assertions(1);

      const listing = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
        accomodations: {
          homeType: 'Entire Place',
          sleepingArrangement: '1',
          numberOfBathrooms: 1,
          sharedBathroom: '1',
          minNumberOfNights: 1,
          maxNumberOfGuests: 1
        }
      });
      const newAccomodations = {
        homeType: 'Private Room',
        sleepingArrangement: '2',
        numberOfBathrooms: 2,
        sharedBathroom: '2',
        minNumberOfNights: 2,
        maxNumberOfGuests: 2
      };
      const opts = {
        accomodations: newAccomodations
      };
      return listing.updateWithMetaFields(opts)
        .then(fetchedListing => {
          expect(fetchedListing.accomodations).toBe(JSON.stringify(newAccomodations));
        });
    });

    test('updateWithMetaFields() should update meta fields', () => {
      expect.assertions(2);
      
      const oldUrl = 'http://www.oldurl.com';
      const newUrl = 'http://www.newurl.com';
      const houseRules = '<p>No Visitors</p>';

      const listing = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
        listingPicUrl: oldUrl,
        houseRules,
      });
      const opts = {
        listingPicUrl: newUrl
      };
      return listing.updateWithMetaFields(opts)
        .then(fetchedListing => {
          expect(fetchedListing.meta.listingPicUrl).toBe(newUrl);
          expect(fetchedListing.meta.houseRules).toBe(houseRules);
        });
    });

    test('toJSON() should not fail if meta field is null/undefined/empty', () => {
      expect.assertions(3);

      let listing1 = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
      });
      let listing2 = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
      });
      let listing3 = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
      });
      listing1.meta = null;
      listing2.meta = undefined;
      listing3.meta = {};
      const updatedListing1 = listing1.toJSON();
      const updatedListing2 = listing2.toJSON();
      const updatedListing3 = listing3.toJSON();

      expect(updatedListing1).toBeTruthy();
      expect(updatedListing2).toBeTruthy();
      expect(updatedListing3).toBeTruthy();
    });

    test('toJSON() should not fail when accomodations is missing/empty', () => {
      expect.assertions(2);

      let listing1 = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
        maxGuests: 5,
        minimumNights: 4,
      });
      let listing2 = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
        maxGuests: 5,
        minimumNights: 4,
      });
      listing1.accomodations = null;
      listing2.accomodations = '{}';
      const updatedListing1 = listing1.toJSON();
      const updatedListing2 = listing2.toJSON();

      expect(updatedListing1).toBeTruthy();
      expect(updatedListing2).toBeTruthy();
    });

    test('toJSON() should use attribute from meta field when available', () => {
      expect.assertions(3);

      let listing = Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
        homeType: 'Private Room',
        sleepingArrangement:'1 Queen',
        numberOfBathrooms: 1,
        sharedBathroom: 'Yes',
        maxGuests: 10,
        minimumNights: 2
      });
      listing.accomodations = '{"homeType":"Shared Room","sleepingArrangement":"5 Kings","numberOfBathrooms": 46,"sharedBathroom":"No","maxNumberOfGuests":16,"minNumberOfNights":3}';
      const updatedListing = listing.toJSON();

      expect(updatedListing.numberOfBathrooms).toBe(1);
      expect(updatedListing.homeType).toBe("Private Room");
      expect(updatedListing.maxNumberOfGuests).toBe(10);
    });

    test('toJSON() should take in a guest and no booking and redact the street address', async () => {
      expect.assertions(2);

      const guest = await User.build(testUtils.createTestUserOpts()).save();

      const listing = await Listing.buildWithMetaFields({
        ...testUtils.createTestListingOpts(),
        homeType: 'Private Room',
        sleepingArrangement:'1 Queen',
        numberOfBathrooms: 1,
        sharedBathroom: 'Yes',
        maxGuests: 10,
        minimumNights: 2
      }).save();

      const returnedListing = listing.toJSON({ requestor: guest });

      expect(returnedListing.addressLine1).toBe(null);
      expect(returnedListing.addressLine2).toBe(null);
    });

    test('toJSON() should take in a admin or host with no booking param and reveal the street address', async () => {
      expect.assertions(2);

      const admin = await User.build(testUtils.createTrustedFirebaseUserOpts({ email: 'admin@thebeetoken.com' })).save();
      const host = await User.build(testUtils.createTestUserOpts()).save();

      return Listing.buildWithMetaFields({
          ...testUtils.createTestListingOpts(),
          hostId: host.id,
        })
        .save()
        .then(({ id }) => (
          Promise.all([
            Listing.findById(id),
            Listing.findById(id),
          ])
        ))
        .then(([listing, listingCopy]) => {
          expect(listing.toJSON({ requestor: admin }).addressLine1).toBeTruthy();
          expect(listingCopy.toJSON({ requestor: host }).addressLine1).toBeTruthy();
        });
    });

    test('toJSON() should take in a guest and a booking with started status and redact the street address', async () => {
      expect.assertions(2);

      const host = await User.build(testUtils.createTestUserOpts()).save();
      const guest = await User.build(testUtils.createTestUserOpts()).save();

      return Listing.buildWithMetaFields({
          ...testUtils.createTestListingOpts(),
          hostId: host.id,
        })
        .save()
        .then(listing => (
          Promise.all([
            listing,
            Listing.findById(listing.id),
            Booking.buildWithMetaFields({
              ...testUtils.createTestBookingOpts(),
              listingId: listing.id,
              hostId: host.id,
              guestId: guest.id,
            })
          ])
        ))
        .then(([listing, listingCopy, booking]) => {
          expect(listingCopy.toJSON({ requestor: guest, booking }).addressLine1).toBeFalsy();
          expect(listing.toJSON({ requestor: host, booking }).addressLine1).toBeTruthy();
        });
    });

    test('toJSON() should take in a guest and a host_approved booking with started status and reveal the street address', async () => {
      expect.assertions(2);

      const host = await User.build(testUtils.createTestUserOpts()).save();
      const guest = await User.build(testUtils.createTestUserOpts()).save();

      return Listing.buildWithMetaFields({
          ...testUtils.createTestListingOpts(),
          hostId: host.id,
        })
        .save()
        .then(listing => (
          Promise.all([
            listing,
            Listing.findById(listing.id),
            Booking.buildWithMetaFields({
              ...testUtils.createTestBookingOpts(),
              listingId: listing.id,
              hostId: host.id,
              guestId: guest.id,
              status: 'host_approved',
            })
          ])
        ))
        .then(([listing, listingCopy, booking]) => {
          expect(listingCopy.toJSON({ requestor: guest, booking }).addressLine1).toBeTruthy();
          expect(listing.toJSON({ requestor: host, booking }).addressLine1).toBeTruthy();
        });
    });
});

