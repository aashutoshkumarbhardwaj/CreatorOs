/**
 * Smart Bio Theme & Lead Capture Engine
 */

const PRESET_PALETTES = {
  midnight_neon: {
    bgColor1: "#0F172A",
    bgColor2: "#020617",
    cardBg: "rgba(30, 41, 59, 0.7)",
    textColor: "#F8FAFC",
    accentColor: "#38BDF8",
    borderRadiusPx: 14,
    fontFamily: "Outfit",
  },
  minimal_clean: {
    bgColor1: "#FFFFFF",
    bgColor2: "#F1F5F9",
    cardBg: "#FFFFFF",
    textColor: "#0F172A",
    accentColor: "#2563EB",
    borderRadiusPx: 8,
    fontFamily: "Inter",
  },
  sunset_glow: {
    bgColor1: "#4C0519",
    bgColor2: "#831843",
    cardBg: "rgba(255, 255, 255, 0.12)",
    textColor: "#FFF1F2",
    accentColor: "#F43F5E",
    borderRadiusPx: 20,
    fontFamily: "Outfit",
  },
  glassmorphic_aurora: {
    bgColor1: "#064E3B",
    bgColor2: "#0F172A",
    cardBg: "rgba(255, 255, 255, 0.15)",
    textColor: "#ECFDF5",
    accentColor: "#34D399",
    borderRadiusPx: 16,
    fontFamily: "Space Grotesk",
  },
};

/**
 * Generate CSS variable block for theme injection
 */
function generateCssVariables(themePreset, customStyles = {}) {
  const palette = PRESET_PALETTES[themePreset] || PRESET_PALETTES.midnight_neon;
  const s = { ...palette, ...customStyles };

  // Sanitize hex colors to prevent CSS injection
  const sanitizeHex = (hex, fallback) => (/^#[0-9A-Fa-f]{3,8}$/.test(hex) ? hex : fallback);

  const bg1 = sanitizeHex(s.bgColor1, palette.bgColor1);
  const bg2 = sanitizeHex(s.bgColor2, palette.bgColor2);
  const text = sanitizeHex(s.textColor, palette.textColor);
  const accent = sanitizeHex(s.accentColor, palette.accentColor);
  const radius = Math.min(32, Math.max(0, Number(s.borderRadiusPx) || 12));

  return `:root {
  --bio-bg-1: ${bg1};
  --bio-bg-2: ${bg2};
  --bio-card-bg: ${s.cardBg || "rgba(255,255,255,0.1)"};
  --bio-text-color: ${text};
  --bio-accent-color: ${accent};
  --bio-border-radius: ${radius}px;
  --bio-font-family: '${s.fontFamily || "Inter"}', sans-serif;
}`;
}

/**
 * Validate RFC-5322 basic email format
 */
function isValidLeadEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase());
}

/**
 * Calculate Bio Click-Through Rate
 */
function computeBioCtr(totalViews, totalClicks) {
  if (!totalViews || totalViews <= 0) return 0;
  return Number(((totalClicks / totalViews) * 100).toFixed(1));
}

module.exports = {
  PRESET_PALETTES,
  generateCssVariables,
  isValidLeadEmail,
  computeBioCtr,
};
