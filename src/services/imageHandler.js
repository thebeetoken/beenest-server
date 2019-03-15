const { URL } = require('url');

const imageHandler = {
  PROD_HOST: 'https://d9lhrxmc0upxv.cloudfront.net',
  DEFAULT_RESIZE: '1080x810',

  getResizedImageUrl: (url, width = 1080, height = 810) => {
    if (!url) {
      return undefined;
    }

    if (url.startsWith(imageHandler.PROD_HOST) && url.includes('1080x810')) {
      return url.replace(imageHandler.DEFAULT_RESIZE, `${width}x${height}`);
    }

    if (!url.startsWith('https://s3-us-west-2.amazonaws.com/beenest-public/')) {
      return url;
    }

    const urlObject = new URL(url);
    const s3Path = urlObject.pathname.replace('/beenest-public/', '');
    return `${imageHandler.PROD_HOST}/fit-in/${width}x${height}/${s3Path}`;
  },
};

module.exports = imageHandler;
