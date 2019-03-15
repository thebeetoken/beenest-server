const server = require('supertest');
const app = require('../../server');
const testUtils = require('../../lib/testUtils');
const CurrencyRate = require('../../models/sequelize').CurrencyRate;

describe('/v2/currencies', () => {
  beforeAll(() => {
    return testUtils.initializeDatabase().then(() => {
      return testUtils.createCurrencyRateModels();
    });
  });

  test('PUT /v2/currencies/ETH will update ETH prices', () => {
    expect.assertions(2);
    const token = 'dev-price-update-secret';
    const path = '/beenest/v2/currencies/ETH';

    return server(app)
      .put(path)
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .set('Authorization', `Bearer ${token}`)
      .send({toUsd: 100})
      .then(response => {
        expect(response.statusCode).toBe(200);
        expect(response.body.currencyRate.toUsd).toBe(100);
      });
  });
});
