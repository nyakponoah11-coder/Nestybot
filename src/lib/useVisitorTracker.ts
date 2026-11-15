/**
 * Visitor Tracking Hook
 * Tracks when people open the shop link, attributing source (WhatsApp, Social, Direct)
 * and storing unique visitor metrics for the admin calendar.
 */

const VISITOR_ID_KEY = "data1_visitor_id";
const LAST_VISIT_KEY = "data1_last_visit_time";
const SESSION_TRACKED_KEY = "data1_visit_tracked_session";

export function trackSiteVisit(path = window.location.pathname) {
  if (typeof window === "undefined") return;
  if (path && (path.startsWith("/admin") || path.startsWith("/api"))) return;

  try {
    const now = Date.now();
    const lastVisit = Number(localStorage.getItem(LAST_VISIT_KEY) || 0);

    // If already tracked in this active browser session and within 45 minutes, skip completely
    const sessionTracked = sessionStorage.getItem(SESSION_TRACKED_KEY);
    const isNewSession = !sessionTracked || now - lastVisit > 45 * 60 * 1000;

    if (!isNewSession) {
      return; // Zero egress: skip redundant pings during active browsing
    }

    sessionStorage.setItem(SESSION_TRACKED_KEY, String(now));
    localStorage.setItem(LAST_VISIT_KEY, String(now));

    // Read persistent device ID from localStorage or cookie
    const getCookie = (name: string) => {
      try {
        const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
        return match ? match[2] : null;
      } catch {
        return null;
      }
    };
    const setCookie = (name: string, val: string) => {
      try {
        document.cookie = `${name}=${val}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
    };

    let visitorId = localStorage.getItem(VISITOR_ID_KEY) || getCookie(VISITOR_ID_KEY);
    if (!visitorId) {
      visitorId = `dev_${Math.random().toString(36).slice(2, 9)}_${now.toString(36)}`;
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
      setCookie(VISITOR_ID_KEY, visitorId);
    } else {
      // Ensure kept in sync across both stores
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
      setCookie(VISITOR_ID_KEY, visitorId);
    }

    // Detect referrer / link source
    const searchParams = new URLSearchParams(window.location.search);
    const refParam = (searchParams.get("ref") || searchParams.get("source") || searchParams.get("utm_source") || "").toLowerCase();
    const docRef = (document.referrer || "").toLowerCase();

    let referrer = "Direct Link";
    if (refParam.includes("wa") || refParam.includes("whatsapp") || docRef.includes("whatsapp") || docRef.includes("api.whatsapp.com")) {
      referrer = "WhatsApp Link";
    } else if (refParam.includes("fb") || refParam.includes("facebook") || docRef.includes("facebook") || docRef.includes("fb.com")) {
      referrer = "Facebook";
    } else if (refParam.includes("ig") || refParam.includes("instagram") || docRef.includes("instagram")) {
      referrer = "Instagram";
    } else if (refParam.includes("tiktok") || docRef.includes("tiktok")) {
      referrer = "TikTok";
    } else if (refParam.includes("twitter") || refParam.includes("x") || docRef.includes("t.co") || docRef.includes("twitter") || docRef.includes("x.com")) {
      referrer = "Twitter / X";
    } else if (docRef.includes("google")) {
      referrer = "Google Search";
    } else if (docRef && !docRef.includes(window.location.hostname)) {
      try {
        referrer = new URL(document.referrer).hostname;
      } catch {
        referrer = "External Link";
      }
    }

    // Detect device type
    const ua = navigator.userAgent || "";
    let device = "Desktop";
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      device = "Tablet";
    } else if (/mobile|iphone|ipod|android|blackberry|iemobile|kindle/i.test(ua)) {
      device = "Mobile";
    }

    // Current date in Ghana Timezone (Africa/Accra)
    const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Accra" });

    // Send tracking ping silently in the background
    const payload = JSON.stringify({
      action: "trackVisit",
      visitor_id: visitorId,
      date: dateStr,
      referrer,
      path,
      device,
      is_new_session: isNewSession,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/admin", payload);
    } else {
      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch (_) {
    // Tracking is non-blocking and silent
  }
}
