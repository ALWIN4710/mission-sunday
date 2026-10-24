const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * SaleItem — embedded sub-document.
 * Snapshots product data at time of sale so edits to Product don't
 * rewrite historical transactions.
 */
const saleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    // Snapshot fields (immutable after creation)
    productName: { type: String, required: true },
    category: { type: String, required: true },
    flavour: { type: String, required: true },
    sellingPricePaise: { type: Number, required: true }, // price at time of sale
    costPricePaise: { type: Number, required: true },    // cost at time of sale
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    // Line total in paise = sellingPricePaise * quantity
    lineTotalPaise: { type: Number, required: true },
  },
  { _id: true }
);

const saleSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      default: () => `TXN-${uuidv4().split('-')[0].toUpperCase()}`,
      index: true,
    },
    // Idempotency key from client to prevent duplicate checkouts
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'A sale must have at least one item',
      },
    },
    subtotalPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    refundedAmountPaise: { type: Number, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 }, // subtotal - discount
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'other'],
      required: true,
    },
    upiReference: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ['completed', 'cancelled', 'partially_refunded', 'fully_refunded'],
      default: 'completed',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ createdBy: 1, createdAt: -1 });
saleSchema.index({ status: 1, createdAt: -1 });
saleSchema.index({ paymentMethod: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
