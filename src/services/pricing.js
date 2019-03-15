const datefns = require('date-fns'); 
const differenceInDays = require('date-fns/difference_in_days');
const { CurrencyRate, Listing, Booking } = require('../models/sequelize');

const service = {
  compute: async (opts) => {
    const { listing, numberOfGuests, checkInDate, checkOutDate, creditBalance } = opts;

    if (!listing) {
      return Promise.reject(new Error('Missing listing'));
    }
    if (!numberOfGuests) {
      return Promise.reject(new Error('Missing number of guests'));
    }
    if (!checkInDate || !checkOutDate) {
      return Promise.reject(new Error('Missing dates'));
    }
    if (!(checkInDate instanceof Date) || !(checkInDate instanceof Date)) {
      return Promise.reject(new Error('Invalid Date Object'));
    }
    if (!datefns.isValid(checkInDate) || !datefns.isValid(checkOutDate)) {
      return Promise.reject(new Error('Invalid Date'));
    }

    const numberOfNights = differenceInDays(checkOutDate, checkInDate);
    if (numberOfNights <= 0) {
       return Promise.reject(new Error('Invalid Date'));
    }
    const lineItemReducer = (acc, lineItem) => acc + lineItem.amount;

    const currencyRates = [
      ...(await CurrencyRate.findAll()),
      { id: CurrencyRate.USD, convertToUsd: usd => usd, convertFromUsd: usd => usd }
    ];
    const paymentPrices = currencyRates.map(currencyRate => {
      const conversionRateToUsd = currencyRate.convertToUsd(1);
      const creditAvailable = creditBalance ?
        currencyRate.convertFromUsd(creditBalance.amountUsd) : 0;
      const securityDeposit = currencyRate.convertFromUsd(listing.securityDepositUsd);
      const pricePerNight = currencyRate.convertFromUsd(listing.pricePerNightUsd);
      const priceTotalNights = pricePerNight * numberOfNights;
      const creditAmountApplied = Math.min(priceTotalNights, creditAvailable);
      const lineItems = [
        {
          type: 'price_total_nights',
          pricePerNight,
          numberOfNights,
          amount: priceTotalNights
        },
        {
          type: 'security_deposit',
          amount: securityDeposit
        },
        {
          type: 'transaction_fee',
          amount: 0
        },
        {
          type: 'credit_amount_applied',
          amount: -1 * creditAmountApplied
        },
      ];
      const total = lineItems.filter(
        ({ type }) => type !== 'security_deposit' || currencyRate.id !== CurrencyRate.USD
      ).reduce(lineItemReducer, 0);
      return {
        currency: currencyRate.id,
        lineItems,
        total,
        totalUsd: currencyRate.convertToUsd(total),
        conversionRateToUsd
      };
    });

    return {
      listingId: listing.id,
      numberOfGuests,
      checkInDate,
      checkOutDate,
      numberOfNights,
      paymentPrices,
      creditBalance,
      createdAt: new Date()
    };
  },

  /**
   * @param price output from compute
   * @param input input from the user
   * @return booking input
   **/
  validate: (price, listing, creditBalance, input) => {
    const {
      checkInDate,
      checkOutDate,
      currency,
      guestDepositAmount,
      guestTotalAmount,
      listingId,
      numberOfGuests,
      pricePerNight,
      guestId,
    } = input;
    const usdPrice = price.paymentPrices.find(paymentPrice => paymentPrice.currency === 'USD');
    const beePrice = price.paymentPrices.find(paymentPrice => paymentPrice.currency === 'BEE');
    const ethPrice = price.paymentPrices.find(paymentPrice => paymentPrice.currency === 'ETH');

    const usdPricePerNight = usdPrice.lineItems.find(
      item => item.type === 'price_total_nights'
    ).pricePerNight;
    const usdSecurityDeposit = usdPrice.lineItems.find(
      item => item.type === 'security_deposit'
    ).amount;
    const usdTransactionFee = usdPrice.lineItems.find(
      item => item.type === 'transaction_fee'
    ).amount;
    const usdCredits = usdPrice.lineItems.find(
      item => item.type === 'credit_amount_applied'
    ).amount;

    const beePricePerNight = beePrice.lineItems.find(
      item => item.type === 'price_total_nights'
    ).pricePerNight;
    const beeSecurityDeposit = beePrice.lineItems.find(
      item => item.type === 'security_deposit'
    ).amount;
    const beeCredits = beePrice.lineItems.find(
      item => item.type === 'credit_amount_applied'
    ).amount;

    const ethPricePerNight = ethPrice.lineItems.find(
      item => item.type === 'price_total_nights'
    ).pricePerNight;
    const ethSecurityDeposit = ethPrice.lineItems.find(
      item => item.type === 'security_deposit'
    ).amount;
    const ethTransactionFee = ethPrice.lineItems.find(
      item => item.type === 'transaction_fee'
    ).amount;
    const ethCredits = ethPrice.lineItems.find(
      item => item.type === 'credit_amount_applied'
    ).amount;

    if (!currency) {
      const error = new Error(`Currency not selected`);
      error.statusCode = 400;
      return Promise.reject(error);
    }
    if (currency === 'USD') {
      if (guestTotalAmount !== usdPrice.total) {
        const error = new Error(
          `USD: Mismatched total price received ${guestTotalAmount} should be ${usdPrice.total}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (pricePerNight !== usdPricePerNight) {
        const error = new Error(
          `USD: Mismatched per night price received ${pricePerNight} should be ${usdPricePerNight}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (guestDepositAmount !== usdSecurityDeposit) {
        const error = new Error(
          `USD: Mismatched security deposit received ${guestDepositAmount} should be ${usdSecurityDeposit}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (creditBalance && creditBalance.amountUsd + usdCredits < 0) {
        const error = new Error(
          `USD: Mismatched credits received ${creditBalance.amountUsd} should be greater than or equal to ${-1 * usdCredits}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
    } 
    else if (currency === 'ETH') {
      if (guestTotalAmount !== ethPrice.total) {
        const error = new Error(
          `ETH: Mismatched total price received ${guestTotalAmount} should be ${ethPrice.total}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (pricePerNight !== ethPricePerNight) {
        const error = new Error(
          `ETH: Mismatched per night price received ${pricePerNight} should be ${ethPricePerNight}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (guestDepositAmount !== ethSecurityDeposit) {
        const error = new Error(
          `ETH: Mismatched security deposit received ${guestDepositAmount} should be ${ethSecurityDeposit}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (creditBalance && creditBalance.getEthValue() + ethCredits < 0) {
        const error = new Error(
          `ETH: Mismatched credits received ${creditBalance.getEthValue()} should be greater than or equal to ${-1 * ethCredits}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
    } else {
      // default to BEE
      if (guestTotalAmount !== beePrice.total) {
        const error = new Error(
          `BEE: Mismatched total price received ${guestTotalAmount} should be ${beePrice.total}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (pricePerNight !== beePricePerNight) {
        const error = new Error(
          `BEE: Mismatched per night price received ${pricePerNight} should be ${beePricePerNight}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (guestDepositAmount !== beeSecurityDeposit) {
        const error = new Error(
          `BEE: Mismatched security deposit received ${guestDepositAmount} should be ${beeSecurityDeposit}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
      if (creditBalance && creditBalance.getBeeValue() + beeCredits < 0) {
        const error = new Error(
          `BEE: Mismatched credits received ${creditBalance.getBeeValue()} should be greater than or equal to ${-1 * beeCredits}`
        );
        error.statusCode = 400;
        return Promise.reject(error);
      }
    }

    // Check to see if incoming request guest number does not exceed host's max guest set
    if (isNaN(numberOfGuests) || listing.maxGuests < numberOfGuests) {
      throw new Error('invalid_guest_number');
    }
     
    const transactionFee = (currency => {
      switch (currency) {
        case 'USD':
          return usdTransactionFee;
        case 'ETH':
          return ethTransactionFee;
        default:
          return 0;
      }
    })(currency);

    // make creditAmountApplied positive
    const positiveUsdCredits = Math.abs(usdCredits);
    const positiveEthCredits = Math.abs(ethCredits);
    const positiveBeeCredits = Math.abs(beeCredits);

    // TODO confirm no existing overlapping bookings similar to findOverlappingBookings
    const opts = {
      status: 'started',
      listingId,
      hostId: listing.hostId,
      guestId,
      checkInDate,
      checkOutDate,

      numberOfGuests,
      pricePerNight,
      guestDepositAmount,
      transactionFee,
      guestTotalAmount,
      currency,
      creditAmountUsdApplied: positiveUsdCredits,
      creditAmountEthApplied: positiveEthCredits,
      creditAmountBeeApplied: positiveBeeCredits
    };

    const intervalOpts = {
      listingId,
      checkInDate,
      checkOutDate,
    };

    return Booking.findOverlappingBookings(intervalOpts)
      .then(bookingsArray => {
        if (bookingsArray.length > 0) {
          return Promise.reject(new Error('Current selection overlaps with an active booking.'));
        }
        return Promise.resolve(opts);
      });
  },

  computeHostPayout: booking => {
    if (!booking || !booking.meta) {
      throw new Error('Missing booking.');
    }
    const { currency, guestTotalAmount } = booking;
    if (currency !== 'USD') {
      return guestTotalAmount;
    }
    const { priceQuotes } = booking.meta;
    const price = (priceQuotes || []).find(p => p.currency === 'USD');
    const transactionFee = price ? price.transactionFee : 0;
    return guestTotalAmount - transactionFee;
  }
};

module.exports = service;
