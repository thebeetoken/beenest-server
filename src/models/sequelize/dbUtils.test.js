const testUtils = require('../../lib/testUtils');
const dbUtils = require('./dbUtils');
const Sequelize = require('sequelize');

describe('dbUtils', () => {
    test('validateMetaFields with invalid field should throw exception', () => {
        const schema = {
            type: 'object',
            properties: {
                firstName: {type: 'string'},
                phone: {type: 'number'}
            }
        }
        const meta = {firstName: 'john', phone: 'galt'};

        try {
            const results = dbUtils.validateMetaFields(schema, meta);
            expect(results).toBe(false);
        } catch (error) {
            expect(error).not.toBe(undefined);
        }
    });

    test('validateMetaFields with valid fields should not throw exception', () => {
        const schema = {
            type: 'object',
            properties: {
                firstName: {type: 'string'},
                lastName: {type: 'string'}
            }
        };
        const meta = {firstName: 'john', lastName: 'galt'};

        try {
            dbUtils.validateMetaFields(schema, meta);
        } catch (error) {
            expect(error).toBe(undefined);
        }
    });

    test('jsonFormat should camelcase and merge meta fields', () => {
        const instance = {
            id: 1,
            listingId: 2,
            meta: {
                firstName: 'john',
                lastName: 'galt'
            }
        };

        const json = dbUtils.jsonFormat(instance);
        expect(json.firstName).toBe(instance.meta.firstName);
        expect(json.lastName).toBe(instance.meta.lastName);
    });

    test('generates virtual properties from a schema', () => {
        const schema = {
            type: 'object',
            properties: {
                firstName: {type: 'string'},
                lastName: {type: 'string'},
                phone: {type: 'number'}
            }
        };
        const virtualProperties = dbUtils.virtualProperties(schema);
        Object.keys(schema.properties)
          .forEach(prop => expect(virtualProperties[prop]).toEqual({
              type: Sequelize.VIRTUAL,
              get: expect.any(Function),
              set: expect.any(Function)
          }));
    });
});

