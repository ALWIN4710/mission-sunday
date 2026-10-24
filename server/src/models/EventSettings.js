const mongoose = require('mongoose');

const eventSettingsSchema = new mongoose.Schema(
  {
    // Singleton — only one settings document exists.
    // Use Settings.findOne() or Settings.findOneAndUpdate({}, ..., {upsert:true})
    eventName: {
      type: String,
      default: 'Mission Sunday',
    },
    eventDate: {
      type: Date,
    },
    // Sales target in paise
    salesTargetPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Opening cash in drawer (for daily reconciliation)
    openingCashPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    currencySymbol: {
      type: String,
      default: '₹',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    // Payment methods available at checkout
    paymentMethods: {
      type: [String],
      default: ['cash', 'upi', 'other'],
    },
    // Receipt / event branding
    receiptHeader: {
      type: String,
      default: 'Mission Sunday',
    },
    receiptFooter: {
      type: String,
      default: 'Thank you for your support!',
    },
    receiptContact: {
      type: String,
    },
    // Discount policy: only admin can apply discounts > this %
    maxVolunteerDiscountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Custom expense categories (in addition to defaults)
    extraExpenseCategories: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EventSettings', eventSettingsSchema);
