'use strict';
/**
 * tests/sales.test.js
 *
 * Integration tests for POST /api/v1/sales, GET /api/v1/sales,
 * and POST /api/v1/sales/:id/refunds.
 */

const request = require('supertest');
const { v4: uuidv4 } = require('uuid');
const app = require('../src/app');
const Product = require('../src/models/Product');
const InventoryMovement = require('../src/models/InventoryMovement');
const Sale = require('../src/models/Sale');
const { connectDB, disconnectDB, clearCollections, createTestUser } = require('./setup');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_that_is_at_least_32_chars_long';

beforeAll(connectDB);
afterAll(disconnectDB);
// Clear all collections before each test for full isolation
beforeEach(clearCollections);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a Product and add an opening stock movement for it.
 * Returns { product, adminCookieHeader }.
 */
async function seedProductWithStock({ stock = 50, sellingPricePaise = 5000 } = {}) {
  const { user: adminUser, cookieHeader: adminCookieHeader } = await createTestUser('admin');

  const product = await Product.create({
    name: 'Vanilla Ice Cream',
    category: 'Ice Cream',
    flavour: 'Vanilla',
    sellingPricePaise,
    costPricePaise: 2000,
    isAvailable: true,
  });

  // Seed opening stock via an inventory movement
  await InventoryMovement.create({
    productId: product._id,
    movementType: 'opening',
    quantity: stock,
    referenceType: 'ManualAdjustment',
    performedBy: adminUser._id,
    notes: 'Test opening stock',
  });

  return { product, adminUser, adminCookieHeader };
}

/**
 * Build a minimal sale payload for one product.
 */
function salePayload(productId, { quantity = 2, paymentMethod = 'cash', idempotencyKey } = {}) {
  return {
    items: [{ productId: productId.toString(), quantity }],
    paymentMethod,
    idempotencyKey: idempotencyKey || uuidv4(),
  };
}

// ── POST /api/v1/sales ────────────────────────────────────────────────────────

describe('POST /api/v1/sales', () => {
  it('creates a sale, returns 201, and decrements stock', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 20 });

    const payload = salePayload(product._id, { quantity: 3 });

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(payload)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.sale).toBeDefined();
    expect(res.body.sale.totalPaise).toBe(product.sellingPricePaise * 3);
    expect(res.body.sale.status).toBe('completed');

    // Verify stock was decremented by checking net inventory movements
    const movements = await InventoryMovement.find({ productId: product._id });
    const netStock = movements.reduce((sum, m) => sum + m.quantity, 0);
    expect(netStock).toBe(17); // 20 opening - 3 sold
  });

  it('returns 400 when items array is empty', async () => {
    const { adminCookieHeader } = await seedProductWithStock();

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send({ items: [], paymentMethod: 'cash' })
      .expect(400);

    expect(res.body.message).toMatch(/at least one item/i);
  });

  it('returns 400 when items field is missing entirely', async () => {
    const { adminCookieHeader } = await seedProductWithStock();

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send({ paymentMethod: 'cash' })
      .expect(400);

    expect(res.body.message).toMatch(/at least one item/i);
  });

  it('returns 200 (not 409) with duplicate:true when idempotency key is reused', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 50 });
    const idempotencyKey = uuidv4();
    const payload = salePayload(product._id, { quantity: 1, idempotencyKey });

    // First request — creates the sale
    await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(payload)
      .expect(201);

    // Second request with the same key — must return the existing sale, not create a new one
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.duplicate).toBe(true);

    // Only one sale should exist in the database
    const count = await Sale.countDocuments({});
    expect(count).toBe(1);
  });

  it('returns 409 when stock is insufficient', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 2 });

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(salePayload(product._id, { quantity: 10 }))
      .expect(409);

    expect(res.body.message).toMatch(/Insufficient stock/i);
  });

  it('returns 409 when product is marked unavailable', async () => {
    const { adminCookieHeader } = await seedProductWithStock({ stock: 50 });

    // Create a separate unavailable product
    const unavailable = await Product.create({
      name: 'Unavailable Cone',
      category: 'Cone',
      flavour: 'Strawberry',
      sellingPricePaise: 4000,
      costPricePaise: 1500,
      isAvailable: false,
    });

    const res = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(salePayload(unavailable._id))
      .expect(409);

    expect(res.body.message).toMatch(/unavailable/i);
  });

  it('returns 401 when not authenticated', async () => {
    const { product } = await seedProductWithStock();

    await request(app)
      .post('/api/v1/sales')
      .send(salePayload(product._id))
      .expect(401);
  });
});

// ── GET /api/v1/sales ─────────────────────────────────────────────────────────

describe('GET /api/v1/sales', () => {
  it('returns a paginated sales list for an admin user', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 100 });

    // Create 3 sales
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/sales')
        .set('Cookie', adminCookieHeader)
        .send(salePayload(product._id, { quantity: 1 }))
        .expect(201);
    }

    const res = await request(app)
      .get('/api/v1/sales?page=1&limit=2')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBe(2); // ceil(3/2)
    expect(Array.isArray(res.body.sales)).toBe(true);
    expect(res.body.sales.length).toBe(2);
  });

  it('returns 401 when not authenticated', async () => {
    await request(app).get('/api/v1/sales').expect(401);
  });

  it('returns an empty list when no sales exist', async () => {
    const { adminCookieHeader } = await seedProductWithStock();

    const res = await request(app)
      .get('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .expect(200);

    expect(res.body.total).toBe(0);
    expect(res.body.sales).toHaveLength(0);
  });
});

// ── POST /api/v1/sales/:id/refunds ────────────────────────────────────────────

describe('POST /api/v1/sales/:id/refunds', () => {
  it('creates a refund for an admin and marks the sale as fully_refunded', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 50, sellingPricePaise: 5000 });

    // Create a sale first
    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(salePayload(product._id, { quantity: 2 }))
      .expect(201);

    const saleId = saleRes.body.sale._id;
    const totalPaise = saleRes.body.sale.totalPaise; // 10000

    const refundRes = await request(app)
      .post(`/api/v1/sales/${saleId}/refunds`)
      .set('Cookie', adminCookieHeader)
      .send({ amountPaise: totalPaise, reason: 'Customer dissatisfied', paymentMethod: 'cash' })
      .expect(201);

    expect(refundRes.body.success).toBe(true);
    expect(refundRes.body.refund).toBeDefined();
    expect(refundRes.body.refund.amountPaise).toBe(totalPaise);
    expect(refundRes.body.refund.status).toBe('approved');

    // Sale status should update to fully_refunded
    expect(refundRes.body.sale.status).toBe('fully_refunded');
  });

  it('creates a partial refund and marks sale as partially_refunded', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 50, sellingPricePaise: 5000 });

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(salePayload(product._id, { quantity: 2 }))
      .expect(201);

    const saleId = saleRes.body.sale._id;
    const totalPaise = saleRes.body.sale.totalPaise; // 10000

    const refundRes = await request(app)
      .post(`/api/v1/sales/${saleId}/refunds`)
      .set('Cookie', adminCookieHeader)
      .send({ amountPaise: totalPaise / 2, reason: 'Partial refund', paymentMethod: 'cash' })
      .expect(201);

    expect(refundRes.body.sale.status).toBe('partially_refunded');
    expect(refundRes.body.sale.refundedAmountPaise).toBe(totalPaise / 2);
  });

  it('returns 403 when a volunteer tries to create a refund', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 50 });
    const { cookieHeader: volunteerCookieHeader } = await createTestUser('volunteer');

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(salePayload(product._id, { quantity: 1 }))
      .expect(201);

    await request(app)
      .post(`/api/v1/sales/${saleRes.body.sale._id}/refunds`)
      .set('Cookie', volunteerCookieHeader)
      .send({ amountPaise: 5000, reason: 'Test', paymentMethod: 'cash' })
      .expect(403);
  });

  it('returns 400 when refund amount exceeds the sale total', async () => {
    const { product, adminCookieHeader } = await seedProductWithStock({ stock: 50, sellingPricePaise: 5000 });

    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Cookie', adminCookieHeader)
      .send(salePayload(product._id, { quantity: 1 }))
      .expect(201);

    const saleId = saleRes.body.sale._id;

    const res = await request(app)
      .post(`/api/v1/sales/${saleId}/refunds`)
      .set('Cookie', adminCookieHeader)
      .send({ amountPaise: 99999999, reason: 'Over-refund', paymentMethod: 'cash' })
      .expect(400);

    expect(res.body.message).toMatch(/exceeds maximum refundable/i);
  });

  it('returns 404 when sale id does not exist', async () => {
    const { adminCookieHeader } = await createTestUser('admin');
    const fakeId = '000000000000000000000001';

    await request(app)
      .post(`/api/v1/sales/${fakeId}/refunds`)
      .set('Cookie', adminCookieHeader)
      .send({ amountPaise: 1000, reason: 'Test', paymentMethod: 'cash' })
      .expect(404);
  });
});
