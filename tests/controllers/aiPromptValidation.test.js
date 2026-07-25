const { handleAiRequest, MAX_AI_PROMPT_LENGTH } = require('../../controller/ai');

describe('handleAiRequest prompt validation', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    function createResponse() {
        return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    }

    test('rejects non-string prompts', async () => {
        const res = createResponse();

        await handleAiRequest({ body: { prompt: { topic: 'growth' } } }, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Prompt is required' });
    });

    test('rejects whitespace-only prompts', async () => {
        const res = createResponse();

        await handleAiRequest({ body: { prompt: '   ' } }, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Prompt is required' });
    });

    test('rejects oversized prompts', async () => {
        const res = createResponse();

        await handleAiRequest({ body: { prompt: 'a'.repeat(MAX_AI_PROMPT_LENGTH + 1) } }, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: `Prompt must be ${MAX_AI_PROMPT_LENGTH} characters or fewer`,
        });
    });
});
