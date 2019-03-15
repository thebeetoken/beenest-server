const sharp  = require('sharp');
const request = require('request');

const ONE_DAY = 86400000;

module.exports.handler = (event, context, callback) => {
    const url = event.queryStringParameters.url;
    const format = "jpeg";
    const width = parseInt(event.queryStringParameters.w || 200, 10) || 200;
    const height = parseInt(event.queryStringParameters.h || 200, 10) || 200;

    if (!url) {
        return context.succeed({isBase64Encoded: false, statusCode: 500, body: `No url defined`});
    }

    console.log(`GET ${url} ${width} ${height}\n`);
    request({url: url, encoding: null}, function (err, response, body) {
        if (err) {
            return context.succeed({isBase64Encoded: false, statusCode: 500, body: `Error ${err.message}`});
        }

        return sharp(body)
            .resize(width, height, { fit: "cover", gravity: "north" })
            .toFormat(format)
            .toBuffer()
            .then(data => {
                return context.succeed({
                    isBase64Encoded: true,
                    statusCode: 200,
                    headers: { 'Content-Type': `image/${format}`,
                               'Cache-Control': `public,max-age=${ONE_DAY}` },
                    body: Buffer.from(data, 'base64').toString('base64')
                });
            })
            .catch(e => {
              return context.succeed({isBase64Encoded: false, statusCode: 500, body: `Failed to rescale: ${e.message}`});
            });
    });
};
