const users = require('express').Router();
const dao = require('../../models/dao');
const User = require('../../models/sequelize').User;
const authenticatedRoutes = require('express').Router();
const cognito = require('../../services/cognito');
const firebase = require('../../services/firebase');

// setup authenticated routes
authenticatedRoutes.use(firebase.ensureAuthenticated);

// CREATE
users.post("/", function (req, res) {
  let userData = {};
  // Ensure all required fields are present
  if (!req.body.email || !req.body.firstName || !req.body.lastName || !req.body.lastName || !req.body.password) {
    e = new Error('invalid input. missing required parameter.');
    return res.status(500).send({ user: false, error: e, userId: null });
  }
  // TODO: validate body paramters
  userData.email = req.body.email;
  userData.firstName = req.body.firstName;
  userData.lastName = req.body.lastName;
  userData.password = req.body.password;

  // register new user with cognito and store user into rds
  dao.registerNewUser(userData)
    .then((usr) => {
      // respond to caller with success
      return res.status(200).send({ user: true, error: null, uuid: usr.uuid });
    })
    .catch((e) => {
      if (e.code == 'UsernameExistsException') {
        return res.status(409).send({ user: false, error: e, uuid: null });
      }
      // return error to caller
      return res.status(500).send({ user: false, error: e, uuid: null });
    });
})

// start forgotten password process
users.post("/start_forgot_password", function (req, res) {
  if (req.body.email == null) {
    res.status(500).send({ error: "missing email field" });
    return;
  }
  dao.startForgotPassword(req.body.email, function (err) {
    if (err) {
      res.status(500).send({ error: JSON.stringify(err, null, 4) });
    } else {
      res.status(200).send({ error: null });
    }
  });
})

// verify forgotten password reset
users.post("/verify_forgot_password", function (req, res) {
  if (req.body.email == null || req.body.verificationCode == null || req.body.newPassword == null) {
    res.status(500).send({ error: "missing email, verificationCode, or newPassword field" });
    return;
  }
  dao.verifyForgotPassword(req.body.email, req.body.verificationCode, req.body.newPassword, function (err) {
    if (err) {
      res.status(500).send({ error: JSON.stringify(err, null, 4) });
    } else {
      res.status(200).send({ error: null });
    }
  });
})

// fetch the current logged in user's information
/*
 * Get  information for the current user
 * 
 * Headers:
 *  + accesstoken (str): JWT
 * Response:
 *  + 200 - okay!
 *    {
 *      firstName (str)
 *      lastName (str)
 *      email (str)
 *      profilePicUrl (str)
 *      about (str)}
 *  + 500 - internal service error
 *
 */
authenticatedRoutes.get("/", function (req, res) {
  if (!res.locals.user) {
    return res.status(500).send("error locating user");
  }

  let user = {
    firstName: res.locals.user.firstName,
    lastName: res.locals.user.lastName,
    profilePicUrl: res.locals.user.profilePicUrl,
    email: res.locals.user.email,
    about: res.locals.user.about
  }
  return res.status(200).send(user);
})

authenticatedRoutes.get("/is_authenticated_detailed", function (req, res) {
  if (User.isAdminEmail(res.locals.user.email)) {
    return res.status(200).send({
      isAuthenticated: true,
      email: res.locals.user.email
    });
  }
  return res.status(500).send(false);

})

authenticatedRoutes.get("/is_authenticated", function (req, res) {
  if (!res.locals || !res.locals.user || !res.locals.user.email) {
    return res.status(500).send(false);
  }

  return res.status(200).send(true);
})

/*
 * Update information for the logged in user
 * 
 * Headers:
 *  + accesstoken (str): JWT
 * Parameters:
 *  + firstName (str)
 *  + lastName (str)
 *  + profilePicUrl (str)
 *  + about (str)
 * Response:
 *  + 200 - okay!
 *  + 500 - internal service error
 * 
 */
authenticatedRoutes.put("/", function (req, res) {
  if (!res.locals || !res.locals.user || !res.locals.user.email) {
    return res.status(500).send("unable to fetch authenticated user");
  }
  // extract out expected features
  let feats = {
    first_name: req.body.firstName,
    last_name: req.body.lastName
  };

  dao.updateUserByEmail(res.locals.user.email, feats, (err, rows) => {
    if (err) {
      return res.status(500).send("unable to update user");
    }
    return res.status(200).send();
  });
})

// DELETE
users.delete("/:id", function (req, res) {
  res.status(200).send("deleteUser: " + req.params.id);
})

// make authenticated routes visible
users.use('/', authenticatedRoutes);

module.exports = users;
