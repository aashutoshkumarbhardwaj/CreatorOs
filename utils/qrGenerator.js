const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const sharp = require('sharp');

/**
 * Pattern presets map to visual module styles.
 * A = squares (default), B = dots, C = rounded, D = classy, E = extra-rounded.
 */
const PATTERN_STYLES = {
    A: 'square',
    B: 'dots',
    C: 'rounded',
    D: 'classy',
    E: 'extra-rounded',
};

/**
 * @function resolveErrorCorrection
 * @description Picks error-correction level. Logo overlays force 'H' so the code
 * remains scannable despite center occlusion (error-correction optimization).
 * @param {object} design
 * @returns {'L'|'M'|'Q'|'H'}
 */
function resolveErrorCorrection(design = {}) {
    if (design.logoUrl) return 'H';
    const level = design.errorCorrectionLevel;
    if (level && ['L', 'M', 'Q', 'H'].includes(level)) return level;
    return 'M';
}

/**
 * @function buildEncodedUrl
 * @description Returns the URL that should be encoded into the QR image.
 * Dynamic codes encode the public redirect `/q/:shortId` so the printed image
 * stays valid when targetUrl changes later.
 * @param {object} qrDoc
 * @param {string} baseUrl
 * @returns {string}
 */
function buildEncodedUrl(qrDoc, baseUrl) {
    if (qrDoc.isDynamic && qrDoc.shortId) {
        return `${baseUrl.replace(/\/$/, '')}/q/${qrDoc.shortId}`;
    }
    return qrDoc.targetUrl;
}

function isLink(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isFinderPatternModule(row, col, moduleCount) {
    return (
        (row < 7 && col < 7) ||
        (row < 7 && col >= moduleCount - 7) ||
        (row >= moduleCount - 7 && col < 7)
    );
}

function shapeForModule({ x, y, moduleSize, fill, style, forceSquare }) {
    if (forceSquare || style === 'square') {
        return `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="${fill}"/>`;
    }

    if (style === 'dots') {
        const r = moduleSize * 0.45;
        const cx = x + moduleSize / 2;
        const cy = y + moduleSize / 2;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
    }

    if (style === 'rounded' || style === 'extra-rounded') {
        const rx = style === 'extra-rounded' ? moduleSize * 0.45 : moduleSize * 0.25;
        return `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" rx="${rx}" ry="${rx}" fill="${fill}"/>`;
    }

    const inset = moduleSize * 0.08;
    const width = moduleSize - inset * 2;
    const rx = width * 0.2;
    return `<rect x="${x + inset}" y="${y + inset}" width="${width}" height="${width}" rx="${rx}" ry="${rx}" fill="${fill}"/>`;
}

/**
 * @function buildPatternedSvg
 * @description Builds an SVG from the raw QR module matrix so presets affect
 * individual modules instead of trying to post-process the library path output.
 * @param {object} qrData
 * @param {object} options
 * @returns {string}
 */
function buildPatternedSvg(qrData, {
    size = 512,
    margin = 2,
    foregroundColor = '#000000',
    backgroundColor = '#FFFFFF',
    patternPreset = 'A',
} = {}) {
    const moduleCount = qrData.modules.size;
    const moduleSize = size / (moduleCount + margin * 2);
    const offset = margin * moduleSize;
    const style = PATTERN_STYLES[patternPreset] || 'square';

    const shapes = [
        `<rect width="${size}" height="${size}" fill="${backgroundColor}"/>`,
    ];

    for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
            if (!qrData.modules.get(row, col)) continue;

            const x = offset + col * moduleSize;
            const y = offset + row * moduleSize;
            shapes.push(shapeForModule({
                x,
                y,
                moduleSize,
                fill: foregroundColor,
                style,
                // Finder patterns need solid square modules so scanners can reliably orient the QR.
                forceSquare: isFinderPatternModule(row, col, moduleCount),
            }));
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="geometricPrecision">${shapes.join('')}</svg>\n`;
}

/**
 * @function generateSvg
 * @description Generates a canonical SVG string for a QR code document.
 * @param {object} qrDoc
 * @param {string} baseUrl
 * @returns {Promise<string>}
 */
async function generateSvg(qrDoc, baseUrl) {
    const design = qrDoc.design || {};
    const encoded = buildEncodedUrl(qrDoc, baseUrl);
    const ecl = resolveErrorCorrection(design);

    const qrData = QRCode.create(encoded, {
        errorCorrectionLevel: ecl,
    });

    return buildPatternedSvg(qrData, {
        size: 512,
        margin: 2,
        foregroundColor: design.foregroundColor || '#000000',
        backgroundColor: design.backgroundColor || '#FFFFFF',
        patternPreset: design.patternPreset || 'A',
    });
}

/**
 * @function compositeLogo
 * @description Overlays an optional logo onto a PNG buffer at ~22% width, centered.
 * Forces high error correction upstream via resolveErrorCorrection when logoUrl is set.
 * @param {Buffer} pngBuffer
 * @param {string|null} logoUrl
 * @returns {Promise<Buffer>}
 */
async function compositeLogo(pngBuffer, logoUrl) {
    if (!logoUrl) return pngBuffer;

    try {
        const response = await fetch(logoUrl, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return pngBuffer;

        const logoBytes = Buffer.from(await response.arrayBuffer());
        const meta = await sharp(pngBuffer).metadata();
        const qrWidth = meta.width || 512;
        const size = Math.max(24, Math.min(Math.round(qrWidth * 0.22), Math.round(qrWidth * 0.28)));
        const padding = Math.max(8, Math.round(size * 0.12));
        // Some hosts redirect thumbnail-looking URLs to large originals; resize and clamp before compositing.
        const resizedLogo = await sharp(logoBytes)
            .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        const badgeSize = size + padding * 2;
        const logoLeft = Math.round((badgeSize - (logoMeta.width || size)) / 2);
        const logoTop = Math.round((badgeSize - (logoMeta.height || size)) / 2);
        const badge = await sharp({
            create: {
                width: badgeSize,
                height: badgeSize,
                channels: 4,
                background: '#FFFFFF',
            },
        })
            .composite([{ input: resizedLogo, left: logoLeft, top: logoTop }])
            .png()
            .toBuffer();

        return sharp(pngBuffer)
            .composite([{ input: badge, gravity: 'centre' }])
            .png()
            .toBuffer();
    } catch (_) {
        // NOTE: logo fetch/composite failures are non-fatal — return base QR
        return pngBuffer;
    }
}

/**
 * @function generatePng
 * @description Generates a canonical PNG buffer (with optional logo overlay).
 * @param {object} qrDoc
 * @param {string} baseUrl
 * @returns {Promise<Buffer>}
 */
async function generatePng(qrDoc, baseUrl) {
    const design = qrDoc.design || {};
    const svg = await generateSvg(qrDoc, baseUrl);
    let pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    pngBuffer = await compositeLogo(pngBuffer, design.logoUrl || null);
    return pngBuffer;
}

/**
 * @function generatePdf
 * @description Builds a one-page PDF embedding the PNG QR plus optional caption.
 * @param {object} qrDoc
 * @param {string} baseUrl
 * @returns {Promise<Buffer>}
 */
async function generatePdf(qrDoc, baseUrl) {
    const pngBuffer = await generatePng(qrDoc, baseUrl);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const title = qrDoc.label || 'QR Code';
        doc.fontSize(18).text(title, { align: 'center' });
        doc.moveDown(0.5);
        const caption = qrDoc.inputType === 'text' ? 'Text QR Code' : qrDoc.targetUrl || '';
        const captionOptions = isLink(qrDoc.targetUrl) ? { align: 'center', link: qrDoc.targetUrl } : { align: 'center' };
        doc.fontSize(10).fillColor('#555555').text(caption, captionOptions);
        doc.moveDown(1.5);

        const imgWidth = 280;
        const x = (doc.page.width - imgWidth) / 2;
        doc.image(pngBuffer, x, doc.y, { width: imgWidth });

        doc.end();
    });
}

/**
 * @function parseDeviceFromUa
 * @description Lightweight UA → device label (no geolocation dependency).
 * @param {string|undefined} ua
 * @returns {string}
 */
function parseDeviceFromUa(ua = '') {
    const value = String(ua).toLowerCase();
    if (!value) return 'Unknown';
    if (/ipad|tablet/.test(value)) return 'Tablet';
    if (/mobi|iphone|android/.test(value)) return 'Mobile';
    return 'Desktop';
}

module.exports = {
    PATTERN_STYLES,
    resolveErrorCorrection,
    buildEncodedUrl,
    generateSvg,
    generatePng,
    generatePdf,
    parseDeviceFromUa,
};
