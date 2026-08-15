/**
 * Resolve a Google OAuth profile to a local user without taking over
 * unverified email/password accounts (pre-registration attack).
 */
async function resolveGoogleOAuthUser(profile, User) {
    const email = profile.emails?.[0]?.value?.toLowerCase();

    if (!email) {
        return { ok: false, message: "Google account does not expose an email address." };
    }

    const googleUser = {
        googleId: profile.id,
        name: profile.displayName || email.split("@")[0],
        email,
        avatar: profile.photos?.[0]?.value,
        lastLoginAt: new Date(),
    };

    let user = await User.findOne({ googleId: profile.id });

    if (user) {
        user.name = user.name || googleUser.name;
        user.avatar = googleUser.avatar || user.avatar;
        user.authProvider = user.password ? user.authProvider : "google";
        user.lastLoginAt = googleUser.lastLoginAt;
        user.isVerified = true;
        await user.save();
        return { ok: true, user };
    }

    user = await User.findOne({ email });

    if (user) {
        const alreadyLinkedToThisGoogle =
            user.googleId && String(user.googleId) === String(googleUser.googleId);

        if (!user.isVerified && !alreadyLinkedToThisGoogle) {
            return {
                ok: false,
                message:
                    "Account exists but is not verified. Verify email or use password login after verification.",
            };
        }

        user.googleId = googleUser.googleId;
        user.name = user.name || googleUser.name;
        user.avatar = googleUser.avatar || user.avatar;
        user.authProvider = user.password ? user.authProvider : "google";
        user.lastLoginAt = googleUser.lastLoginAt;
        // Keep existing verified status; do not elevate unverified accounts here.
        await user.save();
        return { ok: true, user };
    }

    user = await User.create({
        ...googleUser,
        authProvider: "google",
        isVerified: true,
    });
    return { ok: true, user };
}

module.exports = { resolveGoogleOAuthUser };
