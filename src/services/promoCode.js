const { CreditService } = require('../services/credit');
const { AnalyticsService, Properties } = require('../services/analytics');

const CREDIT_CODES = [
  {
    active: true,
    amount: 20,
    code: 'bonus20',
    limit: 200,
  },
  {
    active: true,
    amount: 25,
    code: 'vrma2018',
    limit: 200,
  }
];

class PromoCodeService {
  isReferralCodeValid(code) {
    if (!code) {
      return false;
    }

    // TODO will be replaced with actual referral code system
    return true;
  }

  registerReferralCode(user, code) {
    if (!this.isReferralCodeValid(code)) {
      return Promise.resolve(0);
    }

    return AnalyticsService.trackReferralCode(user, {[Properties.REFERRAL_CODE]: code});
  }

  isCreditCodeValid(code) {
    return CREDIT_CODES.some(async (promo) => {
      /* 
        The 2nd check creates a limit (200 max) of users who can receive this promo code
        by checking if their credit balance is 25.  We use 25 currently because we have
        no other promos so everyone should either have 0 or 25 credits.
        This should be refactored in the future to accomodate for other promo codes.
      */
      return promo.code === code && promo.active && (await CreditService.countUsersByBalance(25) < promo.limit);
    });
  }

  getCreditAmount(code) {
    const foundCode = CREDIT_CODES.find((promo) => promo.code === code);
    return (foundCode && foundCode.active) ? foundCode.amount : 0;
  }

  creditUser(user, code) {
    if (this.getCreditAmount(code) <= 0) {
      return Promise.resolve(0);
    }

    return CreditService.creditToBalance(user, this.getCreditAmount(code));
  }

}

module.exports = {PromoCodeService: new PromoCodeService()};
