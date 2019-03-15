const _ = require('lodash');
const dbUtils = require('./dbUtils');

module.exports = (sequelize, DataTypes) => {
  const Booking = sequelize.import('booking', require('../sequelize/Booking'));
  
  // TODO, move unindex fields to meta field
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      about: {
        type: 'string'
      },
      btcWalletAddress: {
        type: 'string',
      },
      stripeCustomerId: {type: 'string'},
      stripeAccountInfo: {
        accessToken: {type: 'string'},
        livemode: {type: 'boolean'},
        refreshToken: {type: 'string'},
        tokenType: {type: 'string'},
        stripePublishableKey: {type: 'string'},
        stripeUserId: {type: 'string'},
        scope: {type: 'string'}
      },
      updatedBy: { type: 'string' }
    }
  };

  const User = sequelize.define(
    'user',
    {
      id: {
        type: DataTypes.STRING(36),
        primaryKey: true,
        field: 'id'
      },
      displayName: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return this.firstName;
        }
      },
      email: {
        type: DataTypes.STRING,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      firstName: {
        type: DataTypes.STRING(50),
        field: 'first_name',
        validate: {
          len: [1, 50]
        }
      },
      fullName: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return `${this.firstName} ${this.lastName}`;
        }
      },
      lastName: {
        type: DataTypes.STRING(50),
        field: 'last_name',
        validate: {
          len: [1, 50]
        }
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

      profilePicUrl: {
        type: DataTypes.STRING,
        field: 'profile_pic_url'
      },

      // eth wallet address
      walletAddress: {
        type: DataTypes.STRING(50),
        field: 'wallet_address'
      },

      ethWalletAddress: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return this.walletAddress;
        }
      },

      about: {
        type: DataTypes.TEXT,
      },

      supportEmail: {
        type: DataTypes.STRING,
        field: 'support_email'
      },

      completedVerification: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'completed_verification'
      },

      listingCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'listing_count'
      },

      isHost: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return !!this.listingCount;
        }
      },

      meta: {
        type: DataTypes.JSON,
        validate: {
          isValidField(value) {
            dbUtils.validateMetaFields(META_JSON_SCHEMA, value);
          }
        }
      },
      ...(dbUtils.virtualProperties(META_JSON_SCHEMA))
    },
    {
      tableName: 'users',
      freezeTableName: true
    }
  );

  /**
   * Separates fields into the meta fields
   **/
  User.buildWithMetaFields = function(opts) {
    const user = User.build(opts);
    user.meta = {
      about: opts.about || undefined
    };
    return user;
  };

  User.prototype.toJSON = function(opts = {}) {
    const values = dbUtils.jsonFormat(this.get());
    values.phoneNumber = this.phoneNumber; // need to assign here since phoneNumber isn't in our db schema

    if (this.meta && this.meta.stripeAccountInfo && this.meta.stripeAccountInfo.stripeUserId) {
      values.stripeAccountDashboardLink = process.env.APP_ENV === 'production'
      ? `https://dashboard.stripe.com/connect/accounts/${this.meta.stripeAccountInfo.stripeUserId}`
      : `https://dashboard.stripe.com/test/connect/accounts/${this.meta.stripeAccountInfo.stripeUserId}`;
    }
    
    const STRIPE_PROPERTIES = [
      'stripeAccountDashboardLink',
      'stripeAccountInfo',
    ];
    const CONTACT_PROPERTIES = [
      'email',
      'phoneNumber',
    ];
    const privileged = opts.requestor && (opts.requestor.isAdmin() || opts.requestor.id === this.id);
    const contactPrivilege = privileged || Booking.grantsContactPrivilege({ from: this, to: opts.requestor, booking: opts.booking});
    const stripePrivilege = privileged;
    const omitArray = [
      ...(stripePrivilege ? [] : STRIPE_PROPERTIES),
      ...(contactPrivilege ? [] : CONTACT_PROPERTIES),
    ];

    return _.omit(values, omitArray);
  }

  User.prototype.isAdmin = function() {
    // since we allow anyone to create an account without
    // verifying first, we need to ensure admin access to
    // those who verified their emails
    if (process.env.APP_ENV === 'production') {
      return User.isAdminEmail(this.email) && this.completedVerification;
    }

    return User.isAdminEmail(this.email);
  };

  User.isAdminEmail = function(email) {
    if (!email) {
      return false;
    }
    return email.endsWith('@thebeetoken.com') || email.endsWith('@beetoken.com') || email.endsWith('@beenest.com');
  }

  User.prototype.updateListingCount = function (listingCount) {
    if ((!listingCount && listingCount !== 0) || listingCount < 0) {
      throw new Error('Please provide a non-negative listingCount');
    }

    this.listingCount = listingCount;

    return this.save();
  }

  User.prototype.updateStripeAccountInfo = function(stripeAccountInfo) {
    // we use || for stripeAccountInfoMetaData properties because we store the meta data
    // as camelCase internally, but stripe gives it back to us as snake case
    const stripeAccountInfoMetaData = {
      accessToken: stripeAccountInfo.accessToken || stripeAccountInfo.access_token,
      livemode: stripeAccountInfo.liveMode || stripeAccountInfo.live_mode,
      refreshToken: stripeAccountInfo.refreshToken || stripeAccountInfo.refresh_token,
      tokenType: stripeAccountInfo.tokenType || stripeAccountInfo.token_type,
      stripePublishableKey: stripeAccountInfo.stripePublishableKey || stripeAccountInfo.stripe_publishable_key,
      stripeUserId: stripeAccountInfo.stripeUserId || stripeAccountInfo.stripe_user_id,
      scope: stripeAccountInfo.scope
    };

    this.meta = {
      ...this.meta,
      stripeAccountInfo: stripeAccountInfoMetaData,
    };

    return this.save();
  };

  User.prototype.updateStripeCustomerId = function(customer) {
    if (this.meta) {
      this.meta = {
        ...this.meta,
        stripeCustomerId: customer.id
      }
    } else {
      this.meta = { stripeCustomerId: customer.id };
    }

    return this.save();
  }

  User.prototype.canEdit = function (listing) {
    return this.isAdmin() || listing.hostId === this.id;
  }

  User.prototype.canPublish = function (listing) {
    return this.canEdit(listing) && this.completedVerification && listing.canPublish;
  }

  User.prototype.hasStripeAccount = function() {
    return !!_.find(this, 'meta.stripeAccountInfo.stripeUserId');
  }

  return User;
};
