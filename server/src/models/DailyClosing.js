const mongoose = require('mongoose');

/**
 * DailyClosing — end-of-day cash reconciliation record.
 * One document per calendar date (Asia/Kolkata).
 */
const dailyClosingSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true, // One closing per day
      index: true,
    },
    // All amounts in paise
    openingCashPaise: { type: Number, default: 0 },
    cashSalesPaise: { type: Number, default: 0 },
    upiSalesPaise: { type: Number, default: 0 },
    otherSalesPaise: { type: Number, default: 0 },
    refundsPaise: { type: Number, default: 0 },
    // Expected = openingCash + cashSales - cashRefunds
    expectedClosingCashPaise: { type: Number, default: 0 },
    // Actual physical count by volunteer
    countedCashPaise: { type: Number, default: 0 },
    // variance = countedCash - expectedClosingCash (negative = short)
    variancePaise: { type: Number, default: 0 },
    notes: { type: String },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved'],
      default: 'draft',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DailyClosing', dailyClosingSchema);
