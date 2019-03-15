const Web3 = require('web3');
const Big = require('big.js');
const fetch = require('node-fetch');

const { BEE_TOKEN_CONTRACT_ADDRESS } = process.env;
const TOKEN_ABI = require('./ERC20-ABI');
const TOKEN_DIGITS = 18;
const SECRET = process.env.BOOKING_EXPIRE_SECRET;
const BEENEST_SERVER = process.env.BEENEST_API_SERVER || 'https://api.beenest.com';
const ETH_DIGITS = 18;
const web3 = new Web3(Web3.givenProvider || process.env.INFURA_URL);
const beeToken = new web3.eth.Contract(TOKEN_ABI, BEE_TOKEN_CONTRACT_ADDRESS);

function tryWithDefault(fn, defaultValue) {
  try {
    return fn();
  } catch (e) {
    return defaultValue;
  }
}

const verifiers = {
  ETH: async (booking) => {
    const {
      guestTxHash,
      guestWalletAddress,
      hostWalletAddress,
      guestTotalAmount
    } = booking;
    const amount = new Big(Math.pow(10, ETH_DIGITS)).mul(guestTotalAmount);
    const tx = await tryWithDefault(() => web3.eth.getTransaction(guestTxHash), false);
    return !!tx && tx.from === guestWalletAddress && tx.to === hostWalletAddress && amount.lte(tx.value);
  },
  BEE: async (booking) => {
    const {
      guestTxHash,
      guestWalletAddress,
      hostWalletAddress,
      guestTotalAmount
    } = booking;
    const amount = new Big(Math.pow(10, TOKEN_DIGITS)).mul(guestTotalAmount);
    const filter = { from: guestWalletAddress, to: hostWalletAddress };
    const opts = { filter, fromBlock: 0 };
    const events = await tryWithDefault(() => beeToken.getPastEvents('Transfer', opts), []);
    const event = events.find(event => event.transactionHash === guestTxHash);
    return !!event && amount.lte(event.returnValues.value);
  }
};

const checkPayment = (booking) => {
  const verify = verifiers[booking.currency];
  return !!verify && verify(booking);
};

module.exports.verifyTransactions = async () => {
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${SECRET}`,
    'Content-Type': 'application/json'
  };

  // Get bookings from /unverified
  const response = await fetch(`${BEENEST_SERVER}/beenest/v2/bookings/unverified`, {
    headers,
    method: 'GET'
  });

  if (response.status !== 200) {
    throw new Error(response.statusText);
  }

  // Split out into paid or expired
  const bookings = await response.json();
  const paid = [];
  const unpaid = [];

  for (let booking of bookings.filter(({ guestTxHash }) => !!guestTxHash)) {
    const isPaid = await checkPayment(booking);
    (isPaid ? paid : unpaid).push(booking);
  }

  // Advance or expire bookings
  await fetch(`${BEENEST_SERVER}/beenest/v2/bookings/verify_transactions`, {
    headers,
    method: 'POST',
    body: JSON.stringify(paid.map(({ id }) => id))
  });
  await fetch(`${BEENEST_SERVER}/beenest/v2/bookings/expire_transactions`, {
    headers,
    method: 'POST',
    body: JSON.stringify(unpaid.map(({ id }) => id))
  });
};
