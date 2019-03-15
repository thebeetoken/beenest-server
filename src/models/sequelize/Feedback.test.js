const testUtils = require('../../lib/testUtils');
const { Feedback } = require('./index');

describe('Feedback', () => {

    beforeAll(() => {
        return testUtils.initializeDatabase();
    });

    afterAll(() => {
        return testUtils.clearDatabase();
    });

    test('save() should fail with negative nps', () => {
      const text = 'great work';
      const feedback = Feedback.buildWithMetaFields({feedback: text, nps: -1});

      expect.assertions(1);
      return expect(feedback.save()).rejects.toThrow(/Validation min on nps failed/);
    });

    test('save() should save', () => {
      const text = 'great work';
      const opts = {
        email: 'bea@thebeetoken.com',
        feedback: text,
        firstName: 'Bea',
        ipAddressData: { ip: '64.71.8.130' },
        nps: 10,
      };
      const feedback = Feedback.buildWithMetaFields(opts);

      return feedback.save().then(feedback => {
          expect(feedback.id).not.toBe(null);
          expect(feedback.feedback).toBe(text);
      });
    });

});
