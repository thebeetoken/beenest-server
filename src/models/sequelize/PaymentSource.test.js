const testUtils = require('../../lib/testUtils');

const PaymentSource = require('./index').PaymentSource;

describe('PaymentSource', () => {
    beforeAll(() => {
        return testUtils.initializeDatabase();
    });

    afterAll(() => {
        return testUtils.clearDatabase();
    });

    test('should save', () => {
      const opts = testUtils.createTestPaymentSourceOpts();

      return PaymentSource.create(opts).then(paymentSource => {
        expect(paymentSource.id).not.toBe(null);
        expect(paymentSource.userId).toBe(opts.userId);
      });
    });

    test('toJSON should formatted fields', () => {
      const opts = testUtils.createTestPaymentSourceOpts();

      const paymentSource = PaymentSource.build(opts);
      const json = paymentSource.toJSON();

      expect(json.userId).toBe(paymentSource.userId);
      expect(json.stripeSourceId).toBe(paymentSource.meta.stripeSourceId);
      expect(json.stripeLast4).toBe(paymentSource.meta.stripeLast4);
      expect(json.stripeBrand).toBe(paymentSource.meta.stripeBrand);
    });
});
