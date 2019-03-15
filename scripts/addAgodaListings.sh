#!/usr/bin/env node
const { _ } = require('minimist')(process.argv.slice(2));
const lodash = require('lodash');
const parse = require('csv-parse');
const fs = require('fs');
const stream = require('stream');
const { AgodaListing } = require('../src/models/sequelize');

const rekey = obj => Object.keys(obj).reduce(
  (rekeyed, key) => ({ ...rekeyed, [lodash.camelCase(key)]: obj[key] }),
  {}
);

class AgodaListingStream extends stream.Writable {
  constructor(skip = 0) {
    super({ objectMode: true });
    this.skip = skip;
  }

  async _write(chunk, encoding, next) {
    if (chunk['\uFEFFhotel_id'] > this.skip) {
      try {
        await AgodaListing.upsert({ id: chunk['\uFEFFhotel_id'], ...rekey(chunk) });
      } catch (e) {
        console.error(`Error writing ${chunk['\uFEFFhotel_id']}: ${e.message}`);
      }
    }
    next();
  }
}

const addAgodaListings = (csvFile, skip) => new Promise((resolve, reject) =>
  fs.createReadStream(csvFile, 'utf8')
    .pipe(parse({ columns: true }))
    .pipe(new AgodaListingStream(skip))
    .on('end', resolve)
    .on('error', reject)
);

addAgodaListings(_[0], _[1]).then(() => process.exit(0));
