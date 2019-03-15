#!/usr/bin/env node

const program = require('commander');

const { User } = require('../src/models/sequelize');
const { CreditService } = require('../src/services/credit');


function main({ email, amount }) {
  User.findOne({ where: { email } })
    .then(user => {
      return CreditService.creditToBalance(user, amount);
    })
    .then(creditBalance => {
      console.log(creditBalance.toJSON());
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(-1);
    });
}

program
  .version('1.0')
  .option('--email <email>', 'email')
  .option('--amount <amount>', 'amount')
  .parse(process.argv);

main(program);
