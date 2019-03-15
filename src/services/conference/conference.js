const { Sequelize } = require('sequelize');
const { Conference } = require('../../models/sequelize');
const { Op } = Sequelize;

class ConferenceService {
  getActiveConferences() {
    return Conference.findAll({ where: { endDate: { [Op.gte]: new Date() } } });
  }

  getAll() {
    return Conference.findAll({ order: [['createdAt', 'DESC']] });
  }

  getById(id) {
    return Conference.findById(id);
  }

  getFeaturedConference() {
    return Conference.findOne({ order: [['createdAt', 'DESC']] });
  }

  create(opts) {
    const conference = Conference.buildWithMetaFields(opts);
    return conference.save();
  }

  async update(input) {
    const foundConference = await this.getById(input.id);
    return foundConference.updateWithMetaFields(input);
  }

  delete(id) {
    return Conference.destroy({ where: { id }});
  }
}

module.exports = { ConferenceService: new ConferenceService() };
