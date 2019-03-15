#!/usr/bin/env node
const { _ } = require('minimist')(process.argv.slice(2));
const ReportService = require('../src/services/report');

(async () => {
  try {
    await ReportService.sendOnboardingReport(_[0]);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(-1);
  }
})();

