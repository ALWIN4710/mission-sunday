/**
 * One-Time Admin Bootstrap Script
 * Run: npm run bootstrap (from server/ directory)
 *
 * Creates the first admin user from environment variables.
 * Refuses to run if:
 *   - An admin user already exists
 *   - The password is weak (< 12 chars, no uppercase, no number)
 *   - Required env vars are missing
 *
 * This script should be run ONCE after initial deployment.
 * Remove INITIAL_ADMIN_* vars from your environment afterwards.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');

function validatePassword(password) {
  if (!password || password.length < 12) return 'Password must be at least 12 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
  return null;
}

async function bootstrap() {
  const { INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD } = process.env;

  if (!INITIAL_ADMIN_NAME || !INITIAL_ADMIN_EMAIL || !INITIAL_ADMIN_PASSWORD) {
    console.error(
      '❌ Missing required env vars: INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD\n' +
        '   Set these in your .env file and re-run.'
    );
    process.exit(1);
  }

  const passwordError = validatePassword(INITIAL_ADMIN_PASSWORD);
  if (passwordError) {
    console.error(`❌ Weak password: ${passwordError}`);
    process.exit(1);
  }

  await connectDB();

  // Check if admin already exists
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log(
      `ℹ️  An admin account already exists (${existingAdmin.email}). Skipping bootstrap.\n` +
        '   To reset admin credentials, use the Team Settings page in the application.'
    );
    await mongoose.disconnect();
    return;
  }

  const admin = new User({
    name: INITIAL_ADMIN_NAME,
    email: INITIAL_ADMIN_EMAIL.toLowerCase().trim(),
    passwordHash: INITIAL_ADMIN_PASSWORD, // will be hashed by pre-save hook
    role: 'admin',
    isActive: true,
  });

  await admin.save();
  console.log(`\n✅ Admin account created successfully.`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Name:  ${admin.name}`);
  console.log(
    '\n⚠️  IMPORTANT: Remove INITIAL_ADMIN_* variables from your .env file now.\n'
  );

  await mongoose.disconnect();
}

bootstrap().catch((err) => {
  console.error('\n❌ Bootstrap failed:', err.message);
  process.exit(1);
});
