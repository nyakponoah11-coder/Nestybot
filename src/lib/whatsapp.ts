/**
 * Normalizes WhatsApp bot URLs and phone numbers.
 * Supports:
 * - api.whatsapp.com/message/... or wa.me/message/...
 * - Full URLs: https://api.whatsapp.com/message/...
 * - Phone numbers: 0244123456, +233244123456, 233244123456
 * - Ignores WhatsApp channel links (whatsapp.com/channel/...) to prevent opening channels instead of the bot.
 */

export const DEFAULT_WHATSAPP_BOT_URL = "https://wa.me/233200598553";

export function formatWhatsAppBotUrl(input?: string | null): string {
  if (!input) return DEFAULT_WHATSAPP_BOT_URL;
  const raw = input.trim();
  if (!raw) return DEFAULT_WHATSAPP_BOT_URL;

  // Upgrade previous invalid short links or legacy bot phone numbers to the new active bot link
  if (
    raw.includes("U6W5JLVZV72WO1") ||
    raw.includes("SRFE5G7CWA4CL1") ||
    raw.includes("594641841") ||
    raw.includes("593992226")
  ) {
    return DEFAULT_WHATSAPP_BOT_URL;
  }

  // If someone entered a channel link, do not use it for the bot
  if (raw.includes("whatsapp.com/channel/")) {
    return DEFAULT_WHATSAPP_BOT_URL;
  }

  // Direct message links
  if (raw.includes("api.whatsapp.com/message/") || raw.includes("wa.me/message/")) {
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }

  // Pre-existing valid HTTP link that is not a channel
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  // Protocol-less domains
  if (raw.startsWith("api.whatsapp.com/") || raw.startsWith("wa.me/")) {
    return `https://${raw}`;
  }

  // Phone number (e.g. +233 20 059 8553, 0200598553, +233200598553, 233200598553)
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "233" + digits.slice(1);
  } else if (digits.length === 9) {
    digits = "233" + digits;
  }

  if (digits.length >= 9) {
    return `https://wa.me/${digits}`;
  }

  return DEFAULT_WHATSAPP_BOT_URL;
}
