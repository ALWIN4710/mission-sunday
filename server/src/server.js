require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { connectDB, disconnectDB } = require('./config/db');
const { initializeData } = require('./utils/initData');
const logger = require('./utils/logger');

async function startServer() {
  await connectDB();
  await initializeData();

  const app = require('./app');
  const PORT = process.env.PORT || 5001;

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Mission Sunday server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    logger.info(`   API Base: http://localhost:${PORT}/api/v1`);
    logger.info(`   Health:   http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      logger.info('Database disconnected. Server closed.');
      process.exit(0);
    });
    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', { reason });
    shutdown('unhandledRejection');
  });
}

startServer();
