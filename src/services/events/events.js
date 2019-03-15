const errors = require('../../util/errors');
const { ContractEvent } = require('../../models/sequelize');
const { paymentsContractAddress } = require('../../../config/settings');
const advance = require('./advance');
const COMMON_PROPERTIES = [
  'id',
  'guestWalletAddress',
  'hostWalletAddress',
  'guestTotalAmount',
  'guestDepositAmount'
];
const CANCEL_PROPERTIES = [ 'cancellationFee', ...COMMON_PROPERTIES ];
const INVOICE_PROPERTIES = [ 'checkInDate', 'checkOutDate', ...CANCEL_PROPERTIES ];
const DISPATCHERS = {
  Invoice: (event) => advance(event, INVOICE_PROPERTIES, 'host_approved', 'guest_paid'),
  Payout: (event) => advance(event, COMMON_PROPERTIES, 'host_paid', 'completed'),
  Cancel: (event) => advance(event, CANCEL_PROPERTIES, 'guest_cancel_initiated', 'guest_cancelled'),
  Refund: (event) => advance(event, COMMON_PROPERTIES, 'refund_initiated', 'refunded'),
  Dispute: (event) => advance(event, COMMON_PROPERTIES, 'dispute_initiated', 'disputed')
};

class EventService {
  async dispatch(event) {
    if (event.address.toLowerCase() !== paymentsContractAddress.toLowerCase()) {
      const error = new Error(`Event reported from address ${event.address}; expected ${paymentsContractAddress}.`);
      error.code = errors.UNKNOWN_CONTRACT;
      throw error;
    }    
    const contractEvent = await ContractEvent.create({
      blockNumber: event.blockNumber,
      raw: event
    });
    const dispatch = DISPATCHERS[event.event];
    if (dispatch) {
      await dispatch(event);
    }
    return this.getLatestBlockNumber();
  }

  async getLatestBlockNumber() {
    const latestEvent = await ContractEvent.findOne({
      order: [['blockNumber', 'DESC']]
    });
    return latestEvent ? latestEvent.blockNumber : 0
  }
}

module.exports = { EventService: new EventService() };
