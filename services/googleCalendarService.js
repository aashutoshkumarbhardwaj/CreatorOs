const crypto = require("crypto");
const User = require("../model/user");

/**
 * Service to handle Google Calendar Integration and fallback mock behavior.
 */
class GoogleCalendarService {
  static isConfigured() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL)
    );
  }

  static getRedirectUri() {
    return (
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:3000/api/meetings/google/callback"
    );
  }

  /**
   * Generate an integrity-protected OAuth state value. The user id is not
   * trusted until the signature and freshness checks succeed in handleCallback.
   */
  static createOAuthState(userId) {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(32).toString("hex");
    const payload = `${userId}.${timestamp}.${nonce}`;
    const secret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
  }

  /**
   * Validate and recover the creator id from an OAuth state value.
   * State values expire after ten minutes and are cryptographically bound to
   * the server secret, so a caller cannot replace the target user id.
   */
  static verifyOAuthState(state) {
    if (!state || typeof state !== "string") return null;

    const [encodedPayload, signature] = state.split(".");
    if (!encodedPayload || !signature) return null;

    const secret = process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET;
    if (!secret) return null;

    let payload;
    try {
      payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    } catch (_error) {
      return null;
    }

    const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    const [userId, timestamp, nonce] = payload.split(".");
    const issuedAt = Number(timestamp);
    const tenMinutes = 10 * 60 * 1000;

    if (!/^[0-9a-fA-F]{24}$/.test(userId) || !nonce || !Number.isFinite(issuedAt)) {
      return null;
    }

    if (Date.now() - issuedAt < 0 || Date.now() - issuedAt > tenMinutes) {
      return null;
    }

    return userId;
  }

  /**
   * Generate Google OAuth Auth URL for Google Calendar permission scope.
   */
  static getAuthUrl(userId = "") {
    if (!this.isConfigured()) {
      return null;
    }

    const redirectUri = this.getRedirectUri();
    const state = this.createOAuthState(userId);
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle OAuth authorization code callback & save user tokens.
   * In configured mode, the second argument must be a valid signed OAuth state.
   * In mock mode it remains a direct user id because no external OAuth flow is used.
   */
  static async handleCallback(code, state) {
    if (!this.isConfigured()) {
      await User.findByIdAndUpdate(state, {
        googleCalendarTokens: {
          accessToken: "mock_access_token_" + crypto.randomBytes(8).toString("hex"),
          refreshToken: "mock_refresh_token_" + crypto.randomBytes(8).toString("hex"),
          expiryDate: new Date(Date.now() + 3600 * 1000),
          calendarId: "primary",
          isConnected: true,
        },
      });
      return { success: true, mock: true };
    }

    const userId = this.verifyOAuthState(state);
    if (!userId) {
      throw new Error("Invalid or expired Google Calendar OAuth state");
    }

    try {
      const redirectUri = this.getRedirectUri();
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || "Failed to exchange authorization code");
      }

      const expiryDate = new Date(Date.now() + data.expires_in * 1000);

      await User.findByIdAndUpdate(userId, {
        googleCalendarTokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
          expiryDate,
          calendarId: "primary",
          isConnected: true,
        },
      });

      return { success: true, mock: false };
    } catch (error) {
      console.error("Google Calendar OAuth Error:", error.message);
      throw error;
    }
  }

  /**
   * Create Google Calendar Event with automated Google Meet video link.
   */
  static async createCalendarEvent(user, bookingDetails) {
    const { title, description, startTime, endTime, attendeeName, attendeeEmail, locationType } = bookingDetails;

    const tokens = user.googleCalendarTokens || {};

    const generateMockMeetLink = () => {
      const p1 = Math.random().toString(36).substring(2, 5);
      const p2 = Math.random().toString(36).substring(2, 6);
      const p3 = Math.random().toString(36).substring(2, 5);
      return `https://meet.google.com/${p1}-${p2}-${p3}`;
    };

    if (!tokens.isConnected || !tokens.accessToken || tokens.accessToken.startsWith("mock_") || !this.isConfigured()) {
      const mockMeetLink = locationType === "google_meet" ? generateMockMeetLink() : (bookingDetails.locationDetails || "");
      return {
        eventId: "mock_evt_" + crypto.randomBytes(8).toString("hex"),
        meetingLink: mockMeetLink,
        isMock: true,
      };
    }

    try {
      const eventPayload = {
        summary: title,
        description: `${description || ""}\n\nAttendee: ${attendeeName} (${attendeeEmail})`,
        start: { dateTime: new Date(startTime).toISOString() },
        end: { dateTime: new Date(endTime).toISOString() },
        attendees: [
          { email: attendeeEmail, displayName: attendeeName },
          { email: user.email, displayName: user.name },
        ],
      };

      if (locationType === "google_meet") {
        eventPayload.conferenceData = {
          createRequest: {
            requestId: "meet_" + crypto.randomBytes(8).toString("hex"),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        };
      }

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const error = new Error(data.error?.message || data.error_description || `Google Calendar API request failed with status ${res.status}`);
        error.code = "GOOGLE_CALENDAR_API_ERROR";
        error.status = res.status;
        throw error;
      }

      let meetLink = "";
      if (data.conferenceData && data.conferenceData.entryPoints) {
        const videoEntry = data.conferenceData.entryPoints.find((ep) => ep.entryPointType === "video");
        if (videoEntry) meetLink = videoEntry.uri;
      }

      if (!meetLink && locationType === "google_meet") {
        meetLink = data.hangoutLink || generateMockMeetLink();
      }

      return {
        eventId: data.id,
        meetingLink: meetLink,
        isMock: false,
      };
    } catch (err) {
      console.error("Error creating Google Calendar event:", err.message);
      throw err;
    }
  }

  /**
   * Delete Google Calendar Event when booking is cancelled.
   */
  static async deleteCalendarEvent(user, googleEventId) {
    if (!googleEventId || googleEventId.startsWith("mock_") || googleEventId.startsWith("evt_")) {
      return { success: true, mock: true };
    }

    const tokens = user.googleCalendarTokens || {};
    if (!tokens.isConnected || !tokens.accessToken) {
      return { success: true, mock: true };
    }

    try {
      await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      );
      return { success: true };
    } catch (err) {
      console.error("Error deleting calendar event:", err.message);
      return { success: false };
    }
  }
}

module.exports = GoogleCalendarService;
