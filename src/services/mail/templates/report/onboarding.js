const beemail = require('../beemail');
const settings = require('../../../../../config/settings');

module.exports = ({ hosts, listings, hasCalendar, date }) => beemail({
  greeting: 'Hello',
  introduction: `<p>Report generated ${date}.</p>`,
  instructions: `
    <h1>Incomplete Host information:</h1>
    ${hosts.length < 1 ? '<p>No incomplete hosts identified.</p>' : `
    <ul>${hosts.map(host => `
      <li>
        <a href="${settings.beenestHost}/admin/users/${host.id}/edit">
          ${host.id}
        </a>
      </li>
      <ul>
        ${host.about ? '' : '<li>Missing bio</li>'}
        ${host.profilePicUrl ? '' : '<li>Missing profile pic</li>'}
        ${host.stripeCustomerId ? '' : '<li>Missing stripe account</li>'}
        ${host.walletAddress ? '' : '<li>Missing wallet address</li>'}
      </ul>
    `).join('\n')}</ul>`}

    <h1>Incomplete Listing information:</h1>
    ${listings.length < 1 ? '<p>No incomplete listings identified.</p>' : `
    <ul>${listings.map(listing => `
      <li>
        <a href="${settings.beenestHost}/admin/listings/${listing.id}/edit">
          ${listing.id}
        </a>
      </li>
      <ul>
        ${listing.addressLine1 ? '' : '<li>Missing/incomplete address (line 1)</li>'}
        ${listing.city ? '' : '<li>Missing/incomplete address (city)</li>'}
        ${listing.country ? '' : '<li>Missing/incomplete address (country)</li>'}
        ${listing.photos && listing.photos.length >= 2 ? '' : '<li>Missing/too few photos</li>'}
        ${hasCalendar[listing.id] ? '' : '<li>Missing ical link</li>'}
      </ul>
    `).join('\n')}</ul>`}
  `
});
