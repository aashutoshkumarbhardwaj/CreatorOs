/**
 * Escape regex metacharacters so user-provided search text is matched
 * literally when it is passed to MongoDB's $regex operator.
 */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = escapeRegex;
