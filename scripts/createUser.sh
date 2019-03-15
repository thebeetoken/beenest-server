#!/usr/bin/env node

const program = require('commander');
const { UserService } = require('../src/services/user');

function main({ firstName, lastName, email, phoneNumber, password}) {
  UserService.adminCreateHost({firstName, lastName, email, phoneNumber, password}).then(user => {
    console.log(`${user.id} ${user.email}`);
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(-1);
  });
}

program
  .version('1.0')
  .option('--firstName <firstName>', 'first name')
  .option('--lastName <lastName>', 'last name')
  .option('--email <email>', 'email')
  .option('--phoneNumber <phoneNumber>', 'phone')
  .option('--password <password>', 'password')
  .parse(process.argv);

main(program);
