const beemail = require('../beemail');
const settings = require('../../../../../config/settings');

module.exports = ({ event, id, deltas }) => beemail({
  greeting: 'Hello',
  introduction: `
    A ${event} event was issued from our payments contract which did not match
    booking information in the database.
  `,
  instructions: `
    <p><b>Differences:</b></p>
    <ul>
    ${Object.entries(deltas).map(([key, pair]) => {
      const { emitted, booked } = pair;
      return `<li>${key}: ${booked} (in Booking), ${emitted} (in ${event})</li>`;
    }).join('\n')}
    </ul>
  `,
  conclusion: `
    Please consult with engineering to identify the source of the issue and
    any actions necessary.
  `,
  bookingId: id
});
