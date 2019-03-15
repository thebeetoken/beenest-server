const testUtils = require('../lib/testUtils');
const { User, Listing, Booking, CreditBalance, CurrencyRate } = require('../models/sequelize');
const pricing = require('./pricing');

describe('pricing', () => {
  let currencyRates = {};
  let creditBalance;
  let guest;
  let host;
  let listing;

  beforeAll(() => {
    return Promise.all([testUtils.initializeDatabase()])
      .then(() => {
        return Promise.all([
          User.create(testUtils.createTestUserOpts()),
          User.create(testUtils.createTestUserOpts()),
          User.create(testUtils.createTestUserOpts())
        ]);
      })
      .then(users => {
        guest = users[0];
        host = users[1];
        
        const listing = Listing.build(testUtils.createTestListingOpts());
        listing.hostId = host.id;
        listing.pricePerNightUsd = 10.0;
        listing.securityDepositUsd = 5.0;

        const creditBalance = CreditBalance.build({
          id: guest.id,
          amountUsd: 75
        });

        return Promise.all([listing.save(), creditBalance.save()]);
      })
      .then(([savedListing, savedCreditBalance]) => {
        listing = savedListing;
        creditBalance = savedCreditBalance;
        return testUtils.createCurrencyRateModels();
      })
      .then(rates => rates.forEach(rate => currencyRates[rate.id] = rate));
  });

  beforeEach(() => {
    return creditBalance.updateAmount(75);
  });

  test('compute should fail with an invalid date', () => {
    expect.assertions(1);

    let checkInDate = '2017092';
    let checkOutDate = '2018';

    expect(pricing.compute({
      listing: listing,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: 2
    })).rejects.toThrow(/Invalid Date Object/);
  });

  test('compute should return a booking price amount', () => {
    expect.assertions(12);

    let checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate());
    let checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 4);

    return pricing.compute({
      listing: listing,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: 2
    }).then(price => {
      const beePrice = price.paymentPrices.find(p => p.currency === 'BEE');
      const usdPrice = price.paymentPrices.find(p => p.currency === 'USD');
      const ethPrice = price.paymentPrices.find(p => p.currency === 'ETH');

      expect(price.listingId).toEqual(listing.id);

      expect(price.numberOfNights).toEqual(4);
      expect(price.numberOfGuests).toEqual(2);

      expect(beePrice.total).toEqual(currencyRates.BEE.convertFromUsd(45.0));
      expect(beePrice.totalUsd).toBeCloseTo(45.0);
      expect(beePrice.conversionRateToUsd).toBeCloseTo(currencyRates.BEE.convertToUsd(1));

      expect(usdPrice.total).toEqual(40.0);
      expect(usdPrice.totalUsd).toEqual(40.0);
      expect(usdPrice.conversionRateToUsd).toEqual(1);

      expect(ethPrice.total).toBeCloseTo(currencyRates.ETH.convertFromUsd(45.0));
      expect(ethPrice.totalUsd).toBeCloseTo(45.0);
      expect(ethPrice.conversionRateToUsd).toBeCloseTo(currencyRates.ETH.convertToUsd(1));
    });
  });

  test('compute should return a credits applied attribute', () => {
    expect.assertions(1);

    let checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate());
    let checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 4);

    return pricing.compute({
        listing: listing,
        checkInDate: checkInDate,
        checkOutDate: checkOutDate,
        numberOfGuests: 2,
        creditBalance
      }).then(price => {
        const usdPrice = price.paymentPrices.find(p => p.currency === 'USD');
        const usdCredits = usdPrice.lineItems.find(c => c.type === 'credit_amount_applied');

        expect(usdCredits.amount).toBe(-40);
      });
  });

  test('compute should return a credits applied given a low available credit', async () => {
    expect.assertions(4);

    let checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate());
    let checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 4);
    
    const creditAmount = 5;
    await creditBalance.updateAmount(creditAmount);

    return pricing.compute({
      listing,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: 2,
      creditBalance
    }).then(price => {
      const usdPrice = price.paymentPrices.find(p => p.currency === 'USD');
      const usdCredits = usdPrice.lineItems.find(c => c.type === 'credit_amount_applied');

      expect(usdPrice.total).toBe(35);
      expect(usdPrice.totalUsd).toBe(35);
      expect(usdCredits.amount).toBe(-1 * creditAmount);
      expect(creditBalance.amountUsd).toBe(5);
    });
  });

  test('compute should return zero transaction fee when total is entirely paid for by credit', async () => {
    expect.assertions(4);

    let checkInDate = new Date();
    checkInDate.setDate(checkInDate.getDate());
    let checkOutDate = new Date();
    checkOutDate.setDate(checkOutDate.getDate() + 4);

    const creditAmount = 100;
    await creditBalance.updateAmount(creditAmount);

    return pricing.compute({
      listing,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      numberOfGuests: 2,
      creditBalance
    }).then(price => {
      const usdPrice = price.paymentPrices.find(p => p.currency === 'USD');
      const usdPriceTotalNights = usdPrice.lineItems.find(p => p.type === 'price_total_nights');
      const usdCredits = usdPrice.lineItems.find(c => c.type === 'credit_amount_applied');

      expect(usdPrice.total).toBe(0);
      expect(usdPrice.totalUsd).toBe(0);
      expect(usdCredits.amount * -1).toBe(usdPriceTotalNights.amount);
      expect(creditBalance.amountUsd).toBe(creditAmount);
    });
  });

  test('computeHostPayout will return no extra charge for bee payments', () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());
    booking.meta = {
      guestTotalAmount: 10,
      currency: 'BEE'
    };

    const hostPayout = pricing.computeHostPayout(booking);
    expect(hostPayout).toEqual(booking.meta.guestTotalAmount);
  });

  test('computeHostPayout will return correct amount for USD payments', () => {
    const booking = Booking.build(testUtils.createTestBookingOpts());
    booking.meta = {
      currency: 'USD',
      guestTotalAmount: 10,
      priceQuotes: [{
        currency: 'USD',
        transactionFee: 0,
      }],
    };

    const hostPayout = pricing.computeHostPayout(booking);
    const { guestTotalAmount, priceQuotes } = booking.meta;
    const { transactionFee } = priceQuotes.find(p => p.currency === 'USD');
    expect(guestTotalAmount - transactionFee).toEqual(hostPayout);
  });
});
