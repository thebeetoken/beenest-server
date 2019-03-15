process.env.AWS_XRAY_CONTEXT_MISSING = 'LOG_ERROR';

const AWSXRay = require('aws-xray-sdk');
AWSXRay.captureHTTPsGlobal(require('http'));
AWSXRay.capturePromise();

module.exports = AWSXRay;
