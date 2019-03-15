const Big = require('big.js');
const FROM_DUST = Big(1).div(Math.pow(10, 18));

const FORMATTERS = {
  id: ({ id }) => id.replace(/^0x0+/, ''),
  arbitrationAddress: ({ arbitration }) => arbitration,
  disputantAddress: ({ disputant }) => disputant,
  guestWalletAddress: ({ purchaser }) => purchaser,
  hostWalletAddress: ({ supplier }) => supplier,
  guestTotalAmount: ({ price, deposit }) => parseFloat(
    FROM_DUST.times(price).add(FROM_DUST.times(deposit)).toString()
  ),
  guestDepositAmount: ({ deposit }) => parseFloat(
    FROM_DUST.times(deposit).toString()
  ),
  cancellationFee: ({ cancellationFee }) => parseFloat(
    FROM_DUST.times(cancellationFee).toString()
  ),
  checkInDate: ({ cancelDeadline }) => new Date(cancelDeadline * 1000),
  checkOutDate: ({ disputeDeadline }) => new Date(disputeDeadline * 1000)
};

module.exports = (event, properties) => properties.reduce(
  (details, key) => ({
    [key]: FORMATTERS[key](event.returnValues),
    ...details
  }),
  {}
);
