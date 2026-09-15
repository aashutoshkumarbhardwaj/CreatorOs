process.env.USE_MOCK_DB = "true";
const {
    PATTERN_STYLES,
    resolveErrorCorrection,
    buildEncodedUrl,
    generateSvg,
    generatePng,
    generatePdf,
    parseDeviceFromUa,
} = require('../../utils/qrGenerator');

describe('qrGenerator utility', () => {
    describe('PATTERN_STYLES mapping', () => {
        it('should define expected pattern styles for presets A through E', () => {
            expect(PATTERN_STYLES.A).toBe('square');
            expect(PATTERN_STYLES.B).toBe('dots');
            expect(PATTERN_STYLES.C).toBe('rounded');
            expect(PATTERN_STYLES.D).toBe('classy');
            expect(PATTERN_STYLES.E).toBe('extra-rounded');
        });
    });

    describe('resolveErrorCorrection', () => {
        it('should force high error correction (H) when logoUrl is present', () => {
            const level = resolveErrorCorrection({ logoUrl: 'https://example.com/logo.png', errorCorrectionLevel: 'L' });
            expect(level).toBe('H');
        });

        it('should return the specified valid error correction level when no logoUrl', () => {
            expect(resolveErrorCorrection({ errorCorrectionLevel: 'L' })).toBe('L');
            expect(resolveErrorCorrection({ errorCorrectionLevel: 'M' })).toBe('M');
            expect(resolveErrorCorrection({ errorCorrectionLevel: 'Q' })).toBe('Q');
            expect(resolveErrorCorrection({ errorCorrectionLevel: 'H' })).toBe('H');
        });

        it('should default to M when no errorCorrectionLevel or an invalid level is provided', () => {
            expect(resolveErrorCorrection({})).toBe('M');
            expect(resolveErrorCorrection({ errorCorrectionLevel: 'INVALID' })).toBe('M');
            expect(resolveErrorCorrection(undefined)).toBe('M');
        });
    });

    describe('buildEncodedUrl', () => {
        const baseUrl = 'https://creatoros.io';

        it('should return short redirect URL when isDynamic is true and shortId exists', () => {
            const qrDoc = { isDynamic: true, shortId: 'abc1234', targetUrl: 'https://github.com' };
            const encoded = buildEncodedUrl(qrDoc, baseUrl);
            expect(encoded).toBe('https://creatoros.io/q/abc1234');
        });

        it('should strip trailing slash from baseUrl when building redirect URL', () => {
            const qrDoc = { isDynamic: true, shortId: 'xyz987', targetUrl: 'https://github.com' };
            const encoded = buildEncodedUrl(qrDoc, 'https://creatoros.io/');
            expect(encoded).toBe('https://creatoros.io/q/xyz987');
        });

        it('should return direct targetUrl when isDynamic is false', () => {
            const qrDoc = { isDynamic: false, shortId: 'abc1234', targetUrl: 'https://mywebsite.com' };
            const encoded = buildEncodedUrl(qrDoc, baseUrl);
            expect(encoded).toBe('https://mywebsite.com');
        });

        it('should return targetUrl when shortId is missing even if isDynamic is true', () => {
            const qrDoc = { isDynamic: true, targetUrl: 'https://mywebsite.com' };
            const encoded = buildEncodedUrl(qrDoc, baseUrl);
            expect(encoded).toBe('https://mywebsite.com');
        });
    });

    describe('parseDeviceFromUa', () => {
        it('should return Unknown for empty, null, or undefined user-agents', () => {
            expect(parseDeviceFromUa('')).toBe('Unknown');
            expect(parseDeviceFromUa(null)).toBe('Unknown');
            expect(parseDeviceFromUa(undefined)).toBe('Unknown');
        });

        it('should detect Tablet devices', () => {
            const ipadUa = 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15';
            expect(parseDeviceFromUa(ipadUa)).toBe('Tablet');

            const androidTabletUa = 'Mozilla/5.0 (Linux; Android 11; SM-T870) AppleWebKit/537.36';
            expect(parseDeviceFromUa(androidTabletUa)).toBe('Tablet');
        });

        it('should detect Mobile devices', () => {
            const iphoneUa = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';
            expect(parseDeviceFromUa(iphoneUa)).toBe('Mobile');

            const androidPhoneUa = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';
            expect(parseDeviceFromUa(androidPhoneUa)).toBe('Mobile');
        });

        it('should default to Desktop for non-mobile user-agents', () => {
            const macDesktopUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
            expect(parseDeviceFromUa(macDesktopUa)).toBe('Desktop');

            const winDesktopUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
            expect(parseDeviceFromUa(winDesktopUa)).toBe('Desktop');
        });
    });

    describe('generateSvg', () => {
        const baseUrl = 'https://creatoros.io';

        it('should generate valid SVG XML with default design options', async () => {
            const qrDoc = { targetUrl: 'https://creatoros.io' };
            const svg = await generateSvg(qrDoc, baseUrl);

            expect(typeof svg).toBe('string');
            expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('viewBox="0 0 512 512"');
            expect(svg).toContain('</svg>');
        });

        it('should honor custom foreground and background colors', async () => {
            const qrDoc = {
                targetUrl: 'https://example.com',
                design: {
                    foregroundColor: '#123456',
                    backgroundColor: '#abcdef',
                },
            };
            const svg = await generateSvg(qrDoc, baseUrl);

            expect(svg).toContain('fill="#123456"');
            expect(svg).toContain('fill="#abcdef"');
        });

        it('should render SVG for different pattern presets', async () => {
            for (const preset of ['A', 'B', 'C', 'D', 'E']) {
                const qrDoc = {
                    targetUrl: 'https://example.com',
                    design: { patternPreset: preset },
                };
                const svg = await generateSvg(qrDoc, baseUrl);
                expect(svg).toContain('<svg');
                expect(svg).toContain('</svg>');
            }
        });
    });

    describe('generatePng', () => {
        const baseUrl = 'https://creatoros.io';

        it('should generate a valid PNG buffer', async () => {
            const qrDoc = { targetUrl: 'https://creatoros.io' };
            const pngBuffer = await generatePng(qrDoc, baseUrl);

            expect(Buffer.isBuffer(pngBuffer)).toBe(true);
            expect(pngBuffer.length).toBeGreaterThan(0);
            // Verify PNG magic header bytes: 89 50 4E 47 0D 0A 1A 0A
            expect(pngBuffer.subarray(0, 8)).toEqual(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            );
        });
    });

    describe('generatePdf', () => {
        const baseUrl = 'https://creatoros.io';

        it('should generate a valid PDF buffer with url input type', async () => {
            const qrDoc = {
                label: 'Creator Bio QR',
                targetUrl: 'https://creatoros.io/@creator',
                inputType: 'url',
            };
            const pdfBuffer = await generatePdf(qrDoc, baseUrl);

            expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
            expect(pdfBuffer.length).toBeGreaterThan(0);
            // Verify PDF header %PDF
            expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
        });

        it('should generate a valid PDF buffer with text input type', async () => {
            const qrDoc = {
                label: 'Creator Note',
                targetUrl: 'Special discount code: CREATOR2026',
                inputType: 'text',
            };
            const pdfBuffer = await generatePdf(qrDoc, baseUrl);

            expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
            expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
        });
    });
});
