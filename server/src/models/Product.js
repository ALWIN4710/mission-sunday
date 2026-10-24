const mongoose = require('mongoose');

/**
 * All monetary values stored in paise (integer) to avoid floating-point errors.
 * 1 rupee = 100 paise. Display layer divides by 100 and formats as ₹.
 */
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      index: true,
    },
    flavour: {
      type: String,
      required: [true, 'Flavour is required'],
      trim: true,
    },
    // Selling price in paise
    sellingPricePaise: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Selling price must be an integer in paise',
      },
    },
    // Cost price in paise — used for gross profit calculations
    costPricePaise: {
      type: Number,
      default: 0,
      min: [0, 'Cost price cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Cost price must be an integer in paise',
      },
    },
    // Unit for stock tracking: 'piece', 'cup', 'cone', 'litre', 'glass'
    stockUnit: {
      type: String,
      default: 'piece',
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Display order within category
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

productSchema.index({ category: 1, flavour: 1 }, { unique: true });
productSchema.index({ isAvailable: 1 });

// Virtual: current stock (computed via aggregation in inventory service)
// Not stored here; queried from InventoryMovement.

module.exports = mongoose.model('Product', productSchema);
