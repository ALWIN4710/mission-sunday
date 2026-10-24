const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
let memoryServer = null;

async function connectDB(retries = MAX_RETRIES) {
  let uri = process.env.MONGODB_URI;

  if (!uri && process.env.NODE_ENV !== 'production') {
    logger.info('MONGODB_URI is not set. Starting embedded in-memory MongoDB for development...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      process.env.MONGODB_URI = uri;
      logger.info(`Embedded MongoDB started at: ${uri}`);
    } catch (err) {
      logger.error(`Failed to start embedded MongoDB: ${err.message}`);
      process.exit(1);
    }
  }

  if (!uri) {
    logger.error('MONGODB_URI is not set. Please configure your .env file.');
    process.exit(1);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      logger.info(`MongoDB connected: ${mongoose.connection.host}`);
      return;
    } catch (err) {
      logger.error(`MongoDB connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        if (process.env.NODE_ENV !== 'production' && !memoryServer) {
          logger.info('Configured MongoDB unavailable. Falling back to embedded in-memory MongoDB...');
          try {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            memoryServer = await MongoMemoryServer.create();
            uri = memoryServer.getUri();
            process.env.MONGODB_URI = uri;
            await mongoose.connect(uri);
            logger.info(`Connected to fallback embedded MongoDB: ${uri}`);
            return;
          } catch (memErr) {
            logger.error(`Embedded fallback failed: ${memErr.message}`);
          }
        }
        logger.error('All MongoDB connection attempts failed. Exiting.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected.');
});

module.exports = { connectDB, disconnectDB };
