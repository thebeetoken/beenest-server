module.exports = [
  'ALREADY_LOGGED_IN',
  'INACTIVE',
  'INVALID_INPUT',
  'INVALID_STATUS',
  'LISTING_RESERVED',
  'NO_USER_FOUND',
  'NOT_AUTHORIZED',
  'NOT_FOUND',
  'NOT_LOGGED_IN',
  'PRICE_MISMATCH',
  'UNABLE_TO_DELETE',
  'UNKNOWN_CONTRACT'
].reduce((codes, code) => ({ ...codes, [code]: code }), {});
