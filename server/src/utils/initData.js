const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Product = require('../models/Product');
const User = require('../models/User');
const InventoryMovement = require('../models/InventoryMovement');
const EventSettings = require('../models/EventSettings');
const logger = require('./logger');

const ADMIN_ID = new mongoose.Types.ObjectId('65a000000000000000000001');
const VOLUNTEER_ID = new mongoose.Types.ObjectId('65a000000000000000000002');

const CATALOGUE = [
  // ─── Ice Cream ────────────────────────────────────────────
  { _id: new mongoose.Types.ObjectId('65a000000000000000000011'), category: 'Ice Cream', flavour: 'Vanilla',      sellingPricePaise: 3000, costPricePaise: 1200, stockUnit: 'cup',   sortOrder: 1 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000012'), category: 'Ice Cream', flavour: 'Strawberry',   sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cup',   sortOrder: 2 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000013'), category: 'Ice Cream', flavour: 'Butterscotch', sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cup',   sortOrder: 3 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000014'), category: 'Ice Cream', flavour: 'Chocolate',    sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cup',   sortOrder: 4 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000015'), category: 'Ice Cream', flavour: 'Blackcurrant', sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cup',   sortOrder: 5 },

  // ─── Cone ────────────────────────────────────────────────
  { _id: new mongoose.Types.ObjectId('65a000000000000000000021'), category: 'Cone',      flavour: 'Vanilla',      sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cone',  sortOrder: 1 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000022'), category: 'Cone',      flavour: 'Strawberry',   sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cone',  sortOrder: 2 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000023'), category: 'Cone',      flavour: 'Butterscotch', sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cone',  sortOrder: 3 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000024'), category: 'Cone',      flavour: 'Chocolate',    sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cone',  sortOrder: 4 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000025'), category: 'Cone',      flavour: 'Blackcurrant', sellingPricePaise: 6000, costPricePaise: 2000, stockUnit: 'cone',  sortOrder: 5 },

  // ─── Milkshake ───────────────────────────────────────────
  { _id: new mongoose.Types.ObjectId('65a000000000000000000031'), category: 'Milkshake', flavour: 'Vanilla',      sellingPricePaise: 6000, costPricePaise: 2500, stockUnit: 'glass', sortOrder: 1 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000032'), category: 'Milkshake', flavour: 'Chocolate',    sellingPricePaise: 7000, costPricePaise: 2800, stockUnit: 'glass', sortOrder: 2 },
  { _id: new mongoose.Types.ObjectId('65a000000000000000000033'), category: 'Milkshake', flavour: 'Oreo',         sellingPricePaise: 8000, costPricePaise: 3200, stockUnit: 'glass', sortOrder: 3 },

  // ─── Mojito ──────────────────────────────────────────────
  { _id: new mongoose.Types.ObjectId('65a000000000000000000041'), category: 'Mojito',    flavour: 'Blue Mojito',  sellingPricePaise: 5000, costPricePaise: 2000, stockUnit: 'glass', sortOrder: 1 },
];

async function initializeData() {
  try {
    // 1. Admin User First
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      const email = (process.env.INITIAL_ADMIN_EMAIL || 'admin@missionsunday.church').toLowerCase().trim();
      const password = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123456';
      const name = process.env.INITIAL_ADMIN_NAME || 'Admin User';

      admin = await User.create({
        _id: ADMIN_ID,
        name,
        email,
        passwordHash: password, // Pre-save hook hashes with bcrypt once
        role: 'admin',
        isActive: true,
        passwordChangedAt: new Date(0), // Epoch so active tokens are never invalidated by server restarts
      });

      logger.info(`✅ Initial admin account created: ${email} (Password: ${password})`);
    }

    // 2. Volunteer Demo User
    const volunteerCount = await User.countDocuments({ role: 'volunteer' });
    if (volunteerCount === 0) {
      await User.create({
        _id: VOLUNTEER_ID,
        name: 'Volunteer Mary',
        email: 'volunteer@missionsunday.church',
        passwordHash: 'Volunteer@123456',
        role: 'volunteer',
        isActive: true,
        passwordChangedAt: new Date(0),
      });
      logger.info(`✅ Volunteer account created: volunteer@missionsunday.church (Password: Volunteer@123456)`);
    }

    // 3. Products & Opening Stock
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      logger.info('Initializing product catalogue and opening stock...');
      for (const item of CATALOGUE) {
        const productName = `${item.flavour} ${item.category}`;
        const product = await Product.create({
          _id: item._id,
          category: item.category,
          flavour: item.flavour,
          name: productName,
          sellingPricePaise: item.sellingPricePaise,
          costPricePaise: item.costPricePaise,
          stockUnit: item.stockUnit,
          sortOrder: item.sortOrder,
          lowStockThreshold: 10,
          isAvailable: true,
        });

        // Seed 50 units of opening stock per product so POS is immediately usable
        await InventoryMovement.create({
          productId: product._id,
          movementType: 'opening',
          quantity: 50,
          performedBy: admin._id,
          unitCostPaise: item.costPricePaise,
          notes: 'Initial event opening stock',
        });
      }
      logger.info(`✅ Initialized ${CATALOGUE.length} products with 50 units opening stock each.`);
    } else {
      // If products exist but have 0 stock movements, seed opening stock
      const movementCount = await InventoryMovement.countDocuments();
      if (movementCount === 0) {
        const products = await Product.find();
        for (const prod of products) {
          await InventoryMovement.create({
            productId: prod._id,
            movementType: 'opening',
            quantity: 50,
            performedBy: admin._id,
            unitCostPaise: prod.costPricePaise || 1500,
            notes: 'Initial event opening stock',
          });
        }
        logger.info(`✅ Added opening stock to ${products.length} existing products.`);
      }
    }

    // 4. Default Event Settings
    const settingsCount = await EventSettings.countDocuments();
    if (settingsCount === 0) {
      await EventSettings.create({
        eventName: process.env.EVENT_NAME || 'Mission Sunday 2026',
        eventDate: new Date(),
        targetSalesPaise: 10000000, // ₹1,00,000 target
        targetUnits: 1500,
        churchName: 'St. Mary Church - Mission Sunday',
        receiptHeader: 'Thank you for supporting our mission!',
        receiptFooter: 'God bless your cheerful giving!',
        contactPhone: '+91 98765 43210',
        allowedPaymentMethods: ['cash', 'upi', 'other'],
        upiId: 'missionsunday@upi',
      });
      logger.info('✅ Initial event settings created.');
    }
  } catch (err) {
    logger.error(`Error during data initialization: ${err.message}`);
  }
}

module.exports = { initializeData, CATALOGUE, ADMIN_ID, VOLUNTEER_ID };
