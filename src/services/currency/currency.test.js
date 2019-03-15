const testUtils = require('../../lib/testUtils');
const { CurrencyService } = require('./currency');
const { CurrencyRate } = require('../../models/sequelize');

describe('CurrencyService', () => {
  const testCurrency = 'FOO';
  const testRate = 12321;
  
  beforeAll(() => testUtils.initializeDatabase());
  
  afterEach(() => CurrencyRate.destroy({ where: {} }));

  test('creates currency rates', async () => {
    await CurrencyService.setExchangeRate(testCurrency, testRate);
    const rate = await CurrencyRate.findById(testCurrency);
    expect(rate.toUsd).toEqual(testRate);
  });
  
  test('updates currency rates', async () => {
    await CurrencyRate.create({ id: testCurrency, toUsd: 0 });
    await CurrencyService.setExchangeRate(testCurrency, testRate);
    const rate = await CurrencyRate.findById(testCurrency);
    expect(rate.toUsd).toEqual(testRate);    
  });
  
  test('provides currency rate', async () => {
    await CurrencyRate.create({ id: testCurrency, toUsd: testRate });
    const currencyRate = await CurrencyService.getCurrencyRate(testCurrency);
    expect(currencyRate.id).toEqual(testCurrency);
    expect(currencyRate.toUsd).toEqual(testRate);
  });
});
