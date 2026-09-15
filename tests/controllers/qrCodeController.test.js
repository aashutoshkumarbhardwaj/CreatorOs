process.env.USE_MOCK_DB = "true";

jest.mock('../../model/qrCode', () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    listForUser: jest.fn(),
}));

const mongoose = require('mongoose');
const QrCode = require('../../model/qrCode');
const {
    createQrCode,
    batchCreateQrCodes,
    exportQrCode,
    updateQrCode,
    deleteQrCode,
    getQrAnalytics,
    handleQrRedirect,
} = require('../../controller/qrCodeController');

function createMockRes() {
    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        redirectUrl: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        send(data) {
            this.body = data;
            return this;
        },
        setHeader(key, value) {
            this.headers[key] = value;
            return this;
        },
        redirect(url) {
            this.redirectUrl = url;
            return this;
        },
    };
    return res;
}

describe('qrCodeController Unit & Validation Tests', () => {
    const testUserId = new mongoose.Types.ObjectId().toString();
    const otherUserId = new mongoose.Types.ObjectId().toString();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createQrCode', () => {
        it('should reject requests with missing or invalid URL when inputType is url', async () => {
            const req = {
                user: { id: testUserId },
                body: { inputType: 'url', targetUrl: 'not-a-valid-url' },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await createQrCode(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/valid HTTP or HTTPS target URL is required/i);
        });

        it('should reject text QR content exceeding 2000 characters', async () => {
            const req = {
                user: { id: testUserId },
                body: { inputType: 'text', text: 'a'.repeat(2001) },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await createQrCode(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/between 1 and 2000 characters/i);
        });

        it('should reject text QR with empty content', async () => {
            const req = {
                user: { id: testUserId },
                body: { inputType: 'text', text: '   ' },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await createQrCode(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should reject SSRF or invalid logo URLs in design options', async () => {
            const req = {
                user: { id: testUserId },
                body: {
                    inputType: 'url',
                    targetUrl: 'https://creatoros.io',
                    design: { logoUrl: 'http://127.0.0.1/secret' },
                },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await createQrCode(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should successfully create a valid QR code', async () => {
            const mockDoc = {
                _id: new mongoose.Types.ObjectId(),
                userId: testUserId,
                targetUrl: 'https://github.com/myrepo',
                inputType: 'url',
                label: 'GitHub Repo',
                campaignName: 'Launch',
                isDynamic: true,
                shortId: 'gh12345',
                design: { foregroundColor: '#000000', backgroundColor: '#FFFFFF', patternPreset: 'A' },
                totalScans: 0,
                formats: { svg: true, png: true, pdf: false },
                toObject() { return this; },
            };

            QrCode.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
            QrCode.create.mockResolvedValue(mockDoc);

            const req = {
                user: { id: testUserId },
                body: {
                    targetUrl: 'https://github.com/myrepo',
                    label: 'GitHub Repo',
                    campaignName: 'Launch',
                    inputType: 'url',
                },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await createQrCode(req, res);

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.qrCode.targetUrl).toBe('https://github.com/myrepo');
            expect(res.body.qrCode.shortUrl).toBe('https://creatoros.io/q/gh12345');
        });
    });

    describe('batchCreateQrCodes', () => {
        it('should reject batch creation when no URLs are provided', async () => {
            const req = {
                user: { id: testUserId },
                body: { urls: '' },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await batchCreateQrCodes(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Provide at least one URL/i);
        });

        it('should reject batch creation when exceeding the limit of 50 URLs', async () => {
            const oversizedUrls = Array.from({ length: 51 }, (_, i) => `https://example.com/link-${i}`).join('\n');
            const req = {
                user: { id: testUserId },
                body: { urls: oversizedUrls },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await batchCreateQrCodes(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/capped at 50 URLs/i);
        });
    });

    describe('exportQrCode', () => {
        it('should reject invalid export format query params', async () => {
            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                query: { format: 'bmp' },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await exportQrCode(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/format must be png, svg, or pdf/i);
        });

        it('should return 404 if QR code is not found', async () => {
            QrCode.findById.mockResolvedValue(null);

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                query: { format: 'png' },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await exportQrCode(req, res);

            expect(res.statusCode).toBe(404);
            expect(res.body.message).toMatch(/QR code not found/i);
        });

        it('should return 403 if user does not own the QR code', async () => {
            QrCode.findById.mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                userId: otherUserId,
            });

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                query: { format: 'png' },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await exportQrCode(req, res);

            expect(res.statusCode).toBe(403);
            expect(res.body.message).toMatch(/Not your QR code/i);
        });
    });

    describe('updateQrCode', () => {
        it('should return 404 when updating a non-existent QR code', async () => {
            QrCode.findById.mockResolvedValue(null);

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                body: { label: 'Updated Label' },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await updateQrCode(req, res);

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('should return 403 when updating another user QR code', async () => {
            QrCode.findById.mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                userId: otherUserId,
            });

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                body: { label: 'Malicious Update' },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await updateQrCode(req, res);

            expect(res.statusCode).toBe(403);
            expect(res.body.success).toBe(false);
        });

        it('should reject changing targetUrl for static QR codes', async () => {
            const mockDoc = {
                _id: new mongoose.Types.ObjectId(),
                userId: testUserId,
                targetUrl: 'https://old.com',
                isDynamic: false,
                inputType: 'url',
            };
            QrCode.findById.mockResolvedValue(mockDoc);

            const req = {
                params: { id: mockDoc._id.toString() },
                body: { targetUrl: 'https://new.com' },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await updateQrCode(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/Static QR codes cannot change target URL/i);
        });

        it('should reject changing targetUrl for text QR codes', async () => {
            const mockDoc = {
                _id: new mongoose.Types.ObjectId(),
                userId: testUserId,
                targetUrl: 'Sample text',
                isDynamic: true,
                inputType: 'text',
            };
            QrCode.findById.mockResolvedValue(mockDoc);

            const req = {
                params: { id: mockDoc._id.toString() },
                body: { targetUrl: 'https://new.com' },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await updateQrCode(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toMatch(/Text QR content cannot be changed/i);
        });

        it('should successfully update label and campaign metadata for dynamic QR code', async () => {
            const mockDoc = {
                _id: new mongoose.Types.ObjectId(),
                userId: testUserId,
                targetUrl: 'https://example.com',
                isDynamic: true,
                inputType: 'url',
                label: 'Old Label',
                campaignName: 'Old Campaign',
                design: {},
                save: jest.fn().mockResolvedValue(true),
                toObject() { return this; },
            };
            QrCode.findById.mockResolvedValue(mockDoc);

            const req = {
                params: { id: mockDoc._id.toString() },
                body: { label: 'New Label', campaignName: 'Summer2026' },
                user: { id: testUserId },
                protocol: 'https',
                get: () => 'creatoros.io',
            };
            const res = createMockRes();

            await updateQrCode(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockDoc.label).toBe('New Label');
            expect(mockDoc.campaignName).toBe('Summer2026');
            expect(mockDoc.save).toHaveBeenCalled();
        });
    });

    describe('deleteQrCode', () => {
        it('should return 404 when deleting a non-existent QR code', async () => {
            QrCode.findById.mockResolvedValue(null);

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await deleteQrCode(req, res);

            expect(res.statusCode).toBe(404);
        });

        it('should return 403 when deleting another user QR code', async () => {
            QrCode.findById.mockResolvedValue({
                _id: new mongoose.Types.ObjectId(),
                userId: otherUserId,
            });

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await deleteQrCode(req, res);

            expect(res.statusCode).toBe(403);
            expect(QrCode.deleteOne).not.toHaveBeenCalled();
        });

        it('should successfully delete an owned QR code', async () => {
            const mockId = new mongoose.Types.ObjectId();
            QrCode.findById.mockResolvedValue({
                _id: mockId,
                userId: testUserId,
            });
            QrCode.deleteOne.mockResolvedValue({ deletedCount: 1 });

            const req = {
                params: { id: mockId.toString() },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await deleteQrCode(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(QrCode.deleteOne).toHaveBeenCalledWith({ _id: mockId });
        });
    });

    describe('getQrAnalytics', () => {
        it('should return 404 when QR code is not found', async () => {
            QrCode.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await getQrAnalytics(req, res);

            expect(res.statusCode).toBe(404);
        });

        it('should return 403 when user does not own the QR code', async () => {
            QrCode.findById.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: new mongoose.Types.ObjectId(),
                    userId: otherUserId,
                }),
            });

            const req = {
                params: { id: new mongoose.Types.ObjectId().toString() },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await getQrAnalytics(req, res);

            expect(res.statusCode).toBe(403);
        });

        it('should return formatted scan history and timeSeries buckets', async () => {
            const mockDoc = {
                _id: new mongoose.Types.ObjectId(),
                userId: testUserId,
                totalScans: 2,
                scanHistory: [
                    { timestamp: new Date('2026-09-10T10:00:00.000Z'), city: 'New York', country: 'US', device: 'Mobile' },
                    { timestamp: new Date('2026-09-10T14:00:00.000Z'), city: 'London', country: 'UK', device: 'Desktop' },
                ],
            };
            QrCode.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(mockDoc) });

            const req = {
                params: { id: mockDoc._id.toString() },
                user: { id: testUserId },
            };
            const res = createMockRes();

            await getQrAnalytics(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.totalScans).toBe(2);
            expect(res.body.timeSeries).toEqual([{ date: '2026-09-10', count: 2 }]);
        });
    });

    describe('handleQrRedirect', () => {
        it('should return 404 if QR code is not found by shortId', async () => {
            QrCode.findOneAndUpdate.mockResolvedValue(null);

            const req = {
                params: { shortId: 'nonexistent123' },
                headers: {},
                ip: '127.0.0.1',
            };
            const res = createMockRes();

            await handleQrRedirect(req, res);

            expect(res.statusCode).toBe(404);
            expect(res.body).toMatch(/QR code not found/i);
        });

        it('should record scan telemetry and redirect to targetUrl', async () => {
            const mockDoc = {
                _id: new mongoose.Types.ObjectId(),
                shortId: 'valid123',
                targetUrl: 'https://creatoros.io/official',
            };
            QrCode.findOneAndUpdate.mockResolvedValue(mockDoc);

            const req = {
                params: { shortId: 'valid123' },
                headers: {
                    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
                },
                ip: '203.0.113.195',
            };
            const res = createMockRes();

            await handleQrRedirect(req, res);

            expect(res.redirectUrl).toBe('https://creatoros.io/official');
            expect(QrCode.findOneAndUpdate).toHaveBeenCalledWith(
                { shortId: 'valid123', isDynamic: true },
                expect.objectContaining({
                    $inc: { totalScans: 1 },
                    $push: expect.any(Object),
                }),
                { new: true }
            );
        });
    });
});
