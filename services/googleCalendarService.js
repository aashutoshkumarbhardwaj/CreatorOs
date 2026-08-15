const crypto = require("crypto");
const User = require("../model/user");

/**
 * Service to handle Google Calendar Integration and fallback mock behavior.
 */
class GoogleCalendarService {
  /**
   * Check if Google Calendar API environment variables are fully configured.
   */
  static isConfigured() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL)
    );
  }

  /**
   * Get the OAuth redirect URI for Google Calendar authorization.
   */
  static getRedirectUri() {
    return (
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:3000/api/meetings/google/callback"
    );
  }

  /**
   * Generate Google OAuth Auth URL for Google Calendar permission scope.
   */
  static getAuthUrl(state = "") {
    if (!this.isConfigured()) {
      return null;
    }

    const redirectUri = this.getRedirectUri();
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
   */
  static async handleCallback(code, userId) {
    if (!this.isConfigured()) {
      // Mock mode activation
      await User.findByIdAndUpdate(userId, {
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

    // Helper generator for mock Google Meet links
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
        console.warn("Google Calendar API call warning, falling back to generated meet link:", data);
        return {
          eventId: "evt_" + crypto.randomBytes(8).toString("hex"),
          meetingLink: locationType === "google_meet" ? generateMockMeetLink() : (bookingDetails.locationDetails || ""),
          isMock: true,
        };
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
      return {
        eventId: "evt_" + crypto.randomBytes(8).toString("hex"),
        meetingLink: locationType === "google_meet" ? generateMockMeetLink() : (bookingDetails.locationDetails || ""),
        isMock: true,
      };
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
