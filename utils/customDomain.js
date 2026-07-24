const DOMAIN_PATTERN = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function normalizeCustomDomain(value) {
    if (typeof value !== "string") return null;

    const domain = value.trim().toLowerCase().replace(/\.$/, "");
    if (!domain) return null;
    if (domain.includes("://") || /[/?#]/.test(domain)) return null;

    return DOMAIN_PATTERN.test(domain) ? domain : null;
}

module.exports = {
    normalizeCustomDomain,
};
