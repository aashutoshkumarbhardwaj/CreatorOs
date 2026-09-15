function parseDateParts(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

function parseTimeParts(timeString) {
  const match = /^(\d{2}):(\d{2})$/.exec(timeString || "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function getOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(dateString, timeString, timeZone) {
  const dateParts = parseDateParts(dateString);
  const timeParts = parseTimeParts(timeString);
  if (!dateParts || !timeParts) return null;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    return null;
  }

  const utcGuess = new Date(Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0
  ));

  let result = new Date(utcGuess.getTime() - getOffsetMs(utcGuess, timeZone));
  const correctedOffset = getOffsetMs(result, timeZone);
  result = new Date(utcGuess.getTime() - correctedOffset);
  return result;
}

function localDayName(dateString) {
  const parts = parseDateParts(dateString);
  if (!parts) return null;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)).getUTCDay()];
}

function formatTimeInZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

module.exports = {
  parseDateParts,
  parseTimeParts,
  zonedDateTimeToUtc,
  localDayName,
  formatTimeInZone,
};
