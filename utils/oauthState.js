const crypto = require("crypto");

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret() {
  return process.env.JWT_SECRET || "dev_secret_key_creatoros_2026";
}

function generateState(userId) {
  const payload = JSON.stringify({
    uid: userId,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function validateState(state) {
  if (!state || typeof state !== "string") return null;

  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const encoded = state.slice(0, dotIndex);
  const sig = state.slice(dotIndex + 1);

  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expectedSigBuf = Buffer.from(expectedSig);

  if (
    sigBuf.length !== expectedSigBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedSigBuf)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (!payload.uid || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

module.exports = { generateState, validateState };
