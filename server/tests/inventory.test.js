'use strict';
/**
 * tests/inventory.test.js
 *
 * Integration tests for GET /api/v1/inventory, GET /api/v1/inventory/movements,
 * and POST /api/v1/inventory/movements.
 */

const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const InventoryMovement = require('../src/models/InventoryMovement');
const { connectDB, disconnectDB, clearCollections, createTestUser } = require('./setup');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_that_is_at_least_32_chars_long';

beforeAll(connectDB);
afterAll(disconnectDB);
beforeEach(clearCollections);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedProductAndStock({ stock = 30, category = 'Ice Cream', flavour = 'Vanilla' } = {}) {
  const { user: adminUser, cookieHeader: adminCookieHeader } = await createTestUser('admin');

  const product = await Product.create({
    name: `${flavour} ${category}`,
    category,
    flavour,
    sellingPricePaise: 5000,
    costPricePaise: 2000,
    isAvailable: true,
  });

  // Seed stock through a direct InventoryMovement (bypassing HTTP layer)
  if (stock > 0) {
    await InventoryMovement.create({
      productId: product._id,
      movementType: 'opening',
      quantity: stock,
      referenceType: 'ManualAdjustment',
      performedBy: adminUser._id,
      notes: 'Test opening stock',
    });
  }

  return { product, adminUser, adminCookieHeader };
}

// ── GET /api/v1/inventory ─────────────────────────────────────────────────────

describe('GET /api/v1/inventory', () => {
  it('returns 200 with stock levels for all products when authenticated', async () => {
    const { product, adminCookieHeader } = await seedProductAndStock({ stock: 25 });

    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.inventory)).toBe(true);

    const item = res.body.inventory.find((i) => i._id.toString() === product._id.toString());
    expect(item).toBeDefined();
    expect(item.currentStock).toBe(25);
  });

  it('returns 0 stock for a product with no inventory movements', async () => {
    const { cookieHeader: adminCookieHeader } = await createTestUser('admin');

    // Create product with no stock movements
    const product = await Product.create({
      name: 'Lemon Mojito',
      category: 'Mojito',
      flavour: 'Lemon',
      sellingPricePaise: 6000,
      costPricePaise: 2500,
      isAvailable: true,
    });

    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    const item = res.body.inventory.find((i) => i._id.toString() === product._id.toString());
    expect(item).toBeDefined();
    expect(item.currentStock).toBe(0);
  });

  it('returns 401 when not authenticated', async () => {
    await request(app).get('/api/v1/inventory').expect(401);
  });

  it('correctly flags a product as low stock when at or below threshold', async () => {
    const { cookieHeader: adminCookieHeader, user: adminUser } = await createTestUser('admin');

    // Create product with lowStockThreshold=10
    const product = await Product.create({
      name: 'Strawberry Cone',
      category: 'Cone',
      flavour: 'Strawberry',
      sellingPricePaise: 4000,
      costPricePaise: 1500,
      isAvailable: true,
      lowStockThreshold: 10,
    });

    // Add only 5 units — below threshold
    await InventoryMovement.create({
      productId: product._id,
      movementType: 'opening',
      quantity: 5,
      referenceType: 'ManualAdjustment',
      performedBy: adminUser._id,
    });

    const res = await request(app)
      .get('/api/v1/inventory')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    const item = res.body.inventory.find((i) => i._id.toString() === product._id.toString());
    expect(item.isLowStock).toBe(true);
  });
});

// ── POST /api/v1/inventory/movements ─────────────────────────────────────────

describe('POST /api/v1/inventory/movements', () => {
  it('creates an adjustment_add movement when admin and increases stock', async () => {
    const { product, adminCookieHeader } = await seedProductAndStock({ stock: 10 });

    const res = await request(app)
      .post('/api/v1/inventory/movements')
      .set('Cookie', adminCookieHeader)
      .send({
        productId: product._id.toString(),
        movementType: 'adjustment_add',
        quantity: 20,
        notes: 'Restocked from storage',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.movement).toBeDefined();
    expect(res.body.movement.movementType).toBe('adjustment_add');
    // quantity stored should be positive (absolute value of input)
    expect(res.body.movement.quantity).toBe(20);

    // Verify net stock increased
    const movements = await InventoryMovement.find({ productId: product._id });
    const netStock = movements.reduce((sum, m) => sum + m.quantity, 0);
    expect(netStock).toBe(30); // 10 opening + 20 adjustment
  });

  it('creates a wastage movement and decreases stock', async () => {
    const { product, adminCookieHeader } = await seedProductAndStock({ stock: 30 });

    const res = await request(app)
      .post('/api/v1/inventory/movements')
      .set('Cookie', adminCookieHeader)
      .send({
        productId: product._id.toString(),
        movementType: 'wastage',
        quantity: 5,
        notes: 'Melted before event',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    // wastage is stored as negative
    expect(res.body.movement.quantity).toBe(-5);
  });

  it('returns 400 for an invalid movementType', async () => {
    const { product, adminCookieHeader } = await seedProductAndStock();

    const res = await request(app)
      .post('/api/v1/inventory/movements')
      .set('Cookie', adminCookieHeader)
      .send({
        productId: product._id.toString(),
        movementType: 'invalid_type',
        quantity: 5,
      })
      .expect(400);

    expect(res.body.message).toMatch(/movementType must be one of/i);
  });

  it('returns 404 when the product does not exist', async () => {
    const { adminCookieHeader } = await createTestUser('admin');
    const fakeId = '000000000000000000000001';

    await request(app)
      .post('/api/v1/inventory/movements')
      .set('Cookie', adminCookieHeader)
      .send({
        productId: fakeId,
        movementType: 'adjustment_add',
        quantity: 10,
      })
      .expect(404);
  });

  it('returns 403 when a volunteer tries to create a movement', async () => {
    const { product } = await seedProductAndStock();
    const { cookieHeader: volunteerCookieHeader } = await createTestUser('volunteer');

    await request(app)
      .post('/api/v1/inventory/movements')
      .set('Cookie', volunteerCookieHeader)
      .send({
        productId: product._id.toString(),
        movementType: 'adjustment_add',
        quantity: 5,
      })
      .expect(403);
  });

  it('returns 401 when not authenticated', async () => {
    const { product } = await seedProductAndStock();

    await request(app)
      .post('/api/v1/inventory/movements')
      .send({ productId: product._id.toString(), movementType: 'adjustment_add', quantity: 5 })
      .expect(401);
  });
});

// ── GET /api/v1/inventory/movements ──────────────────────────────────────────

describe('GET /api/v1/inventory/movements', () => {
  it('returns paginated movement history for an authenticated user', async () => {
    const { product, adminUser, adminCookieHeader } = await seedProductAndStock({ stock: 100 });

    // Seed additional movements
    await InventoryMovement.insertMany([
      {
        productId: product._id,
        movementType: 'wastage',
        quantity: -5,
        referenceType: 'ManualAdjustment',
        performedBy: adminUser._id,
        notes: 'Batch wastage 1',
      },
      {
        productId: product._id,
        movementType: 'adjustment_add',
        quantity: 10,
        referenceType: 'ManualAdjustment',
        performedBy: adminUser._id,
        notes: 'Top-up',
      },
    ]);

    const res = await request(app)
      .get('/api/v1/inventory/movements?page=1&limit=2')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    // At least 3 movements exist (opening + 2 extra)
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect(res.body.page).toBe(1);
    expect(Array.isArray(res.body.movements)).toBe(true);
    expect(res.body.movements.length).toBeLessThanOrEqual(2);
  });

  it('filters movements by movementType', async () => {
    const { product, adminUser, adminCookieHeader } = await seedProductAndStock({ stock: 50 });

    await InventoryMovement.create({
      productId: product._id,
      movementType: 'wastage',
      quantity: -3,
      referenceType: 'ManualAdjustment',
      performedBy: adminUser._id,
      notes: 'Test wastage',
    });

    const res = await request(app)
      .get('/api/v1/inventory/movements?movementType=wastage')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    expect(res.body.movements.every((m) => m.movementType === 'wastage')).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    await request(app).get('/api/v1/inventory/movements').expect(401);
  });

  it('returns empty list when no movements exist', async () => {
    const { cookieHeader: adminCookieHeader } = await createTestUser('admin');

    const res = await request(app)
      .get('/api/v1/inventory/movements')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    expect(res.body.total).toBe(0);
    expect(res.body.movements).toHaveLength(0);
  });
});
