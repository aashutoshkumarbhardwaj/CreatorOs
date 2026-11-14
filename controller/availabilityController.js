const EventType = require("../model/eventType");
const MeetingBooking = require("../model/meetingBooking");
const User = require("../model/user");

const {
  parseDateParts,
  zonedDateTimeToUtc,
  localDayName,
  formatTimeInZone,
} = require("../utils/timeZone");

/**
 * Configuration
 */
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "17:00";
const DEFAULT_AVAILABLE_DAYS = ["mon", "tue", "wed", "thu", "fri"];

/**
 * Slugify text.
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Find creator using alias, nameSlug, name or ID.
 */
async function findCreatorByAliasOrName(identifier) {
  if (!identifier || typeof identifier !== "string") {
    return null;
  }

  const normalizedIdentifier = identifier.trim().toLowerCase();

  let creator = await User.findOne({
    role: "creator",
    $or: [
      { alias: normalizedIdentifier },
      { nameSlug: normalizedIdentifier },
    ],
  });

  // Fallback for legacy users.
  if (!creator) {
    const escapedName = identifier
      .replace(/-/g, " ")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    creator = await User.findOne({
      role: "creator",
      name: {
        $regex: "^" + escapedName.replace(/\s+/g, "\\s+") + "$",
        $options: "i
