const dns = require('dns');
const net = require('net');

/**
 * @function stripHostnameBrackets
 * @description Removes surrounding brackets from IPv6 hostnames (e.g. "[::1]" → "::1").
 * @param {string} hostname
 * @returns {string}
 */
function stripHostnameBrackets(hostname) {
    if (typeof hostname !== 'string') return '';
    const trimmed = hostname.trim().toLowerCase();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

/**
 * @function isPrivateIPv4
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv4(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
        return false;
    }

    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 100.64.0.0/10 (CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 127.0.0.0/8
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local / cloud metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 198.18.0.0/15 (benchmarking)
    if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return true;

    return false;
}

/**
 * @function expandIPv6
 * @description Expands an IPv6 address into eight 16-bit hex groups.
 * @param {string} ip
 * @returns {string[]|null}
 */
function expandIPv6(ip) {
    if (!net.isIPv6(ip)) return null;

    let address = ip.toLowerCase();
    if (address.startsWith('::ffff:')) {
        const mapped = address.slice(7);
        if (net.isIPv4(mapped)) {
            const parts = mapped.split('.').map((part) => Number(part).toString(16).padStart(2, '0'));
            address = `::ffff:${parts[0]}${parts[1]}:${parts[2]}${parts[3]}`;
        }
    }

    const [left, right = ''] = address.split('::');
    const leftParts = left ? left.split(':') : [];
    const rightParts = right ? right.split(':') : [];
    const missing = 8 - (leftParts.length + rightParts.length);
    if (missing < 0) return null;

    const parts = [
        ...leftParts,
        ...Array.from({ length: missing }, () => '0'),
        ...rightParts,
    ].map((part) => part.padStart(4, '0'));

    return parts.length === 8 ? parts : null;
}

/**
 * @function isPrivateIPv6
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIPv6(ip) {
    const parts = expandIPv6(ip);
    if (!parts) return false;

    const first = parseInt(parts[0], 16);

    // :: and ::1 (unspecified / loopback)
    if (parts.every((part) => part === '0000')) return true;
    if (
        parts.slice(0, 7).every((part) => part === '0000') &&
        parts[7] === '0001'
    ) {
        return true;
    }

    // IPv4-mapped / IPv4-compatible — check embedded IPv4
    if (
        parts.slice(0, 5).every((part) => part === '0000') &&
        (parts[5] === '0000' || parts[5] === 'ffff')
    ) {
        const hi = parseInt(parts[6], 16);
        const lo = parseInt(parts[7], 16);
        const mapped = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateIPv4(mapped);
    }

    // fe80::/10 link-local
    if ((first & 0xffc0) === 0xfe80) return true;
    // fc00::/7 unique local (ULA)
    if ((first & 0xfe00) === 0xfc00) return true;

    return false;
}

/**
 * @function isPrivateIP
 * @description Returns true for private, loopback, link-local, ULA, CGNAT, and metadata ranges.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIP(ip) {
    if (typeof ip !== 'string' || !ip) return false;
    const normalized = stripHostnameBrackets(ip);

    if (net.isIPv4(normalized)) return isPrivateIPv4(normalized);
    if (net.isIPv6(normalized)) return isPrivateIPv6(normalized);
    return false;
}

/**
 * @function lookupAllAddresses
 * @param {string} hostname
 * @returns {Promise<string[]>}
 */
function lookupAllAddresses(hostname) {
    return new Promise((resolve) => {
        dns.lookup(hostname, { all: true }, (err, addrs) => {
            if (err || !Array.isArray(addrs)) {
                resolve([]);
                return;
            }
            resolve(addrs.map((entry) => entry.address));
        });
    });
}

/**
 * @function assertSafePublicHttpUrl
 * @description Ensures a URL is http(s) and does not target private/internal addresses.
 * Performs DNS resolution and re-checks every returned address.
 * @param {string} urlString
 * @returns {Promise<URL>}
 */
async function assertSafePublicHttpUrl(urlString) {
    if (typeof urlString !== 'string' || !urlString.trim()) {
        throw new Error('Invalid URL');
    }

    let parsed;
    try {
        parsed = new URL(urlString.trim());
    } catch {
        throw new Error('Invalid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
    }

    const hostname = stripHostnameBrackets(parsed.hostname);
    if (!hostname) {
        throw new Error('Invalid URL hostname');
    }

    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('URL points to a private or internal network address');
    }

    if (net.isIP(hostname) && isPrivateIP(hostname)) {
        throw new Error('URL points to a private or internal network address');
    }

    const addresses = await lookupAllAddresses(hostname);
    if (!addresses.length && !net.isIP(hostname)) {
        throw new Error('Unable to resolve URL hostname');
    }

    for (const addr of addresses) {
        if (isPrivateIP(addr)) {
            throw new Error('URL resolves to a private or internal network address');
        }
    }

    return parsed;
}

module.exports = {
    stripHostnameBrackets,
    isPrivateIP,
    assertSafePublicHttpUrl,
};
