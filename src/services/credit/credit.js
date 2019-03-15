const _ = require('lodash');
const CreditBalance = require('../../models/sequelize').CreditBalance;
const CreditLedger = require('../../models/sequelize').CreditLedger;

class CreditService {
  getEmptyBalance() {
    return new CreditBalance({amountUsd: 0});
  }

  getBalance(user) {
    if (!this._isUserValid(user)) return null;
    return CreditBalance.findByUserId(user.id);
  }

  async debitFromBalance(user, amountUsd, bookingId, notes) {
    if (!this._isUserValid(user)) {
      return Promise.reject(new Error('invalid user parameter'));
    }
    if (!bookingId) {
      return Promise.reject(new Error('Missing booking id'));
    }

    const { id } = user;
    await CreditLedger.createDebit(id, amountUsd, bookingId);
    return CreditBalance.debitFromBalance(id, amountUsd)
  }

  async countUsersByBalance(balance) {
    return await CreditBalance.count({
      where: { amountUsd: balance }
    });
  }

  async creditToBalance(user, amountUsdToCredit, bookingId) {
    if (!this._isUserValid(user)) {
      return Promise.reject(new Error('invalid user parameter'));
    }
    const { id } = user;
    await CreditLedger.createCredit(id, amountUsdToCredit, bookingId);
    return CreditBalance.creditToBalance(id, amountUsdToCredit);
  }

  refundGuestCancel(guest, booking) {
    const amountToCredit = booking.getCreditRefundAmountForGuest();
    if (!amountToCredit) {
      return booking.updateCreditAmountAppliedFromUsd(0);
    }
    if (guest.id !== booking.guestId) {
      return Promise.reject(new Error('Provided guest id does not match the booking guest id'));
    }

    return Promise.all([
        booking.updateCreditAmountAppliedFromUsd(0),
        this.creditToBalance(guest, amountToCredit, booking.id)
      ])
      .then(([booking]) => booking);
  }
  
  confirm(creditBalance, booking, guest) {
    if (!creditBalance || !creditBalance.amountUsd) {
      return booking;
    }
    if (booking.hasCreditApplied() && creditBalance.amountUsd - booking.meta.creditAmountUsdApplied < 0) {
      let error = new Error(`Credit amount has changed since booking was created. current balance:${creditBalance.amountUsd} balance to be debited:${booking.meta.creditAmountUsdApplied}`);
      error.statusCode = 500;
      return Promise.reject(error);
    }

    const amountUsdToDebit = booking.meta.creditAmountUsdApplied;
    return Promise.all([
        booking.updateCreditAmountAppliedFromUsd(amountUsdToDebit),
        this.debitFromBalance(guest, amountUsdToDebit, booking.id)
      ])
      .then(([booking]) => booking);
  }

  reject(guest, booking) {
    if (!booking.hasCreditApplied()) {
      return booking;
    }

    const { creditAmountUsdApplied } = booking.meta;
    return Promise.all([
        booking.updateCreditAmountAppliedFromUsd(0),
        this.creditToBalance(guest, creditAmountUsdApplied, booking.id)
      ])
      .then(([booking]) => booking);
  }

  refundFull(guest, booking) {
    const amountToCredit = _.get(booking, 'meta.creditAmountUsdApplied');
    if (!amountToCredit) {
      return Promise.resolve(booking);
    }
    if (guest.id !== booking.guestId) {
      return Promise.reject(new Error('Provided guest id does not match the booking guest id'));
    }

    return Promise.all([
        booking.updateCreditAmountAppliedFromUsd(0),
        this.creditToBalance(guest, amountToCredit, booking.id)
      ])
      .then(([booking]) => booking);
  }

  _isUserValid(user) {
    return user && user.id;
  }
}

module.exports = { CreditService: new CreditService() };
