const { MAX_SCHEDULED_CAPTION_LENGTH } = require('../../controller/contentController');

describe('scheduled caption length configuration', () => {
    test('uses the expected caption limit', () => {
        expect(MAX_SCHEDULED_CAPTION_LENGTH).toBe(2200);
    });

    test('model schema enforces the same caption limit', () => {
        const ScheduledContent = require('../../model/scheduledContent');
        const maxLength = ScheduledContent.schema.path('caption').options.maxlength;

        expect(maxLength).toBe(MAX_SCHEDULED_CAPTION_LENGTH);
    });
});
