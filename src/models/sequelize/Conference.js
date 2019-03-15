const dbUtils = require('./dbUtils');
const _ = require('lodash');

module.exports = (sequelize, DataTypes) => {
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      city: { type: 'string' },
      country: { type: 'string' },
      coverImage: {
        type: 'object',
        properties: { url: { type: 'string' } },
        additionalProperties: true
      },
      description: { type: 'string' },
      listingIds: { type: 'array', items: { type: 'integer' } },
      link: { type: 'string', format: 'uri' },
      state: { type: 'string' },
      title: { type: 'string' },
      venue: { type: 'string' },
    }
  };
  const Op = sequelize.Op;
  const Conference = sequelize.define(
    'conference',
    {
      id: {
        type: DataTypes.STRING(50),
        primaryKey: true,
        validate: { is: /^\S+$/ }
      },
      startDate: {
        type: DataTypes.DATE,
        field: 'start_date'
      },
      endDate: {
        type: DataTypes.DATE,
        field: 'end_date'
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at'
      },
      meta: {
        type: DataTypes.JSON,
        validate: {
          isValidField(value) {
            dbUtils.validateMetaFields(META_JSON_SCHEMA, value);
          }
        }
      }
    },
    {
      tableName: 'conferences',
      freezeTableName: true
    }
  );

  Conference.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };

  Conference.buildWithMetaFields = function(opts) {
    if (!opts.title || opts.title.length === 0) {
      throw new Error(`Missing Title`);
    }

    const conference = Conference.build(opts);
    conference.meta = {
      city: opts.city,
      country: opts.country,
      coverImage: opts.coverImage,
      description: opts.description,
      listingIds: opts.listingIds || [],
      link: opts.link,
      state: opts.state,
      title: opts.title,
      venue: opts.venue,
    };
    conference.id = _.kebabCase(opts.title);
    return conference;
  };

  Conference.prototype.updateWithMetaFields = function(opts) {
    const updatedConference = Object.assign(this, opts);
    updatedConference.meta = {
      city: opts.city || this.meta.city,
      country: opts.country || this.meta.country,
      coverImage: opts.coverImage || this.meta.coverImage,
      description: opts.description || this.meta.description,
      link: opts.link || this.meta.link,
      listingIds: opts.listingIds || this.meta.listingIds,
      state: opts.state || this.meta.state,
      title: opts.title || this.meta.title,
      venue: opts.venue || this.meta.venue,
    };
    return updatedConference.save();
  };

  return Conference;
};
