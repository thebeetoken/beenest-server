const { Feedback } = require('../../models/sequelize');

class FeedbackService {
  getAll() {
    return Feedback.findAll({ order: [['id', 'DESC']] });
  }

  create(feedbackOpts) {
    const feedback = Feedback.buildWithMetaFields(feedbackOpts);
    return feedback.save();
  }
}

module.exports = { FeedbackService: new FeedbackService() };
