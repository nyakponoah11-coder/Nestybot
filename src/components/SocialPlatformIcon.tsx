import React from "react";
import { Rocket } from "lucide-react";

/**
 * Official TikTok Logo:
 * Iconic cyan & magenta overlapping musical note on solid black background
 */
export const TikTokIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="TikTok">
    <rect width="48" height="48" rx="12" fill="#010101" />
    {/* Cyan offset */}
    <path
      d="M34.2 16.8a8.9 8.9 0 0 1-5.7-4.4v17.2a9.6 9.6 0 1 1-8.2-9.5v5.1a4.8 4.8 0 1 0 3.4 4.6V7h4.8a8.8 8.8 0 0 0 5.7 5.7v4.1z"
      fill="#25F4EE"
    />
    {/* Magenta offset */}
    <path
      d="M36.2 14.8a8.9 8.9 0 0 1-5.7-4.4v17.2a9.6 9.6 0 1 1-8.2-9.5v5.1a4.8 4.8 0 1 0 3.4 4.6V5h4.8a8.8 8.8 0 0 0 5.7 5.7v4.1z"
      fill="#FE2C55"
    />
    {/* Center white overlap */}
    <path
      d="M35.2 15.8a8.9 8.9 0 0 1-5.7-4.4v17.2a9.6 9.6 0 1 1-8.2-9.5v5.1a4.8 4.8 0 1 0 3.4 4.6V6h4.8a8.8 8.8 0 0 0 5.7 5.7v4.1z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Official Instagram Logo:
 * Iconic vibrant radial/linear gradient background with white camera outline
 */
export const InstagramIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="Instagram">
    <defs>
      <radialGradient id="ig-rg" cx="15%" cy="100%" r="115%">
        <stop offset="0%" stopColor="#FFD521" />
        <stop offset="25%" stopColor="#F50000" />
        <stop offset="70%" stopColor="#B900B4" />
        <stop offset="100%" stopColor="#4A00E0" />
      </radialGradient>
    </defs>
    <rect width="48" height="48" rx="12" fill="url(#ig-rg)" />
    <rect x="11" y="11" width="26" height="26" rx="7.5" stroke="#FFFFFF" strokeWidth="3" />
    <circle cx="24" cy="24" r="6" stroke="#FFFFFF" strokeWidth="3" />
    <circle cx="31.5" cy="16.5" r="1.8" fill="#FFFFFF" />
  </svg>
);

/**
 * Official Facebook Logo:
 * Iconic Facebook blue circle with bold white "f"
 */
export const FacebookIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="Facebook">
    <rect width="48" height="48" rx="12" fill="#1877F2" />
    <path
      d="M32 25h-5v17h-7V25h-3.5v-6H20v-4c0-4.5 2.7-7 6.8-7 2 0 4.1.3 4.1.3v4.6h-2.3c-2.2 0-2.9 1.4-2.9 2.8V19h5.2l-.9 6z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Official YouTube Logo:
 * Iconic red rounded badge with solid white play triangle
 */
export const YouTubeIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="YouTube">
    <rect width="48" height="48" rx="12" fill="#FF0000" />
    <path
      d="M37.5 16.5c-.3-1.3-1.4-2.4-2.7-2.7C32.4 13 24 13 24 13s-8.4 0-10.8.8c-1.3.3-2.4 1.4-2.7 2.7C10 18.9 10 24 10 24s0 5.1.5 7.5c.3 1.3 1.4 2.4 2.7 2.7 2.4.8 10.8.8 10.8.8s8.4 0 10.8-.8c1.3-.3 2.4-1.4 2.7-2.7.5-2.4.5-7.5.5-7.5s0-5.1-.5-7.5z"
      fill="#FFFFFF"
    />
    <path d="M21 29l8-5-8-5v10z" fill="#FF0000" />
  </svg>
);

/**
 * Official Twitter / X Logo:
 * Iconic solid black badge with crisp white mathematical double-struck X
 */
export const TwitterXIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="Twitter / X">
    <rect width="48" height="48" rx="12" fill="#000000" />
    <path
      d="M31.8 12h3.5l-7.7 8.8 9.1 12h-7.1l-5.5-7.2-6.3 7.2h-3.6l8.2-9.4L13.8 12h7.2l5 6.6L31.8 12zm-1.2 18.7h2l-12.8-17h-2.1l12.9 17z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Official Telegram Logo:
 * Iconic sky blue circular badge with white folded paper plane
 */
export const TelegramIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="Telegram">
    <rect width="48" height="48" rx="12" fill="#24A1DE" />
    <path
      d="M12 23.5l19-8c1-.4 1.8.2 1.5 1.5l-3.2 15.3c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.2 9.5-8.6c.4-.4-.1-.6-.6-.2l-11.7 7.4-5-1.6c-1.1-.3-1.1-1.1.3-1.6z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Official WhatsApp Logo:
 * Iconic vibrant green badge with crisp white speech bubble & phone handset
 */
export const WhatsAppIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="WhatsApp">
    <rect width="48" height="48" rx="12" fill="#25D366" />
    <path
      d="M24 10a13.9 13.9 0 0 0-12 21l-1.6 5.8 6-1.6A14 14 0 1 0 24 10zm7.1 19.8c-.3.8-1.7 1.6-2.4 1.7-.6.1-1.4.1-2.3-.2-.5-.2-1.2-.4-2.1-.8-3.7-1.6-6.1-5.3-6.3-5.5-.2-.3-1.6-2.1-1.6-4 0-1.9 1-2.8 1.4-3.2.4-.4.8-.5 1.1-.5.3 0 .5 0 .7.1.3 0 .6.1.9.7.3.7 1 2.5 1.1 2.7.1.2.1.4 0 .6-.1.3-.2.4-.4.7-.2.2-.4.4-.6.6-.2.2-.4.5-.2.8.3.5 1.1 1.8 2.4 3 1.7 1.5 3.1 2 3.6 2.2.4.2.7.2 1-.1.3-.4 1.2-1.4 1.5-1.9.3-.5.6-.4 1-.3.4.2 2.5 1.2 2.9 1.4.4.2.7.3.8.5.1.2.1 1.1-.2 1.9z"
      fill="#FFFFFF"
    />
  </svg>
);

/**
 * Official Spotify Logo:
 * Iconic Spotify green circular badge with black curved sound waves
 */
export const SpotifyIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-label="Spotify">
    <rect width="48" height="48" rx="12" fill="#1DB954" />
    <path
      d="M31.8 30.5c-.3.5-.9.7-1.4.4-3.9-2.4-8.8-2.9-14.6-1.6-.6.1-1.1-.3-1.2-.8-.1-.6.3-1.1.8-1.2 6.3-1.4 11.8-.8 16 1.8.5.3.7.9.4 1.4zm2-4.5c-.4.6-1.2.8-1.7.4-4.5-2.8-11.3-3.6-16.6-2-.7.2-1.4-.2-1.6-.8-.2-.7.2-1.4.8-1.6 6-1.8 13.6-.9 18.7 2.3.5.3.7 1.1.4 1.7zm.2-4.7c-5.4-3.2-14.3-3.5-19.5-1.9-.8.2-1.7-.2-1.9-1-.2-.8.2-1.7 1-1.9 5.9-1.8 15.7-1.5 21.9 2.2.7.4 1 1.4.5 2.1-.4.7-1.3 1-2 .5z"
      fill="#000000"
    />
  </svg>
);

/**
 * Universal Platform Icon Resolver
 * Accurately maps platform names/IDs to their official brand logos.
 */
export const SocialPlatformIcon = ({
  platform,
  className = "size-7",
}: {
  platform: string;
  className?: string;
}) => {
  const p = (platform || "").toLowerCase();

  if (p.includes("tiktok") || p.includes("tik tok")) {
    return <TikTokIcon className={className} />;
  }
  if (p.includes("instagram") || p.includes("insta")) {
    return <InstagramIcon className={className} />;
  }
  if (p.includes("facebook") || p.includes("fb")) {
    return <FacebookIcon className={className} />;
  }
  if (p.includes("youtube") || p.includes("yt")) {
    return <YouTubeIcon className={className} />;
  }
  if (p.includes("twitter") || p === "x" || p.includes("(x)") || p.startsWith("x ") || p.includes("twitter (x)")) {
    return <TwitterXIcon className={className} />;
  }
  if (p.includes("telegram") || p.includes("tg")) {
    return <TelegramIcon className={className} />;
  }
  if (p.includes("whatsapp") || p.includes("wa")) {
    return <WhatsAppIcon className={className} />;
  }
  if (p.includes("spotify")) {
    return <SpotifyIcon className={className} />;
  }

  return <Rocket className={className} />;
};

export default SocialPlatformIcon;
