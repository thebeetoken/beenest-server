const User = require('./sequelize').User;

/*
 * Adds a user to RDS
 *
 * Input:
 *  user: {uuid: str,
 *         email: str,
 *         firstName: str,
 *         lastName: str }
 * Output:
 *   Promise<User, Error>
 */
function addUserToRDS(opts) {
  return User.create({id: opts.uuid, email: opts.email, firstName: opts.firstName, lastName: opts.lastName});
}

function fetchUserById(userId, callback) {
  if (callback) {
    return User.findById(userId).then(user => {
      callback(null, user);
    }).catch(callback);
  }

  return User.findById(userId);
};

function updateUser(userId, feats, callback) {
  if (callback) {
    User.update(feats, {where: {id: userId}}).then(user => {
      return callback(null, user);
    }).catch(callback);
  }

  return User.update(feats, {where: {id: userId}});
};

function updateUserByEmail(userEmail, feats, callback) {
  User.update(feats, {where: {email: userEmail}}).then(user => {
    return callback(null, [user]);
  }).catch(callback);
};

/*
* Fetches user from RDS and syncs with firebase record.
*/
function fetchAndSyncUserById(id, firebaseData) {
  const email = firebaseData.email || `firebase--${id}@facebook-no-phone.com`;
  const firstName = firebaseData.firstName;
  const lastName = firebaseData.lastName;

  return fetchUserById(id)
    .then(user => {
      if (user) {
        return user;
      }

      // create new user in db
      return addUserToRDS({ uuid: id, firstName: firstName, lastName: lastName, email: email });
  });
}

module.exports.fetchUserById = fetchUserById;
module.exports.updateUser = updateUser;
module.exports.updateUserById = updateUser;
module.exports.updateUserByEmail = updateUserByEmail;
module.exports.addUserToRDS = addUserToRDS;
module.exports.fetchAndSyncUserById = fetchAndSyncUserById;
