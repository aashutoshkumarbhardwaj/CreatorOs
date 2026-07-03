function getUserTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        console.warn('[Timezone] Failed to detect timezone, defaulting to UTC:', error);
        return 'UTC';
    }
}

function convertToUTC(dateTime, userTimeZone) {
    try {
        if (!dateTime) return null;

        const date = new Date(dateTime);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });

        const parts = formatter.formatToParts(date);
        const partsMap = {};
        parts.forEach(({ type, value }) => {
            partsMap[type] = value;
        });

        const offset = new Date(
            partsMap.year,
            partsMap.month - 1,
            partsMap.day,
            partsMap.hour,
            partsMap.minute,
            partsMap.second
        ).getTime() - date.getTime();

        return new Date(date.getTime() + offset);
    } catch (error) {
        console.error('[Timezone] Error converting to UTC:', error);
        return new Date(dateTime);
    }
}

function convertFromUTC(utcDate, userTimeZone) {
    try {
        if (!utcDate) return null;

        const date = new Date(utcDate);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });

        const formatted = formatter.format(date);
        return formatted;
    } catch (error) {
        console.error('[Timezone] Error converting from UTC:', error);
        return utcDate.toISOString();
    }
}

function getValidTimeZones() {
    return Intl.supportedValuesOf('timeZone');
}

module.exports = {
    getUserTimeZone,
    convertToUTC,
    convertFromUTC,
    getValidTimeZones,
};
