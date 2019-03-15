const testUtils = require('../lib/testUtils');
const idGenerator = require('./idGenerator');

describe('idGenerator', () => {

  test('generate generates an id with just chars and numbers ', () => {
    let id = idGenerator.generate();

    expect(idGenerator.isValid(id)).toBe(true);
  });

  test('generate generates an id with just chars and numbers ', () => {
    let id = idGenerator.generate();

    expect(idGenerator.isValid(id + id)).toBe(false);
  });

  test('generate generates an id with just chars and numbers ', () => {
    let id = '_' + idGenerator.generate();

    expect(idGenerator.isValid(id)).toBe(false);
  });

});
