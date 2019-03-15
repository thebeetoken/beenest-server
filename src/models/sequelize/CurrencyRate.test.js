const testUtils = require('../../lib/testUtils');
const { CurrencyRate } = require('./index');

describe('CurrencyRate', () => {

    beforeAll(() => {
        return testUtils.initializeDatabase();
    });

    afterAll(() => {
        return testUtils.clearDatabase();
    });

    test('save() should save', () => {
      const ethCurrencyRate = CurrencyRate.build({id: CurrencyRate.ETH, toUsd: 500});

      ethCurrencyRate.save().then(currencyRate => {
          expect(currencyRate.id).toBe(CurrencyRate.ETH);
      });
    });

});
