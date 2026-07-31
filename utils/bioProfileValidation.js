const { isValidUrl } = require('./validators');

const HANDLE_PATTERN = /^[a-zA-Z0-9_-]{3,50}$/;
const MAX_TAGS = 10;
const MAX_LINKS = 25;

function isOptionalHttpUrl(value) {
    return !value || (typeof value === 'string' && isValidUrl(value.trim()));
}

function validateHandle(handle) {
    if (!handle) return true;
    return typeof handle === 'string' && HANDLE_PATTERN.test(handle.trim());
}

function normalizeTags(tags) {
    if (tags === undefined) return [];
    if (!Array.isArray(tags) || tags.length > MAX_TAGS) {
        return null;
    }

    const normalized = [];
    for (const tag of tags) {
        if (typeof tag !== 'string') return null;
        const value = tag.trim();
        if (!value || value.length > 30) return null;
        normalized.push(value);
    }
    return normalized;
}

function normalizeLinks(links) {
    if (links === undefined) return [];
    if (!Array.isArray(links) || links.length > MAX_LINKS) {
        return null;
    }

    const normalized = [];
    for (const link of links) {
        if (!link || typeof link !== 'object') return null;

        const type = typeof link.type === 'string' ? link.type.trim() : '';
        const label = typeof link.label === 'string' ? link.label.trim() : '';
        const url = typeof link.url === 'string' ? link.url.trim() : '';
        const icon = typeof link.icon === 'string' ? link.icon.trim() : undefined;
        const category = typeof link.category === 'string' ? link.category.trim() : undefined;

        if (!type || type.length > 40 || !label || label.length > 80 || !isValidUrl(url.trim())) {
            return null;
        }

        normalized.push({
            type,
            label,
            url,
            ...(icon && { icon }),
            ...(category && { category }),
            ...(link._id && { _id: link._id }),
        });
    }
    return normalized;
}

function validateBioProfileInput(body = {}) {
    const { handle, name, bio, tags, avatarUrl, links } = body;

    if (!validateHandle(handle)) {
        return { success: false, message: 'Handle must be 3-50 characters and contain only letters, numbers, hyphens, or underscores' };
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
        return { success: false, message: 'Name must be 1-100 characters' };
    }

    if (bio !== undefined && (typeof bio !== 'string' || bio.length > 500)) {
        return { success: false, message: 'Bio must be at most 500 characters' };
    }

    if (!isOptionalHttpUrl(avatarUrl)) {
        return { success: false, message: 'Avatar URL must be a valid HTTP or HTTPS URL' };
    }

    const normalizedTags = normalizeTags(tags);
    if (!normalizedTags) {
        return { success: false, message: `Tags must be an array of up to ${MAX_TAGS} non-empty strings` };
    }

    const normalizedLinks = normalizeLinks(links);
    if (!normalizedLinks) {
        return { success: false, message: `Links must be an array of up to ${MAX_LINKS} valid HTTP or HTTPS links` };
    }

    return {
        success: true,
        data: {
            handle: handle?.trim(),
            name: name?.trim(),
            bio,
            tags: normalizedTags,
            avatarUrl: avatarUrl?.trim(),
            links: normalizedLinks,
        },
    };
}

module.exports = {
    validateBioProfileInput,
    MAX_TAGS,
    MAX_LINKS,
};
