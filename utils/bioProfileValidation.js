const { isValidUrl } = require("./validators");

const HANDLE_PATTERN = /^[a-zA-Z0-9_-]{3,50}$/;
const MAX_TAGS = 10;
const MAX_LINKS = 25;
const VALID_THEMES = ["light", "dark", "neon", "gradient"];
const VALID_LAYOUTS = ["list", "grid", "cards"];
const SAFE_HEX_BACKGROUND = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

const MAX_AVATAR_DATA_URL_LENGTH = 2_800_000; // ~2MB image as base64

function isOptionalHttpUrl(value) {
  if (!value) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/.test(trimmed)) {
    return trimmed.length <= MAX_AVATAR_DATA_URL_LENGTH;
  }
  return isValidUrl(trimmed);
}

function isSafeBackground(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;
  return SAFE_HEX_BACKGROUND.test(value.trim());
}

function validateHandle(handle) {
  if (!handle) return true;
  return typeof handle === "string" && HANDLE_PATTERN.test(handle.trim());
}

function normalizeTags(tags) {
  if (tags === undefined) return [];
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) {
    return null;
  }

  const normalized = [];
  for (const tag of tags) {
    if (typeof tag !== "string") return null;
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
    if (!link || typeof link !== "object") return null;

    const type = typeof link.type === "string" ? link.type.trim() : "";
    const label = typeof link.label === "string" ? link.label.trim() : "";
    const url = typeof link.url === "string" ? link.url.trim() : "";
    const icon = typeof link.icon === "string" ? link.icon.trim() : undefined;
    const category =
      typeof link.category === "string" ? link.category.trim() : undefined;

    if (
      !type ||
      type.length > 40 ||
      !label ||
      label.length > 80 ||
      !isValidUrl(url.trim())
    ) {
      return null;
    }

    normalized.push({
      type,
      label,
      url,
      ...(icon && { icon }),
      ...(category && { category }),
      ...(link._id && { _id: link._id }),
      featured: !!link.featured,
    });
  }
  return normalized;
}

const MAX_DOMAIN_LENGTH = 255;
const DOMAIN_PATTERN =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function validateBioProfileInput(body = {}) {
  const {
    handle,
    name,
    bio,
    tags,
    avatarUrl,
    links,
    theme,
    layout,
    background,
    contactButton,
    customDomain,
    seoTitle,
    seoDescription,
  } = body;

  if (!validateHandle(handle)) {
    return {
      success: false,
      message:
        "Handle must be 3-50 characters and contain only letters, numbers, hyphens, or underscores",
    };
  }

  if (theme !== undefined && !VALID_THEMES.includes(theme)) {
    return {
      success: false,
      message: `Theme must be one of: ${VALID_THEMES.join(", ")}`,
    };
  }

  if (layout !== undefined && !VALID_LAYOUTS.includes(layout)) {
    return {
      success: false,
      message: `Layout must be one of: ${VALID_LAYOUTS.join(", ")}`,
    };
  }

  if (
    name !== undefined &&
    (typeof name !== "string" || !name.trim() || name.trim().length > 100)
  ) {
    return { success: false, message: "Name must be 1-100 characters" };
  }

  if (bio !== undefined && (typeof bio !== "string" || bio.length > 500)) {
    return { success: false, message: "Bio must be at most 500 characters" };
  }

  if (!isOptionalHttpUrl(avatarUrl)) {
    return {
      success: false,
      message: "Avatar URL must be a valid HTTP or HTTPS URL",
    };
  }

  const normalizedTags = normalizeTags(tags);
  if (!normalizedTags) {
    return {
      success: false,
      message: `Tags must be an array of up to ${MAX_TAGS} non-empty strings`,
    };
  }

  const normalizedLinks = normalizeLinks(links);
  if (!normalizedLinks) {
    return {
      success: false,
      message: `Links must be an array of up to ${MAX_LINKS} valid HTTP or HTTPS links`,
    };
  }

  if (background !== undefined) {
    if (typeof background !== "string" || background.length > 200) {
      return { success: false, message: "Background must be at most 200 characters" };
    }
    if (!isSafeBackground(background)) {
      return {
        success: false,
        message: "Background must be a hex color (#RGB, #RRGGBB, or #RRGGBBAA)",
      };
    }
  }

  let normalizedContactButton;
  if (contactButton !== undefined) {
    if (contactButton === null) {
      normalizedContactButton = null;
    } else if (typeof contactButton !== "object") {
      return { success: false, message: "Contact button must be an object" };
    } else {
      const label = typeof contactButton.label === "string" ? contactButton.label.trim() : "";
      const url = typeof contactButton.url === "string" ? contactButton.url.trim() : "";
      if (label.length > 40 || url.length > 500) {
        return { success: false, message: "Contact button label/url too long" };
      }
      if (url && !isValidUrl(url)) {
        return {
          success: false,
          message: "Contact button URL must be a valid HTTP or HTTPS URL",
        };
      }
      normalizedContactButton = { label, url };
    }
  }

  if (customDomain !== undefined && customDomain !== "" && customDomain !== null) {
    if (typeof customDomain !== "string" || customDomain.length > MAX_DOMAIN_LENGTH || !DOMAIN_PATTERN.test(customDomain.trim())) {
      return { success: false, message: "Custom domain must be a valid domain name" };
    }
  }

  if (seoTitle !== undefined && (typeof seoTitle !== "string" || seoTitle.length > 60)) {
    return { success: false, message: "SEO title must be at most 60 characters" };
  }

  if (seoDescription !== undefined && (typeof seoDescription !== "string" || seoDescription.length > 160)) {
    return { success: false, message: "SEO description must be at most 160 characters" };
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
      ...(theme !== undefined && { theme }),
      ...(layout !== undefined && { layout }),
      ...(background !== undefined && { background: background.trim() }),
      ...(normalizedContactButton !== undefined && { contactButton: normalizedContactButton }),
      ...(customDomain !== undefined && { customDomain: customDomain?.trim() || "" }),
      ...(seoTitle !== undefined && { seoTitle: seoTitle.trim() }),
      ...(seoDescription !== undefined && { seoDescription: seoDescription.trim() }),
    },
  };
}

module.exports = {
  validateBioProfileInput,
  MAX_TAGS,
  MAX_LINKS,
};
