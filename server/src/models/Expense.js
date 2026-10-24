const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Expense category is required'],
      enum: [
        'Ingredients',
        'Ice Cream Supplies',
        'Milk & Dairy',
        'Cups & Packaging',
        'Cones',
        'Beverages',
        'Transport',
        'Equipment',
        'Miscellaneous',
      ],
      index: true,
    },
    amountPaise: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be positive'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer in paise',
      },
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'other'],
      default: 'cash',
    },
    vendor: { type: String, trim: true },
    notes: { type: String, trim: true },
    receiptUrl: { type: String }, // Optional attachment URL
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Audit trail of edits
    editHistory: [
      {
        editedAt: { type: Date, default: Date.now },
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        previousValues: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1, category: 1 });
expenseSchema.index({ createdBy: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
