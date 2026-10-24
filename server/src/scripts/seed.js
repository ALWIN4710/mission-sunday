/**
 * Idempotent Product Seed Script
 * Run: npm run seed (from server/ directory)
 *
 * Uses upsert on {category, flavour} unique index — safe to run multiple times.
 * All prices stored in paise (1 rupee = 100 paise).
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Product = require('../models/Product');

const CATALOGUE = [
  // ─── Ice Cream ────────────────────────────────────────────
  { category: 'Ice Cream', flavour: 'Vanilla',      sellingPricePaise: 3000, costPricePaise: 1200, stockUnit: 'cup',  sortOrder: 1 },
  { category: 'Ice Cream', flavour: 'Strawberry',   sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cup',  sortOrder: 2 },
  { category: 'Ice Cream', flavour: 'Butterscotch', sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cup',  sortOrder: 3 },
  { category: 'Ice Cream', flavour: 'Chocolate',    sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cup',  sortOrder: 4 },
  { category: 'Ice Cream', flavour: 'Blackcurrant', sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cup',  sortOrder: 5 },

  // ─── Cone ────────────────────────────────────────────────
  { category: 'Cone',      flavour: 'Vanilla',      sellingPricePaise: 4000, costPricePaise: 1500, stockUnit: 'cone', sortOrder: 1 },
  { category: 'Cone',      flavour: 'Strawberry',   sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cone', sortOrder: 2 },
  { category: 'Cone',      flavour: 'Butterscotch', sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cone', sortOrder: 3 },
  { category: 'Cone',      flavour: 'Chocolate',    sellingPricePaise: 5000, costPricePaise: 1800, stockUnit: 'cone', sortOrder: 4 },
  { category: 'Cone',      flavour: 'Blackcurrant', sellingPricePaise: 6000, costPricePaise: 2000, stockUnit: 'cone', sortOrder: 5 },

  // ─── Milkshake ───────────────────────────────────────────
  { category: 'Milkshake', flavour: 'Vanilla',      sellingPricePaise: 6000, costPricePaise: 2500, stockUnit: 'glass', sortOrder: 1 },
  { category: 'Milkshake', flavour: 'Chocolate',    sellingPricePaise: 7000, costPricePaise: 2800, stockUnit: 'glass', sortOrder: 2 },
  { category: 'Milkshake', flavour: 'Oreo',         sellingPricePaise: 8000, costPricePaise: 3200, stockUnit: 'glass', sortOrder: 3 },

  // ─── Mojito ──────────────────────────────────────────────
  { category: 'Mojito',    flavour: 'Blue Mojito',  sellingPricePaise: 5000, costPricePaise: 2000, stockUnit: 'glass', sortOrder: 1 },
];

async function seed() {
  await connectDB();
  console.log('\n🌱 Starting product seed...\n');

  let created = 0;
  let updated = 0;

  for (const item of CATALOGUE) {
    const productName = `${item.flavour} ${item.category}`;
    const result = await Product.findOneAndUpdate(
      { category: item.category, flavour: item.flavour },
      {
        $set: {
          name: productName,
          sellingPricePaise: item.sellingPricePaise,
          costPricePaise: item.costPricePaise,
          stockUnit: item.stockUnit,
          sortOrder: item.sortOrder,
          lowStockThreshold: 10,
          isAvailable: true,
        },
        $setOnInsert: {
          category: item.category,
          flavour: item.flavour,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    const wasInserted = result.createdAt.getTime() === result.updatedAt.getTime();
    if (wasInserted) {
      console.log(`  ✅ Created: ${productName} — ₹${item.sellingPricePaise / 100}`);
      created++;
    } else {
      console.log(`  ♻️  Updated: ${productName}`);
      updated++;
    }
  }

  console.log(`\n📦 Seed complete — ${created} created, ${updated} updated.\n`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
