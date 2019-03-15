const beemail = require('../beemail');
const settings = require('../../../../../config/settings');

const DEFAULT_PROFILE_PIC_URL = 'https://static.beenest.com/images/app/misc/profile.png';

module.exports = ({ message, sender, booking, listing }) => beemail({
  greeting: `This message was sent from Beenest member, ${sender.firstName}:`,
  introduction: message,
  instructions: `
    ${listing ? `
      <b>Listing ID: ${listing.id}</b>
      <b><a href="${settings.beenestHost}/listings/${listing.id}" target="_blank">${listing.title}</a></b>
      <br>
    ` : '' }
    ${booking ? `
      <b>Trip Receipt: ${settings.beenestHost}/trips/${booking.id}/receipt</b>
      <br>
    ` : '' }
  `,
  conclusion: `
    <div class="avatar-container">
      <img src=${sender.profilePicUrl || DEFAULT_PROFILE_PIC_URL} alt="Photo of ${sender.fullName}" width="64px" height="64px" style="border-radius: 50%;" />
    </div>
    ${sender.fullName}
  `,
  farewell: `
    Reply to ${sender.fullName} at ${sender.email}.
    <br>
    Your email address was NOT shared. If you reply to this email, you WILL be sharing your email address with ${sender.fullName}. **
  `,
  bookingId: booking && booking.id,
  listingId: listing && listing.id
});
