const { PaymentSource } = require('../../models/sequelize');

class PaymentSourceService {
  getPaymentSourcesByUserId(userId) {
    return PaymentSource.findAll({ where: { userId }});
  }
}

module.exports = { PaymentSourceService: new PaymentSourceService() };
