const { validateRequest, sanitizeNoSqlQuery } = require('./common');
const {
  validateBrand,
  validateDeal,
  validateInvoice,
  validateMediaKit,
  validateCrmQuery,
} = require('./creatorCrmValidator');
const {
  validatePreferences,
  validateCreateNotification,
} = require('./smartNotificationValidator');
const {
  validateEventType,
  validateCreateBooking,
} = require('./meetingValidator');
const {
  validateBioLink,
  validateProfile,
} = require('./creatorBioValidator');
const {
  validateContentItem,
  validateContentFolder,
  validateAiPrompt,
} = require('./contentOsValidator');
const {
  validateDmTrigger,
} = require('./instagramValidator');

module.exports = {
  validateRequest,
  sanitizeNoSqlQuery,
  validateBrand,
  validateDeal,
  validateInvoice,
  validateMediaKit,
  validateCrmQuery,
  validatePreferences,
  validateCreateNotification,
  validateEventType,
  validateCreateBooking,
  validateBioLink,
  validateProfile,
  validateContentItem,
  validateContentFolder,
  validateAiPrompt,
  validateDmTrigger,
};
