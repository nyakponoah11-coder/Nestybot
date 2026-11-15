"use client";

import { useMemo, useEffect } from "react";

const ghanaianNames = [
  "Stony",
  "Kwame Asare",
  "Ama Serwaa",
  "Kofi Mensah",
  "Abena Osei",
  "Yaw Boateng",
  "Efua Agyeman",
  "Kwadwo Frimpong",
  "Akua Poku",
  "Kojo Nkrumah",
  "Akosua Bonsu",
  "Kwabena Owusu",
  "Afia Danso",
  "Nana Yaa",
  "Fiifi Annan",
  "Esi Quansah",
  "Kwesi Arthur",
  "Adwoa Baffoe",
  "Kwaku Duah",
  "Ama Darko",
  "Yaw Ofori",
  "Efia Okyere",
  "Kwame Acheampong",
  "Aba Mensah",
  "Kofi Addo",
  "Akosua Kyere",
  "Kojo Sarpong",
  "Adwoa Ntim",
  "Yaw Gyasi",
  "Efua Owusu",
];

const reviews = [
  "I bought 10GB from Data One and received it instantly! Data One is legit",
  "Just got 5GB MTN from Data One in under 2 minutes. Best prices in Ghana!",
  "Data One delivered my Telecel 2GB bundle before I even finished my tea. Amazing!",
  "Been using Data One for months. Never had a failed delivery. Highly recommended!",
  "AirtelTigo 3GB from Data One hit my phone in 60 seconds. Fastest service ever!",
  "Data One prices beat everyone. Got 1GB MTN for cheap and it arrived instantly.",
  "My go-to for data bundles. Data One never disappoints. 5GB Telecel in 3 mins!",
  "Stony from Data One helped me when my order was stuck. Fixed in seconds!",
  "Data One is the real deal. Bought 2GB AirtelTigo and it was there before I refreshed.",
  "Always reliable. Data One 5GB MTN bundle delivered in under 5 minutes every time.",
  "Best data shop in Ghana hands down. Data One 10GB Telecel instant delivery!",
  "Data One saved me when I needed data urgently. 3GB AirtelTigo in 90 seconds!",
  "Been a customer for a year. Data One has the best prices and fastest delivery.",
  "Data One 1GB MTN for my mom - she got it before I could call her. Incredible!",
  "No stress, no hidden fees. Data One 2GB Telecel delivered perfectly.",
  "Data One is my secret weapon for cheap data. 5GB MTN every month, instant!",
  "Fastest customer service ever. Data One team responds in seconds on WhatsApp.",
  "Data One 3GB AirtelTigo bundle - received it while still on the payment page!",
  "Unbeatable prices. Data One 10GB MTN for less than buying direct. Legit!",
  "Never had issues with Data One. 1GB Telecel instant every single time.",
  "Data One delivered 2GB AirtelTigo to my second phone seamlessly. Pro service.",
  "My whole family uses Data One now. 5GB bundles for everyone, instant delivery!",
  "Data One 3GB MTN - paid, blinked, data was there. This is how it should work.",
  "Telecel 2GB from Data One in 45 seconds. Fastest in Kumasi for sure!",
  "Data One prices are honest. No surprises, just cheap data delivered fast.",
  "Needed data for my trip. Data One 5GB AirtelTigo ready before I packed. Thanks!",
  "Data One 1GB MTN - simplest purchase ever. Paid MoMo, got data, done.",
  "Reliable, fast, cheap. Data One is the only place I buy bundles now.",
  "Data One 2GB Telecel for my sister - she's in Tamale, got it instantly!",
  "Best decision switching to Data One. 3GB MTN every week, never a delay.",
];

function getRandomColor() {
  const colors = [
    "bg-amber-500",
    "bg-emerald-500",
    "bg-sky-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-lime-500",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getInitials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPravatarUrl(name) {
  const seed = name.replace(/\s+/g, "").toLowerCase();
  return `https://i.pravatar.cc/40?u=${encodeURIComponent(seed)}`;
}

function buildPool() {
  const shuffledNames = [...ghanaianNames].sort(() => Math.random() - 0.5);
  const shuffledReviews = [...reviews].sort(() => Math.random() - 0.5);
  const pool = [];
  for (let i = 0; i < 30; i++) {
    const name = shuffledNames[i % shuffledNames.length];
    const review = shuffledReviews[i % shuffledReviews.length];
    pool.push({
      id: i,
      name,
      message: review,
      avatarColor: getRandomColor(),
      avatarUrl: getPravatarUrl(name),
      initials: getInitials(name),
    });
  }
  return pool;
}

export function SocialProofMarquee() {
  const pool = useMemo(() => buildPool(), []);

  // Duplicate pool for seamless infinite scroll
  const items = [...pool, ...pool];

  useEffect(() => {
    // Inject marquee animation keyframes once
    if (!document.getElementById("marquee-style")) {
      const style = document.createElement("style");
      style.id = "marquee-style";
      style.textContent = `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 80s linear infinite;
          will-change: transform;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          gap: 1.5rem;
          padding: 0 1rem;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div
      className="w-full overflow-hidden bg-gradient-to-r from-amber-50/50 via-white to-emerald-50/50 dark:from-gray-900/50 dark:via-gray-900 dark:to-gray-900/50 border-y border-amber-200/50 dark:border-gray-700/50 py-3"
      aria-label="Customer reviews"
    >
      <div className="marquee-track animate-marquee">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2.5 min-w-[320px] max-w-[380px]"
            style={{ boxShadow: "0 10px 30px -10px rgba(0,0,0,0.15)" }}
          >
            <div className="shrink-0">
              <div
                className={`size-9 rounded-full flex items-center justify-center text-white font-bold text-xs overflow-hidden ${item.avatarColor}`}
                style={{ boxShadow: "0 3px 8px -2px rgba(0,0,0,0.2)" }}
              >
                <img
                  src={item.avatarUrl}
                  alt=""
                  className="size-full rounded-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextElementSibling.style.display = "flex";
                  }}
                />
                <span
                  className="hidden items-center justify-center size-full"
                  style={{ fontSize: "10px" }}
                >
                  {item.initials}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs text-black truncate">
                {item.name}
              </div>
              <p className="text-[11px] text-black leading-snug line-clamp-2">
                {item.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}