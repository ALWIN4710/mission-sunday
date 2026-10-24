const mongoose = require('mongoose');

/**
 * InventoryMovement — append-only ledger.
 *
 * Current stock for a product is computed as:
 *   SUM(qty) where positive types add, negative types subtract.
 *
 * movementType values and their effect on stock:
 *   opening      (+) — initial stock record
 *   purchase     (+) — stock received from supplier
 *   sale         (-) — deducted when a sale is completed
 *   wastage      (-) — spoilage or damage
 *   adjustment_add    (+) — manual positive correction
 *   adjustment_remove (-) — manual negative correction
 *   refund_return     (+) — stock returned after refund (optional)
 */
const inventoryMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    movementType: {
      type: String,
      required: true,
      enum: [
        'opening',
        'purchase',
        'sale',
        'wastage',
        'adjustment_add',
        'adjustment_remove',
        'refund_return',
      ],
    },
    // Signed quantity:
    //   Positive for opening, purchase, adjustment_add, refund_return
    //   Negative for sale, wastage, adjustment_remove
    quantity: {
      type: Number,
      required: true,
    },
    // Reference to the triggering document (Sale, StockPurchase, etc.)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      enum: ['Sale', 'StockPurchase', 'ManualAdjustment', 'Refund', null],
      default: null,
    },
    notes: { type: String },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Snapshot of unit cost at time of movement (for stock valuation)
    unitCostPaise: { type: Number, default: 0 },
  },
  { timestamps: true }
);

inventoryMovementSchema.index({ productId: 1, createdAt: -1 });
inventoryMovementSchema.index({ movementType: 1 });
inventoryMovementSchema.index({ referenceId: 1 });

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
