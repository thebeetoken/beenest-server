const routes = require('express').Router();
const authenticatedRoutes = require('express').Router();
const firebase = require('../../services/firebase');
const { User } = require('../../models/sequelize');

authenticatedRoutes.use(firebase.ensureAuthenticatedAndTrusted);

// fetch the current logged in user's information
/*
 * Get  information for the current user
 *
 * Headers:
 *  + Authorization (str): JWT
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
routes.get("/", function (req, res, next) {
  if (!res.locals.user) {
    return next(new Error("error locating user"));
  }

  let user = {
    firstName: res.locals.user.firstName,
    lastName: res.locals.user.lastName,
    profilePicUrl: res.locals.user.profilePicUrl,
    email: res.locals.user.email,
    about: res.locals.user.about
  }
  return res.json(user);
});

/* confirm that the user has finished the verification flow */
routes.post("/confirm_finished", (req, res, next) => {
  firebase.extractJWT(req)
    .then(token => {
      return firebase.getUserByIdToken(token);
    })
    .then(userRecord => {
      return User.update(
        { completedVerification: true },
        { where: { id: userRecord.uid }, returning: true }
      );
    })
    .then(() => {
      return res.json({ msg: "You completed the verification" })
    }).catch(next);
});

routes.use('/', authenticatedRoutes);
module.exports = routes;

