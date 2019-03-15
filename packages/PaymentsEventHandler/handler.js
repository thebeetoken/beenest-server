const Web3 = require('web3');
const fetch = require('node-fetch');

const {
  ADMIN_SECRET,
  BEENEST_API_SERVER,
  INFURA_URL,
  PAYMENTS_CONTRACT_ADDRESS
} = process.env;

// These are deployment block numbers, to bound query times.
const FROM_BLOCK = INFURA_URL.includes('ropsten') ? 4537101 : 6803255;

[
  'ADMIN_SECRET',
  'BEENEST_API_SERVER',
  'INFURA_URL',
  'PAYMENTS_CONTRACT_ADDRESS'
].forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} undefined.`);
  }
});

const PAYMENTS_ABI = require('./Payments-ABI.json');
const web3 = new Web3(Web3.givenProvider || INFURA_URL);
const payments = new web3.eth.Contract(PAYMENTS_ABI, PAYMENTS_CONTRACT_ADDRESS);
const headers = {
  Accept: 'application/json',
  Authorization: `Bearer ${ADMIN_SECRET}`,
  'Content-Type': 'application/json'
};

module.exports.handleEvents = async () => {
  const response = await fetch(`${BEENEST_API_SERVER}/beenest/v2/events`, {
    headers,
    method: 'GET'
  });
  const { blockNumber } = await response.json();

  const events = await payments.getPastEvents(
    'allEvents',
    { fromBlock: (blockNumber || FROM_BLOCK) + 1 }
  );

  for (let event of events) {
    await fetch(`${BEENEST_API_SERVER}/beenest/v2/events`, {
      headers,
      method: 'POST',
      body: JSON.stringify(event)
    });
  }
};
