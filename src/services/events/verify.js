const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_SIX_HOURS = 36 * 60 * 60 * 1000;

// For floating point comparison
const CLOSE_ENOUGH = 0.999;

const feeVerifier = (key, booking, details) =>
  booking.cancellationFee >= (details[key] * CLOSE_ENOUGH);
const checkInVerifier = (key, booking, details) => {
  const timeDifference = booking[key].getTime() - details[key].getTime();
  return timeDifference >= 0 && timeDifference <= SEVEN_DAYS;
};
const checkOutVerifier = (key, booking, details) => {
  const timeDifference = details[key].getTime() - booking[key].getTime();
  return timeDifference >= 0 && timeDifference <= THIRTY_SIX_HOURS;
}
const addressVerifier = (key, booking, details) =>
  booking[key].toLowerCase() === details[key].toLowerCase();
const defaultVerifier = (key, booking, details) =>
  booking[key] === details[key];

const verifiers = {
  cancellationFee: feeVerifier,
  checkInDate: checkInVerifier,
  checkOutDate: checkOutVerifier,
  guestWalletAddress: addressVerifier,
  hostWalletAddress: addressVerifier,
};

module.exports = (booking, details) => Object.keys(details).filter(key => {
  try {
    return !(verifiers[key] || defaultVerifier)(key, booking, details);
  } catch (e) {
    return true;
  }
}).reduce((mismatches, key) => ({
  [key]: { emitted: details[key], booked: booking[key] },
  ...mismatches
}), {});
