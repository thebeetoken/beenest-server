const AWS = require('aws-sdk');
const shortuuid = require('short-uuid');
const numericaluuid = shortuuid('0123456789');
const jimp = require('jimp');
const multer = require('multer');
const photos = require('express').Router();
const storage = multer.memoryStorage();
const { User } = require('../../models/sequelize');
const firebase = require('../../services/firebase');
const s3 = new AWS.S3();
const logger = require('./../../services/logger');
const maxSize = 1024 * 1024 * 5; // ~5mb
const uploadPhotos = multer({
  storage: storage,
  limits: { fileSize: maxSize }
});

// Setup authenticated routes
photos.use(firebase.ensureAuthenticated);

// bucketName points to a specific bucket in s3
const publicBucketName = 'beenest-public/images/users';
const privateBucketName = 'beenest-private/images/users';

const awsParams = Object.freeze({
  Bucket: publicBucketName, // Pointer to a s3 bucket
  ContentType: 'image/jpg', // MIME Type
  ACL: 'public-read', // Allow read access and to load file to the browser instead of downloading the file
  CacheControl: 'no-cache',
  Expires: new Date()
});

const awsParamsPrivate = Object.freeze({
  Bucket: privateBucketName,
  ContentType: 'image/jpg',
  ACL: 'private',
  CacheControl: 'no-cache',
  Expires: new Date()
});

// Start helper functions
const uploadToS3 = (awsParamsObject) => {
  logger.info('in uploadtos3');
  let photoUrl = awsParamsObject.ACL === 'public-read' ? 'https://s3-us-west-2.amazonaws.com/beenest-public/' : 'https://s3-us-west-2.amazonaws.com/beenest-private/'
  return new Promise((resolve, reject) => {
    s3.upload(awsParamsObject, (err, success) => {
      if (err) {
        logger.info(err);
        return reject(err);
      }

      photoUrl = `${photoUrl}${success.Key}`;
      resolve(photoUrl);
    });
  });
}

const imageToBufferPromise = (fileBuffer) => {
  // Create and return a buffer as a promise
  return new Promise((resolve, reject) => {
    // Read file buffer from front end
    return jimp.read(fileBuffer, (err, image) => {
      if (err) {
        return reject(err);
      }
      // Get file buffer and convert it to jpeg buffer
      image.getBuffer(jimp.MIME_JPEG, (err, buffer) => {
        if (err) {
          return reject(err);
        }
        // Return jpeg buffer promise
        resolve(buffer);
      });
    });
  });
}
// End helper functions

photos.post('/', uploadPhotos.single('file'), (req, res, next) => {
  // Obtain userId
  const userId = res.locals.user.id || res.locals.user.userId;
  const validImageTypes = ['image/jpg', 'image/jpeg', 'image/png'];
  let photoUrl;
  // Send returned jpeg buffer promise to imagemin to compress
  imageToBufferPromise(req.file.buffer)
    .then((newBuffer) => {
      // Set AWS Key and Body
      let s3Params = {
        Key: `${userId}.jpg`, // Name of the file
        Body: newBuffer  // File you are uploading
      }
      // copy over PUBLIC s3 params
      s3Params = Object.assign(s3Params, awsParams)
      // Upload to s3
      return uploadToS3(s3Params);
    })
    .then((imageUrl) => {
      photoUrl = imageUrl;
      return User.update({id: userId}, { profilePicUrl: imageUrl });
    })
    .then(rowsUpdated => {
      if (rowsUpdated == 0) {
        return Promise.reject(new Error('Could not update profile photo.'));
      }

      return res.json({ profilePhoto: photoUrl });
    })
    .catch(next);
});

// upload listing cover photo
photos.post('/upload', uploadPhotos.single('file'), (req, res, next) => {
  const newUuid = numericaluuid.new();
  const shortenedUuid = newUuid.substring(0, newUuid.length - 8) + 'a';
  const validImageTypes = ['image/jpg', 'image/jpeg', 'image/png'];
  let photoUrl;
  // Send returned jpeg buffer promise to imagemin to compress
  imageToBufferPromise(req.file.buffer)
    .then((newBuffer) => {
      // Set AWS Key and Body
      let s3Params = {
        Key: `${shortenedUuid}.jpg`, // Name of the file
        Body: newBuffer  // File you are uploading
      }
      // copy over PUBLIC s3 params
      s3Params = Object.assign(s3Params, awsParams)
      // Upload to s3
      return uploadToS3(s3Params);
    })
    .then((imageUrl) => {
      photoUrl = imageUrl;
      return res.json({  photoUrl });
    })
    .catch(next);
});

module.exports = photos;
