/**
 * Local-time helpers for HTML datetime-local inputs.
 * datetime-local values are wall-clock local time, not UTC.
 */
(function (root) {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toDate(value) {
    if (value == null || value === "") return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toDatetimeLocalValue(value) {
    const date = toDate(value);
    if (!date) return "";
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }

  function toLocalDateISO(value) {
    const date = toDate(value);
    if (!date) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function datetimeLocalToISO(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const api = { toDatetimeLocalValue, toLocalDateISO, datetimeLocalToISO };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.CreatorOsDateTime = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
