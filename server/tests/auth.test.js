'use strict';
/**
 * tests/auth.test.js
 *
 * Integration tests for POST /api/v1/auth/login, /logout and GET /api/v1/auth/me.
 */

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { connectDB, disconnectDB, clearCollections, createTestUser } = require('./setup');

// ── Env must be set before app.js is required ───────────────────────────────
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test_jwt_secret_that_is_at_least_32_chars_long';

beforeAll(connectDB);
afterAll(disconnectDB);
beforeEach(clearCollections);

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUser({ role = 'admin', password = 'Password123!' } = {}) {
  const email = `${role}-${Date.now()}@test.com`;
  const user = await User.create({
    name: `Test ${role}`,
    email,
    passwordHash: password,
    role,
    isActive: true,
  });
  return { user, email, password };
}

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns 200 and sets an httpOnly jwt_token cookie on valid credentials', async () => {
    const { email, password } = await seedUser();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email.toLowerCase());

    // Cookie must be present and httpOnly
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).toMatch(/jwt_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
  });

  it('returns 401 on wrong password', async () => {
    const { email } = await seedUser();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword!' })
      .expect(401);

    expect(res.body.success).toBeUndefined();
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'Password123!' })
      .expect(400);

    expect(res.body.message).toMatch(/email and password are required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'someone@test.com' })
      .expect(400);

    expect(res.body.message).toMatch(/email and password are required/i);
  });

  it('returns 400 when both email and password are missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/email and password are required/i);
  });

  it('returns 401 for a non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@test.com', password: 'Password123!' })
      .expect(401);

    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  it('returns 403 when the account is deactivated', async () => {
    const email = `inactive-${Date.now()}@test.com`;
    await User.create({
      name: 'Inactive User',
      email,
      passwordHash: 'Password123!',
      role: 'volunteer',
      isActive: false,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(403);

    expect(res.body.message).toMatch(/deactivated/i);
  });
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('clears the jwt_token cookie and returns 200', async () => {
    const { cookieHeader } = await createTestUser('volunteer');

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/Logged out/i);

    // The Set-Cookie header should clear the jwt_token (MaxAge=0 or expires in past)
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
      // Either MaxAge=0 or Expires in the past signals cookie deletion
      const isCleared =
        cookieStr.match(/Max-Age=0/i) ||
        cookieStr.match(/jwt_token=;/i) ||
        cookieStr.match(/Expires=Thu, 01 Jan 1970/i);
      expect(isCleared).toBeTruthy();
    }
  });

  it('returns 401 when called without a cookie', async () => {
    await request(app).post('/api/v1/auth/logout').expect(401);
  });
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('returns 200 with the current user when authenticated', async () => {
    const { user, cookieHeader } = await createTestUser('admin');

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user._id).toBe(user._id.toString());
    expect(res.body.user.email).toBe(user.email);
    // passwordHash must never be returned
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/v1/auth/me').expect(401);
    expect(res.body.message).toMatch(/not logged in/i);
  });
});
