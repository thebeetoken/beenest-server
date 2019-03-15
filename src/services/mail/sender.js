const AWS = require('aws-sdk');
const SES_REGIONID = process.env.COGNITO_REGION || 'us-west-2';
const CCS = [
  'tommy@beetoken.com',
  'kevin@beetoken.com',
  'jeremy@beetoken.com',
  'vic@beetoken.com',
];

if (process.env.APP_ENV !== 'test') {
  AWS.config.update({ region: SES_REGIONID });
}

const parameterize = ({ ccs, html, subject, from, to, replyTo}) => ({
  Destination: {
    /* required */
    BccAddresses: ccs ? [...ccs, ...CCS] : CCS,
    ToAddresses: [to]
  },
  Message: {
    /* required */
    Body: {
      /* required */
      Html: {
        Charset: 'UTF-8',
        Data: html
      }
    },
    Subject: {
      Charset: 'UTF-8',
      Data: subject
    }
  },
  Source: from || 'no-reply@beenest.com' /* required */,
  ReplyToAddresses: [replyTo || 'support+booking@beenest.com']
});

module.exports = (process.env.APP_ENV !== 'test') ? {
  send: options => new AWS.SES({ apiVersion: '2010-12-01' })
    .sendEmail(parameterize(options))
    .promise()
} : { send: () => Promise.resolve(true) };
