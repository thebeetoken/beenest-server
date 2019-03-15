const beemail = require('../beemail');
const settings = require('../../../../../config/settings');

module.exports = ({ dates, weeklies, totals }) => beemail({
  greeting: 'Buzz buzz y\'all!',
  introduction: `
    <h4>${dates}</h4>
    <ul>
      ${Object.entries(weeklies).map(([key, value]) => `
        <li>${key}, ${value}</li>
      `).join('\n')}
    </ul>

    <h4>Total</h4>
    <ul>
      ${Object.entries(totals).map(([key, value]) => `
        <li>${key}, ${value}</li>
      `).join('\n')}
    </ul>
    <h5>${settings.appEnv}</h5>
  `
});
