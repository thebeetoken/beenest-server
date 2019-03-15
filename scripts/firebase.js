if (process.env.APP_ENV === 'production') {
  console.log('Can not run in production');
  process.exit(-1);
}

const admin = require('firebase-admin');
const { FIREBASE_CONFIG, FIREBASE_URL } = require('../config/firebase');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_CONFIG),
    databaseURL: FIREBASE_URL,
  });
}

function deleteFirebaseUsers() {
  return admin
    .auth()
    .listUsers(1000)
    .then(async ({ users }) => {
      await Promise.all(
        users.map(user => {
          const { uid } = user.toJSON();
          return admin.auth().deleteFirebaseUsers(uid);
        })
      );
      return users.length;
    })
    .catch(error => console.log('error in deleting', error));
}

async function callDeleteFirebase(count = 0, total = 0) {
  if (count > 1000) {
    return console.log(`Deleted ${10 * count} users`);
  }
  const deletedUsersCount = await deleteFirebaseUsers();
  const amountDeleted = total + deletedUsersCount;
  await new Promise(resolve => setTimeout(resolve, 1200));
  console.log(
    `Currently on count: ${count}, successfully deleted a total of ${amountDeleted} users`
  );
  return callDeleteFirebase(++count, amountDeleted);
}

callDeleteFirebase().then(() => process.exit(0));
