const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      required: true,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: [1, 'Refund amount must be positive'],
      validate: {
        validator: Number.isInteger,
        message: 'Refund amount must be an integer in paise',
      },
    },
    reason: {
      type: String,
      required: [true, 'Refund reason is required'],
      trim: true,
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['approved', 'rejected', 'pending'],
      default: 'approved',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'other'],
      default: 'cash',
    },
    notes: { type: String },
  },
  { timestamps: true }
);

refundSchema.index({ saleId: 1, createdAt: -1 });

module.exports = mongoose.model('Refund', refundSchema);
