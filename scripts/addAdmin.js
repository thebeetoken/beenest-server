const { _ } = require('minimist')(process.argv.slice(2));
const isEmail = require('validator/lib/isEmail');
const { FirebaseService } = require('../src/services/firebase/firebase');

// How to run
// node scripts/addAdmin xx@beetoken.com

(async () => {
  try {
    const users = await Promise.all(
      _.filter(email => {
        return (
          isEmail(email) &&
          (email.endsWith('@beetoken.com') ||
            email.endsWith('@thebeetoken.com'))
        );
      }).map(email => FirebaseService.getUserByEmail(email))
    );
    await Promise.all(users.map(({ uid }) => FirebaseService.setAdmin(uid)));
    process.exit(0);
  } catch (error) {
    console.error('Error in setting Admin privileges');
    console.error(error);
    process.exit(-1);
  }
})();
