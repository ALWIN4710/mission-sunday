const EventSettings = require('../models/EventSettings');
const catchAsync = require('../utils/catchAsync');
const { createAuditLog } = require('../middleware/auditLogger');

/** GET /api/v1/settings */
const getSettings = catchAsync(async (req, res) => {
  let settings = await EventSettings.findOne();
  if (!settings) {
    settings = await EventSettings.create({});
  }
  res.status(200).json({ success: true, settings });
});

/** PATCH /api/v1/settings */
const updateSettings = catchAsync(async (req, res) => {
  const allowed = [
    'eventName', 'eventDate', 'salesTargetPaise', 'openingCashPaise',
    'timezone', 'receiptHeader', 'receiptFooter', 'receiptContact',
    'paymentMethods', 'maxVolunteerDiscountPercent', 'extraExpenseCategories',
  ];
  const updates = {};
  allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const settings = await EventSettings.findOneAndUpdate(
    {},
    { $set: updates },
    { new: true, upsert: true, runValidators: true }
  );

  await createAuditLog({
    action: 'settings.update',
    entity: 'EventSettings',
    entityId: settings._id,
    changes: updates,
    description: 'Event settings updated',
    performedBy: req.user.id,
    ipAddress: req.ip,
  });

  res.status(200).json({ success: true, settings });
});

module.exports = { getSettings, updateSettings };
