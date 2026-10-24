const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Creates an audit log entry.
 * @param {object} params
 * @param {string} params.action - e.g. 'sale.create', 'product.price_change'
 * @param {string} params.entity - e.g. 'Sale', 'Product'
 * @param {string} [params.entityId] - MongoDB ObjectId of affected document
 * @param {object} [params.changes] - diff or relevant data
 * @param {string} [params.description] - human-readable summary
 * @param {string} [params.performedBy] - user ObjectId
 * @param {string} [params.ipAddress]
 */
const createAuditLog = async (params) => {
  try {
    await AuditLog.create(params);
  } catch (err) {
    // Audit log failures should not crash the main flow
    logger.error(`Failed to write audit log: ${err.message}`, { params });
  }
};

/**
 * Express middleware factory for automatic audit logging.
 * Use for routes where you want an audit trail on every request.
 */
const auditMiddleware = (action, entity) => async (req, res, next) => {
  // Attach audit helper to req so controllers can call it
  req.audit = (entityId, changes, description) =>
    createAuditLog({
      action,
      entity,
      entityId,
      changes,
      description,
      performedBy: req.user?.id,
      ipAddress: req.ip,
    });
  next();
};

module.exports = { createAuditLog, auditMiddleware };
