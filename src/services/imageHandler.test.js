const testUtils = require('../lib/testUtils');
const imageHandler = require('./imageHandler');

describe('imageHandler', () => {

  test('getResizedImageUrl not on s3 should return the same url', () => {
    let url = 'https://farm2.staticflickr.com/1756/27553462267_d552712dec_k_d.jpg';
    expect(imageHandler.getResizedImageUrl(url)).toBe(url);
  });

  test('getResizedImageUrl should replace the width and height of images that have default dimensions saved', () => {
    let url = 'https://d9lhrxmc0upxv.cloudfront.net/fit-in/1080x810/images/listings/01-outside-01-COVER.jpg';
    let expected = 'https://d9lhrxmc0upxv.cloudfront.net/fit-in/210x110/images/listings/01-outside-01-COVER.jpg';
    expect(imageHandler.getResizedImageUrl(url, 210, 110)).toBe(expected);
  });

  test('getResizedImageUrl should return resized url', () => {
    let url = 'https://s3-us-west-2.amazonaws.com/beenest-public/images/listings/01-outside-01-COVER.jpg';
    let expected = 'https://d9lhrxmc0upxv.cloudfront.net/fit-in/1080x810/images/listings/01-outside-01-COVER.jpg';
    expect(imageHandler.getResizedImageUrl(url)).toBe(expected);
  });

});
