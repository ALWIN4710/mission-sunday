'use strict';
/**
 * tests/products.test.js
 *
 * Integration tests for GET/POST/PATCH /api/v1/products.
 *
 * Note: The products route uses PATCH /:id/status (not /:id/availability).
 * The task description calls it "availability" — we test the actual endpoint.
 */

const request = require('supertest');
const app = require('../src/app');
const Product = require('../src/models/Product');
const { connectDB, disconnectDB, clearCollections, createTestUser } = require('./setup');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_that_is_at_least_32_chars_long';

beforeAll(connectDB);
afterAll(disconnectDB);
beforeEach(clearCollections);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seedProduct(overrides = {}) {
  return Product.create({
    name: 'Vanilla Ice Cream',
    category: 'Ice Cream',
    flavour: 'Vanilla',
    sellingPricePaise: 5000,
    costPricePaise: 2000,
    isAvailable: true,
    ...overrides,
  });
}

// ── GET /api/v1/products ──────────────────────────────────────────────────────

describe('GET /api/v1/products', () => {
  it('returns 200 with an array of products when authenticated', async () => {
    const { cookieHeader } = await createTestUser('volunteer');
    await seedProduct();

    const res = await request(app)
      .get('/api/v1/products')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThanOrEqual(1);
    expect(res.body.count).toBeDefined();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/products').expect(401);
    expect(res.body.message).toMatch(/not logged in/i);
  });

  it('filters by category when query param is provided', async () => {
    const { cookieHeader } = await createTestUser('volunteer');
    await seedProduct({ category: 'Ice Cream', flavour: 'Chocolate', name: 'Chocolate Ice Cream' });
    await seedProduct({ category: 'Mojito', flavour: 'Mint', name: 'Mint Mojito' });

    const res = await request(app)
      .get('/api/v1/products?category=Ice%20Cream')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body.products.every((p) => p.category === 'Ice Cream')).toBe(true);
  });
});

// ── POST /api/v1/products ─────────────────────────────────────────────────────

describe('POST /api/v1/products', () => {
  it('creates a product and returns 201 when the requester is admin', async () => {
    const { cookieHeader } = await createTestUser('admin');

    const res = await request(app)
      .post('/api/v1/products')
      .set('Cookie', cookieHeader)
      .send({
        name: 'Mango Milkshake',
        category: 'Milkshake',
        flavour: 'Mango',
        sellingPricePaise: 8000,
        costPricePaise: 3500,
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.product).toBeDefined();
    expect(res.body.product.name).toBe('Mango Milkshake');
    expect(res.body.product.sellingPricePaise).toBe(8000);
  });

  it('returns 403 when the requester is a volunteer', async () => {
    const { cookieHeader } = await createTestUser('volunteer');

    const res = await request(app)
      .post('/api/v1/products')
      .set('Cookie', cookieHeader)
      .send({
        name: 'Strawberry Cone',
        category: 'Cone',
        flavour: 'Strawberry',
        sellingPricePaise: 4000,
      })
      .expect(403);

    expect(res.body.message).toMatch(/Access denied/i);
  });

  it('returns 401 when not authenticated', async () => {
    await request(app)
      .post('/api/v1/products')
      .send({ name: 'Test', category: 'Cone', flavour: 'Lemon', sellingPricePaise: 3000 })
      .expect(401);
  });
});

// ── PATCH /api/v1/products/:id ────────────────────────────────────────────────

describe('PATCH /api/v1/products/:id', () => {
  it('updates a product when the requester is admin', async () => {
    const { cookieHeader } = await createTestUser('admin');
    const product = await seedProduct();

    const res = await request(app)
      .patch(`/api/v1/products/${product._id}`)
      .set('Cookie', cookieHeader)
      .send({ sellingPricePaise: 6000, name: 'Updated Vanilla Ice Cream' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.product.sellingPricePaise).toBe(6000);
    expect(res.body.product.name).toBe('Updated Vanilla Ice Cream');
  });

  it('returns 403 when a volunteer tries to update a product', async () => {
    const { cookieHeader } = await createTestUser('volunteer');
    const product = await seedProduct();

    await request(app)
      .patch(`/api/v1/products/${product._id}`)
      .set('Cookie', cookieHeader)
      .send({ sellingPricePaise: 9999 })
      .expect(403);
  });

  it('returns 404 for a non-existent product id', async () => {
    const { cookieHeader } = await createTestUser('admin');
    const fakeId = '000000000000000000000001';

    await request(app)
      .patch(`/api/v1/products/${fakeId}`)
      .set('Cookie', cookieHeader)
      .send({ sellingPricePaise: 6000 })
      .expect(404);
  });
});

// ── PATCH /api/v1/products/:id/status (availability toggle) ──────────────────

describe('PATCH /api/v1/products/:id/status', () => {
  it('toggles availability from true to false when admin', async () => {
    const { cookieHeader } = await createTestUser('admin');
    const product = await seedProduct({ isAvailable: true });

    const res = await request(app)
      .patch(`/api/v1/products/${product._id}/status`)
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.product.isAvailable).toBe(false);
  });

  it('toggles availability from false back to true when admin', async () => {
    const { cookieHeader } = await createTestUser('admin');
    const product = await seedProduct({ isAvailable: false });

    const res = await request(app)
      .patch(`/api/v1/products/${product._id}/status`)
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.product.isAvailable).toBe(true);
  });

  it('returns 403 when a volunteer tries to toggle availability', async () => {
    const { cookieHeader } = await createTestUser('volunteer');
    const product = await seedProduct();

    await request(app)
      .patch(`/api/v1/products/${product._id}/status`)
      .set('Cookie', cookieHeader)
      .expect(403);
  });
});
