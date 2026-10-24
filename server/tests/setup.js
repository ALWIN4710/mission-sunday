'use strict';
/**
 * tests/setup.js
 *
 * Shared test setup helpers for Mission Sunday backend tests.
 *
 * Usage in each test file:
 *   const { connectDB, disconnectDB, createTestUser } = require('./setup');
 *   beforeAll(connectDB);
 *   afterAll(disconnectDB);
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');

// Keep a module-level handle so every test file shares the same instance
// when running --runInBand (sequential). Each file calls connectDB/disconnectDB
// independently when used in its own describe scope.

let mongod = null;

/**
 * Start an in-memory MongoDB instance and open a Mongoose connection.
 * Call this in beforeAll().
 */
async function connectDB() {
  // Ensure required env vars are set before app.js validates them
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_that_is_at_least_32_chars_long';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.COOKIE_SECURE = 'false';
  process.env.COOKIE_SAME_SITE = 'lax';

  // Only start a new server if one isn't already running (avoids double-start
  // when multiple test suites share the same Node process via --runInBand).
  if (mongoose.connection.readyState !== 0) {
    return; // already connected
  }

  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Set MONGODB_URI so that any code that reads it (e.g. env validation) is
  // satisfied, but we connect manually here.
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri, {
    // Use the same options you'd use in production for parity
  });
}

/**
 * Drop the database, close the Mongoose connection, and stop the in-memory server.
 * Call this in afterAll().
 */
async function disconnectDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

/**
 * Clear all documents from every registered model.
 * Useful in beforeEach to achieve test isolation without a full reconnect.
 */
async function clearCollections() {
  const collections = mongoose.connection.collections;
  await Promise.all(
    Object.values(collections).map((col) => col.deleteMany({}))
  );
}

/**
 * Create a real User document in the database and return a signed JWT
 * suitable for use as an HTTP cookie header value.
 *
 * @param {'admin'|'volunteer'} role - The role to assign to the test user.
 * @returns {Promise<{ user: import('../src/models/User'), cookieHeader: string }>}
 */
async function createTestUser(role = 'volunteer') {
  const email = `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

  // Set passwordHash directly; the pre-save hook will bcrypt-hash it.
  const user = await User.create({
    name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    email,
    passwordHash: 'TestPassword123!',
    role,
    isActive: true,
  });

  const token = jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Format as the value that would appear in the Cookie request header
  const cookieHeader = `jwt_token=${token}`;

  return { user, cookieHeader };
}

module.exports = { connectDB, disconnectDB, clearCollections, createTestUser };
