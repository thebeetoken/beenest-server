const _ = require('lodash');
const datefns = require('date-fns');
const dbUtils = require('./dbUtils');
const idGenerator = require('../../services/idGenerator');
const { Sequelize } = require('sequelize');
const { Op } = Sequelize;

module.exports = (sequelize, DataTypes) => {
  const CurrencyRate = sequelize.import('currency_rate', require('../sequelize/CurrencyRate'));
  
  const META_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      stripeChargeId: { type: 'string' },
      stripeRefundId: { type: 'string' },
      stripeRefundAmount: { type: 'number' },

      hostRejectedAt: { type: 'string', format: 'date-time' },
      guestCancelledAt: { type: 'string', format: 'date-time' },

      numberOfGuests: { type: 'integer' },

      pricePerNight: { type: 'number' },
      transactionFee: { type: 'number' },
      currency: { type: 'string', maxLength: 3, enum: ['BEE', 'BTC', 'USD', 'ETH'] },

      totalPrice: { type: 'number' },
      guestTotalAmount: { type: 'number' },
      guestDepositAmount: { type: 'number' },
      hostDepositAmount: { type: 'number' },

      approvedBy: { type: 'string', maxLength: 45 },
      cancelledBy: { type: 'string', maxLength: 45 },
      rejectedBy: { type: 'string', maxLength: 45 },

      // payment related
      paymentSourceProvider: { type: 'string' },
      paymentSourceId: { type: 'integer' },

      // crypto payment fields
      // erc20 network addresses
      tokenContractAddress: { type: 'string', maxLength: 45 },
      paymentProtocolAddress: { type: 'string', maxLength: 45 },

      guestWalletAddress: { type: 'string' },
      hostWalletAddress: { type: 'string' },
      btcWalletAddress: { type: 'string' },

      // step 1. guest approves that money can be taken out of account
      guestTxHash: { type: 'string', maxLength: 70 },

      // step 2. sets up payment contract with all the booking details
      initpayTxHash: { type: 'string', maxLength: 70 },

      // step 3. withdraw money from both sides and makes the transfer
      payTxHash: { type: 'string', maxLength: 70 },

      guestCancelTxHash: { type: 'string', maxLength: 70 },
      hostCancelTxHash: { type: 'string', maxLength: 70 },

      // credits related
      creditAmountBeeApplied: { type: 'number', maxLength: 70 },
      creditAmountEthApplied: { type: 'number', maxLength: 70 },
      creditAmountUsdApplied: { type: 'number', maxLength: 70 },

      // Price Quotes
      priceQuotes: {
        type: 'array',
        items: {
          type: 'object', 
          properties: {
            creditAmountApplied: { type: 'number', maxLength: 70 },
            currency: { type: 'string', maxLength: 10 },
            guestTotalAmount: { type: 'number', maxLength: 70 },
            guestTotalAmountUsd: { type: 'number', maxLength: 70 },
            pricePerNight: { type: 'number', maxLength: 70 },
            priceTotalNights: { type: 'number', maxLength: 70 },
            securityDeposit: { type: 'number', maxLength: 70 },
            transactionFee: { type: 'number', maxLength: 70 },
          }
        }
      }
    }
  };

  const Booking = sequelize.define(
    'booking',
    {
      id: {
        type: DataTypes.STRING(60),
        defaultValue: () => idGenerator.generate(),
        primaryKey: true
      },
      listingId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: 'listing_id',
        index: true,
        allowNull: false
      },
      guestId: {
        type: DataTypes.STRING(60),
        field: 'guest_id',
        index: true,
        allowNull: false
      },
      hostId: {
        type: DataTypes.STRING(60),
        field: 'host_id',
        index: true,
        allowNull: false
      },
      checkInDate: {
        type: DataTypes.DATE,
        field: 'check_in_date'
      },
      checkOutDate: {
        type: DataTypes.DATE,
        field: 'check_out_date'
      },
      cancellationFee: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return this.cancellationRate * (this.guestTotalAmount - this.guestDepositAmount);
        }
      },
      cancellationRate: {
        type: DataTypes.VIRTUAL,
        get: function () {
          if (['started', 'guest_confirmed'].includes(this.status)) {
            return 0;
          }
          const cancelledAt = this.guestCancelledAt || new Date();
          return datefns.differenceInDays(this.checkInDate, cancelledAt) > 7 ? 0.1 : 1;
        }
      },
      numberOfNights: {
        type: DataTypes.VIRTUAL,
        get: function () {
          return Math.abs(datefns.differenceInDays(this.checkInDate, this.checkOutDate));
        }
      },
      status: {
        type: DataTypes.STRING(16),
        defaultValue: 'started',
        validate: {
          len: [1, 30],
          isIn: {
            args: [
              [
                'started',
                'expired_before_guest_confirmed',
                'guest_confirmed',
                'guest_cancel_initiated',
                'guest_cancelled',
                'guest_rejected',
                'guest_rejected_payment',
                'host_rejected',
                'host_approved',
                'host_cancelled',
                'expired_before_host_approved',
                'init_pay_submitted',
                'payment_failed',
                'guest_paid',
                'host_paid',
                'dispute_initiated',
                'disputed',
                'refund_initiated',
                'refunded',
                'completed'
              ]
            ],
            msg: 'Must be a valid status'
          }
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
      tableName: 'bookings',
      freezeTableName: true
    }
  );

  Status = {
    STARTED: 'started',
    EXPIRED_BEFORE_GUEST_CONFIRED: 'expired_before_guest_confirmed',
    GUEST_CONFIRMED: 'guest_confirmed',
    GUEST_CANCEL_INITIATED: 'guest_cancel_initiated',
    GUEST_CANCELLED: 'guest_cancelled',
    GUEST_REJECTED: 'guest_rejected',
    GUEST_REJECTED_PAYMENT: 'guest_rejected_payment',
    HOST_REJECTED: 'host_rejected',
    HOST_APPROVED: 'host_approved',
    HOST_CANCELLED: 'host_cancelled',
    EXPIRED_BEFORE_HOST_APPROVED: 'expired_before_host_approved',
    INIT_PAY_SUBMITTED: 'init_pay_submitted',
    PAYMENT_FAILED: 'payment_failed',
    GUEST_PAID: 'guest_paid',
    HOST_PAID: 'host_paid',
    DISPUTE_INITIATED: 'dispute_initiated',
    DISPUTED: 'disputed',
    REFUND_INITIATED: 'refund_initiated',
    REFUNDED: 'refunded',
    COMPLETED: 'completed',
  };

  CONTACT_PRIVILEGE_STATUSES = [
    Status.COMPLETED,
    Status.HOST_APPROVED,
    Status.HOST_CANCELLED,
    Status.HOST_PAID,
    Status.REFUNDED,
  ];

  Booking.cancelStatuses = {
    CANCEL_WITHOUT_PENALTY: 'cancel_without_penalty',
    CANCEL_BEFORE_DEADLINE: 'cancel_before_deadline',
    CANCEL_AFTER_DEADLINE: 'cancel_after_deadline'
  };

  /**
   * Separates fields into the meta fields
   **/
  Booking.buildWithMetaFields = function(opts) {
    const booking = Booking.build(opts);
    booking.meta = {
      paymentSourceId: opts.paymentSourceId,
      pricePerNight: opts.pricePerNight,
      transactionFee: opts.transactionFee,
      guestDepositAmount: opts.guestDepositAmount,
      guestTotalAmount: opts.guestTotalAmount,
      numberOfGuests: opts.numberOfGuests,
      currency: opts.currency,
      creditAmountBeeApplied: opts.creditAmountBeeApplied,
      creditAmountEthApplied: opts.creditAmountEthApplied,
      creditAmountUsdApplied: opts.creditAmountUsdApplied,
    };
    return booking;
  };

  /**
   * Returns expired booking requests.
   * Input:
   *  None
   * Output:
   *  Promise<Iterator<Booking>>
   */
  Booking.findExpired = async function () {
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    const oneWeekAgo = new Date(Date.now() - oneWeekInMs);
    const today = new Date();
    const guestIdsSeen = {};
    const startedBookings = await Booking.findAll({
      order: [['createdAt', 'DESC']],
      where: { status: 'started' }
    });
    return startedBookings.filter(({ checkInDate, createdAt, guestId }) => {
      if (
        guestIdsSeen[guestId] ||
        checkInDate.valueOf() < today.valueOf() ||
        createdAt.valueOf() < oneWeekAgo.valueOf()
      ) {
        return true;
      }
      guestIdsSeen[guestId] = true;
      return false;
    });
  }

  Booking.findGuestBookingsByStatus = ({ guestId, tripStatus }) => {
    if (!guestId) {
      throw new Error('Missing guestId');
    }
    if (!tripStatus) {
      throw new Error('Missing tripStatus');
    }

    const started = [Status.STARTED];
    const cancelled = [
      Status.EXPIRED_BEFORE_HOST_APPROVED,
      Status.GUEST_CANCELLED,
      Status.GUEST_CANCEL_INITIATED,
      Status.GUEST_REJECTED,
      Status.GUEST_REJECTED_PAYMENT,
      Status.HOST_CANCELLED,
      Status.HOST_REJECTED,
      Status.PAYMENT_FAILED,
      Status.REFUNDED,
    ];

    // bookings that aren't straight up "cancelled"
    const bookingsInProgress = [
      Status.GUEST_PAID,
      Status.HOST_PAID,
      Status.HOST_APPROVED,
      Status.INIT_PAY_SUBMITTED,
      Status.DISPUTE_INITIATED,
      Status.DISPUTED,
      Status.REFUND_INITIATED,
      Status.REFUNDED,
      Status.GUEST_CONFIRMED,  // originally only included in 'upcoming' but it's important to track if something goes wrong
    ];

    const upcoming = [
      ...bookingsInProgress,
    ];
    const current = [
      ...bookingsInProgress
    ];
    const past = [
      ...bookingsInProgress,
      Status.COMPLETED,
    ];

    const now = Date.now();
    const chronologyMap = {
      past: {
        checkInDate: {
          [Op.lt]: now
        },
        checkOutDate: {
          [Op.lt]: now
        },
      },
      present: {
        checkInDate: {
          [Op.lte]: now
        },
        checkOutDate: {
          [Op.gte]: now
        },
      },
      future: {
        checkInDate: {
          [Op.gt]: now
        },
        checkOutDate: {
          [Op.gt]: now
        }
      },
    };
    const statusWithOpts= {
      started: { category: started, limit: 1 },
      upcoming: { category: upcoming, chronology: 'future' },
      current: { category: current, chronology: 'present' },
      past: { category: past, chronology: 'past'},
      cancelled: { category: cancelled },
    };

    const { chronology, limit, category } = statusWithOpts[tripStatus];
    return Booking.findAll({
      order: [['createdAt', 'DESC']],
      where: {
        guestId,
        status: {
          [Op.in]: category
        },
        ...(chronologyMap[chronology] && 
          chronologyMap[chronology]
        ),
      },
      ...(limit && { limit }),
    });
  }

  Booking.getAllBookings = ({limit}) => {
    return Booking.findAll({
      order: [['createdAt', 'DESC']],
      limit: limit || 100
    });
  }

  Booking.getGuestBookings = (guestId) => {
    return Booking.findAll({
      order: [['createdAt', 'DESC']],
      where: { guestId },
    });
  }

  Booking.findOverlappingBookings = function ({ listingId, bookingId, checkInDate, checkOutDate }) {
    if (!listingId || !checkInDate || !checkOutDate) {
      throw new Error('invalid parameters');
    }

    let bookingPredicate = bookingId ? bookingId : '';

    // IMPORTANT: The checkInDate/checkOutDate clauses should match Reservation.findInRange
    return Booking.findAll({
      where: {
        listingId,
        status: {
          [Op.notIn]: [
            // need to verify with someone on valid statuses for active bookings
            'started',
            'expired_before_guest_confirmed',
            'guest_cancelled',
            'guest_rejected',
            'guest_rejected_payment',
            'host_rejected',
            'host_cancelled',
            'expired_before_host_approved',
          ],
        },
        id: {
          [Op.not]: bookingPredicate
        },
        checkInDate:  {
          [Op.lt]: checkOutDate
        },
        checkOutDate: {
          [Op.gt]: checkInDate
        }
      }
    });
  }

  Booking.isAddressAllowed = function(user = {}, booking = {}) {
    return user.isAdmin()
      || (booking.hostId === user.id)
      || ((booking.guestId === user.id)
      && CONTACT_PRIVILEGE_STATUSES.includes(booking.status));
  }

  Booking.grantsContactPrivilege = function ({ from, to, booking }) {
    if (!booking) {
      return false;
    }
    const { guestId, hostId, status } = booking;
    const participants = [guestId, hostId];
    return CONTACT_PRIVILEGE_STATUSES.includes(status) &&
      [from, to].every(user => !!user && participants.includes(user.id));
  }


  Booking.prototype.isValidPaymentSource = function(paymentSource) {
    if (!paymentSource) {
      return false;
    }
    return paymentSource.userId === this.guestId;
  };

  Booking.prototype.canApprove = function(user) {
    if (!user) {
      return false;
    }

    return user.isAdmin() || this.hostId === user.id;
  };

  Booking.prototype.guestRejectPayment = function(user) {
    if (!user) {
      return false;
    }

    return user.isAdmin() || (this.guestId === user.id && this.status == 'started');
  }

  Booking.prototype.canCancel = function(user) {
    if (!user) {
      return false;
    }
    return this.guestId === user.id ||
      this.hostId === user.id ||
      user.isAdmin();
  };

  Booking.prototype.toJSON = function() {
    return dbUtils.jsonFormat(this.get());
  };

  Booking.prototype.updatePaymentSource = function(paymentSource) {
    this.meta = {
      ...this.meta,
      paymentSourceId: paymentSource.id,
      paymentSourceProvider: paymentSource.provider
    };
    return this.save();
  };

  Booking.prototype.updateCryptoSource = function ({
      guestWalletAddress,
      hostWalletAddress,
      paymentProtocolAddress,
      tokenContractAddress,
      guestTxHash,
      status,
    }) {

    this.guestWalletAddress = guestWalletAddress;
    this.hostWalletAddress = hostWalletAddress;
    this.paymentProtocolAddress = paymentProtocolAddress;
    this.tokenContractAddress = tokenContractAddress;
    this.guestTxHash = guestTxHash;
    this.status = status;

    this.meta = {
      ...this.meta,
      guestWalletAddress: guestWalletAddress,
      hostWalletAddress: hostWalletAddress,
      paymentProtocolAddress: paymentProtocolAddress,
      tokenContractAddress: tokenContractAddress,
      guestTxHash: guestTxHash,
    };

    return this.save();
  }

  Booking.prototype.updateCreditAmountAppliedFromUsd = function(creditAmountUsdApplied) {
    return Promise.all([
        CurrencyRate.findById(CurrencyRate.BEE),
        CurrencyRate.findById(CurrencyRate.ETH),
      ])
      .then(([beeCurrencyRate, ethCurrencyRate]) => {
        const creditAmountBeeApplied = creditAmountUsdApplied / beeCurrencyRate.toUsd;
        const creditAmountEthApplied = creditAmountUsdApplied / ethCurrencyRate.toUsd;
      
        this.meta = {
          ...this.meta,
          creditAmountBeeApplied: creditAmountBeeApplied,
          creditAmountEthApplied: creditAmountEthApplied,
          creditAmountUsdApplied: creditAmountUsdApplied,
        };

        return this.save();
      });
  }
  
  Booking.prototype.updateStatus = function(status, approvedByUserId) {
    this.status = status;
    this.meta = {
      ...this.meta,
      approvedBy: approvedByUserId
    };
    return this.save();
  };

  Booking.prototype.setCancelBy = function (user, isHost) {
    if (!user) {
      throw new Error('Must provide a user to cancel booking');
    }
    if (!this.canCancel(user)) {
      throw new Error('Unauthorized user cannot set booking status to cancelled');
    }
    
    return this.update({
      status: isHost ? 'host_cancelled' : 'guest_cancelled',
      cancelledBy: user.email
    });
  };

  Booking.prototype.setGuestRejected = function (user) {
    if (!user) {
      throw new Error('Must provide a user to cancel booking');
    }
    
    return this.update({
      status: 'guest_rejected',
      rejectedBy: user.email
    });
  };

  Booking.prototype.updateStripeCharge = function(stripeCharge) {
    this.meta = {
      ...this.meta,
      stripeChargeId: stripeCharge.id
    };
    return this.save();
  };

  Booking.prototype.updateStripeRefund = function(stripeRefund) {
    this.meta = {
      ...this.meta,
      stripeRefundId: stripeRefund.id,
      // stripe stores amounts in integers as cents; we store as decimal
      stripeRefundAmount: parseFloat(
        parseFloat(stripeRefund.amount / 100).toFixed(2)
      )
    }; 
    return this.save();
  };

  /**
   * Used to calculate charge percent when the guest cancels on bee/eth
   **/
  Booking.prototype.getCancelChargePercentForGuest = function () {
    switch (this.getCancelStatus()) {
      case Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY:
        return 0;
      case Booking.cancelStatuses.CANCEL_BEFORE_DEADLINE:
        return 0.1;
      case Booking.cancelStatuses.CANCEL_AFTER_DEADLINE:
        return 1;
      default:
        throw new Error('invalid cancel status');
        break;
    }
  };
  
  /**
   * Used to calculate stripe refund when the guest cancels
   **/
  Booking.prototype.getCancelRefundPercentForGuest = function () {
    switch (this.getCancelStatus()) {
      case Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY:
        // a charge was never performed if it's before the penalty deadline
        return 0;
      case Booking.cancelStatuses.CANCEL_BEFORE_DEADLINE:
        return 0.9;
      case Booking.cancelStatuses.CANCEL_AFTER_DEADLINE:
        return 0;
      default:
        throw new Error('invalid cancel status');
        break;
    }
  };

  /**
   * for BEE/ETH charges.
   **/
  Booking.prototype.getCancelChargeAmountForGuest = function () {
    const guestTotalAmount = _.get(this, 'meta.guestTotalAmount');
    const transactionFee = _.get(this, 'meta.transactionFee', 0);

    if (!guestTotalAmount && guestTotalAmount !== 0) {
      throw new Error('Refund not successful due to missing guest total amount');
    }

    const totalWithoutTransFee = guestTotalAmount - transactionFee;
    return totalWithoutTransFee * this.getCancelChargePercentForGuest();
  };

  Booking.prototype.getCancelRefundAmountForGuest = function () {
    // escape early if we don't refund the guest anything since a charge was never performed
    if (this.getCancelStatus() === Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY) {
      return 0;
    }

    // no refunds after deadline
    if (this.getCancelStatus() === Booking.cancelStatuses.CANCEL_AFTER_DEADLINE) {
      return 0;
    }

    const guestTotalAmount = _.get(this, 'meta.guestTotalAmount');
    const transactionFee = _.get(this, 'meta.transactionFee', 0);

    if (!guestTotalAmount && guestTotalAmount !== 0) {
      throw new Error('Refund not successful due to missing guest total amount');
    }

    const totalWithoutTransFee = guestTotalAmount - transactionFee;
    return totalWithoutTransFee * this.getCancelRefundPercentForGuest();
  };

  Booking.prototype.getCancelRefundAmountForHost = function () {
    return this.status === 'guest_confirmed' ? 0 : this.guestTotalAmount;
  };

  Booking.prototype.getCreditChargeAmountForGuest = function () {
    const creditAmountUsdApplied = _.get(this, 'meta.creditAmountUsdApplied', 0);

    // charge nothing
    if (this.getCancelStatus() === Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY) {
      return 0;
    }

    // charge everything
    if (this.getCancelStatus() === Booking.cancelStatuses.CANCEL_AFTER_DEADLINE) {
      return creditAmountUsdApplied ? creditAmountUsdApplied : 0;
    }

    return creditAmountUsdApplied * this.getCancelChargePercentForGuest();
  };

  Booking.prototype.getCreditRefundAmountForGuest = function () {
    const creditAmountUsdApplied = _.get(this, 'meta.creditAmountUsdApplied', 0);

    // refund full credit amount
    if (this.getCancelStatus() === Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY) {
      return creditAmountUsdApplied ? creditAmountUsdApplied : 0;
    }

    // no refunds after deadline
    if (this.getCancelStatus() === Booking.cancelStatuses.CANCEL_AFTER_DEADLINE) {
      return 0;
    }

    return creditAmountUsdApplied * this.getCancelRefundPercentForGuest();
  };

  Booking.prototype.hasCreditApplied = function () {
    const creditApplied = _.get(this, 'meta.creditAmountUsdApplied');
    return creditApplied > 0;
  }

  /**
   * Returns the cancel status
   * @return string ['cancel_before_host_approved', 'cancel_before_deadline', 'cancel_after_deadline']
   **/
  Booking.prototype.getCancelStatus = function () {
    // cancel without penalty (e.g., before host confirmed)
    if (['started', 'guest_confirmed'].includes(this.status)) {
      return Booking.cancelStatuses.CANCEL_WITHOUT_PENALTY;
    }

    let deadlineDay = datefns.subDays(this.checkInDate, 7);
    let minutesUntilDeadline = datefns.differenceInMinutes(deadlineDay, new Date());

    if (minutesUntilDeadline > 0) {
      return Booking.cancelStatuses.CANCEL_BEFORE_DEADLINE;
    }

    return Booking.cancelStatuses.CANCEL_AFTER_DEADLINE;
  };

  Booking.prototype.getPriceTotalNights = function () {
    const numberOfNights = datefns.differenceInDays(this.checkOutDate, this.checkInDate);
    const priceTotalNights = this.pricePerNight * numberOfNights;
    
    if (priceTotalNights < 0) {
      throw new Error(`priceTotalNights should not be negative: ${priceTotalNights}`);
    }

    return priceTotalNights;
  };

  return Booking;
};
