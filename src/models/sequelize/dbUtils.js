const logger = require('../../services/logger');
const _ = require('lodash');
const camelcaseKeys = require('camelcase-keys');
const Ajv = require('ajv');
const ajv = new Ajv();
const Sequelize = require('sequelize');

module.exports = {
  validateMetaFields: (schema, meta) => {
    const validate = ajv.compile(schema);
    const valid = validate(meta);
    if (!valid) {
      logger.error(validate.errors);
      const message = validate.errors.map(error => {
        return `${error.params.additionalProperty} ${error.message} ${error.dataPath}`;
      }).join(', ');
      throw new Error(message);
    }
    return valid;
  },
  virtualProperties: (schema) => {
    return Object.keys(schema.properties).reduce((opts, property) => ({
      ...opts,
      [property]: {
        type: Sequelize.VIRTUAL,
        get: function () {
          return (this.get('meta') || {})[property];
        },
        set: function (value) {
          this.setDataValue('meta', { ...(this.get('meta') || {}),
            [property]: value
          });
        }
      }
    }), {});
  },
  /**
   * This camelcases the meta JSON field and merges it with the parent
   **/
  jsonFormat: (values) => {
    var newValues = _.clone(values);

    if (newValues && newValues.meta) {
      var newMetaValues = camelcaseKeys(values.meta);
      newValues = _.merge(newValues, newMetaValues);
      newValues = _.omit(newValues, ['meta']);
    }

    // TODO why do duplicated underscored values retain in the values?
    newValues = _.omitBy(newValues, (value, key) => {
      const hasUnderscore = key.indexOf('_') > -1;
      const hasDuplicateUnderscoreKey = Object.keys(newValues).includes(_.camelCase(key));

      return hasUnderscore && hasDuplicateUnderscoreKey;
    });

    return newValues;
  },
};