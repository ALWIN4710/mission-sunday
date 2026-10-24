/**
 * Strict environment validation.
 * The server will refuse to start if any required variable is missing.
 */

function validateEnv() {
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    console.error(
      `[env] Missing required environment variable MONGODB_URI in production mode.\n` +
        `      Please configure your MongoDB Atlas or production URI.`
    );
    process.exit(1);
  }

  const REQUIRED_VARS = ['JWT_SECRET'];
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[env] Missing required environment variables: ${missing.join(', ')}\n` +
        `      Copy .env.example to .env and fill in the values.`
    );
    process.exit(1);
  }

  // Warn against obviously weak JWT secrets
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret.length < 32) {
    console.error('[env] JWT_SECRET must be at least 32 characters. Generate one with:\n  node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
  }
}

module.exports = { validateEnv };
