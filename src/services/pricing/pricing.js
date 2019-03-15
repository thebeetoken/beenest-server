const { CreditService } = require('../../services/credit');
const { CurrencyService } = require('../../services/currency');
const pricing = require('../../services/pricing');

class PricingService {
  async getPrices(listing) {
    const { pricePerNightUsd, securityDepositUsd } = listing;
    const rates = await CurrencyService.getRates();
    return rates.map(rate => ({
      currency: rate.id,
      pricePerNight: rate.convertFromUsd(pricePerNightUsd),
      securityDeposit: rate.convertFromUsd(securityDepositUsd)
    }));
  }

  async getPriceQuote(booking, listing, user) {
    const { numberOfGuests, checkInDate, checkOutDate } = booking;
    const creditBalance = await CreditService.getBalance(user);
    return pricing.compute({
      creditBalance,
      listing,
      numberOfGuests,
      checkInDate: new Date(checkInDate),
      checkOutDate: new Date(checkOutDate),
    });
  }

  flattenPrice({ lineItems, total, totalUsd }, currency) {
    const { pricePerNight, amount: priceTotalNights } = lineItems.find(
      p => p.type === 'price_total_nights'
    );
    const creditAmountApplied = lineItems.find(
      p => p.type === 'credit_amount_applied'
    ).amount;
    const securityDeposit = lineItems.find(p => p.type === 'security_deposit')
      .amount;
    const transactionFee = lineItems.find(p => p.type === 'transaction_fee');
    return {
      creditAmountApplied,
      currency,
      pricePerNight,
      priceTotalNights,
      securityDeposit,
      guestTotalAmount: total,
      guestTotalAmountUsd: totalUsd,
      transactionFee: transactionFee ? transactionFee.amount : 0,
    };
  }

  async hasPriceChanged(booking, listing, guest) {
    // Double check the price
    const opts = {
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numberOfGuests: booking.meta.numberOfGuests,
    };
    const { paymentPrices } = await this.getPriceQuote(opts, listing, guest);
    const priceQuote = paymentPrices.find(p => p.currency === booking.currency);
    const {
      guestTotalAmount,
      pricePerNight,
      securityDeposit,
    } = this.flattenPrice(priceQuote, booking.currency);
    return (
      guestTotalAmount !== parseFloat(booking.guestTotalAmount) ||
      pricePerNight !== parseFloat(booking.pricePerNight) ||
      securityDeposit !== parseFloat(booking.guestDepositAmount)
    );
  }
}

module.exports = {
  PricingService: new PricingService(),
};
