const dns = require('dns');
const {
    isPrivateIP,
    stripHostnameBrackets,
    assertSafePublicHttpUrl,
} = require('../../utils/ssrf');

describe('ssrf helpers', () => {
    describe('stripHostnameBrackets', () => {
        it('strips brackets from IPv6 hostnames', () => {
            expect(stripHostnameBrackets('[::1]')).toBe('::1');
            expect(stripHostnameBrackets('[fe80::1]')).toBe('fe80::1');
        });

        it('lowercases hostnames without brackets', () => {
            expect(stripHostnameBrackets('Example.COM')).toBe('example.com');
        });
    });

    describe('isPrivateIP', () => {
        it('blocks private and loopback IPv4 addresses', () => {
            expect(isPrivateIP('127.0.0.1')).toBe(true);
            expect(isPrivateIP('10.0.0.5')).toBe(true);
            expect(isPrivateIP('192.168.1.10')).toBe(true);
            expect(isPrivateIP('172.16.0.1')).toBe(true);
            expect(isPrivateIP('169.254.169.254')).toBe(true);
            expect(isPrivateIP('100.64.0.1')).toBe(true);
            expect(isPrivateIP('0.0.0.0')).toBe(true);
        });

        it('blocks IPv6 loopback, link-local, and ULA addresses', () => {
            expect(isPrivateIP('::1')).toBe(true);
            expect(isPrivateIP('[::1]')).toBe(true);
            expect(isPrivateIP('fe80::1')).toBe(true);
            expect(isPrivateIP('fc00::1')).toBe(true);
            expect(isPrivateIP('fd12:3456:789a::1')).toBe(true);
            expect(isPrivateIP('::ffff:127.0.0.1')).toBe(true);
            expect(isPrivateIP('::ffff:169.254.169.254')).toBe(true);
        });

        it('allows public addresses', () => {
            expect(isPrivateIP('8.8.8.8')).toBe(false);
            expect(isPrivateIP('1.1.1.1')).toBe(false);
            expect(isPrivateIP('2001:4860:4860::8888')).toBe(false);
        });
    });

    describe('assertSafePublicHttpUrl', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('rejects non-http protocols', async () => {
            await expect(assertSafePublicHttpUrl('javascript:alert(1)')).rejects.toThrow(
                /Only HTTP and HTTPS/
            );
            await expect(assertSafePublicHttpUrl('ftp://example.com/logo.png')).rejects.toThrow(
                /Only HTTP and HTTPS/
            );
        });

        it('rejects localhost and private IP literals', async () => {
            await expect(assertSafePublicHttpUrl('http://localhost/logo.png')).rejects.toThrow(
                /private or internal/
            );
            await expect(assertSafePublicHttpUrl('http://127.0.0.1/logo.png')).rejects.toThrow(
                /private or internal/
            );
            await expect(assertSafePublicHttpUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
                /private or internal/
            );
            await expect(assertSafePublicHttpUrl('http://[::1]/logo.png')).rejects.toThrow(
                /private or internal/
            );
            await expect(assertSafePublicHttpUrl('http://[fe80::1]/logo.png')).rejects.toThrow(
                /private or internal/
            );
        });

        it('rejects hostnames that resolve to private addresses', async () => {
            jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
                callback(null, [{ address: '127.0.0.1', family: 4 }]);
            });

            await expect(assertSafePublicHttpUrl('https://evil.example/logo.png')).rejects.toThrow(
                /resolves to a private/
            );
        });

        it('allows public http(s) URLs whose DNS is public', async () => {
            jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
                callback(null, [{ address: '93.184.216.34', family: 4 }]);
            });

            await expect(assertSafePublicHttpUrl('https://example.com/logo.png')).resolves.toBeInstanceOf(URL);
        });
    });
});
