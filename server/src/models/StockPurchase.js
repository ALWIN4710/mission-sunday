const mongoose = require('mongoose');

/**
 * StockPurchase — records a bulk purchase/stock receipt from a supplier.
 * Each item creates a corresponding InventoryMovement of type 'purchase'.
 */
const purchaseItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true }, // snapshot
  quantity: { type: Number, required: true, min: 1 },
  unitCostPaise: { type: Number, required: true, min: 0 }, // cost per unit
  totalCostPaise: { type: Number, required: true, min: 0 },
});

const stockPurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      unique: true,
    },
    vendor: { type: String, trim: true },
    date: { type: Date, required: true, default: Date.now },
    items: { type: [purchaseItemSchema], validate: (v) => v.length > 0 },
    totalAmountPaise: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'credit', 'other'],
      default: 'cash',
    },
    notes: { type: String },
    receiptUrl: { type: String },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

stockPurchaseSchema.index({ date: -1 });
stockPurchaseSchema.index({ vendor: 1 });

// Auto-generate purchase number
stockPurchaseSchema.pre('save', async function (next) {
  if (!this.purchaseNumber) {
    const count = await mongoose.model('StockPurchase').countDocuments();
    this.purchaseNumber = `PUR-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('StockPurchase', stockPurchaseSchema);
