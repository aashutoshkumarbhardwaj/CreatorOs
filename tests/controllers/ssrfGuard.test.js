const { isPrivateIP, isSSRFBlocked, validateURL } = require('../../controller/url');

describe('SSRF guard IPv6 handling', () => {
    describe('isPrivateIP', () => {
        it('blocks IPv4-mapped IPv6 in dotted form', () => {
            expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
            expect(isPrivateIP('::ffff:10.0.0.1')).toBe(true);
            expect(isPrivateIP('::ffff:192.168.1.1')).toBe(true);
            expect(isPrivateIP('::ffff:169.254.169.254')).toBe(true);
        });

        it('blocks IPv4-mapped IPv6 in hex-compressed form', () => {
            expect(isPrivateIP('::ffff:7f00:1')).toBe(true);
            expect(isPrivateIP('::ffff:a00:1')).toBe(true);
            expect(isPrivateIP('::ffff:0a00:0a')).toBe(true);
        });

        it('blocks other private IPv6 ranges', () => {
            expect(isPrivateIP('fc00::1')).toBe(true);
            expect(isPrivateIP('fd00::1')).toBe(true);
            expect(isPrivateIP('fe80::1')).toBe(true);
            expect(isPrivateIP('::1')).toBe(true);
            expect(isPrivateIP('::')).toBe(true);
        });

        it('does not block public IPv4-mapped addresses', () => {
            expect(isPrivateIP('::ffff:8.8.8.8')).toBe(false);
            expect(isPrivateIP('::ffff:1.1.1.1')).toBe(false);
        });
    });

    describe('isSSRFBlocked', () => {
        it('strips brackets from IPv6 literals before checking', () => {
            expect(isSSRFBlocked('[::ffff:127.0.0.1]')).toBe(true);
            expect(isSSRFBlocked('[::ffff:7f00:1]')).toBe(true);
            expect(isSSRFBlocked('[fe80::1]')).toBe(true);
            expect(isSSRFBlocked('[fc00::1]')).toBe(true);
            expect(isSSRFBlocked('[::1]')).toBe(true);
        });

        it('still blocks plain IPv4 private addresses', () => {
            expect(isSSRFBlocked('127.0.0.1')).toBe(true);
            expect(isSSRFBlocked('10.0.0.5')).toBe(true);
            expect(isSSRFBlocked('169.254.169.254')).toBe(true);
        });

        it('allows public IPs', () => {
            expect(isSSRFBlocked('8.8.8.8')).toBe(false);
            expect(isSSRFBlocked('[::ffff:8.8.8.8]')).toBe(false);
        });
    });

    describe('validateURL', () => {
        it('rejects URLs pointing at private IPv4-mapped IPv6', async () => {
            await expect(validateURL('http://[::ffff:127.0.0.1]:3000/')).rejects.toThrow('private or internal');
            await expect(validateURL('http://[::ffff:7f00:1]/')).rejects.toThrow('private or internal');
            await expect(validateURL('http://[::ffff:169.254.169.254]/')).rejects.toThrow('private or internal');
        });

        it('rejects URLs pointing at private IPv6 ranges', async () => {
            await expect(validateURL('http://[fc00::1]/')).rejects.toThrow('private or internal');
            await expect(validateURL('http://[fe80::1]/')).rejects.toThrow('private or internal');
            await expect(validateURL('http://[::1]/')).rejects.toThrow('private or internal');
        });
    });
});
