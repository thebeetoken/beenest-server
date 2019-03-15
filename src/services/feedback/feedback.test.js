const testUtils = require('../../lib/testUtils');
const { FeedbackService } = require('./feedback');

describe('Feedback Service', () => {

  beforeAll(() => (
    Promise.all([testUtils.initializeDatabase()])
  ));

  test('create', async () => {
    expect.assertions(1);

    let feedback = await FeedbackService.create({feedback: 'test feedback text', nps: 5.0});
    expect(feedback.id).not.toEqual(null);
  });
});
