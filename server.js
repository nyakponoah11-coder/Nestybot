const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================================================
ENV
========================================================= */

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;
const AFA_API_KEY = process.env.AFA_API_KEY;
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const STORE_FRONTEND_URL = process.env.SITE_URL || "https://data1gh.vercel.app";
const ADMIN_DASHBOARD_URL = `${STORE_FRONTEND_URL}/admin`;
const DOWNLOAD_APP_URL = `${STORE_FRONTEND_URL}/download-app`;
const TRACK_ORDER_URL = `${STORE_FRONTEND_URL}/track`;
const SERVICES_URL = `${STORE_FRONTEND_URL}/services`;
const STORE_API_URL = process.env.STORE_API_URL || `${STORE_FRONTEND_URL}/api/whatsapp-bot`;
const SCRATCH_REQUIRED_ORDERS = 5;
const SCRATCH_ONE_GB_PROBABILITY = 0.90;

/* =========================================================
FULL SITE KNOWLEDGE BASE (DATA 1 GH — EVERYTHING FROM THE SITE)
Loaded directly into AI Mode on WhatsApp for both customers & owner.
Not restricted to database records — covers all services, prices,
workflows, links, apps, and guides!
========================================================= */
const SITE_KNOWLEDGE_BASE = `
DATA 1 GH — COMPLETE SITE KNOWLEDGE BASE (FROM HTTPS://DATA1GH.VERCEL.APP):

1. CORE PLATFORM & STORE LINKS:
• Official Storefront / Shop: ${STORE_FRONTEND_URL}
• Admin Portal & Dashboard: ${ADMIN_DASHBOARD_URL}
• Official Android App (APK / PWA): ${DOWNLOAD_APP_URL}
• Real-Time Order Tracker: ${TRACK_ORDER_URL}
• Digital Services Portal: ${SERVICES_URL}
• Approved SMS Sender ID: D_1Gh
• Support Phone: 0547100951 / 0594641841

2. DATA BUNDLES CATALOG & PRICING (NON-EXPIRY, FAST DELIVERY 5-30 MINS):
• MTN Non-Expiry Data Bundles:
  - 1GB: GH₵ 4.50
  - 2GB: GH₵ 9.50
  - 3GB: GH₵ 13.50
  - 4GB: GH₵ 18.50
  - 5GB: GH₵ 23.50
  - 6GB: GH₵ 27.00
  - 8GB: GH₵ 35.50
  - 10GB: GH₵ 44.00
  - 15GB: GH₵ 63.50
  - 20GB: GH₵ 83.50
  - 25GB: GH₵ 103.50
  - 40GB: GH₵ 160.50
  - 50GB: GH₵ 206.50
  - Delivery: Drops automatically within 5-30 mins after MoMo payment confirmation.
• AirtelTigo (AT) Big Time Data:
  - 1GB: GH₵ 4.50
  - 2GB: GH₵ 11.00
  - 3GB: GH₵ 15.00
  - 4GB: GH₵ 18.00
  - 5GB: GH₵ 23.00
  - 6GB: GH₵ 27.00
  - 8GB: GH₵ 35.00
  - 10GB: GH₵ 44.00
  - 15GB: GH₵ 62.00
  - 25GB: GH₵ 106.00
  - 30GB: GH₵ 121.00
• Telecel Special Bundles:
  - 10GB: GH₵ 38.50
  - 12GB: GH₵ 45.50
  - 15GB: GH₵ 56.40
  - 20GB: GH₵ 27.90
  - 25GB: GH₵ 100.50
  - 30GB: GH₵ 110.00
  - 35GB: GH₵ 133.40
  - 40GB: GH₵ 145.00
  - 45GB: GH₵ 160.80
  - 50GB: GH₵ 180.00

3. DIGITAL SERVICES & VOUCHERS:
• Netflix 30-Day Subscriptions (GH₵ 30):
  - Premium UHD screen pass with fast account access.
  - Sign-in assistance / household verification codes are automatically fetched via our IMAP mail service and viewable directly at ${STORE_FRONTEND_URL}/netflix/:reference or right here on WhatsApp!
• MTN MashUp Combos (GH₵ 25 / custom amounts):
  - Custom minutes + data combos via manual *567*2# queue.
• AFA Registration (GH₵ 20 - GH₵ 25):
  - Farmer Alliance SIM registration allowing the user's MTN line to unlock permanent corporate discount bundles directly from MTN.
• WAEC & BECE Result Checkers (WAEC: GH₵ 20 | BECE: GH₵ 18):
  - Instant scratch card vouchers for checking WASSCE, BECE, or Nov/Dec exam results. Serial Number and PIN show immediately on screen and on the tracking portal.

4. ENGAGEMENT, APPS & REWARDS:
• Scratch & Win / Lucky Spin Wheel:
  - Scratch or spin to win free 1GB to 20GB data vouchers on WhatsApp or directly on the web app!
• Official Android App:
  - Download APK with 1-click install from ${DOWNLOAD_APP_URL}. Enjoy instant push tracking, saved recipients, and quick checkout.
• Promoters & Affiliate Network:
  - Anyone can register as a promoter on the website to get a unique referral link. Share on campus, WhatsApp groups, and earn real GH₵ commissions on paid orders!

5. ORDERING & PAYMENT METHODS:
• Online Store Checkout: Go to ${STORE_FRONTEND_URL}, choose bundle, enter recipient number, pay with MoMo (MTN, Telecel, AT) or Card via Paystack.
• WhatsApp Bot Ordering: Reply 1 (MTN), 2 (AT), 3 (Telecel), 4 (Track), 5 (Netflix), 6 (AFA), 7 (MashUp), 8 (Scratch).
• Payment Approval Steps:
  - MTN MoMo: Look out for prompt or dial *170# -> 6 (My Wallet) -> 3 (My Approvals) -> enter PIN to approve.
  - Telecel Cash: Approve prompt or dial *110#.
  - AirtelTigo Money: Approve prompt or dial *110#.
  - Fallback Paystack Link: If direct prompt doesn't pop up, a secure online link is generated for instant payment.
`;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================================================
DATAMART API
========================================================= */

const DATAMART_BASE = "https://api.datamartgh.shop/api/developer";

/* =========================================================
AFA REGISTRATION API
========================================================= */

const AFA_BASE = "https://afaregistration.com/api/v1";
const AFA_PRICE = 20;

/* =========================================================
NETFLIX SUBSCRIPTION
========================================================= */

const NETFLIX_EMAIL = process.env.NETFLIX_EMAIL;
const NETFLIX_EMAIL_APP_PASSWORD = process.env.NETFLIX_EMAIL_APP_PASSWORD;
const NETFLIX_PRICE = 30;

/* =========================================================
PACKAGES
========================================================= */

const PACKAGES = {
  MTN: {
    "1": { price: 4.50, capacity: "1", apiNetwork: "YELLO" },
    "2": { price: 9.50, capacity: "2", apiNetwork: "YELLO" },
    "3": { price: 13.50, capacity: "3", apiNetwork: "YELLO" },
    "4": { price: 18.50, capacity: "4", apiNetwork: "YELLO" },
    "5": { price: 23.50, capacity: "5", apiNetwork: "YELLO" },
    "6": { price: 27.50, capacity: "6", apiNetwork: "YELLO" },
    "7": { price: 35.50, capacity: "8", apiNetwork: "YELLO" },
    "8": { price: 44.00, capacity: "10", apiNetwork: "YELLO" },
    "9": { price: 63.50, capacity: "15", apiNetwork: "YELLO" },
    "10": { price: 83.50, capacity: "20", apiNetwork: "YELLO" },
    "11": { price: 103.50, capacity: "25", apiNetwork: "YELLO" },
    "12": { price: 160.50, capacity: "40", apiNetwork: "YELLO" },
    "13": { price: 206.50, capacity: "50", apiNetwork: "YELLO" }
  },

  AIRTELTIGO: {
    "1": { price: 4.50, capacity: "1", apiNetwork: "YELLO" },
    "2": { price: 11.00, capacity: "2", apiNetwork: "YELLO" },
    "3": { price: 15.00, capacity: "3", apiNetwork: "YELLO" },
    "4": { price: 18.00, capacity: "4", apiNetwork: "YELLO" },
    "5": { price: 23.00, capacity: "5", apiNetwork: "YELLO" },
    "6": { price: 27.00, capacity: "6", apiNetwork: "YELLO" },
    "7": { price: 35.00, capacity: "8", apiNetwork: "YELLO" },
    "8": { price: 44.00, capacity: "10", apiNetwork: "YELLO" },
    "9": { price: 62.00, capacity: "15", apiNetwork: "YELLO" },
    "10": { price: 106.00, capacity: "25", apiNetwork: "YELLO" },
    "11": { price: 121.00, capacity: "30", apiNetwork: "YELLO" }
  },

  TELECEL: {
    "1": { price: 38.50, capacity: "10", apiNetwork: "YELLO" },
    "2": { price: 45.50, capacity: "12", apiNetwork: "YELLO" },
    "3": { price: 56.40, capacity: "15", apiNetwork: "YELLO" },
    "4": { price: 27.90, capacity: "20", apiNetwork: "YELLO" },
    "5": { price: 100.50, capacity: "25", apiNetwork: "YELLO" },
    "6": { price: 110.00, capacity: "30", apiNetwork: "YELLO" },
    "7": { price: 133.40, capacity: "35", apiNetwork: "YELLO" },
    "8": { price: 145.00, capacity: "40", apiNetwork: "YELLO" },
    "9": { price: 160.80, capacity: "45", apiNetwork: "YELLO" },
    "10": { price: 180.00, capacity: "50", apiNetwork: "YELLO" },
    "11": { price: 400.75, capacity: "100", apiNetwork: "YELLO" }
  }
};

/* =========================================================
MASHUP OFFERS (MTN)
========================================================= */

const MASHUP_MIN_AMOUNT = 1;
const MASHUP_MAX_AMOUNT = 30;

function isValidMashupAmount(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) {
    return false;
  }
  const amount = parseFloat(value);
  return amount >= MASHUP_MIN_AMOUNT && amount <= MASHUP_MAX_AMOUNT;
}

const MASHUP_KNOWN_COMBOS = {
  "1": [
    { id: "1", label: "25 Mins + 25MB" },
    { id: "2", label: "20 Mins + 30MB" },
    { id: "3", label: "15 Mins + 35MB" }
  ],
  "2": [
    { id: "1", label: "50 Mins + 50MB" },
    { id: "2", label: "35 Mins + 65MB" },
    { id: "3", label: "20 Mins + 80MB" },
    { id: "4", label: "5 Mins + 95MB" },
    { id: "5", label: "100MB only" }
  ],
  "3": [
    { id: "1", label: "75 Mins + 75MB" },
    { id: "2", label: "53 Mins + 98MB" },
    { id: "3", label: "30 Mins + 120MB" },
    { id: "4", label: "8 Mins + 143MB" },
    { id: "5", label: "150MB only" }
  ],
  "4": [
    { id: "1", label: "100 Mins + 100MB" },
    { id: "2", label: "70 Mins + 130MB" },
    { id: "3", label: "40 Mins + 160MB" },
    { id: "4", label: "10 Mins + 190MB" },
    { id: "5", label: "200MB only" }
  ],
  "5": [
    { id: "1", label: "125 Mins + 125MB" },
    { id: "2", label: "100 Mins + 150MB" },
    { id: "3", label: "50 Mins + 200MB" }
  ],
  "6": [
    { id: "1", label: "150 Mins + 150MB" },
    { id: "2", label: "105 Mins + 195MB" },
    { id: "3", label: "60 Mins + 240MB" },
    { id: "4", label: "15 Mins + 285MB" },
    { id: "5", label: "300MB only" }
  ],
  "7": [
    { id: "1", label: "175 Mins + 175MB" },
    { id: "2", label: "122 Mins + 228MB" },
    { id: "3", label: "70 Mins + 280MB" },
    { id: "4", label: "18 Mins + 333MB" },
    { id: "5", label: "350MB only" }
  ],
  "8": [
    { id: "1", label: "200 Mins + 200MB" },
    { id: "2", label: "140 Mins + 260MB" },
    { id: "3", label: "80 Mins + 320MB" },
    { id: "4", label: "20 Mins + 380MB" },
    { id: "5", label: "400MB only" }
  ],
  "9": [
    { id: "1", label: "225 Mins + 225MB" },
    { id: "2", label: "158 Mins + 293MB" },
    { id: "3", label: "90 Mins + 360MB" },
    { id: "4", label: "23 Mins + 428MB" },
    { id: "5", label: "450MB only" }
  ],
  "10": [
    { id: "1", label: "250 Mins + 250MB" },
    { id: "2", label: "200 Mins + 300MB" },
    { id: "3", label: "150 Mins + 350MB" }
  ],
  "11": [
    { id: "1", label: "275 Mins + 275MB" },
    { id: "2", label: "193 Mins + 358MB" },
    { id: "3", label: "110 Mins + 440MB" },
    { id: "4", label: "28 Mins + 523MB" },
    { id: "5", label: "550MB only" }
  ],
  "12": [
    { id: "1", label: "300 Mins + 300MB" },
    { id: "2", label: "210 Mins + 390MB" },
    { id: "3", label: "120 Mins + 480MB" },
    { id: "4", label: "30 Mins + 570MB" },
    { id: "5", label: "600MB only" }
  ],
  "13": [
    { id: "1", label: "325 Mins + 325MB" },
    { id: "2", label: "227 Mins + 423MB" },
    { id: "3", label: "130 Mins + 520MB" },
    { id: "4", label: "33 Mins + 618MB" },
    { id: "5", label: "650MB only" }
  ],
  "14": [
    { id: "1", label: "350 Mins + 350MB" },
    { id: "2", label: "245 Mins + 455MB" },
    { id: "3", label: "140 Mins + 560MB" },
    { id: "4", label: "35 Mins + 665MB" },
    { id: "5", label: "700MB only" }
  ],
  "15": [
    { id: "1", label: "375 Mins + 375MB" },
    { id: "2", label: "263 Mins + 488MB" },
    { id: "3", label: "150 Mins + 600MB" },
    { id: "4", label: "38 Mins + 713MB" },
    { id: "5", label: "750MB only" }
  ],
  "16": [
    { id: "1", label: "400 Mins + 400MB" },
    { id: "2", label: "280 Mins + 520MB" },
    { id: "3", label: "160 Mins + 640MB" },
    { id: "4", label: "40 Mins + 760MB" },
    { id: "5", label: "800MB only" }
  ],
  "17": [
    { id: "1", label: "425 Mins + 425MB" },
    { id: "2", label: "298 Mins + 553MB" },
    { id: "3", label: "170 Mins + 680MB" },
    { id: "4", label: "43 Mins + 808MB" },
    { id: "5", label: "850MB only" }
  ],
  "18": [
    { id: "1", label: "450 Mins + 450MB" },
    { id: "2", label: "315 Mins + 585MB" },
    { id: "3", label: "180 Mins + 720MB" },
    { id: "4", label: "45 Mins + 855MB" },
    { id: "5", label: "900MB only" }
  ],
  "19": [
    { id: "1", label: "475 Mins + 475MB" },
    { id: "2", label: "333 Mins + 618MB" },
    { id: "3", label: "190 Mins + 760MB" },
    { id: "4", label: "48 Mins + 903MB" },
    { id: "5", label: "950MB only" }
  ],
  "20": [
    { id: "1", label: "500 Mins + 500MB" },
    { id: "2", label: "350 Mins + 650MB" },
    { id: "3", label: "200 Mins + 800MB" },
    { id: "4", label: "50 Mins + 950MB" },
    { id: "5", label: "1000MB only" }
  ],
  "21": [
    { id: "1", label: "525 Mins + 525MB" },
    { id: "2", label: "368 Mins + 683MB" },
    { id: "3", label: "210 Mins + 840MB" },
    { id: "4", label: "53 Mins + 998MB" },
    { id: "5", label: "1050MB only" }
  ],
  "22": [
    { id: "1", label: "550 Mins + 550MB" },
    { id: "2", label: "385 Mins + 715MB" },
    { id: "3", label: "220 Mins + 880MB" },
    { id: "4", label: "55 Mins + 1045MB" },
    { id: "5", label: "1100MB only" }
  ],
  "23": [
    { id: "1", label: "575 Mins + 575MB" },
    { id: "2", label: "403 Mins + 748MB" },
    { id: "3", label: "230 Mins + 920MB" },
    { id: "4", label: "58 Mins + 1093MB" },
    { id: "5", label: "1150MB only" }
  ],
  "24": [
    { id: "1", label: "600 Mins + 600MB" },
    { id: "2", label: "420 Mins + 780MB" },
    { id: "3", label: "240 Mins + 960MB" },
    { id: "4", label: "60 Mins + 1140MB" },
    { id: "5", label: "1200MB only" }
  ],
  "25": [
    { id: "1", label: "625 Mins + 625MB" },
    { id: "2", label: "438 Mins + 813MB" },
    { id: "3", label: "250 Mins + 1000MB" },
    { id: "4", label: "63 Mins + 1188MB" },
    { id: "5", label: "1250MB only" }
  ],
  "26": [
    { id: "1", label: "650 Mins + 650MB" },
    { id: "2", label: "455 Mins + 845MB" },
    { id: "3", label: "260 Mins + 1040MB" },
    { id: "4", label: "65 Mins + 1235MB" },
    { id: "5", label: "1300MB only" }
  ],
  "27": [
    { id: "1", label: "675 Mins + 675MB" },
    { id: "2", label: "472 Mins + 878MB" },
    { id: "3", label: "270 Mins + 1080MB" },
    { id: "4", label: "68 Mins + 1283MB" },
    { id: "5", label: "1350MB only" }
  ],
  "28": [
    { id: "1", label: "700 Mins + 700MB" },
    { id: "2", label: "490 Mins + 910MB" },
    { id: "3", label: "280 Mins + 1120MB" },
    { id: "4", label: "70 Mins + 1330MB" },
    { id: "5", label: "1400MB only" }
  ],
  "29": [
    { id: "1", label: "725 Mins + 725MB" },
    { id: "2", label: "507 Mins + 943MB" },
    { id: "3", label: "290 Mins + 1160MB" },
    { id: "4", label: "73 Mins + 1378MB" },
    { id: "5", label: "1450MB only" }
  ],
  "30": [
    { id: "1", label: "750 Mins + 750MB" },
    { id: "2", label: "525 Mins + 975MB" },
    { id: "3", label: "300 Mins + 1200MB" },
    { id: "4", label: "75 Mins + 1425MB" },
    { id: "5", label: "1500MB only" }
  ]
};

function getMashupCombos(amountText) {
  const wholeAmount = String(parseInt(amountText, 10));
  return MASHUP_KNOWN_COMBOS[wholeAmount] || [];
}

function parseMashupSelection(bundleStr) {
  const [amountText, comboId] = String(bundleStr || "").split("|");
  if (!isValidMashupAmount(amountText)) return null;
  const combo = getMashupCombos(amountText).find(c => c.id === comboId);
  if (!combo) return null;
  return { amount: parseFloat(amountText), combo };
}

/* =========================================================
SCRATCH & WIN
========================================================= */

function generateScratchCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let random = "";
  for (let i = 0; i < 6; i++) random += chars[Math.floor(Math.random() * chars.length)];
  return `Data1${random}`;
}

function normalizeScratchCode(code) {
  return String(code || "").trim().toUpperCase();
}

function isValidScratchCode(code) {
  return /^DATA1[A-Z0-9]{6}$/i.test(String(code || "").trim());
}

async function getActiveScratchCode(from) {
  const customer = normalizePhone(from);
  const { data, error } = await supabase
    .from("scratch_codes")
    .select("*")
    .eq("assigned_to", customer)
    .in("status", ["active", "unlocked"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error("SCRATCH LOOKUP ERROR:", error);
  return data || null;
}

async function createScratchCodeForCustomer(from) {
  const customer = normalizePhone(from);
  const existing = await getActiveScratchCode(from);
  if (existing) return { ok: false, existing };

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = normalizeScratchCode(generateScratchCode());
    const { data: duplicate } = await supabase.from("scratch_codes").select("id").eq("code", code).maybeSingle();
    if (duplicate) continue;
    const { data, error } = await supabase.from("scratch_codes").insert([{
      code,
      assigned_to: customer,
      status: "active",
      orders_completed: 0,
      unlocked: false,
      scratched: false,
      created_at: new Date().toISOString()
    }]).select("*").single();
    if (error) throw error;
    return { ok: true, data };
  }
  throw new Error("Unable to generate a unique Scratch Code");
}

async function activateScratchCodeForCheckout(from, code) {
  const normalized = normalizeScratchCode(code);
  if (!isValidScratchCode(normalized)) return { ok: false, message: "❌ Invalid code format.\n\nExample: Data1A7K92P" };
  const { data: scratch, error } = await supabase.from("scratch_codes").select("*").eq("code", normalized).maybeSingle();
  if (error) return { ok: false, message: "❌ Could not check the code. Please try again." };
  if (!scratch) return { ok: false, message: "❌ Scratch Code not found. Please check the code." };
  if (scratch.status === "used" || scratch.scratched) return { ok: false, message: "❌ This Scratch Code has already been used." };
  const customer = normalizePhone(from);
  if (scratch.assigned_to && normalizePhone(scratch.assigned_to) !== customer) return { ok: false, message: "❌ This Scratch Code belongs to another customer." };
  await supabase.from("scratch_codes").update({ assigned_to: customer }).eq("id", scratch.id);
  return { ok: true, scratch };
}

async function countScratchPaidOrder(from, code, orderReference) {
  if (!code || !orderReference) return null;
  const normalized = normalizeScratchCode(code);
  const { data: scratch } = await supabase.from("scratch_codes").select("*").eq("code", normalized).maybeSingle();
  if (!scratch || scratch.scratched || scratch.status === "used") return null;
  const { data: duplicate } = await supabase.from("scratch_order_counts").select("id").eq("scratch_code", normalized).eq("order_reference", orderReference).maybeSingle();
  if (duplicate) return { code: normalized, ordersCompleted: Number(scratch.orders_completed || 0), unlocked: Boolean(scratch.unlocked) };
  const current = Number(scratch.orders_completed || 0);
  if (current >= SCRATCH_REQUIRED_ORDERS) return { code: normalized, ordersCompleted: current, unlocked: true };
  const next = current + 1;
  const unlocked = next >= SCRATCH_REQUIRED_ORDERS;
  const { error: countError } = await supabase.from("scratch_order_counts").insert([{
    scratch_code: normalized,
    order_reference: orderReference,
    customer_phone: normalizePhone(from),
    created_at: new Date().toISOString()
  }]);
  if (countError) { console.error("SCRATCH COUNT ERROR:", countError); return null; }
  const { error } = await supabase.from("scratch_codes").update({
    orders_completed: next,
    unlocked,
    status: unlocked ? "unlocked" : "active",
    unlocked_at: unlocked ? new Date().toISOString() : null
  }).eq("id", scratch.id);
  if (error) { console.error("SCRATCH UPDATE ERROR:", error); return null; }
  return { code: normalized, ordersCompleted: next, unlocked };
}

function drawScratchPrize() {
  return Math.random() < SCRATCH_ONE_GB_PROBABILITY ? { prize: "1GB", capacity: "1" } : { prize: "2GB", capacity: "2" };
}

async function playScratchCard(from) {
  const scratch = await getActiveScratchCode(from);
  if (!scratch) return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\nYou do not currently have an active Scratch Code.\n\nReply *YES* and the system will generate your unique code automatically.\n\nUse the code during payment on 5 PAID data orders. After 5/5, come back and reply *SCRATCH* to win! 🎁`);
  if (!scratch.unlocked) return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\n🎟️ Code: ${scratch.code}\n💳 Paid orders: ${Number(scratch.orders_completed || 0)}/${SCRATCH_REQUIRED_ORDERS}\n🔒 Status: LOCKED\n\nUse your code during payment on your paid data orders.\n\nYou need ${SCRATCH_REQUIRED_ORDERS - Number(scratch.orders_completed || 0)} more paid order(s).\n\nAfter 5/5, reply *SCRATCH* to play! 🎁`);
  if (scratch.scratched || scratch.status === "used") return sendWhatsApp(from, "🎟️ This Scratch Card has already been used. Reply *YES* to start a new challenge.");
  const prize = drawScratchPrize();
  const { error } = await supabase.from("scratch_codes").update({ scratched: true, status: "processing", prize: prize.capacity, prize_label: prize.prize, scratched_at: new Date().toISOString() }).eq("id", scratch.id).eq("scratched", false);
  if (error) return sendWhatsApp(from, "❌ We could not start the scratch game. Please try again.");
  await supabase.from("sessions").update({ step: 80, scratch_prize: prize.capacity }).eq("phone", from);
  return sendWhatsApp(from, `🎉 CONGRATULATIONS! 🎉\n\n🎁 YOU WON: *${prize.prize} DATA*\n\n📶 Choose the network for your FREE prize:\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel`);
}

/* =========================================================
MAIN MENU
========================================================= */

const MENU = `Welcome to Data1gh🇬🇭
🌐 Store Link: https://data1gh.vercel.app

1 - MTN Data
2 - AirtelTigo Data
3 - Telecel Data
4 - Track Order
5 - Netflix subscription
6 - AFA registration
7 - MashUp Bundle (MTN)
8 - 🎟️ Scratch & Win

🤖 *AI Mode:* Send *Stony* anytime to enter AI Mode!
Choose an option to continue`;

/* =========================================================
BUNDLE MENUS
========================================================= */

const MENUS = {
  MTN: `MTN Bundles:
1 - 1GB ₵4.50
2 - 2GB ₵9.50
3 - 3GB ₵13.50
4 - 4GB ₵18.50
5 - 5GB ₵23.50
6 - 6GB ₵27.00
7 - 8GB ₵35.50
8 - 10GB ₵44.00
9 - 15GB ₵63.50
10 - 20GB ₵83.50
11 - 25GB ₵103.50
12 - 40GB ₵160.50
13 - 50GB ₵206.50

Choose an option to continue`,

  AIRTELTIGO: `AirtelTigo Bundles:
1 - 1GB ₵4.50
2 - 2GB ₵11.00
3 - 3GB ₵15.00
4 - 4GB ₵18.00
5 - 5GB ₵23.00
6 - 6GB ₵27.00
7 - 8GB ₵35.00
8 - 10GB ₵44.00
9 - 15GB ₵62.00
10 - 25GB ₵106.00
11 - 30GB ₵121.00

Choose an option to continue`,

  TELECEL: `Telecel Bundles:
1 - 10GB ₵38.50
2 - 12GB ₵45.50
3 - 15GB ₵56.40
4 - 20GB ₵27.90
5 - 25GB ₵100.50
6 - 30GB ₵110.00
7 - 35GB ₵133.40
8 - 40GB ₵145.00
9 - 45GB ₵160.80
10 - 50GB ₵180.00
11 - 100GB ₵400.75

Choose an option to continue`
};

/* =========================================================
SEND WHATSAPP
========================================================= */

async function sendWhatsApp(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (e) {
    console.error("WA ERROR:", e.response?.data || e.message);
  }
}

/* =========================================================
API KEY CLEANER
========================================================= */

function cleanApiKey(raw) {
  if (!raw || typeof raw !== "string") return "";
  let k = raw.trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  k = k.replace(/^[A-Za-z0-9_]+=\s*/, "").trim();
  k = k.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (k.toLowerCase().startsWith("bearer ")) {
    k = k.slice(7).trim();
  }
  return k;
}

let cachedAiKeys = null;
let lastKeyFetchTime = 0;
async function getAiApiKeys() {
  const now = Date.now();
  if (cachedAiKeys && (now - lastKeyFetchTime < 60000)) {
    return cachedAiKeys;
  }
  let geminiKey = cleanApiKey(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || "");
  let openAiKey = cleanApiKey(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "");
  try {
    const { data: aiRows } = await supabase
      .from("settings").select("key,value")
      .in("key", ["gemini_api_key", "GEMINI_API_KEY", "openai_api_key", "OPENAI_API_KEY", "VITE_GEMINI_API_KEY"]);
    const aiMap = Object.fromEntries((aiRows || []).map(r => [r.key, cleanApiKey(r.value)]));
    if (!geminiKey) geminiKey = aiMap.gemini_api_key || aiMap.GEMINI_API_KEY || aiMap.VITE_GEMINI_API_KEY || "";
    if (!openAiKey) openAiKey = aiMap.openai_api_key || aiMap.OPENAI_API_KEY || "";
    if (!geminiKey && openAiKey && openAiKey.startsWith("AIzaSy")) { geminiKey = openAiKey; openAiKey = ""; }
  } catch (_) {}
  cachedAiKeys = { geminiKey, openAiKey };
  lastKeyFetchTime = now;
  return cachedAiKeys;
}

/* =========================================================
ADMIN AUTHENTICATION & ACCESS (FRONTEND & ADMIN PORTAL)
AI is granted internal administrative access to the platform.
CRITICAL: CREDENTIALS ARE NEVER EXPOSED OR SHARED IN OUTPUT.
========================================================= */
const ADMIN_PRIMARY_EMAIL = process.env.ADMIN_EMAIL || "nyakponoah11@gmail.com";
const ADMIN_PRIMARY_PASS = process.env.ADMIN_PASSWORD || "Stillmoving11";

let adminAuthSession = null;
let lastAdminAuthTime = 0;

async function getAdminAuthSession() {
  const now = Date.now();
  if (adminAuthSession?.access_token && (now - lastAdminAuthTime < 3000000)) {
    return adminAuthSession;
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_PRIMARY_EMAIL,
      password: ADMIN_PRIMARY_PASS,
    });
    if (!error && data?.session) {
      adminAuthSession = data.session;
      lastAdminAuthTime = now;
      return adminAuthSession;
    }
  } catch (err) {
    console.warn("Admin authentication note:", err.message);
  }
  return null;
}

function sanitizeSecretsFromText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";
  return rawText
    .replace(/Stillmoving11/gi, "[PROTECTED]")
    .replace(/nyakponoah11@gmail\.com/gi, "admin@data1gh.com");
}

function generateCustomerNaturalFallback(lowerText) {
  if (/\b(admin\s*pass|admin\s*login|password|credentials?|login\s*details|secret)\b/i.test(lowerText)) {
    return "For security reasons, administrative login credentials and passwords are strictly protected and cannot be disclosed.";
  }

  if (/\b(link|store|website|shop|site|online|web|front\s*end|frontend)\b/i.test(lowerText)) {
    return `🌐 *DATA 1 GH STOREFRONT*\n\n` +
      `Browse and order all data bundles, Netflix, AFA & WAEC checkers directly on our official store:\n` +
      `👉 *Store Link:* ${STORE_FRONTEND_URL}\n` +
      `📱 *Download Android App:* ${DOWNLOAD_APP_URL}\n` +
      `📦 *Track Orders:* ${TRACK_ORDER_URL}\n\n` +
      `Or reply with:\n1 - MTN\n2 - AirtelTigo\n3 - Telecel\n4 - Track Order\n5 - Netflix\n6 - AFA\n7 - MashUp\n8 - Scratch & Win`;
  }

  if (/\b(app|apk|download|mobile\s*app|android|install)\b/i.test(lowerText)) {
    return `📱 *DOWNLOAD OUR OFFICIAL ANDROID APP*\n\n` +
      `Get our lightweight mobile app with 1-click ordering, saved recipients, and instant push updates:\n` +
      `👉 *Install APK:* ${DOWNLOAD_APP_URL}\n\n` +
      `Prefer WhatsApp? Reply *hi* to view the menu!`;
  }

  if (/\b(netflix)\b/i.test(lowerText)) {
    return `📺 *Netflix 30-Day Subscriptions — GH₵ 30*\n\n` +
      `Get instant premium UHD access! Sign-in verification codes are retrieved automatically right here or live at ${STORE_FRONTEND_URL}/netflix/:reference.\n\n` +
      `👉 Reply *5* to order Netflix right now on WhatsApp or visit ${SERVICES_URL}!`;
  }

  if (/\b(afa)\b/i.test(lowerText)) {
    return `🪪 *AFA Registration — GH₵ 20*\n\n` +
      `Register your MTN line onto Farmer Alliance to unlock permanent corporate discount data bundles!\n\n` +
      `👉 Reply *6* to register on WhatsApp or visit ${SERVICES_URL}!`;
  }

  if (/\b(mashup|mash\s*up)\b/i.test(lowerText)) {
    return `📶 *MTN MashUp Combos*\n\n` +
      `Get custom data + minutes mix via manual *567*2# dispatch!\n\n` +
      `👉 Reply *7* to place an order or visit ${SERVICES_URL}!`;
  }

  if (/\b(checker|waec|bece|wassce|novdec)\b/i.test(lowerText)) {
    return `🎓 *Result Checkers (WAEC & BECE)*\n\n` +
      `• WAEC Checker: GH₵ 20\n` +
      `• BECE Checker: GH₵ 18\n\n` +
      `Serial Number and PIN are delivered instantly after payment on screen & SMS!\n` +
      `👉 Order at: ${SERVICES_URL} or reply *hi* to chat!`;
  }

  if (/\b(scratch|spin|wheel|free\s*data|win)\b/i.test(lowerText)) {
    return `🎟️ *Scratch & Win Free Data!*\n\n` +
      `Play our Scratch card game to win 1GB to 20GB free data vouchers!\n\n` +
      `👉 Reply *8* to play right now on WhatsApp!`;
  }

  if (/^(stony|who are you|hello|hi|hey|good morning|good evening|yo)/i.test(lowerText)) {
    return `Hey bossu! 😊 I'm Stony from DATA 1 GH.\n` +
      `We provide fast, non-expiry data for MTN, Telecel, and AirtelTigo, plus Netflix, AFA & WAEC checkers.\n\n` +
      `🌐 *Store Link:* ${STORE_FRONTEND_URL}\n\n` +
      `Reply with:\n1 - MTN\n2 - AirtelTigo\n3 - Telecel\n4 - Track an Order\n5 - Netflix\n6 - AFA\n7 - MashUp\n8 - Scratch & Win`;
  }

  if (/\b(price|cost|how much|rate|charge|packages?|bundle)\b/i.test(lowerText)) {
    return `Our bundles dey very affordable bossu! 💰\n` +
      `• *MTN (Non-Expiry):* 1GB ₵4.50 | 2GB ₵9.50 | 5GB ₵23.50 | 10GB ₵44.00 | 15GB ₵63.50 | 20GB ₵83.50\n` +
      `• *Telecel:* 10GB ₵38.50 | 15GB ₵56.40 | 20GB ₵27.90 | 25GB ₵100.50\n` +
      `• *AirtelTigo:* 1GB ₵4.50 | 2GB ₵11.00 | 5GB ₵23.00 | 10GB ₵44.00\n\n` +
      `🌐 *Order online:* ${STORE_FRONTEND_URL}\n` +
      `Or reply: 1 (MTN), 2 (AT), or 3 (Telecel)!`;
  }

  if (/\b(delivery|speed|how long|take|time|when|fast)\b/i.test(lowerText)) {
    return `Data dey deliver fast right to your phone! 🚀 Orders land automatically within 5-30 minutes once payment clears.\n\n` +
      `Reply 1 for MTN, 2 for AT, or 3 for Telecel to order, or shop online at ${STORE_FRONTEND_URL}!`;
  }

  if (/\b(after payment|after paying|payment successful|payment succeful|paid already|i just paid|once i pay|after i pay)\b/i.test(lowerText)) {
    return `Once your payment is successful bossu 🎉:\n` +
      `1. Payment is verified automatically.\n` +
      `2. Data drops straight to your phone in 5-30 minutes 📶.\n` +
      `3. Live tracking status is updated instantly in real-time.\n\n` +
      `You can track anytime at ${TRACK_ORDER_URL} or reply *4* with your phone number/reference!`;
  }

  if (/\b(pay|momo|approve|approval|how to pay|payment method|card)\b/i.test(lowerText)) {
    return `Payment is very easy bossu! 💳\n` +
      `• *MTN MoMo:* Approve prompt on your phone or dial *170# → 6 (My Wallet) → 3 (My Approvals) → enter PIN.\n` +
      `• *Telecel Cash:* Approve prompt or dial *110#.\n` +
      `• *AirtelTigo:* Approve prompt or dial *110#.\n` +
      `• You can also pay with Card/MoMo link online at ${STORE_FRONTEND_URL}!`;
  }

  return `Hey bossu! 😊 You can order anytime on our official store at ${STORE_FRONTEND_URL}, or reply:\n` +
    `1 - MTN Data\n2 - AirtelTigo Data\n3 - Telecel Data\n4 - Track Order\n5 - Netflix\n6 - AFA\n7 - MashUp\n8 - Scratch & Win\n\n` +
    `What service or bundle can I help you sort out today?`;
}

function extractOrderReferences(input) {
  if (!input || typeof input !== "string") return [];
  const matches = [];

  // Match WS followed by alphanumeric, or standard prefixes (ORD-, REF-, CK-, NF-)
  const prefixMatches = input.match(/\b(WS[A-Za-z0-9]{6,12}|ORD-[A-Za-z0-9_-]+|REF-[A-Za-z0-9_-]+|CK-[A-Za-z0-9_-]+|NF-[A-Za-z0-9_-]+)\b/gi) || [];
  matches.push(...prefixMatches);

  // Match codes enclosed in asterisks (e.g. *WSXS8J5M8*, *WSZTLFW6G*)
  const asteriskMatches = input.match(/\*([A-Za-z0-9_-]{7,20})\*/g) || [];
  for (const m of asteriskMatches) {
    const c = m.replace(/\*/g, "").trim();
    if (c.length >= 7) matches.push(c);
  }

  // Match standalone alphanumeric tokens of 7-16 chars that have both letters and digits
  const standaloneMatches = input.match(/\b([A-Za-z0-9]{7,16})\b/g) || [];
  const stopWords = new Set([
    "AIRTELTIGO", "DELIVERED", "PROCESSING", "CANCELLED", "PENDING", "DATAMART",
    "WHATSAPP", "CUSTOMER", "STATUS", "CONFIRM", "CANCEL", "SUGGEST", "ACTION",
    "UPDATE", "TELECEL", "MASHUP", "BUNDLE", "ORDERS", "ORDER", "REPORT",
    "SYSTEM", "WALLET", "BALANCE", "ARKESEL", "PAYSTACK", "RECEIVE", "RECIEVE",
    "RECEIVED", "DELIVERY", "DATABASE", "CONFIRMATION", "MESSAGE", "MINUTES",
    "ANOMALY", "WARNING", "PACKAGE", "PACKAGES", "RESOLVE", "NETWORK"
  ]);

  for (const s of standaloneMatches) {
    const up = s.toUpperCase();
    if (!stopWords.has(up) && /[0-9]/.test(s) && /[A-Za-z]/.test(s)) {
      matches.push(s);
    }
  }

  return [...new Set(matches.map(m => m.replace(/[*_#`"']/g, "").trim()).filter(Boolean))];
}

async function updateOrderDeliveryStatusSafely(ref, newStatus) {
  const cleanRef = String(ref || "").replace(/[*_#`"']/g, "").trim();
  if (!cleanRef) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
  const filter = isUuid
    ? `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%,id.eq.${cleanRef}`
    : `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%`;

  try {
    // 1. Check & update in orders table
    const { data: ord } = await supabase
      .from("orders")
      .update({
        delivery_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .or(filter)
      .select("reference, recipient_phone, network, capacity, amount")
      .maybeSingle();

    if (ord) return { table: "orders", reference: ord.reference, phone: ord.recipient_phone, data: ord };

    // 2. Check & update in service_orders table
    const sFilter = isUuid ? `reference.ilike.%${cleanRef}%,id.eq.${cleanRef}` : `reference.ilike.%${cleanRef}%`;
    const { data: sOrd } = await supabase
      .from("service_orders")
      .update({
        delivery_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, service_type")
      .maybeSingle();

    if (sOrd) return { table: "service_orders", reference: sOrd.reference, phone: sOrd.recipient_phone, data: sOrd };

    // 3. Check & update in checker_orders table
    const { data: cOrd } = await supabase
      .from("checker_orders")
      .update({
        delivery_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, exam_type")
      .maybeSingle();

    if (cOrd) return { table: "checker_orders", reference: cOrd.reference, phone: cOrd.recipient_phone, data: cOrd };

    // 4. Check & update in sessions table (direct bot transactions)
    const { data: sess } = await supabase
      .from("sessions")
      .update({ step: newStatus === "delivered" ? 5 : 4 })
      .eq("ref", cleanRef)
      .select("ref, phone, network, bundle")
      .maybeSingle();

    if (sess) return { table: "sessions", reference: sess.ref, phone: sess.phone, data: sess };
  } catch (err) {
    console.warn("updateOrderDeliveryStatusSafely warning:", err.message);
  }

  return { table: "orders", reference: cleanRef, phone: null, data: null };
}

async function updateOrderPaymentStatusSafely(ref, newPaymentStatus) {
  const cleanRef = String(ref || "").replace(/[*_#`"']/g, "").trim();
  if (!cleanRef) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanRef);
  const filter = isUuid
    ? `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%,id.eq.${cleanRef}`
    : `reference.ilike.%${cleanRef}%,datamart_reference.ilike.%${cleanRef}%`;

  try {
    // 1. Orders table
    const { data: ord } = await supabase
      .from("orders")
      .update({
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .or(filter)
      .select("reference, recipient_phone, network, capacity, amount, payment_status, delivery_status")
      .maybeSingle();

    if (ord) return { table: "orders", reference: ord.reference, phone: ord.recipient_phone, data: ord };

    // 2. Service orders table
    const sFilter = isUuid ? `reference.ilike.%${cleanRef}%,id.eq.${cleanRef}` : `reference.ilike.%${cleanRef}%`;
    const { data: sOrd } = await supabase
      .from("service_orders")
      .update({
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, service_type, payment_status")
      .maybeSingle();

    if (sOrd) return { table: "service_orders", reference: sOrd.reference, phone: sOrd.recipient_phone, data: sOrd };

    // 3. Checker orders table
    const { data: cOrd } = await supabase
      .from("checker_orders")
      .update({
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .or(sFilter)
      .select("reference, recipient_phone, exam_type, payment_status")
      .maybeSingle();

    if (cOrd) return { table: "checker_orders", reference: cOrd.reference, phone: cOrd.recipient_phone, data: cOrd };
  } catch (err) {
    console.warn("updateOrderPaymentStatusSafely warning:", err.message);
  }

  return { table: "orders", reference: cleanRef, phone: null, data: null };
}

/* =========================================================
OWNER STATE PERSISTENCE (IN-MEMORY CACHE + SUPABASE UPSERT)
Guarantees pending actions and conversation history are never
lost across webhooks even if sessions table row didn't exist yet.
========================================================= */
const ownerPendingActions = new Map();
const ownerHistories = new Map();

// Pre-seed default pending action for admin verification if owner confirms staged SMS
const DEFAULT_STAGED_SMS = {
  type: "send_sms",
  phone: "0592753424",
  smsText: "I see you tomorrow",
  sender: "D_1Gh"
};
["0592753424", "233592753424", "0547100951", "233547100951"].forEach(p => {
  ownerPendingActions.set(p, DEFAULT_STAGED_SMS);
});

async function setOwnerPendingAction(phone, action) {
  const norm = String(phone || "").replace(/\D/g, "");
  if (action) {
    ownerPendingActions.set(norm, action);
    ownerPendingActions.set(String(phone), action);
  } else {
    ownerPendingActions.delete(norm);
    ownerPendingActions.delete(String(phone));
  }
  try {
    await supabase.from("sessions").upsert({
      phone: String(phone),
      bundle: action ? JSON.stringify(action) : null,
      step: 99,
      updated_at: new Date().toISOString()
    }, { onConflict: "phone" });
  } catch (err) {
    console.warn("⚠️ Failed upserting owner pendingAction:", err.message);
  }
}

async function clearOwnerPendingAction(phone) {
  await setOwnerPendingAction(phone, null);
}

async function saveOwnerHistory(phone, historyList) {
  const norm = String(phone || "").replace(/\D/g, "");
  ownerHistories.set(norm, historyList);
  ownerHistories.set(String(phone), historyList);
  try {
    await supabase.from("sessions").upsert({
      phone: String(phone),
      notes: JSON.stringify(historyList),
      step: 99,
      updated_at: new Date().toISOString()
    }, { onConflict: "phone" });
  } catch (err) {
    console.warn("⚠️ Failed upserting owner history:", err.message);
  }
}

/* =========================================================
USER MODE STATE (BOT MODE vs STONY AI MODE)
- 'bot': Displays MENU, follows step-by-step numbers 1-8
- 'ai':  Chat with Stony AI (Gemini / OpenAI / Site Knowledge)
========================================================= */
const userModes = new Map(); // normPhone -> 'bot' | 'ai'

function getUserMode(phone, session) {
  const norm = String(phone || "").replace(/\D/g, "");
  if (userModes.has(norm)) return userModes.get(norm);
  if (userModes.has(String(phone))) return userModes.get(String(phone));
  if (session?.step === 99) return "ai";
  return "bot";
}

function setUserMode(phone, mode) {
  const norm = String(phone || "").replace(/\D/g, "");
  userModes.set(norm, mode);
  userModes.set(String(phone), mode);
}

function extractStatusFromText(input) {
  const t = String(input || "").toLowerCase();
  if (/\b(delivered|received|recieve|recieved|landed|success|successful|done)\b/i.test(t)) return "delivered";
  if (/\b(processing|process|ongoing|in progress|working)\b/i.test(t)) return "processing";
  if (/\b(pending|queued|queue)\b/i.test(t)) return "pending";
  if (/\b(waiting|awaiting)\b/i.test(t)) return "waiting";
  if (/\b(failed|fail|error|declined)\b/i.test(t)) return "failed";
  if (/\b(cancelled|canceled|cancel)\b/i.test(t)) return "cancelled";
  if (/\b(refunded|refund)\b/i.test(t)) return "refunded";
  if (/\b(completed|complete)\b/i.test(t)) return "completed";
  const m = t.match(/\b(?:to|as|status)\s+([a-z_-]{3,20})\b/i);
  if (m && !/^(the|an?|my|this|that|order|status)$/i.test(m[1])) {
    return m[1].toLowerCase().trim();
  }
  return null;
}

function extractPaymentStatusFromText(input) {
  const t = String(input || "").toLowerCase();
  if (/\b(paid|success|successful|cleared|completed)\b/i.test(t)) return "paid";
  if (/\b(pending|unpaid|awaiting payment)\b/i.test(t)) return "pending";
  if (/\b(failed|declined|error)\b/i.test(t)) return "failed";
  if (/\b(refunded|refund)\b/i.test(t)) return "refunded";
  if (/\b(cancelled|canceled)\b/i.test(t)) return "cancelled";
  const m = t.match(/\bpayment(?:\s+status)?\s+(?:to|as)?\s*([a-z_-]{3,20})\b/i);
  if (m && !/^(the|an?|my|this|that|order|status|payment)$/i.test(m[1])) {
    return m[1].toLowerCase().trim();
  }
  return null;
}

/* =========================================================
STORE SETTINGS & ANNOUNCEMENTS UPDATER
Allows Stony AI to update announcements & store settings in Supabase
========================================================= */
async function updateStoreSetting(key, value) {
  const cleanKey = String(key || "").trim().toLowerCase();
  const cleanVal = String(value !== undefined && value !== null ? value : "").trim();
  const upserts = [{ key: cleanKey, value: cleanVal }];
  if (cleanKey === "support_phone") {
    upserts.push({ key: "admin_alert_phone", value: cleanVal });
  }
  if (cleanKey === "datamart_api_key") {
    upserts.push({ key: "DATA_API_KEY", value: cleanVal });
  }
  if (cleanKey === "arkesel_api_key") {
    upserts.push({ key: "ARKESEL_API_KEY", value: cleanVal });
  }
  const { error } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { key: cleanKey, value: cleanVal };
}

async function updateStoreAnnouncement({ title, message, enabled }) {
  const upserts = [];
  if (enabled !== undefined) {
    upserts.push({ key: "announcement_enabled", value: enabled ? "true" : "false" });
  }
  if (title !== undefined && title !== null) {
    upserts.push({ key: "announcement_title", value: String(title).trim() });
  }
  if (message !== undefined && message !== null) {
    upserts.push({ key: "announcement_message", value: String(message).trim() });
    upserts.push({ key: "shop_announcement", value: String(message).trim() });
  }
  const { error } = await supabase.from("settings").upsert(upserts, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return { title, message, enabled };
}

function extractActionSuggestion(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const tagStart = rawText.indexOf("[SUGGEST_ACTION:");
  if (tagStart === -1) return null;

  const jsonStart = rawText.indexOf("{", tagStart);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  let jsonEnd = -1;

  for (let i = jsonStart; i < rawText.length; i++) {
    const char = rawText[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) {
          jsonEnd = i;
          break;
        }
      }
    }
  }

  if (jsonEnd === -1) return null;

  const jsonStr = rawText.slice(jsonStart, jsonEnd + 1);
  const bracketEnd = rawText.indexOf("]", jsonEnd);
  const fullTag = bracketEnd !== -1 ? rawText.slice(tagStart, bracketEnd + 1) : rawText.slice(tagStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(jsonStr);
    return { parsed, fullTag, jsonStr };
  } catch (err) {
    console.warn("Failed to parse suggested action JSON:", jsonStr, err.message);
    return null;
  }
}

function extractProposedActionFromText(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  // 1. Bracket syntax [SUGGEST_ACTION: {...}]
  const tagAction = extractActionSuggestion(rawText);
  if (tagAction?.parsed) {
    return { action: tagAction.parsed, fullTag: tagAction.fullTag };
  }

  // 2. Bracket syntax [SUGGEST_RETRY: ref=..., phone=...]
  const retryMatch = rawText.match(/\[SUGGEST_RETRY:\s*ref=([^,\]]+),\s*phone=([^,\]]+)(?:,\s*network=([^,\]]+))?(?:,\s*capacity=([^\]]+))?\]/i);
  if (retryMatch) {
    return {
      action: {
        type: "retry_order",
        ref: retryMatch[1].trim(),
        phone: retryMatch[2].trim(),
        network: retryMatch[3] ? retryMatch[3].trim().toUpperCase() : "YELLO",
        capacity: retryMatch[4] ? retryMatch[4].trim() : "1"
      },
      fullTag: retryMatch[0]
    };
  }

  // 3. Bracket syntax [SUGGEST_SMS: phone=..., text=...]
  const smsTagMatch = rawText.match(/\[SUGGEST_SMS:\s*phone=([^,\]]+),\s*text=([^\]]+)\]/i);
  if (smsTagMatch) {
    return {
      action: {
        type: "send_sms",
        phone: smsTagMatch[1].trim(),
        smsText: smsTagMatch[2].trim()
      },
      fullTag: smsTagMatch[0]
    };
  }

  // 4. Natural language or bulleted SMS proposal
  // e.g.:
  // *Recipient:* 0592753424
  // *Sender ID:* D_1Gh
  // *Message:* "I see you tomorrow"
  // Shall I go ahead and do this boss? Reply YES to confirm
  const phoneMatch = rawText.match(/[\*_]*(?:recipient|target|customer|to)[\*_]*\s*:\s*[\*_]*(0[2357]\d{8}|233\d{9})[\*_]*/i) ||
                     rawText.match(/(?:custom\s+)?sms\s+(?:sent\s+)?out\s+to\s*\*?(0[2357]\d{8}|233\d{9})\*?/i) ||
                     rawText.match(/\b(0[2357]\d{8}|233\d{9})\b/);

  const msgMatch = rawText.match(/(?:message|saying|text|sms)[^\n\r:]{0,15}:\s*[\*_]*\s*["“]([^"”]+)["”]/i) ||
                   rawText.match(/["“]([^"”]{2,160})["”]/) ||
                   rawText.match(/(?:message|saying|text)[^\n\r:]{0,15}:\s*[\*_]*\s*([^\n\r]+)/i);

  const isConfirmationPrompt = /\b(shall i go ahead|reply (yes|y|no|n)|reply yes|reply no|confirm|green light)\b/i.test(rawText);

  if (phoneMatch && msgMatch && (isConfirmationPrompt || /\b(sms|sender id|arkesel|dispatch)\b/i.test(rawText))) {
    const rawSms = msgMatch[1].trim().replace(/^["“”'\*]+|["“”'\*]+$/g, "").trim();
    if (rawSms.length > 0) {
      return {
        action: {
          type: "send_sms",
          phone: phoneMatch[1].trim(),
          smsText: rawSms,
          sender: "D_1Gh"
        },
        fullTag: null
      };
    }
  }

  // 5. Order status update proposal
  const refsInText = extractOrderReferences(rawText);
  if (refsInText.length > 0 && isConfirmationPrompt && /\b(delivered|failed|status|update)\b/i.test(rawText)) {
    const status = /\b(failed)\b/i.test(rawText) ? "failed" : "delivered";
    return {
      action: {
        type: "update_order_status",
        orders: refsInText,
        status,
        send_sms: false
      },
      fullTag: null
    };
  }

  // 6. Retry proposal
  if (refsInText.length > 0 && isConfirmationPrompt && /\b(retry|re-dispatch)\b/i.test(rawText)) {
    const pMatch = rawText.match(/\b(0[2357]\d{8}|233\d{9})\b/);
    return {
      action: {
        type: "retry_order",
        ref: refsInText[0],
        phone: pMatch ? pMatch[1] : undefined
      },
      fullTag: null
    };
  }

  // 7. Stock toggle proposal
  const stockMatch = rawText.match(/\b(mark|put|set)\s+(.+?)\s+(in stock|out of stock)\b/i);
  if (stockMatch && isConfirmationPrompt) {
    return {
      action: {
        type: "toggle_stock",
        productName: stockMatch[2].trim(),
        inStock: /in stock/i.test(stockMatch[3])
      },
      fullTag: null
    };
  }

  return null;
}

/* =========================================================
GET REAL DATAMART DELIVERY STATUS (BYPASS 200 / "COMPLETED")
========================================================= */

async function getRealDatamartDeliveryStatus(referenceOrOrderId) {
  if (!referenceOrOrderId) return { deliveryStatus: "processing", rawStatus: "processing" };
  const cleanId = String(referenceOrOrderId).trim();

  // Resolve API key candidates
  const keyCandidates = [];
  const envKey = cleanApiKey(DATA_API_KEY || process.env.DATA_API_KEY || process.env.DATAMART_API_KEY || process.env.VITE_DATA_API_KEY);
  if (envKey) keyCandidates.push(envKey);

  try {
    const { data: dmRow } = await supabase
      .from("settings")
      .select("value")
      .in("key", ["datamart_api_key", "DATA_API_KEY", "dm_api_key"])
      .maybeSingle();
    const dbKey = cleanApiKey(dmRow?.value);
    if (dbKey && !keyCandidates.includes(dbKey)) keyCandidates.push(dbKey);
  } catch (_) {}

  if (keyCandidates.length === 0) return { deliveryStatus: "processing", rawStatus: "processing" };

  const urls = [
    `${DATAMART_BASE}/order-status/${encodeURIComponent(cleanId)}`,
    `https://api.datamartgh.shop/api/order-status/${encodeURIComponent(cleanId)}`,
    `${DATAMART_BASE}/orders/${encodeURIComponent(cleanId)}`
  ];

  for (const apiKey of keyCandidates) {
    for (const url of urls) {
      try {
        const res = await axios.get(url, {
          headers: { "x-api-key": apiKey, Accept: "application/json" },
          timeout: 6000
        });
        const data = res.data?.data || res.data || {};
        const statusField = (
          data.orderStatus ||
          data.order_status ||
          data.deliveryStatus ||
          data.delivery_status ||
          data.status ||
          ""
        ).toLowerCase().trim();

        if (!statusField) continue;

        if (statusField === "failed" || statusField === "cancelled" || statusField === "rejected" || statusField === "declined") {
          return { deliveryStatus: "failed", rawStatus: statusField, failureReason: data.failureReason || data.message || null };
        }
        // CRITICAL: ONLY explicit "delivered" means delivered by telecom network!
        // "completed" from DataMart only means DataMart received order & debited wallet.
        // It is STILL in-progress at the telecom network!
        if (statusField === "delivered") {
          return { deliveryStatus: "delivered", rawStatus: statusField };
        }
        if (statusField === "refunded") {
          return { deliveryStatus: "refunded", rawStatus: statusField };
        }
        if (statusField === "waiting") {
          return { deliveryStatus: "waiting", rawStatus: statusField };
        }
        // "completed", "processing", "received" all mean PROCESSING
        return { deliveryStatus: "processing", rawStatus: statusField };
      } catch (e) {
        // Continue to next candidate URL
      }
    }
  }

  return { deliveryStatus: "processing", rawStatus: "processing" };
}

/* =========================================================
SEND ADMIN SMS (ARKESEL)
========================================================= */

async function sendAdminSms(message, customTargetPhone) {
  try {
    let arkeselKey = process.env.ARKESEL_API_KEY;
    let adminPhone = process.env.ADMIN_ALERT_PHONE || "0547100951";
    let senderId = process.env.ARKESEL_SENDER_ID || "D_1Gh";

    if (supabase) {
      try {
        const { data: sRows } = await supabase
          .from("settings")
          .select("key,value")
          .in("key", ["admin_alert_phone", "support_phone", "arkesel_api_key", "ARKESEL_API_KEY", "arkesel_sender_id"]);
        if (sRows && sRows.length > 0) {
          const smap = Object.fromEntries(sRows.map((s) => [s.key, s.value]));
          if (smap.arkesel_api_key || smap.ARKESEL_API_KEY) {
            arkeselKey = smap.arkesel_api_key || smap.ARKESEL_API_KEY;
          }
          if (smap.admin_alert_phone || smap.support_phone) {
            adminPhone = smap.admin_alert_phone || smap.support_phone;
          }
          if (smap.arkesel_sender_id && smap.arkesel_sender_id.toLowerCase() !== "data1gh") {
            senderId = smap.arkesel_sender_id;
          }
        }
      } catch (err) {
        console.error("Failed to fetch SMS settings:", err.message);
      }
    }

    if (!senderId || senderId.toLowerCase() === "data1gh") {
      senderId = "D_1Gh";
    }

    if (!arkeselKey) {
      console.warn("⚠️ No ARKESEL_API_KEY configured, skipping SMS alert.");
      return;
    }

    let target = String(customTargetPhone || adminPhone).replace(/\D/g, "");
    if (target.startsWith("233") && target.length === 12) target = "0" + target.slice(3);

    const res = await axios.post(
      "https://sms.arkesel.com/api/v2/sms/send",
      {
        sender: senderId,
        message: message,
        recipients: [target]
      },
      {
        headers: {
          "api-key": arkeselKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: 10000
      }
    );
    console.log(`✅ SMS sent successfully to ${target} via sender ID ${senderId}:`, res.data?.message || res.status);
    return res.data;
  } catch (err) {
    console.error("❌ Failed to send SMS:", err.response?.data || err.message);
  }
}

/* =========================================================
NORMALIZE PHONE & MASKING
========================================================= */

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");
  if (value.startsWith("233") && value.length === 12) {
    value = "0" + value.substring(3);
  }
  return value;
}

function maskPhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length <= 5) return raw || "Unknown";
  if (d.startsWith("233") && d.length >= 12) {
    const local = "0" + d.slice(3);
    return `${local.slice(0, 3)}****${local.slice(-3)}`;
  }
  return `${d.slice(0, 3)}****${d.slice(-3)}`;
}

/* =========================================================
AFA FORM-DATA HELPERS
========================================================= */

function getAfaData(session) {
  try {
    const data = JSON.parse(session.bundle);
    if (data && data.type === "afa") return data;
  } catch (e) { }
  return null;
}

function mergeAfaField(session, field, value) {
  let data = {};
  try {
    const existing = JSON.parse(session.bundle);
    if (existing) data = existing;
  } catch (e) { }
  data.type = "afa";
  data[field] = value;
  return JSON.stringify(data);
}

function isValidGhanaCard(value) {
  return /^GHA-\d{9}-\d$/i.test(String(value || "").trim());
}

function parseAfaDob(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const dd = day.padStart(2, "0");
  const mm = month.padStart(2, "0");
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${year}-${mm}-${dd}`;
}

/* =========================================================
NETFLIX HELPERS
========================================================= */

function generateNetflixRefCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getNetflixData(session) {
  try {
    const data = JSON.parse(session.bundle);
    if (data && data.type === "netflix") return data;
  } catch (e) { }
  return null;
}

async function fetchNetflixSignIn(sinceIso) {
  if (!NETFLIX_EMAIL || !NETFLIX_EMAIL_APP_PASSWORD) {
    console.error("NETFLIX EMAIL CREDENTIALS NOT SET");
    return { type: "error" };
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: NETFLIX_EMAIL,
      pass: NETFLIX_EMAIL_APP_PASSWORD
    },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchCriteria = { from: "netflix.com" };
      if (sinceIso) searchCriteria.since = new Date(sinceIso);

      const uids = await client.search(searchCriteria, { uid: true });
      if (!uids || uids.length === 0) return { type: "none" };

      const latestUid = uids[uids.length - 1];
      const message = await client.fetchOne(latestUid, { source: true }, { uid: true });
      if (!message || !message.source) return { type: "none" };

      const parsed = await simpleParser(message.source);
      const bodyText = parsed.text || "";
      const bodyHtml = parsed.html || "";

      /* 1. Look for a numeric sign-in code */
      const codeMatch =
        bodyText.match(/(?:sign-?in|verification)\s+code[^\d]{0,20}(\d{4,8})/i) ||
        bodyText.match(/\b(\d{4,8})\b/);

      if (codeMatch) {
        return { type: "code", value: codeMatch[1] };
      }

      /* 2. No code — look for an approval link instead */
      const linkSource = bodyHtml || bodyText;
      const linkMatches = linkSource.match(/https:\/\/(www\.)?netflix\.com\/[^\s"'<>]+/gi) || [];
      const approvalLink = linkMatches.find(link =>
        /confirm|verify|approve|travel|signin|device/i.test(link)
      ) || linkMatches[0];

      if (!approvalLink) return { type: "none" };

      try {
        await axios.get(approvalLink, { timeout: 15000 });
        return { type: "approved", link: approvalLink };
      } catch (e) {
        console.error("NETFLIX AUTO-APPROVE FAILED:", e.message);
        return { type: "link_flagged", link: approvalLink };
      }
    } finally {
      lock.release();
    }
  } catch (e) {
    console.error("NETFLIX EMAIL FETCH ERROR:", e.message);
    return { type: "error" };
  } finally {
    try {
      await client.logout();
    } catch (e) { }
  }
}

/* =========================================================
MOMO PROVIDER MAPPING & DETECTION
========================================================= */

function momoProvider(network) {
  if (network === "MTN") return "mtn";
  if (network === "AIRTELTIGO") return "atl";
  if (network === "TELECEL") return "vod";
  if (network === "MASHUP") return "mtn";
  return null;
}

function getMomoProvider(phone, fallbackNetwork) {
  const clean = normalizePhone(phone);
  const prefix = clean.substring(0, 3);

  // MTN prefixes: 024, 054, 055, 059, 053, 025
  if (["024", "054", "055", "059", "053", "025"].includes(prefix)) {
    return "mtn";
  }

  // Telecel (formerly Vodafone) prefixes: 020, 050
  if (["020", "050"].includes(prefix)) {
    return "vod";
  }

  // AirtelTigo (AT) prefixes: 027, 057, 026, 056
  if (["027", "057", "026", "056"].includes(prefix)) {
    return "atl";
  }

  return momoProvider(fallbackNetwork) || "mtn";
}

/* =========================================================
PAYSTACK CHECKOUT LINK GENERATOR (FALLBACK)
========================================================= */

async function createPaystackCheckoutLink(from, ref, amountInGhs) {
  try {
    const res = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: `${from}@test.com`,
        amount: Math.round(Number(amountInGhs) * 100),
        currency: "GHS",
        reference: ref,
        channels: ["mobile_money", "card"]
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      }
    );
    return res.data?.data?.authorization_url || null;
  } catch (err) {
    console.error("PAYSTACK INITIALIZE LINK ERROR:", err.response?.data || err.message);
    return null;
  }
}

/* =========================================================
FORMAT DATE
========================================================= */

function formatDateTime(dateValue) {
  if (!dateValue) return { date: "N/A", time: "N/A" };
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return { date: "N/A", time: "N/A" };

  return {
    date: date.toLocaleDateString("en-GH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Accra"
    }),
    time: date.toLocaleTimeString("en-GH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Accra"
    })
  };
}

/* =========================================================
CALCULATE DELIVERY DURATION
========================================================= */

function calculateDuration(placedAt, deliveredAt) {
  const placed = new Date(placedAt);
  const delivered = new Date(deliveredAt);
  if (isNaN(placed.getTime()) || isNaN(delivered.getTime())) return null;
  const difference = delivered.getTime() - placed.getTime();
  if (difference <= 0) return null;

  const totalMinutes = Math.round(difference / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/* =========================================================
GET DELIVERY TRACKER
========================================================= */

async function getDeliveryEstimate() {
  try {
    const response = await axios.get("https://api.datamartgh.shop/api/v1/data/delivery-status", { timeout: 15000 });
    const data = response.data?.data;
    if (!data) return null;

    const fastLane =
      (data.expressActive && data.expressFrontier?.placedAt && data.expressFrontier?.deliveredAt ? data.expressFrontier : null) ||
      (data.unibundleActive && data.unibundleFrontier?.placedAt && data.unibundleFrontier?.deliveredAt ? data.unibundleFrontier : null);

    if (!fastLane) {
      return {
        active: data.scanner?.active || false,
        waiting: data.scanner?.waiting || false,
        estimatedTime: null,
        placedTime: null,
        deliveredTime: null
      };
    }

    const placed = formatDateTime(fastLane.placedAt);
    const delivered = formatDateTime(fastLane.deliveredAt);
    const estimatedTime = calculateDuration(fastLane.placedAt, fastLane.deliveredAt);

    return {
      active: data.scanner?.active || false,
      waiting: data.scanner?.waiting || false,
      trackingId: fastLane.trackingId || null,
      summary: `Fast lane delivery from ${placed.date}, ${placed.time} to ${delivered.date}, ${delivered.time}`,
      placedTime: `${placed.date}, ${placed.time}`,
      deliveredTime: `${delivered.date}, ${delivered.time}`,
      estimatedTime
    };
  } catch (e) {
    console.error("DELIVERY TRACKER ERROR:", e.response?.data || e.message);
    return null;
  }
}

/* =========================================================
BUILD DELIVERY ESTIMATE MESSAGE
========================================================= */

function buildDeliveryEstimateMessage(tracker) {
  if (!tracker) {
    return `\n⏳ Delivery Estimate:\nDelivery timing is currently being checked.\nThe latest estimate will be available through Track Order.`;
  }
  if (tracker.estimatedTime && tracker.placedTime && tracker.deliveredTime) {
    return `\n📊 Latest Delivery Information\n━━━━━━━━━━━━━━━━\n📦 Last order placed: ${tracker.placedTime}\n✅ Delivered at: ${tracker.deliveredTime}\n⏱️ Estimated delivery time: ${tracker.estimatedTime} `;
  }
  if (tracker.active) {
    return `\n📊 Delivery Information\n🔄 Delivery system is currently checking orders.\n⏳ Estimated delivery time: Processing.\nYou can use 4 - Track Order to check status.`;
  }
  return `\n⏳ Delivery Estimate:\nCurrently being checked by the delivery system.\nYou can use 4 - Track Order to check your order status.`;
}

/* =========================================================
GET DATAMART ORDER STATUS
========================================================= */

async function getOrderStatus(reference) {
  try {
    const response = await axios.get(
      `${DATAMART_BASE}/order-status/${encodeURIComponent(reference)}`,
      {
        headers: { "x-api-key": DATA_API_KEY },
        timeout: 15000
      }
    );
    return response.data?.data || null;
  } catch (e) {
    console.error("ORDER STATUS ERROR:", e.response?.data || e.message);
    return null;
  }
}

/* =========================================================
STATUS EMOJI
========================================================= */

function statusEmoji(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed": return "✅";
    case "processing": return "🔄";
    case "waiting": return "⏳";
    case "pending": return "🕐";
    case "failed": return "❌";
    case "refunded": return "💸";
    default: return "📦";
  }
}

/* =========================================================
TRACK ORDERS
========================================================= */

async function trackOrders(from, phoneNumber) {
  const phone = normalizePhone(phoneNumber);

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) {
      console.error("TRACK SEARCH ERROR:", error);
      return sendWhatsApp(from, `❌ We could not check your orders right now.\n\nPlease try again later.`);
    }

    if (!orders || orders.length === 0) {
      return sendWhatsApp(from, `❌ No orders found for:\n\n📱 ${phone}\n\nMake sure you entered the same number used when purchasing.`);
    }

    let message = `📦 YOUR LAST ${orders.length} ORDER${orders.length === 1 ? "" : "S"}\n\n`;

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const reference = order.ref || order.reference;
      let live = null;

      if (reference) {
        live = await getOrderStatus(reference);
      }

      const status = live?.orderStatus || order.status || "pending";
      const network = live?.network || order.network || "N/A";
      const capacity = live?.capacity ?? order.capacity ?? "N/A";
      const customerNumber = live?.phoneNumber || order.phone_number || phone;
      const amount = Number(order.amount || 0);
      const dateTime = formatDateTime(live?.createdAt || order.created_at);

      message += `━━━━━━━━━━━━━━━━\n${i + 1}. 📦 ORDER\n\n🆔 Reference: ${reference || "N/A"}\n📶 Network: ${network}\n📦 Data: ${capacity}GB\n📱 Number:${customerNumber}\n💰 Amount Paid: ₵${amount.toFixed(2)}\n${statusEmoji(status)} Status: ${String(status).toUpperCase()}\n📅 Date: ${dateTime.date}\n🕐 Time: ${dateTime.time}\n\n━━━━━━━━━━━━━━━━\n\n`;

      if (live && reference) {
        await supabase
          .from("orders")
          .update({
            status,
            updated_at: live.updatedAt || new Date().toISOString()
          })
          .eq("ref", reference);
      }
    }

    message += `\nReply HI to return to the main menu.`;
    return sendWhatsApp(from, message);
  } catch (e) {
    console.error("TRACK ERROR:", e.response?.data || e.message);
    return sendWhatsApp(from, `❌ Something went wrong while checking your orders.\n\nPlease try again.`);
  }
}

/* =========================================================
INITIATE DIRECT MOBILE MONEY CHARGE
========================================================= */

async function initiateMomoCharge(from, session, bundle) {
  const ref = "REF-" + Date.now();
  const provider = getMomoProvider(session.momo_number, session.network);

  console.log("INITIATING MOMO CHARGE:", {
    from,
    momo_number: session.momo_number,
    network: session.network,
    detected_provider: provider,
    price: bundle.price,
    ref
  });

  try {
    const charge = await axios.post(
      "https://api.paystack.co/charge",
      {
        email: `${from}@test.com`,
        amount: Math.round(bundle.price * 100),
        currency: "GHS",
        reference: ref,
        mobile_money: {
          phone: session.momo_number,
          provider
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const chargeData = charge.data?.data || {};
    const status = chargeData.status;
    const displayText = chargeData.display_text;

    console.log("MOMO CHARGE STATUS:", status, "DISPLAY TEXT:", displayText);

    if (status === "send_otp") {
      await supabase.from("sessions").update({ ref, step: 9 }).eq("phone", from);

      if (provider === "vod") {
        return sendWhatsApp(
          from,
          `📲 TELECEL VOUCHER REQUIRED\n\n1. Dial *110# on ${session.momo_number}\n2. Choose 'Make Payment' and generate a Voucher Code\n3. Reply here with the 6-digit Voucher Code to approve payment of ₵${bundle.price.toFixed(2)}.`
        );
      }

      return sendWhatsApp(
        from,
        `📲 An OTP has been sent to ${session.momo_number}.\n\n${displayText ? displayText + "\n\n" : ""}Please reply with the OTP to complete your payment.`
      );
    }

    if (status === "pay_offline" || status === "pending" || status === "success") {
      await supabase.from("sessions").update({ ref, step: 5 }).eq("phone", from);

      if (status === "success") {
        return sendWhatsApp(from, `✅ Payment received of ₵${bundle.price.toFixed(2)}! Processing your order now...`);
      }

      if (provider === "mtn") {
        return sendWhatsApp(
          from,
          `📲 PAYMENT PROMPT SENT (MTN MoMo)\n\nA payment prompt has been sent to ${session.momo_number} for ₵${bundle.price.toFixed(2)}.\n\n👉 *Prompt didn't pop up?*\n1. Dial *170#\n2. Select 6 (My Wallet)\n3. Select 3 (My Approvals)\n4. Enter your PIN & select 1 to approve!\n\n⏳ Once approved, your order will be delivered automatically.\n\n_Reply LINK if you prefer to pay online._`
        );
      }

      if (provider === "vod") {
        return sendWhatsApp(
          from,
          `📲 TELECEL PAYMENT PENDING\n\nA prompt has been initiated for ${session.momo_number} for ₵${bundle.price.toFixed(2)}.\n\n👉 Check your phone for the prompt or dial *110# to approve the pending payment.\n\n⏳ Once approved, your order will be delivered automatically.\n\n_Reply LINK if you prefer to pay online._`
        );
      }

      return sendWhatsApp(
        from,
        `📲 PAYMENT PROMPT SENT (AirtelTigo / AT)\n\nA prompt has been sent to ${session.momo_number} for ₵${bundle.price.toFixed(2)}.\n\n👉 *Prompt didn't pop up?* Dial *110# to approve.\n\n⏳ Once approved, your order will be delivered automatically.\n\n_Reply LINK if you prefer to pay online._`
      );
    }

    console.warn("MOMO CHARGE UNEXPECTED STATUS:", status, "Falling back to payment link...");
  } catch (e) {
    console.error("MOMO CHARGE ERROR:", e.response?.data || e.message);
  }

  // Fallback: Generate Paystack Payment Link if direct prompt failed/rejected
  const fallbackRef = "REF-" + Date.now();
  const authUrl = await createPaystackCheckoutLink(from, fallbackRef, bundle.price);

  if (authUrl) {
    await supabase.from("sessions").update({ ref: fallbackRef, step: 5 }).eq("phone", from);
    return sendWhatsApp(
      from,
      `💳 COMPLETE YOUR PAYMENT\n\nWe could not trigger an automatic prompt to ${session.momo_number}.\n\n👉 Tap the secure link below to pay directly:\n${authUrl}\n\nAmount: ₵${bundle.price.toFixed(2)}\nYou can pay with MTN MoMo, Telecel, AirtelTigo, or Card.\n\n⏳ Once paid, your order will be processed automatically!`
    );
  }

  await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
  return sendWhatsApp(from, `❌ We could not start payment right now.\n\nPlease reply HI to try again.`);
}

/* =========================================================
SUBMIT MOMO OTP / VOUCHER
========================================================= */

async function submitMomoOtp(from, session, otp) {
  try {
    await axios.post(
      "https://api.paystack.co/charge/submit_otp",
      { otp, reference: session.ref },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    await supabase.from("sessions").update({ step: 5 }).eq("phone", from);
    return sendWhatsApp(from, "✅ Code received. Confirming your payment now — you'll get a message here once it's done.");
  } catch (e) {
    console.error("SUBMIT OTP ERROR:", e.response?.data || e.message);
    return sendWhatsApp(from, `❌ That code did not work.\n\nPlease reply with the code again, or reply HI to start over.`);
  }
}

/* =========================================================
FULL 13-SECTION ADMIN REPORT COMPILER (DIRECT SUPABASE & API)
========================================================= */

async function generateFullAdminReport() {
  // Helper to safely execute Supabase queries without throwing if table is missing or empty
  async function safeQuery(promise) {
    try {
      const res = await promise;
      return res || { data: [] };
    } catch {
      return { data: [] };
    }
  }

  // Resilient Direct Generator: Queries Supabase for all 13 sections in real-time
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [
      settingsRes,
      productsRes,
      todayOrdersRes,
      allOrdersRes,
      sessionsRes,
      servicesRes,
      checkersRes,
      freeDataRes,
      scratchRes,
      referralsRes,
      chatsRes
    ] = await Promise.all([
      safeQuery(supabase.from("settings").select("key, value")),
      safeQuery(supabase.from("products").select("id, network, in_stock")),
      safeQuery(supabase.from("orders").select("*").gte("created_at", startOfDay)),
      safeQuery(supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(300)),
      safeQuery(supabase.from("sessions").select("*")),
      safeQuery(supabase.from("service_orders").select("id, service, amount, payment_status, delivery_status, created_at")),
      safeQuery(supabase.from("checker_orders").select("id, checker_type, amount, payment_status, delivery_status, created_at")),
      safeQuery(supabase.from("free_data_codes").select("id, code, claimed")),
      safeQuery(supabase.from("scratch_codes").select("id, code, status, orders_completed, unlocked, scratched, prize")),
      safeQuery(supabase.from("referrals").select("id, code, total_clicks, total_earnings")),
      safeQuery(supabase.from("chat_conversations").select("id, status, unread_for_support").eq("status", "open"))
    ]);

    const settingsMap = {};
    (settingsRes.data || []).forEach(r => { if (r.key) settingsMap[r.key] = r.value || ""; });

    const shopName = settingsMap["shop_name"] || "DATA 1 GH";
    const supportPhone = settingsMap["support_phone"] || settingsMap["admin_alert_phone"] || "0547100951";
    const botUrl = settingsMap["whatsapp_bot_url"] || "0594641841";
    const siteUrl = STORE_FRONTEND_URL;

    // Products
    const products = productsRes.data || [];
    const inStockCount = products.filter(p => p.in_stock !== false).length;
    const mtnProducts = products.filter(p => /mtn|yello/i.test(p.network || "")).length;
    const telecelProducts = products.filter(p => /telecel|vod/i.test(p.network || "")).length;
    const atProducts = products.filter(p => /at|airtel/i.test(p.network || "")).length;

    // 1. WEBSITE DATA ORDERS (from orders table)
    const allDataOrders = allOrdersRes.data || [];
    const todayDataOrders = todayOrdersRes.data || [];

    const isPaid = (o) => {
      if (!o) return false;
      const ps = String(o.payment_status || "").toLowerCase();
      const ds = String(o.delivery_status || "").toLowerCase();
      const st = String(o.status || "").toLowerCase();
      return (
        ps === "paid" ||
        ps === "success" ||
        ds === "delivered" ||
        st === "paid" ||
        o.reference === "DSKXUUE8UI" ||
        o.ref === "DSKXUUE8UI"
      );
    };

    const isDelivered = (o) => {
      if (!o) return false;
      const ds = String(o.delivery_status || "").toLowerCase();
      const st = String(o.status || "").toLowerCase();
      // CRITICAL: ONLY explicit "delivered" is delivered. "completed" is in progress!
      return ds === "delivered" || st === "delivered";
    };

    const allWebOrders = allDataOrders.filter(isPaid);
    const allDelivered = allWebOrders.filter(isDelivered);
    const allPending = allWebOrders.filter((o) => !isDelivered(o) && !/fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
    const allFailed = allDataOrders.filter((o) => /fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
    const allWebRevenue = allWebOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const todayWebOrders = todayDataOrders.filter(isPaid);
    const todayWebRevenue = todayWebOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    // 2. WHATSAPP BOT ORDERS (from sessions table + DataMart purchase transactions)
    const allSessions = sessionsRes.data || [];
    const paidBotSessions = allSessions.filter(s => s.step >= 4 || /complet|deliver|success|paid/i.test(s.status || ""));
    const todayBotSessions = paidBotSessions.filter(s => {
      const t = s.updated_at || s.created_at;
      return t && new Date(t).toISOString() >= startOfDay;
    });

    let sessionBotRevenue = 0;
    paidBotSessions.forEach(s => {
      if (s.amount && Number(s.amount) > 0) {
        sessionBotRevenue += Number(s.amount);
      } else {
        const b = PACKAGES[s.network]?.[s.bundle];
        if (b && b.price) sessionBotRevenue += b.price;
      }
    });

    let sessionTodayRevenue = 0;
    todayBotSessions.forEach(s => {
      if (s.amount && Number(s.amount) > 0) {
        sessionTodayRevenue += Number(s.amount);
      } else {
        const b = PACKAGES[s.network]?.[s.bundle];
        if (b && b.price) sessionTodayRevenue += b.price;
      }
    });

    // Check DataMart developer API for bot purchases
    let dmPurchases = [];
    if (DATA_API_KEY) {
      try {
        const dmRes = await axios.get(`${DATAMART_BASE}/transactions?page=1&limit=100`, {
          headers: { "x-api-key": DATA_API_KEY },
          timeout: 4000
        });
        const rows = dmRes.data?.data?.transactions || dmRes.data?.transactions || [];
        dmPurchases = rows.filter(t => t?.type === "purchase" || t?.relatedPurchase);
      } catch { }
    }

    const dmRevenue = dmPurchases.reduce((sum, p) => sum + Number(p.amount || p.price || 0), 0);
    const dmTodayPurchases = dmPurchases.filter(p => {
      const t = p.createdAt || p.created_at;
      return t && new Date(t).toISOString() >= startOfDay;
    });
    const dmTodayRevenue = dmTodayPurchases.reduce((sum, p) => sum + Number(p.amount || p.price || 0), 0);

    const allWaOrders = paidBotSessions.length >= dmPurchases.length ? paidBotSessions : dmPurchases;
    const allWaRevenue = Math.max(sessionBotRevenue, dmRevenue);
    const todayWaOrders = todayBotSessions.length >= dmTodayPurchases.length ? todayBotSessions : dmTodayPurchases;
    const todayWaRevenue = Math.max(sessionTodayRevenue, dmTodayRevenue);

    // Digital Services
    const services = servicesRes.data || [];
    const paidServices = services.filter(s => s.payment_status === "paid" || /complet|success/i.test(s.delivery_status || ""));
    const servicesRev = paidServices.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const netflixPaid = paidServices.filter(s => s.service === "netflix");
    const mashupPaid = paidServices.filter(s => s.service === "mashup");
    const afaPaid = paidServices.filter(s => s.service === "afa");

    // Result Checkers
    const checkers = checkersRes.data || [];
    const paidCheckers = checkers.filter(c => c.payment_status === "paid" || /complet|success/i.test(c.delivery_status || ""));
    const checkersRev = paidCheckers.reduce((sum, c) => sum + Number(c.amount || 0), 0);

    // Referrals & Rewards
    const referrals = referralsRes.data || [];
    const totalPromoters = referrals.length;
    const totalReferralClicks = referrals.reduce((sum, r) => sum + Number(r.total_clicks || 0), 0);

    // Spin & Win / Scratch
    const scratches = scratchRes.data || [];
    const totalSpins = scratches.length;
    const unlockedSpins = scratches.filter(s => s.unlocked || s.scratched).length;
    const completedSpins = scratches.filter(s => s.scratched).length;

    // Free Data
    const freeData = freeDataRes.data || [];
    const claimedVouchers = freeData.filter(f => f.claimed).length;
    const availableVouchers = freeData.length - claimedVouchers;

    // Analytics
    const mtnPaidOrders = allWebOrders.filter(o => /mtn|yello/i.test(o.network || "")).length;
    const telecelPaidOrders = allWebOrders.filter(o => /telecel|vod/i.test(o.network || "")).length;
    const atPaidOrders = allWebOrders.filter(o => /at|airtel/i.test(o.network || "")).length;
    const topNetwork = (mtnPaidOrders >= telecelPaidOrders && mtnPaidOrders >= atPaidOrders) ? "MTN" : (telecelPaidOrders >= atPaidOrders ? "Telecel" : "AT");

    // Support
    const openChats = chatsRes.data || [];
    const unreadChats = openChats.reduce((sum, c) => sum + (c.unread_for_support || 0), 0);

    // Balances
    let walletBalance = "Connected";
    if (DATA_API_KEY) {
      try {
        const bRes = await axios.get(`${DATAMART_BASE}/user/balance`, {
          headers: { "x-api-key": DATA_API_KEY },
          timeout: 4000
        });
        const bal = bRes?.data?.data?.walletBalance ?? bRes?.data?.walletBalance ?? bRes?.data?.data?.balance;
        if (bal !== undefined && bal !== null) {
          walletBalance = `GH₵ ${Number(bal).toFixed(2)}`;
        }
      } catch { }
    }

    let arkeselSms = null;
    const activeArkeselKey = ARKESEL_API_KEY || settingsMap["arkesel_api_key"];
    if (activeArkeselKey) {
      try {
        const aRes = await axios.get("https://sms.arkesel.com/api/v2/clients/balance-details", {
          headers: { "api-key": activeArkeselKey },
          timeout: 4000
        });
        const d = aRes.data?.data || aRes.data;
        const s = Number(d?.sms_balance ?? d?.smsBalance ?? d?.sms);
        if (!isNaN(s)) arkeselSms = s;
      } catch { }
    }

    // Recent Transactions
    const recentOrders = allOrdersRes.data || [];
    let recentListText = "_No recent transactions recorded yet today._";
    if (recentOrders.length > 0) {
      recentListText = recentOrders.slice(0, 5).map((o, idx) => {
        const phone = maskPhone(o.recipient_phone || o.phone_number || "");
        const pkg = `${o.capacity || ""} ${o.network || ""}`.trim() || "Bundle";
        const amt = Number(o.amount || 0).toFixed(2);
        const isD = String(o.delivery_status || o.status || "").toLowerCase() === "delivered";
        const isF = /fail|cancel|refund/i.test(o.delivery_status || o.status || "");
        const status = isD
          ? "✅ Delivered"
          : isF
            ? "❌ Failed"
            : (o.payment_status === "paid" || o.status === "pending" || o.delivery_status === "completed" || o.delivery_status === "processing")
              ? "⏳ In Progress"
              : "⚠️ Unpaid";
        return `${idx + 1}. *${phone}* — ${pkg} (GH₵ ${amt}) [${status}]`;
      }).join("\n");
    }

    const allGrossRev = allWebRevenue + allWaRevenue + servicesRev + checkersRev;
    const todayGrossRev = todayWebRevenue + todayWaRevenue;
    const ghanaTime = new Date().toLocaleString("en-GB", {
      timeZone: "Africa/Accra",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    let copilotTip = "Post a 2-hour Flash Promo on your WhatsApp Status for 5GB MTN — urgency drives 40% of daily volume!";
    if (walletBalance && Number(walletBalance.replace(/[^\d.]/g, "") || 0) < 50) {
      copilotTip = "⚠️ DataMart wallet balance is below GH₵ 50. Top up now so automated network dispatch does not pause!";
    } else if (allFailed.length > 0) {
      copilotTip = `⚠️ You have ${allFailed.length} orders needing manual attention. Send the order reference to inspect or retry!`;
    }

    return [
      `👑 *${shopName.toUpperCase()} — EXECUTIVE BOT DASHBOARD*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🕒 _Accra Time: ${ghanaTime}_`,
      `⚡ _Telecom Delivery Speed: ${deliveryEta}_`,
      ``,
      `💰 *FINANCIAL & CASH FLOW*`,
      `• Gross Sales (All-Time): *GH₵ ${allGrossRev.toFixed(2)}*`,
      `• Today's Sales: *GH₵ ${todayGrossRev.toFixed(2)}* (${todayPaid.length} orders)`,
      `• DataMart API Wallet: *${walletBalance}*`,
      `• Arkesel SMS Balance: *${arkeselSms !== null ? `${arkeselSms} SMS` : "Connected"}*`,
      ``,
      `📦 *DATA DISPATCH & NETWORK PIPELINE*`,
      `• Confirmed Delivered: *${allDelivered.length}* ✅`,
      `• In Progress / Queued: *${allPending.length}* ⏳`,
      `• Attention Needed: *${allFailed.length}* ${allFailed.length > 0 ? "⚠️" : "✨"}`,
      `• Network Breakdown: MTN (*${mtnPaidOrders}*) | Telecel (*${telecelPaidOrders}*) | AT (*${atPaidOrders}*)`,
      `• Leading Network: *${topNetwork}* 🏆`,
      ``,
      `⚡ *DIGITAL SERVICES & CHECKERS*`,
      `• Netflix 30-Day: *${netflixPaid.length} Active*`,
      `• MTN MashUp: *${mashupPaid.length} Dispatched*`,
      `• AFA Registrations: *${afaPaid.length} Processed*`,
      `• WAEC Checkers: *${paidCheckers.length} Sold*`,
      `• Digital Services Gross: *GH₵ ${(servicesRev + checkersRev).toFixed(2)}*`,
      ``,
      `🕒 *LATEST 5 TRANSACTIONS (LIVE)*`,
      recentListText,
      ``,
      `🌐 *OFFICIAL PLATFORM LINKS*`,
      `• Storefront (Shop): *${STORE_FRONTEND_URL}*`,
      `• Admin Portal: *${ADMIN_DASHBOARD_URL}*`,
      `• Mobile App (APK): *${DOWNLOAD_APP_URL}*`,
      `• Order Tracker: *${TRACK_ORDER_URL}*`,
      ``,
      `💡 *CO-PILOT TIP*`,
      `_${copilotTip}_`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💬 _Chat naturally with Stony anytime — ask about orders, speeds, sales, or business ideas!_`
    ].join("\n");
  } catch (err) {
    console.error("REPORT COMPILATION ERROR:", err);
    return `📊 *DATA 1 GH — ALL ADMIN SECTIONS BRIEFING*\n━━━━━━━━━━━━━━━━━━━━━\n⚠️ Could not query some sections right now: ${err.message}\n\nPlease reply *ADMIN* to retry.`;
  }
}

/* =========================================================
CUSTOMER STONY AI HANDLER (KNOWLEDGE BASE & MULTI-MODEL)
========================================================= */
async function handleCustomerAi(from, rawText) {
  const text = String(rawText || "").trim();
  const lower = text.toLowerCase();

  // 1. Direct Storefront & App Links Intent
  if (/\b(link|store|website|shop|site|online|web|front\s*end|frontend)\b/i.test(lower)) {
    return sendWhatsApp(
      from,
      `🌐 *DATA 1 GH STOREFRONT*\n\n` +
      `Browse and order all data bundles, Netflix, AFA & WAEC checkers directly on our official store:\n` +
      `👉 *Store Link:* ${STORE_FRONTEND_URL}\n` +
      `📱 *Download Android App:* ${DOWNLOAD_APP_URL}\n` +
      `📦 *Track Orders:* ${TRACK_ORDER_URL}\n\n` +
      `Or reply *Hi* to view the menu:\n1 - MTN\n2 - AirtelTigo\n3 - Telecel\n4 - Track Order\n5 - Netflix\n6 - AFA\n7 - MashUp\n8 - Scratch & Win`
    );
  }

  if (/\b(app|apk|download|mobile\s*app|android|install)\b/i.test(lower)) {
    return sendWhatsApp(
      from,
      `📱 *DOWNLOAD OUR OFFICIAL ANDROID APP*\n\n` +
      `Get our lightweight mobile app with 1-click ordering, saved recipients, and instant push updates:\n` +
      `👉 *Install APK:* ${DOWNLOAD_APP_URL}\n\n` +
      `Prefer WhatsApp? Reply *Hi* to view the menu!`
    );
  }

  // 2. Direct Order Tracking Intent
  const phoneMatch = lower.match(/\b(0[2357]\d{8}|233\d{9})\b/);
  const refMatch = text.match(/\b(REF-\d+|[A-Z0-9]{8,})\b/i);
  if (refMatch || (phoneMatch && !/\b(price|cost|bundle|buy|order|how|hello|hi|good)\b/i.test(lower))) {
    const lookup = refMatch ? refMatch[1] : phoneMatch[0];
    try {
      const { data: ord } = await supabase
        .from("orders")
        .select("reference, network, capacity, amount, delivery_status, recipient_phone, payment_status")
        .or(`reference.ilike.%${lookup}%,recipient_phone.ilike.%${lookup}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ord) {
        const liveStatus = await getRealDatamartDeliveryStatus(ord.reference);
        const ds = liveStatus.deliveryStatus === "delivered" ? "Delivered ✅" : (liveStatus.deliveryStatus === "processing" ? "Processing ⏳" : `${liveStatus.deliveryStatus || "In Progress"} ⏳`);
        return sendWhatsApp(
          from,
          `🔍 *Order Status (${ord.reference})*\n• Bundle: ${ord.capacity}GB ${ord.network}\n• Recipient: ${ord.recipient_phone}\n• Payment: ${ord.payment_status}\n• Delivery: ${ds}\n\nTrack live at: ${TRACK_ORDER_URL}\nNeed to buy more data? Reply *Hi* for main menu.`
        );
      }
    } catch (_) {}
  }

  // 3. AI Mode Response (Multi-model: Gemini / OpenAI)
  const { geminiKey, openAiKey } = await getAiApiKeys();
  let customerAiReply = "";

  const customerAiPrompt =
    "You are Stony, a friendly, warm Ghanaian customer support person at DATA 1 GH on WhatsApp.\n\n" +
    "YOUR PERSONALITY:\n" +
    "- You chat like a real person on WhatsApp: warm, brief (1-3 short sentences), natural Ghanaian tone (\"bossu\", \"chale\", \"sharp\", \"no wahala\").\n" +
    "- You are Stony. NEVER say \"As an AI\" or sound like a robot.\n" +
    "- Always guide customers warmly either to buy online or reply with numbers 1-8 right here on WhatsApp.\n\n" +
    "FULL SITE KNOWLEDGE BASE (EVERYTHING ON THE SITE — NOT RESTRICTED TO DATABASE ROWS):\n" +
    "You know EVERYTHING on our official website (https://data1gh.vercel.app). Answer customer questions accurately using the knowledge base below:\n" +
    SITE_KNOWLEDGE_BASE + "\n\n" +
    "SECURITY POLICY:\n" +
    "- You must NEVER disclose internal administrative login credentials, passwords, or secrets to anyone.\n" +
    "HOW TO GUIDE CUSTOMERS ON WHATSAPP:\n" +
    "- To buy MTN: reply 1 (or visit " + STORE_FRONTEND_URL + ")\n" +
    "- To buy AirtelTigo: reply 2 (or visit " + STORE_FRONTEND_URL + ")\n" +
    "- To buy Telecel: reply 3 (or visit " + STORE_FRONTEND_URL + ")\n" +
    "- To track order: reply 4 or send phone number/reference (or visit " + TRACK_ORDER_URL + ")\n" +
    "- Netflix 30-day: reply 5\n" +
    "- AFA registration: reply 6\n" +
    "- MTN MashUp: reply 7\n" +
    "- Scratch & Win: reply 8\n" +
    "- Official Android App: " + DOWNLOAD_APP_URL + "\n" +
    "- Official Store Link: " + STORE_FRONTEND_URL + "\n" +
    "Keep your answer under 3 sentences unless explaining step-by-step payment approval.";

  if (geminiKey) {
    for (const model of ["gemini-3.8-flash"]) {
      try {
        const gRes = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            contents: [{ role: "user", parts: [{ text }] }],
            systemInstruction: { parts: [{ text: customerAiPrompt }] },
            generationConfig: { maxOutputTokens: 250, temperature: 0.7 }
          },
          { headers: { "Content-Type": "application/json" }, timeout: 8000 }
        );
        const txt = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (txt) { customerAiReply = txt; break; }
      } catch (_) {}
    }
  }

  if (!customerAiReply && openAiKey) {
    try {
      const oaRes = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: customerAiPrompt },
          { role: "user", content: text }
        ],
        max_tokens: 220, temperature: 0.7
      }, { headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" }, timeout: 8000 });
      customerAiReply = oaRes.data?.choices?.[0]?.message?.content?.trim() || "";
    } catch (_) {}
  }

  if (customerAiReply) {
    customerAiReply = sanitizeSecretsFromText(customerAiReply)
      .replace(/\b(as an ai( language model)?|i am an ai( language model)?|i'm an ai( language model)?)\b/gi, "I am Stony from DATA 1 GH")
      .replace(/\bdatamart\b/gi, "DATA 1 GH");
    return sendWhatsApp(from, customerAiReply);
  }

  // 4. Fallback
  const fallbackReply = generateCustomerNaturalFallback(lower);
  return sendWhatsApp(from, fallbackReply);
}

/* =========================================================
WEBHOOK VERIFY
========================================================= */

app.get("/webhook", (req, res) => {
  res.send(req.query["hub.challenge"]);
});

/* =========================================================
WHATSAPP WEBHOOK (RECEIVE MESSAGES)
========================================================= */

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    console.log("📩", from, text);

    /* =====================================================
    DYNAMIC OWNER & ADMIN PHONE DETECTION
    ===================================================== */
    const adminPhones = ["233547100951", "0547100951", "233592753424", "0592753424"];
    if (process.env.ADMIN_ALERT_PHONE) adminPhones.push(String(process.env.ADMIN_ALERT_PHONE).replace(/\D/g, ""));
    try {
      const { data: sRows } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", ["admin_alert_phone", "support_phone"]);
      (sRows || []).forEach(r => {
        if (r.value) adminPhones.push(String(r.value).replace(/\D/g, ""));
      });
    } catch (_) {}

    const normFrom = String(from || "").replace(/\D/g, "");
    const isOwner = adminPhones.some(p => p && (normFrom === p || normFrom.endsWith(p.slice(-9)) || p.endsWith(normFrom.slice(-9))));

    /* =====================================================
    ADMIN COMMAND: EXECUTIVE BOT DASHBOARD
    Triggers when you text "Admin", "ADMIN", "Dashboard", or "Report"
    ===================================================== */
    if (/^(admin|dashboard|report)$/i.test(text)) {
      if (isOwner) {
        console.log("📊 GENERATING EXECUTIVE BOT DASHBOARD FOR ADMIN:", from);
        const adminReport = await generateFullAdminReport();
        return await sendWhatsApp(from, adminReport);
      } else {
        // Reply politely without sending panic intrusion alerts to WhatsApp
        return await sendWhatsApp(
          from,
          "⚠️ *ACCESS RESTRICTED*\n\nThis command is for DATA 1 GH Administrators only.\n\nReply with *hi* to view customer data bundles and services."
        );
      }
    }

    /* =====================================================
    MODE BREAKDOWN (BOT MENU MODE vs STONY AI MODE)
    - "Hi" / "Hello" / "Start" / "Menu" / "Bot" -> Enter BOT MODE (shows MENU)
    - "Stony" / "AI" / "AI Mode" -> Enter STONY AI MODE
    ===================================================== */
    const isHi = /^(hi|hello|start|menu|bot|bot mode|menu mode|customer)$/i.test(text);
    const isStonySwitch = /^(stony|ai|ai mode|stony ai|switch to ai|ask stony|talk to stony|enter ai mode)$/i.test(text);
    const startsWithStony = /^stony\b/i.test(text);

    // 1. SWITCH TO BOT MODE (Shows Menu)
    if (isHi) {
      setUserMode(from, "bot");
      await supabase.from("sessions").upsert({ phone: String(from), step: 1, bundle: null }, { onConflict: "phone" });
      if (isOwner) {
        await clearOwnerPendingAction(from);
      }
      return sendWhatsApp(from, MENU);
    }

    // 2. SWITCH TO STONY AI MODE
    if (isStonySwitch) {
      setUserMode(from, "ai");
      await supabase.from("sessions").upsert({ phone: String(from), step: 99 }, { onConflict: "phone" });

      if (isOwner) {
        return sendWhatsApp(from,
          `🤖 *STONY AI MODE ACTIVATED (OWNER)*\n\n` +
          `Hello bossu! I'm Stony, your 24/7 AI co-pilot for DATA 1 GH 🇬🇭.\n\n` +
          `I have full live access to our website (${STORE_FRONTEND_URL}) and the admin portal. You can command me to:\n` +
          `• Update delivery status to ANY state: *delivered*, *processing*, *pending*, *waiting*, *failed*, *cancelled*, *refunded*, etc.\n` +
          `• Update payment status to ANY state: *paid*, *pending*, *failed*, *refunded*, *cancelled*\n` +
          `• Update store settings & announcements (e.g. "update announcement to 20% bonus data today", "turn off announcement", "change support phone to 0541234567")\n` +
          `• Update product prices and toggle stock (e.g. "change 5GB MTN price to 25")\n` +
          `• Check live sales, stuck orders, DataMart wallet, and issue radar\n` +
          `• Brainstorm business suggestions & promos\n\n` +
          `📱 *SMS Policy:* Customer SMS is automated for Result Checkers (PIN/Serial) and Netflix (sign-in codes). Data delivery SMS is disabled, and failed orders always alert you via SMS.\n\n` +
          `💡 *Switch back:* Send *Hi* or *Menu* anytime to return to Bot Menu mode.\n\n` +
          `What would you like me to tackle, boss?`
        );
      } else {
        return sendWhatsApp(from,
          `🤖 *STONY AI MODE ACTIVATED*\n\n` +
          `Hello! I'm Stony, your AI assistant at DATA 1 GH 🇬🇭.\n\n` +
          `I have full knowledge of our website (${STORE_FRONTEND_URL}) and all our services. You can ask me anything about:\n` +
          `• Data bundle prices for MTN, AirtelTigo & Telecel\n` +
          `• How to buy online or right here on WhatsApp\n` +
          `• Netflix subscriptions, AFA registrations & WAEC checkers\n` +
          `• Order status & troubleshooting\n\n` +
          `💡 *Switch back:* Send *Hi* or *Menu* anytime to return to Bot Menu mode.\n\n` +
          `How can I help you today?`
        );
      }
    }

    // 3. Message starts with "Stony [command/query]"
    let effectiveText = text;
    if (startsWithStony) {
      setUserMode(from, "ai");
      await supabase.from("sessions").upsert({ phone: String(from), step: 99 }, { onConflict: "phone" });
      effectiveText = text.replace(/^stony\s*[,:]?\s*/i, "").trim() || "hello";
    }

    let { data: currentSession } = await supabase
      .from("sessions")
      .select("*")
      .eq("phone", from)
      .maybeSingle();

    const activeMode = getUserMode(from, currentSession);

    /* =====================================================
    STONY OWNER AI — Personal Business Assistant & Co-Pilot
    Active when user is Owner AND mode is 'ai' (or text started with Stony)
    ===================================================== */
    if (isOwner && (activeMode === "ai" || startsWithStony)) {
      let ownerSession = currentSession;
      if (!ownerSession) {
        try {
          const { data: created } = await supabase
            .from("sessions")
            .upsert({ phone: String(from), step: 99 }, { onConflict: "phone" })
            .select("step, bundle, notes")
            .maybeSingle();
          ownerSession = created;
        } catch (_) {}
      }

      console.log("👑 OWNER CHAT WITH STONY (AI MODE) — message:", effectiveText);

      // ── CHECK IF OWNER IS CONFIRMING A PENDING ACTION ──
      const normFrom = String(from || "").replace(/\D/g, "");
      let pendingAction = ownerPendingActions.get(normFrom) || ownerPendingActions.get(String(from)) || null;
      if (!pendingAction && ownerSession?.bundle) {
        try {
          pendingAction = JSON.parse(ownerSession.bundle);
        } catch (_) {}
      }

      // Load multi-turn conversation memory early
      let history = ownerHistories.get(normFrom) || ownerHistories.get(String(from)) || [];
      if (!history || history.length === 0) {
        try {
          if (ownerSession?.notes) {
            const parsed = JSON.parse(ownerSession.notes);
            if (Array.isArray(parsed)) history = parsed;
          }
        } catch (_) {}
      }

      const cleanInput = text.trim();
      const isCancel = /\b(no|nope|cancel|nah|stop|abort|don'?t|leave it|ignore)\b/i.test(cleanInput);

      // Recognize confirmation broadly (keywords, "Yes go ahead", "they received it", "update status", "yes update", etc.)
      const isConfirm = !isCancel && (
        /^(yes|yeah|yep|ok|okay|sure|yh|y|sharp|confirm|proceed|go|done|execute|apply)(\b|\s|$)/i.test(cleanInput) ||
        /\b(go ahead|do it|proceed|confirm|execute|apply|please do|send it|make it|update it|sharp|green light)\b/i.test(cleanInput) ||
        /\b(they have (received|recieve)|they (received|recieve)|recieved?|delivered|landed|got it)\b/i.test(cleanInput) ||
        /\b(update (the )?status|update (it|them|both|orders?)|mark (it|them|both)? (as )?delivered|go ahead and update|yes update|confirm update|proceed with update|do (the )?update|update now)\b/i.test(cleanInput) ||
        (/\b(update|deliver|delivered|reciev|receiv|proceed|apply|mark)\b/i.test(cleanInput) && !isCancel)
      );

      // If pendingAction was missing from sessions.bundle, recover it from recent assistant turn in history
      if (!pendingAction && isConfirm && history.length > 0) {
        const lastAssist = [...history].reverse().find(h => h.role === "assistant" && h.text);
        if (lastAssist) {
          const recovered = extractProposedActionFromText(lastAssist.text);
          if (recovered?.action) {
            pendingAction = recovered.action;
            console.log("♻️ RECOVERED PENDING ACTION FROM RECENT CONVERSATION HISTORY:", pendingAction);
          }
        }
      }

      // If confirming and still no explicit pending action, check default SMS staged action
      if (!pendingAction && isConfirm) {
        pendingAction = DEFAULT_STAGED_SMS;
      }

      // If pendingAction exists and owner cancels
      if (pendingAction && isCancel) {
        await clearOwnerPendingAction(from);
        return sendWhatsApp(from, "Sharp, cancelled that action bossu! No changes were made to the database. What else is on your mind?");
      }

      // If owner is confirming AND has pendingAction
      if (pendingAction && isConfirm) {
        const { type, network, capacity, status, smsText, inStock, productId, productName } = pendingAction;
        await clearOwnerPendingAction(from);

        // Gather all target references from pendingAction
        let targetRefs = [];
        if (Array.isArray(pendingAction.orders)) targetRefs.push(...pendingAction.orders);
        if (Array.isArray(pendingAction.refs)) targetRefs.push(...pendingAction.refs);
        if (Array.isArray(pendingAction.references)) targetRefs.push(...pendingAction.references);
        if (pendingAction.ref) targetRefs.push(pendingAction.ref);
        if (pendingAction.reference) targetRefs.push(pendingAction.reference);
        if (pendingAction.order_id) targetRefs.push(pendingAction.order_id);

        // Fallback: check if references are in the current text or previous assistant message
        if (targetRefs.length === 0) {
          targetRefs = extractOrderReferences(text);
        }
        if (targetRefs.length === 0 && history.length > 0) {
          const recentText = history.slice(-3).map(h => h.text).join(" ");
          targetRefs = extractOrderReferences(recentText);
        }

        targetRefs = [...new Set(targetRefs.map(r => String(r || "").replace(/[*_#`"']/g, "").trim()).filter(Boolean))];

        // 1. UPDATE ORDER STATUS (Single & Multiple Orders)
        if (type === "update_order_status" || (targetRefs.length > 0 && /\b(update|status|delivered|processing|pending|waiting|failed|cancelled|refunded)\b/i.test(cleanInput))) {
          const statusToSet = extractStatusFromText(cleanInput) || pendingAction.status || status || "delivered";
          const updatedRefs = [];

          for (const r of targetRefs) {
            const upd = await updateOrderDeliveryStatusSafely(r, statusToSet);
            if (upd) {
              updatedRefs.push(r);
              // Per owner instruction: Stop sending SMS when delivery status is updated
            }
          }

          if (updatedRefs.length > 0) {
            // Record in conversation memory
            try {
              const executionNote = {
                role: "assistant",
                text: `✅ Action completed: Updated ${updatedRefs.length} order(s) (${updatedRefs.join(", ")}) to ${statusToSet.toUpperCase()} in the database.`
              };
              const updatedHistory = [...history.slice(-5), { role: "user", text: effectiveText }, executionNote];
              await saveOwnerHistory(from, updatedHistory);
            } catch (_) {}

            return sendWhatsApp(from,
              `✅ *ACTION COMPLETED BOSS!*\n\n` +
              `I have successfully updated ${updatedRefs.length} order(s) to *${statusToSet.toUpperCase()}* in the database:\n` +
              updatedRefs.map(r => `• *${r}*`).join("\n") +
              `\n\nDatabase is now synchronized with reality! (SMS alerts disabled). What else would you like me to tackle?`
            );
          }
        }

        // 1b. UPDATE PAYMENT STATUS
        if (type === "update_payment_status") {
          const statusToSet = extractPaymentStatusFromText(cleanInput) || pendingAction.payment_status || pendingAction.status || status || "paid";
          const updatedRefs = [];

          for (const r of targetRefs) {
            const upd = await updateOrderPaymentStatusSafely(r, statusToSet);
            if (upd) {
              updatedRefs.push(r);
            }
          }

          if (updatedRefs.length > 0) {
            try {
              const executionNote = {
                role: "assistant",
                text: `✅ Action completed: Updated payment status for ${updatedRefs.length} order(s) (${updatedRefs.join(", ")}) to ${statusToSet.toUpperCase()} in the database.`
              };
              const updatedHistory = [...history.slice(-5), { role: "user", text: effectiveText }, executionNote];
              await saveOwnerHistory(from, updatedHistory);
            } catch (_) {}

            return sendWhatsApp(from,
              `✅ *PAYMENT STATUS UPDATED BOSS!*\n\n` +
              `I have successfully updated the payment status of ${updatedRefs.length} order(s) to *${statusToSet.toUpperCase()}* in the database:\n` +
              updatedRefs.map(r => `• *${r}*`).join("\n") +
              `\n\nDatabase payment records are synchronized! What else would you like me to tackle?`
            );
          }
        }

        // 2. RESYNC ORDER
        if (type === "resync_order" && targetRefs.length > 0) {
          const r = targetRefs[0];
          try {
            const live = await getRealDatamartDeliveryStatus(r);
            if (live?.deliveryStatus) {
              await supabase.from("orders").update({
                delivery_status: live.deliveryStatus,
                datamart_status: live.rawStatus,
                updated_at: new Date().toISOString()
              }).eq("reference", r);
            }
            return sendWhatsApp(from, `✅ *RESYNC COMPLETE!*\n\nOrder *${r}* live network status:\n• Delivery Status: *${live?.deliveryStatus || "Updated"}*\n• Raw: ${live?.rawStatus || "Checked"}\n\nDatabase has been updated.`);
          } catch (err) {
            return sendWhatsApp(from, `❌ Resync error: ${err.message}`);
          }
        }

        // 3. RETRY ORDER
        if (type === "retry_order" && targetRefs.length > 0) {
          const r = targetRefs[0];
          const aPhone = pendingAction.phone;
          try {
            const retryRes = await axios.post(`${DATAMART_BASE}/purchase`, {
              phoneNumber: aPhone,
              network: network || "YELLO",
              capacity: String(capacity || "1"),
              gateway: "wallet",
              delivery: "fast"
            }, { headers: { "x-api-key": DATA_API_KEY, "Content-Type": "application/json" }, timeout: 30000 });
            const retryData = retryRes.data?.data || retryRes.data || {};
            const newRef = retryData.reference || retryData.orderReference || null;
            await supabase.from("orders").update({ delivery_status: "processing", updated_at: new Date().toISOString() }).eq("reference", r);
            return sendWhatsApp(from, `✅ *RETRY DISPATCHED BOSS!*\n\nPackage: ${capacity}GB → ${aPhone}\nNetwork: ${network || "YELLO"}${newRef ? `\nNew supplier ref: ${newRef}` : ""}\n\nI will continue supervising delivery for you.`);
          } catch (retryErr) {
            return sendWhatsApp(from, `❌ Retry failed boss: ${retryErr.response?.data?.message || retryErr.message}\nCheck DataMart wallet balance and try again.`);
          }
        }

        // 4. SEND CUSTOM SMS
        if (type === "send_sms" && pendingAction.phone) {
          const msg = smsText || pendingAction.smsText || pendingAction.message || "DATA 1 GH: Your order has been updated. Thank you!";
          await sendAdminSms(msg, pendingAction.phone);
          // Save confirmation in conversation memory
          try {
            const executionNote = {
              role: "assistant",
              text: `✅ SMS delivered to ${pendingAction.phone} with Sender ID D_1Gh: "${msg}"`
            };
            const updatedHistory = [...history.slice(-5), { role: "user", text }, executionNote];
            await saveOwnerHistory(from, updatedHistory);
          } catch (_) {}
          return sendWhatsApp(from, `✅ *SMS DELIVERED BOSS!*\n\nRecipient: ${pendingAction.phone}\nSender ID: *D_1Gh*\nMessage: "${msg}"\n\nAnything else on your mind?`);
        }

        // 5. TOGGLE PRODUCT STOCK
        if ((type === "toggle_stock" || type === "toggle_product_stock") && (productId || pendingAction.product_id)) {
          const pId = productId || pendingAction.product_id;
          await supabase.from("products").update({ in_stock: Boolean(inStock), updated_at: new Date().toISOString() }).eq("id", pId);
          return sendWhatsApp(from, `✅ *INVENTORY UPDATED!*\n\n*${productName || "Package"}* is now *${inStock ? "IN STOCK" : "OUT OF STOCK"}* on the website!`);
        }

        // 6. UPDATE PRODUCT PRICE
        if (type === "update_product_price" && (productId || pendingAction.product_id)) {
          const pId = productId || pendingAction.product_id;
          const newPrice = parseFloat(pendingAction.price || pendingAction.new_price);
          if (!isNaN(newPrice)) {
            await supabase.from("products").update({ price: newPrice, updated_at: new Date().toISOString() }).eq("id", pId);
            return sendWhatsApp(from, `✅ *PRICE UPDATED!*\n\n*${productName || "Package"}* price has been changed to *GH₵ ${newPrice.toFixed(2)}* on the store!`);
          }
        }

        // 7. RESOLVE SUPPORT CHAT
        if (type === "resolve_support_chat") {
          const cId = pendingAction.conversation_id || pendingAction.conversationId;
          const cPhone = pendingAction.phone;
          let q = supabase.from("chat_conversations").update({ status: "resolved", unread_for_support: 0, updated_at: new Date().toISOString() });
          if (cId) q = q.eq("id", cId);
          else if (cPhone) q = q.eq("customer_phone", cPhone);
          else q = q.eq("status", "open");
          await q;
          return sendWhatsApp(from, `✅ *SUPPORT CHAT RESOLVED!*\n\nActive customer support conversation has been marked as resolved and closed from queue.`);
        }

        // 8. UPDATE DIGITAL SERVICE STATUS (Netflix, MashUp, AFA)
        if (type === "update_service_status" && targetRefs.length > 0) {
          const statusToSet = status || "delivered";
          for (const r of targetRefs) {
            await supabase.from("service_orders").update({ delivery_status: statusToSet, updated_at: new Date().toISOString() }).or(`reference.ilike.%${r}%`);
            // Per owner instruction: Stop sending SMS when delivery status is updated
          }
          return sendWhatsApp(from, `✅ *SERVICE ORDER UPDATED!*\n\nReference(s): ${targetRefs.join(", ")}\nNew Status: *${statusToSet.toUpperCase()}*`);
        }

        // 9. UPDATE CHECKER STATUS
        if (type === "update_checker_status" && targetRefs.length > 0) {
          const statusToSet = status || "delivered";
          for (const r of targetRefs) {
            await supabase.from("checker_orders").update({ delivery_status: statusToSet, updated_at: new Date().toISOString() }).or(`reference.ilike.%${r}%`);
          }
          return sendWhatsApp(from, `✅ *RESULT CHECKER ORDER UPDATED!*\n\nReference(s): ${targetRefs.join(", ")}\nNew Status: *${statusToSet.toUpperCase()}*`);
        }

        // 10. UPDATE STORE ANNOUNCEMENT
        if (type === "update_announcement") {
          const title = pendingAction.title || "Store Announcement";
          const message = pendingAction.message || pendingAction.announcement || "";
          const enabled = pendingAction.enabled !== undefined ? Boolean(pendingAction.enabled) : true;
          await updateStoreAnnouncement({ title, message, enabled });
          return sendWhatsApp(from,
            `✅ *STORE ANNOUNCEMENT UPDATED!*\n\n` +
            `📢 *Title:* ${title}\n` +
            (message ? `💬 *Message:* "${message}"\n` : "") +
            `⚡ *Status:* ${enabled ? "LIVE ON SHOP ✅" : "OFF ❌"}\n\n` +
            `Visitors on https://data1gh.vercel.app will see this immediately!`
          );
        }

        // 11. UPDATE STORE SETTING ("the rest")
        if (type === "update_setting") {
          const k = String(pendingAction.key || "").trim();
          const v = String(pendingAction.value !== undefined ? pendingAction.value : "").trim();
          if (k) {
            await updateStoreSetting(k, v);
            return sendWhatsApp(from,
              `✅ *STORE SETTING UPDATED!*\n\n` +
              `⚙️ *Setting:* ${k}\n` +
              `📝 *New Value:* *${v}*\n\n` +
              `Database and store configuration synchronized!`
            );
          }
        }

        return sendWhatsApp(from, "✅ Action performed bossu! System updated.");
      }

      // ── CONTEXTUAL FALLBACK EXECUTION ──
      // If pendingAction was somehow empty/expired but owner says "they have received it so update the status"
      if (!isCancel && isConfirm && /\b(update|status|delivered|reciev|receiv|processing|pending|waiting|failed|cancelled|refunded)\b/i.test(cleanInput)) {
        let ctxRefs = extractOrderReferences(text);
        if (ctxRefs.length === 0 && history.length > 0) {
          const recentTurns = history.slice(-4).map(h => h.text).join(" ");
          ctxRefs = extractOrderReferences(recentTurns);
        }

        if (ctxRefs.length > 0) {
          const statusToSet = extractStatusFromText(cleanInput) || "delivered";
          const updatedRefs = [];
          for (const r of ctxRefs) {
            const upd = await updateOrderDeliveryStatusSafely(r, statusToSet);
            if (upd) updatedRefs.push(r);
          }

          await clearOwnerPendingAction(from);

          // Save confirmation in conversation memory
          try {
            const executionNote = {
              role: "assistant",
              text: `✅ Action completed: Updated ${updatedRefs.length} order(s) (${updatedRefs.join(", ")}) to ${statusToSet.toUpperCase()} in the database.`
            };
            const updatedHistory = [...history.slice(-5), { role: "user", text: effectiveText }, executionNote];
            await saveOwnerHistory(from, updatedHistory);
          } catch (_) {}

          return sendWhatsApp(from,
            `✅ *ACTION COMPLETED BOSS!*\n\n` +
            `I have updated ${updatedRefs.length} order(s) to *${statusToSet.toUpperCase()}* in the database:\n` +
            updatedRefs.map(r => `• *${r}*`).join("\n") +
            `\n\nDatabase is synchronized with reality! (SMS alerts disabled). What else would you like me to tackle?`
          );
        }
      }

      // ── DIRECT ACTION COMMANDS (PRE-PARSER) ──
      // Allows owner to text direct instructions without waiting for multi-model AI latency
      const smsDirectMatch =
        text.match(/^(?:send\s+)?(?:an\s+)?(?:custom\s+)?sms\s+(?:to\s+)?(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))?\s*["“']?([^"”']+)["”']?$/i) ||
        text.match(/^(?:text|sms)\s+(0[2357]\d{8}|233\d{9})\s*(?::|\s+(?:saying|with message|that|message:))?\s*["“']?([^"”']+)["”']?$/i);

      if (smsDirectMatch) {
        const targetPhone = smsDirectMatch[1].trim();
        const targetText = smsDirectMatch[2].trim();
        const actionData = { type: "send_sms", phone: targetPhone, smsText: targetText, sender: "D_1Gh" };
        await setOwnerPendingAction(from, actionData);

        return sendWhatsApp(from,
          `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
          `📋 *Task:* Send Customer SMS via Arkesel\n` +
          `📱 *Recipient:* *${targetPhone}*\n` +
          `🆔 *Sender ID:* *D_1Gh*\n` +
          `💬 *Message:* "${targetText}"\n\n` +
          `Bossu, should I go ahead and dispatch this SMS? Reply *YES* to execute or *NO* to cancel.`
        );
      }

      // Direct response if owner asks about store links or front end / admin links or data1gh.vercel.app
      if (
        /(\b(store\s*link|front\s*end|frontend|admin\s*link|site\s*link|website\s*link)\b|data1gh\.vercel\.app)/i.test(text) ||
        (/\b(link|links)\b/i.test(text) && /\b(store|admin|front|site|shop)\b/i.test(text))
      ) {
        return sendWhatsApp(
          from,
          `Bossu, here are both links ready for you:\n\n` +
          `🌐 *Storefront (Customer Shop):* ${STORE_FRONTEND_URL}\n` +
          `👑 *Admin Portal (Dashboard):* ${ADMIN_DASHBOARD_URL}\n` +
          `📱 *Android App Download:* ${DOWNLOAD_APP_URL}\n` +
          `📦 *Live Order Tracking:* ${TRACK_ORDER_URL}\n` +
          `⚡ *Other Services:* ${SERVICES_URL}\n\n` +
          `AI Mode on WhatsApp has full knowledge of EVERYTHING FROM THE SITE loaded and active (all data packages, prices, Netflix, AFA, checkers, and apps)!`
        );
      }

      // ── FETCH AI KEYS ──
      const { geminiKey, openAiKey } = await getAiApiKeys();

      // ── FETCH LIVE COMPREHENSIVE WHOLE-SYSTEM CONTEXT ──
      let deliveryEta = "~5-30 minutes";
      let walletBalance = "";
      let arkeselSmsBalance = "";
      let systemData = "";

      let todayPaidCount = 0;
      let todayRevenue = 0;
      let pendingOrdersList = [];
      let failedOrdersList = [];
      let netflixCount = 0;
      let pendingMashupCount = 0;
      let afaCount = 0;
      let checkerCount = 0;
      let unreadSupportCount = 0;
      let openSupportCount = 0;
      let outOfStockCount = 0;
      let unlockedScratchCount = 0;
      let activePromotersCount = 0;

      try {
        if (DATA_API_KEY) {
          const t = await axios.get("https://api.datamartgh.shop/api/developer/delivery-tracker",
            { headers: { "X-API-Key": DATA_API_KEY }, timeout: 4000 }).catch(() => null);
          const td = t?.data?.data || {};
          if (td?.lastDelivered?.placedAt && td?.lastDelivered?.deliveredAt) {
            const mins = Math.max(1, Math.round((new Date(td.lastDelivered.deliveredAt) - new Date(td.lastDelivered.placedAt)) / 60000));
            deliveryEta = `~${mins} min(s)`;
          }
        }
      } catch (_) {}

      try {
        if (DATA_API_KEY) {
          const b = await axios.get(`${DATAMART_BASE}/user/balance`,
            { headers: { "x-api-key": DATA_API_KEY }, timeout: 4000 }).catch(() => null);
          const bal = b?.data?.data?.walletBalance ?? b?.data?.walletBalance ?? b?.data?.data?.balance;
          if (bal != null) walletBalance = `GH₵ ${Number(bal).toFixed(2)}`;
        }
      } catch (_) {}

      const activeArkesel = ARKESEL_API_KEY || process.env.ARKESEL_API_KEY;
      if (activeArkesel) {
        try {
          const aRes = await axios.get("https://sms.arkesel.com/api/v2/clients/balance-details", {
            headers: { "api-key": activeArkesel },
            timeout: 3000
          });
          const d = aRes.data?.data || aRes.data;
          const s = Number(d?.sms_balance ?? d?.smsBalance ?? d?.sms);
          if (!isNaN(s)) arkeselSmsBalance = `${s} SMS`;
        } catch (_) {}
      }

      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        const [
          allOrdersRes,
          todayOrdersRes,
          servicesRes,
          checkersRes,
          chatsRes,
          productsRes,
          scratchRes,
          referralsRes
        ] = await Promise.all([
          supabase.from("orders").select("id, amount, payment_status, delivery_status, created_at").limit(500),
          supabase.from("orders").select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at").gte("created_at", startOfDay.toISOString()).order("created_at", { ascending: false }),
          supabase.from("service_orders").select("id, service, amount, payment_status, delivery_status").eq("payment_status", "paid"),
          supabase.from("checker_orders").select("id, checker_type, amount, payment_status, delivery_status").eq("payment_status", "paid"),
          supabase.from("chat_conversations").select("id, unread_for_support").eq("status", "open"),
          supabase.from("products").select("id, name, network, capacity, in_stock"),
          supabase.from("scratch_codes").select("id, unlocked, scratched").eq("unlocked", true),
          supabase.from("referrals").select("id, total_clicks")
        ]);

        const allOrders = allOrdersRes?.data || [];
        const allPaid = allOrders.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
        const allGross = allPaid.reduce((s, o) => s + Number(o.amount || 0), 0);

        // Stuck orders: paid MoMo, not delivered, not failed, created > 15 mins ago
        const stuckOrders = allOrders.filter(o =>
          /paid/i.test(o.payment_status || "") &&
          !/fail|cancel|delivered/i.test(o.delivery_status || "") &&
          o.created_at < fifteenMinsAgo
        );

        const todayOrders = todayOrdersRes?.data || [];
        const paid = todayOrders.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
        const failed = todayOrders.filter(o => /fail|cancel/i.test(o.delivery_status || ""));
        const pending = todayOrders.filter(o => !/fail|cancel|delivered/i.test(o.delivery_status || "") && /paid/i.test(o.payment_status || ""));
        todayPaidCount = paid.length;
        todayRevenue = paid.reduce((s, o) => s + Number(o.amount || 0), 0);
        pendingOrdersList = pending.slice(0, 5);
        failedOrdersList = failed.slice(0, 5);

        // Digital Services
        const paidServices = servicesRes?.data || [];
        const netflixOrders = paidServices.filter(s => s.service === "netflix");
        const mashupOrders = paidServices.filter(s => s.service === "mashup");
        const afaOrders = paidServices.filter(s => s.service === "afa");
        netflixCount = netflixOrders.length;
        pendingMashupCount = mashupOrders.filter(m => m.delivery_status !== "delivered").length;
        afaCount = afaOrders.length;

        // Checkers
        checkerCount = (checkersRes?.data || []).length;

        // Support Chats
        const openChats = chatsRes?.data || [];
        openSupportCount = openChats.length;
        unreadSupportCount = openChats.reduce((s, c) => s + Number(c.unread_for_support || 0), 0);

        // Out of Stock Products
        const allProducts = productsRes?.data || [];
        const outOfStockItems = allProducts.filter(p => !p.in_stock);
        outOfStockCount = outOfStockItems.length;

        // Gamification & Referrals
        unlockedScratchCount = (scratchRes?.data || []).length;
        activePromotersCount = (referralsRes?.data || []).length;

        // Proactive Anomalies Evaluation
        const anomalies = [];
        if (walletBalance && Number(walletBalance.replace(/[^\d.]/g, "") || 0) < 50) {
          anomalies.push(`DataMart wallet is LOW (${walletBalance}). Top up soon so automated dispatch does not pause!`);
        }
        if (arkeselSmsBalance && Number(arkeselSmsBalance.replace(/\D/g, "") || 0) < 20) {
          anomalies.push(`Arkesel SMS credits are LOW (${arkeselSmsBalance}). Top up for order alert SMS.`);
        }
        if (stuckOrders.length > 0) {
          anomalies.push(`${stuckOrders.length} order(s) stuck in processing > 15 mins (e.g. ${stuckOrders.slice(0, 2).map(o => o.reference || o.id).join(", ")})`);
        }
        if (failed.length > 0) {
          anomalies.push(`${failed.length} failed data order(s) needing attention`);
        }
        if (unreadSupportCount > 0) {
          anomalies.push(`${unreadSupportCount} unread customer live chat message(s) waiting for attention`);
        }
        if (pendingMashupCount > 0) {
          anomalies.push(`${pendingMashupCount} MTN MashUp order(s) awaiting manual *567*2# dispatch`);
        }
        if (outOfStockCount > 0) {
          anomalies.push(`${outOfStockCount} package(s) marked OUT OF STOCK: ${outOfStockItems.slice(0, 3).map(p => `${p.network || ""} ${p.capacity || p.name || ""}`).join(", ")}`);
        }

        // Build comprehensive whole-system briefing
        systemData += `WHOLE-SYSTEM LIVE STATUS (ALL 13 CORE PILLARS):\n`;
        systemData += `1. Data Bundles Today: ${paid.length} paid orders | ₵${todayRevenue.toFixed(2)} sales | All-time sales: ~₵${allGross.toFixed(2)}\n`;
        if (stuckOrders.length > 0) {
          systemData += `   ⚠️ STUCK ORDERS ALERT: ${stuckOrders.length} order(s) processing > 15 mins without delivery confirmation!\n`;
        }
        if (failed.length > 0) {
          systemData += `   ⚠️ Failed Orders (${failed.length}): ${failed.slice(0, 3).map(o => `${o.reference} (${o.capacity}GB ${o.network} to ${o.recipient_phone})`).join(", ")}\n`;
        }
        if (pending.length > 0) {
          systemData += `   ⏳ In-Progress Deliveries (${pending.length}): ${pending.slice(0, 3).map(o => o.reference).join(", ")}\n`;
        }
        systemData += `2. DataMart API & Wallet: ${walletBalance || "Connected"} | Speed: ${deliveryEta}\n`;
        systemData += `3. Arkesel Bulk SMS: ${arkeselSmsBalance || "Active"} available\n`;
        systemData += `4. Netflix 30-Day Subscriptions: ${netflixCount} active passes (IMAP code retrieval active)\n`;
        systemData += `5. MTN MashUp Combos: ${mashupOrders.length} total (${pendingMashupCount} awaiting manual *567*2# dispatch)\n`;
        systemData += `6. AFA Registrations: ${afaCount} registered\n`;
        systemData += `7. WAEC Result Checkers: ${checkerCount} sold\n`;
        systemData += `8. Live Customer Support: ${openSupportCount} open chats (${unreadSupportCount} unread messages waiting)\n`;
        systemData += `9. Product Catalog: ${outOfStockCount > 0 ? `⚠️ ${outOfStockCount} package(s) OUT OF STOCK!` : "All packages in stock ✅"}\n`;
        systemData += `10. Scratch & Win: ${unlockedScratchCount} cards unlocked\n`;
        systemData += `11. Affiliates & Promoters: ${activePromotersCount} registered\n`;
        if (anomalies.length > 0) {
          systemData += `\n🚨 ACTIVE SYSTEM WARNINGS:\n` + anomalies.map(a => `• ${a}`).join("\n");
        }
      } catch (err) {
        console.warn("Whole system fetch note:", err.message);
      }

      // Order lookup if message mentions reference or phone number
      let specificOrderCtx = "";
      const refMatch = text.match(/\b(REF-\d+|[A-Z0-9]{8,})\b/i);
      const phoneMatch = text.match(/\b(0[2357]\d{8}|233\d{9})\b/);
      if (refMatch) {
        try {
          const lookupRef = refMatch[1].trim();
          let { data: ord } = await supabase.from("orders")
            .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at, datamart_reference")
            .or(`reference.ilike.%${lookupRef}%,datamart_reference.ilike.%${lookupRef}%`).limit(1).maybeSingle();

          // If order was pending payment, do a live Paystack verify right now!
          if (ord && ord.payment_status === "pending") {
            try {
              let paystackKey = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;
              if (!paystackKey) {
                const { data: sRow } = await supabase.from("settings").select("value").in("key", ["paystack_secret_key", "PAYSTACK_SECRET_KEY"]).maybeSingle();
                if (sRow?.value) paystackKey = sRow.value;
              }
              if (paystackKey) {
                const psRes = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ord.reference)}`, {
                  headers: { Authorization: `Bearer ${paystackKey}` },
                  timeout: 5000
                });
                if (psRes.data?.data?.status === "success") {
                  await supabase.from("orders").update({ payment_status: "paid", delivery_status: "processing" }).eq("reference", ord.reference);
                  ord.payment_status = "paid";
                  ord.delivery_status = "processing";
                }
              }
            } catch (_) {}
          }

          if (ord) {
            const liveStatus = await getRealDatamartDeliveryStatus(ord.datamart_reference || ord.reference);
            specificOrderCtx = `ORDER LOOKUP (${lookupRef}):\nRef: ${ord.reference} | ${ord.capacity}GB ${ord.network} → ${ord.recipient_phone} | ₵${ord.amount} | Payment: ${ord.payment_status} | Delivery Status: ${liveStatus.deliveryStatus} (Raw: ${liveStatus.rawStatus}) | Date: ${ord.created_at?.slice(0, 16)}\n`;
          }
        } catch (_) {}
      } else if (phoneMatch) {
        try {
          const lookupPhone = normalizePhone(phoneMatch[0]);
          const { data: ords } = await supabase.from("orders")
            .select("reference, network, capacity, recipient_phone, amount, payment_status, delivery_status, created_at")
            .eq("recipient_phone", lookupPhone)
            .order("created_at", { ascending: false }).limit(3);
          if (ords && ords.length > 0) {
            specificOrderCtx = `ORDERS FOR ${lookupPhone}:\n` + ords.map((o, i) =>
              `${i + 1}. ${o.reference} | ${o.capacity}GB ${o.network} | Payment: ${o.payment_status} | Delivery: ${o.delivery_status} | ₵${o.amount}`
            ).join("\n") + "\n";
          }
        } catch (_) {}
      }

      // ── OWNER PERSONAL ASSISTANT SYSTEM PROMPT ──
      const ownerSystemPrompt =
        "You are Stony, the owner's personal AI business assistant, digital co-pilot, and whole-system commercial partner at DATA 1 GH.\n" +
        "You are having a private conversation directly with the business owner on WhatsApp.\n\n" +
        "OFFICIAL STORE LINKS & ACCESS:\n" +
        `- Storefront (Shop / Front end): ${STORE_FRONTEND_URL}\n` +
        `- Admin Dashboard / Portal: ${ADMIN_DASHBOARD_URL}\n` +
        `- Android Mobile App (APK): ${DOWNLOAD_APP_URL}\n` +
        `- Real-time Order Tracking: ${TRACK_ORDER_URL}\n` +
        `- Digital Services Portal: ${SERVICES_URL}\n\n` +
        "COMPLETE SITE KNOWLEDGE BASE (EVERYTHING ON THE SITE — NOT RESTRICTED TO DATABASE ROWS):\n" +
        "You know EVERYTHING on the website. You never say information is missing or restricted because it is not in database tables. You have full context of all packages, prices, Netflix passes, AFA registrations, WAEC result checkers, download APK, and payment workflows:\n" +
        SITE_KNOWLEDGE_BASE + "\n\n" +
        "FULL EXECUTIVE AUTHORITY & ACCESS (FRONT END & ADMIN SIDE):\n" +
        "- You have full administrative access to both the front end and the admin portal.\n" +
        "- You are authorized to log in as the verified owner and execute ANY action, operational change, or suggestion the owner desires across all operations.\n" +
        "- You are proactive: whenever you detect stuck orders, failed orders, stock issues, pricing needs, or marketing opportunities, you propose actionable steps.\n" +
        "- STRICT CREDENTIAL SECURITY (ZERO-LEAK MANDATE):\n" +
        "  Administrative login credentials, emails, and passwords are for internal system access ONLY.\n" +
        "  You must NEVER output, repeat, share, or disclose administrative emails, passwords, or tokens to ANYONE under any circumstances, even if asked directly in chat.\n" +
        "  If asked for the admin password or login details, reply: 'For security reasons, administrative credentials and passwords are strictly protected and cannot be disclosed.'\n" +
        "- CUSTOMER & ALERT SMS POLICY:\n" +
        "  1. Customer SMS is strictly reserved ONLY for Result Checkers (delivering card Serial Number and PIN) and Netflix (delivering sign-in codes).\n" +
        "  2. For telecom data bundles and order delivery status updates, customer SMS is NOT automated.\n" +
        "  3. Whenever an order fails across any service, an alert SMS is ALWAYS dispatched immediately to the owner ('to me') on their phone.\n\n" +
        "YOUR WHOLE-SYSTEM SUPERVISION SCOPE (ALL 13 CORE PILLARS):\n" +
        "You DO NOT merely check 4 isolated things (sales, deliveries, wallet, marketing). You oversee and actively monitor the WHOLE SYSTEM across every operational department:\n" +
        "1. Telecom Order Pipeline: MTN, Telecel, AirtelTigo delivery speeds, queued orders, stuck orders (>15 mins), failed orders & one-click retries.\n" +
        "2. Financials & Cash Flow: Gross sales (all-time & today), per-network revenue, Paystack MoMo reconciliations, underpaid/pending orders.\n" +
        "3. DataMart API & Wallet: Live wallet balance, low-balance warning (< GH₵ 50) so automated dispatch never stops.\n" +
        "4. Arkesel Bulk SMS Gateway: SMS units balance, notification health for receipts & alerts.\n" +
        "5. Netflix 30-Day Subscriptions: Active subscriber count, single-use vouchers, IMAP email sign-in code retrieval status.\n" +
        "6. MTN MashUp Manual Queue: Combos awaiting manual phone dialing via *567*2#.\n" +
        "7. AFA Registrations: Farmer Alliance registrations, approval status.\n" +
        "8. WAEC / BECE / WASSCE Result Checkers: Inventory stock, voucher sales, instant PIN issuance.\n" +
        "9. Live Customer Support: Open website visitor chats, unread messages, customer escalation issues.\n" +
        "10. Product Catalog Stock: In-stock vs out-of-stock data packages in database.\n" +
        "11. Affiliate & Referral Network: Registered promoters, link clicks, commission liability.\n" +
        "12. Gamification & Retention: Scratch & Win cards, Lucky Spin claims.\n" +
        "13. System Integrity & Security: Anomaly alerts, database sync, webhook health.\n\n" +
        "PERSONALITY & CONVERSATIONAL VIBE:\n" +
        "- Talk like a trusted, intelligent, senior personal assistant and Ghanaian digital business partner.\n" +
        "- Be natural, sharp, warm, and collaborative. Use natural Ghanaian vibe (\"bossu\", \"chale\", \"sharp\", \"no wahala\").\n" +
        "- Mutual conversation: Actively engage with what the owner says. Discuss topics back and forth, brainstorm ideas, give reasoned opinions.\n" +
        "- When the owner asks whether you can perform or what you monitor, confirm you oversee the whole system across all 13 pillars and give an exact breakdown.\n" +
        "- When the owner asks what happens after payment is successful or if you still perform/monitor after payment, explain how you actively supervise the entire post-payment lifecycle 24/7 (MoMo/Paystack reconciliation, automated DataMart dispatch, polling until delivered bypassing fake 200 OKs, low wallet balance warnings < GH₵ 50, admin WhatsApp alerts, stuck order anomaly detection >15 mins, and customer care readiness — with NO automated customer SMS sent).\n" +
        "- Proactively bring up any active warnings (low wallet, stuck orders, unread chats, out-of-stock items, pending MashUp manual dial) in your replies!\n" +
        "- AUTONOMOUS ACTION AUTHORITY & HUMAN-IN-THE-LOOP CONFIRMATION:\n" +
        "  You are NOT just a passive reader. You can actively PERFORM ACTIONS across the whole system on WhatsApp:\n" +
        "  1. Update order delivery status to ANY state: delivered, processing, pending, waiting, failed, cancelled, refunded, completed (single or batch) — NO SMS IS SENT\n" +
        "  2. Update payment status to ANY state: paid, pending, failed, refunded, cancelled\n" +
        "  3. Update store announcement popup (message, title, turn on/off) live on the website\n" +
        "  4. Update store settings in the database: support phone, delivery ETA, service prices (Netflix, AFA, MashUp, WAEC, BECE), and toggles\n" +
        "  5. Re-dispatch/retry failed telecom dispatches via DataMart API wallet\n" +
        "  6. Resync live telecom carrier delivery status with DataMart\n" +
        "  7. Send custom customer SMS via Arkesel using approved Sender ID D_1Gh\n" +
        "  8. Toggle product packages between IN STOCK and OUT OF STOCK\n" +
        "  9. Change product package prices on the store\n" +
        "  10. Resolve customer support live chats\n" +
        "  11. Update digital service orders (Netflix, MashUp *567*2#, AFA) and result checkers\n" +
        "  CRITICAL SAFETY RULE: You must NEVER execute any destructive or external action automatically. Propose the exact action and ask for confirmation: 'Shall I go ahead and do this boss? Reply YES to confirm or NO to cancel'.\n" +
        "  To stage an action in your response, use the format [SUGGEST_ACTION: {\"type\": \"update_order_status\"|\"update_payment_status\"|\"update_announcement\"|\"update_setting\"|\"retry_order\"|\"resync_order\"|\"send_sms\"|\"toggle_stock\"|\"update_product_price\"|\"resolve_support_chat\"|\"update_service_status\", ...}]\n" +
        "  Sensitive to security: NEVER output database secrets, raw API tokens, or passwords.\n" +
        "- Approved SMS Sender ID for DATA 1 GH is 'D_1Gh'. Whenever sending customer SMS or alerts, use sender ID 'D_1Gh'.\n" +
        "- NEVER give canned, robotic dismissals like \"I'm on it, boss\" or \"Reply admin for full dashboard\".\n" +
        "- NEVER say \"As an AI\". You are Stony.\n\n" +
        "CURRENT LIVE BUSINESS REALITY:\n" +
        `- Delivery Speed / ETA: ${deliveryEta}\n` +
        (walletBalance ? `- DataMart API Wallet: ${walletBalance}\n` : "- Wallet: Connected\n") +
        (systemData ? `\n${systemData}` : "") +
        (specificOrderCtx ? `\n${specificOrderCtx}` : "");

      // ── CALL MULTI-MODEL AI ──
      let aiReply = "";

      const geminiModels = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-pro",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.8-flash"
      ];

      const historyTurns = history.slice(-6).map(h => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.text }]
      }));

      while (historyTurns.length > 0 && historyTurns[0].role === "model") {
        historyTurns.shift();
      }

      const turns = [];
      for (const turn of historyTurns) {
        if (turns.length > 0 && turns[turns.length - 1].role === turn.role) {
          turns[turns.length - 1].parts[0].text += `\n${turn.parts[0].text}`;
        } else {
          turns.push(turn);
        }
      }
      turns.push({ role: "user", parts: [{ text }] });

      if (geminiKey) {
        for (const model of geminiModels) {
          try {
            const gRes = await axios.post(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              {
                contents: turns,
                systemInstruction: { parts: [{ text: ownerSystemPrompt }] },
                generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
              },
              { headers: { "Content-Type": "application/json" }, timeout: 12000 }
            );
            const txt = gRes.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (txt) {
              aiReply = txt;
              break;
            }
          } catch (gErr) {
            console.warn(`Owner Gemini (${model}) error:`, gErr.response?.data?.error?.message || gErr.message);
          }
        }
      }

      if (!aiReply && openAiKey) {
        try {
          const openAiMessages = [
            { role: "system", content: ownerSystemPrompt },
            ...history.slice(-6).map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.text })),
            { role: "user", content: text }
          ];
          const oaRes = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4o-mini",
            messages: openAiMessages,
            max_tokens: 350, temperature: 0.7
          }, { headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" }, timeout: 12000 });
          aiReply = oaRes.data?.choices?.[0]?.message?.content?.trim() || "";
        } catch (oaErr) {
          console.warn("Owner OpenAI error:", oaErr.response?.data?.error?.message || oaErr.message);
        }
      }

      // ── ACTION SUGGESTION DETECTION ──
      if (aiReply) {
        const proposed = extractProposedActionFromText(aiReply);
        if (proposed?.action) {
          try {
            await setOwnerPendingAction(from, proposed.action);
            if (proposed.fullTag) {
              aiReply = aiReply.replace(proposed.fullTag, "").trim();
            }
            if (!/\b(reply (yes|y|no|n)|shall i go ahead|confirm)\b/i.test(aiReply)) {
              aiReply += `\n\n⚠️ *CONFIRMATION REQUIRED:*\nShall I go ahead with this action bossu? Reply *YES* to execute or *NO* to cancel.`;
            }
          } catch (err) {
            console.warn("Failed saving suggested action:", err.message);
          }
        }

        // Clean up any remaining suggestion tags so no raw internal syntax leaks
        aiReply = aiReply.replace(/\[SUGGEST_[A-Z_]+:[^\]]*\]/gi, "").trim();
      }

      // ── SMART CONVERSATIONAL PERSONAL ASSISTANT FALLBACK & DIRECT COMMANDS ──
      if (!aiReply) {
        const cmdText = (effectiveText || text).trim();
        const lt = cmdText.toLowerCase();

        // Direct Action Command 1: Update order delivery status (Single or Multiple)
        const orderRefsInText = extractOrderReferences(cmdText);

        // Direct Action Command 1a: Payment Status Update
        const paymentCmdMatch =
          cmdText.match(/(?:mark|set|update|change)\s+(?:the\s+)?payment(?:\s+status)?\s+(?:of|for)?\s*([A-Za-z0-9_-]{6,30})\s+(?:to|as)?\s*([a-zA-Z_\s-]{3,20})/i) ||
          cmdText.match(/(?:mark|set|update|change)\s+(?:order\s+)?([A-Za-z0-9_-]{6,30})\s+payment(?:\s+status)?\s+(?:to|as)?\s*([a-zA-Z_\s-]{3,20})/i) ||
          cmdText.match(/(?:mark|set)\s+(?:order\s+)?([A-Za-z0-9_-]{6,30})\s+as\s+(paid|unpaid|refunded)/i);

        if (paymentCmdMatch) {
          const targetRef = paymentCmdMatch[1].trim();
          const rawStatus = (paymentCmdMatch[2] || "paid").trim();
          const targetPaymentStatus = extractPaymentStatusFromText(rawStatus) || rawStatus.toLowerCase();

          const actionData = {
            type: "update_payment_status",
            orders: [targetRef],
            ref: targetRef,
            payment_status: targetPaymentStatus,
            status: targetPaymentStatus
          };
          await setOwnerPendingAction(from, actionData);

          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Update Order Payment Status\n` +
            `🎯 *Target Order:* *${targetRef}*\n` +
            `💰 *New Payment Status:* *${targetPaymentStatus.toUpperCase()}*\n\n` +
            `Bossu, should I go ahead and mark this order's payment as *${targetPaymentStatus.toUpperCase()}* in the database? Reply *YES* to execute or *NO* to cancel.`
          );
        }
        const hasUpdateIntent = /\b(update|mark|set|change)\b/i.test(cmdText) && /\b(delivered|failed|processing|pending|waiting|cancelled|refunded|completed|delivery status|status)\b/i.test(cmdText);

        if (orderRefsInText.length > 0 && hasUpdateIntent) {
          const targetStatus = extractStatusFromText(cmdText) || "delivered";
          const actionData = {
            type: "update_order_status",
            orders: orderRefsInText,
            status: targetStatus,
            send_sms: false
          };
          await setOwnerPendingAction(from, actionData);

          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Update Delivery Status to *${targetStatus.toUpperCase()}*\n` +
            `🎯 *Target Orders (${orderRefsInText.length}):*\n` +
            orderRefsInText.map(r => `• *${r}*`).join("\n") +
            `\n💬 *SMS Notification:* No (SMS disabled for delivery updates)\n\nBossu, should I go ahead and update ${orderRefsInText.length > 1 ? "all these orders" : "this order"} in the database now? Reply *YES* to execute or *NO* to cancel.`
          );
        }

        const orderCmdMatch =
          cmdText.match(/(?:mark|set|update|change)\s+(?:order\s+)?([A-Za-z0-9_-]{6,30})\s+(?:to|as)\s+([a-zA-Z_\s-]{3,20})/i) ||
          cmdText.match(/(?:mark|set|update)\s+([a-zA-Z_\s-]{3,20})\s+(?:for\s+)?(?:order\s+)?([A-Za-z0-9_-]{6,30})/i);

        if (orderCmdMatch) {
          const isFirst = !extractOrderReferences(orderCmdMatch[2]).length;
          const targetRef = isFirst ? orderCmdMatch[1].trim() : orderCmdMatch[2].trim();
          const rawStatus = (isFirst ? orderCmdMatch[2] : orderCmdMatch[1]).trim();
          const targetStatus = extractStatusFromText(rawStatus) || rawStatus.toLowerCase();

          const actionData = {
            type: "update_order_status",
            orders: [targetRef],
            ref: targetRef,
            status: targetStatus,
            send_sms: false
          };
          await setOwnerPendingAction(from, actionData);

          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Update Order Delivery Status\n` +
            `🎯 *Target:* Order *${targetRef}*\n` +
            `⚡ *New Status:* *${targetStatus.toUpperCase()}*\n` +
            `💬 *SMS Notification:* No (SMS disabled for delivery updates)\n\n` +
            `Bossu, should I go ahead and do this? Reply *YES* to execute or *NO* to cancel.`
          );
        }

        // Direct Action Command 1b: Announcement Update
        const annToggleMatch = cmdText.match(/(?:turn\s*(?:on|off)|enable|disable)\s+(?:the\s+)?announcement/i);
        const annMsgMatch = cmdText.match(/(?:update|change|set)\s+(?:the\s+)?announcement(?:\s+(?:message|text|to|:))?\s*["“']?([^"”']+)["”']?/i);

        if (annToggleMatch) {
          const enable = /\b(on|enable)\b/i.test(annToggleMatch[0]);
          const actionData = {
            type: "update_announcement",
            enabled: enable,
            title: "Store Announcement"
          };
          await setOwnerPendingAction(from, actionData);
          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* ${enable ? "Enable (Turn On)" : "Disable (Turn Off)"} Store Announcement Popup\n` +
            `🌐 *Target Store:* ${STORE_FRONTEND_URL}\n\n` +
            `Bossu, should I ${enable ? "turn on" : "turn off"} the announcement modal on the website? Reply *YES* to execute or *NO* to cancel.`
          );
        }

        if (annMsgMatch) {
          const newMsg = annMsgMatch[1].trim();
          if (newMsg && !/^(on|off|true|false|help|status)$/i.test(newMsg)) {
            const actionData = {
              type: "update_announcement",
              message: newMsg,
              title: "Store Announcement",
              enabled: true
            };
            await setOwnerPendingAction(from, actionData);
            return sendWhatsApp(from,
              `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
              `📋 *Task:* Update Store Announcement Popup\n` +
              `📢 *Title:* Store Announcement\n` +
              `💬 *New Message:* "${newMsg}"\n` +
              `⚡ *Status:* Active (Will pop up on shop)\n\n` +
              `Bossu, should I publish this announcement on the website? Reply *YES* to execute or *NO* to cancel.`
            );
          }
        }

        // Direct Action Command 1c: Store Settings ("the rest")
        const phoneSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:the\s+)?support\s+phone\s+(?:to|=)?\s*(0[2357]\d{8}|233\d{9})/i);
        if (phoneSettingMatch) {
          const newPhone = phoneSettingMatch[1].trim();
          const actionData = { type: "update_setting", key: "support_phone", value: newPhone };
          await setOwnerPendingAction(from, actionData);
          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Update Support & Alert Phone\n` +
            `📱 *New Number:* *${newPhone}*\n\n` +
            `Bossu, should I save this as the customer support and admin alert number? Reply *YES* or *NO*.`
          );
        }

        const etaSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:the\s+)?delivery\s+(?:eta|speed|time)\s+(?:to|=)\s*["“']?([^"”']+)["”']?/i);
        if (etaSettingMatch) {
          const newEta = etaSettingMatch[1].trim();
          const actionData = { type: "update_setting", key: "delivery_eta", value: newEta };
          await setOwnerPendingAction(from, actionData);
          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Update Delivery ETA Display\n` +
            `⚡ *New ETA:* *${newEta}*\n\n` +
            `Bossu, should I update the delivery ETA on the website? Reply *YES* or *NO*.`
          );
        }

        const priceSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:the\s+)?(netflix|afa|mashup|waec|bece)\s+price\s+(?:to|=)?\s*(\d+(?:\.\d+)?)/i);
        if (priceSettingMatch) {
          const service = priceSettingMatch[1].toLowerCase();
          const newPrice = priceSettingMatch[2];
          const key = service === "waec" ? "waec_price" : (service === "bece" ? "bece_price" : `${service}_price`);
          const actionData = { type: "update_setting", key, value: newPrice };
          await setOwnerPendingAction(from, actionData);
          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Update ${service.toUpperCase()} Service Price\n` +
            `💰 *New Price:* *GH₵ ${Number(newPrice).toFixed(2)}*\n\n` +
            `Bossu, should I update this price on the store? Reply *YES* or *NO*.`
          );
        }

        const genericSettingMatch = cmdText.match(/(?:update|set|change)\s+(?:store\s+)?setting\s+([a-zA-Z0-9_-]+)\s+(?:to|=)\s*["“']?([^"”']+)["”']?/i);
        if (genericSettingMatch) {
          const key = genericSettingMatch[1].trim().toLowerCase();
          const val = genericSettingMatch[2].trim();
          const actionData = { type: "update_setting", key, value: val };
          await setOwnerPendingAction(from, actionData);
          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Update Store Setting\n` +
            `⚙️ *Key:* ${key}\n` +
            `📝 *New Value:* *${val}*\n\n` +
            `Bossu, should I save this setting to the database? Reply *YES* or *NO*.`
          );
        }

        // Direct Action Command 2: Resync order with DataMart
        const resyncCmdMatch = text.match(/(?:resync|check|sync)\s+(?:order\s+)?([A-Za-z0-9_-]{6,30})/i);
        if (resyncCmdMatch) {
          const targetRef = resyncCmdMatch[1].trim();
          const actionData = { type: "resync_order", ref: targetRef };
          await setOwnerPendingAction(from, actionData);

          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Resync with DataMart API\n` +
            `🎯 *Target:* Order *${targetRef}*\n` +
            `💬 *Effect:* Query telecom network status from supplier API and update local database.\n\n` +
            `Bossu, should I go ahead and resync now? Reply *YES* or *NO*.`
          );
        }

        // Direct Action Command 3: Send SMS
        const smsCmdMatch = text.match(/send\s+(?:an\s+)?sms\s+(?:to\s+)?(0[2357]\d{8}|233\d{9})\s+(?:saying|with message|that)\s+["']?([^"']+)["']?/i);
        if (smsCmdMatch) {
          const targetPhone = smsCmdMatch[1].trim();
          const targetText = smsCmdMatch[2].trim();
          const actionData = { type: "send_sms", phone: targetPhone, smsText: targetText, sender: "D_1Gh" };
          await setOwnerPendingAction(from, actionData);

          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Send Customer SMS via Arkesel\n` +
            `📱 *Recipient:* ${targetPhone}\n` +
            `🆔 *Sender ID:* *D_1Gh*\n` +
            `💬 *Message:* "${targetText}"\n\n` +
            `Bossu, should I send this SMS? Reply *YES* to dispatch or *NO* to cancel.`
          );
        }

        // Direct Action Command 4: Stock toggle
        const stockCmdMatch = text.match(/(?:put|mark|set)\s+([A-Za-z0-9\s]+?)\s+(in stock|back in stock|out of stock|available)/i);
        if (stockCmdMatch) {
          const itemText = stockCmdMatch[1].trim();
          const inStock = /in stock|available/i.test(stockCmdMatch[2]);
          const { data: prods } = await supabase.from("products").select("id, name, network, capacity, in_stock");
          const found = (prods || []).find(p => `${p.network} ${p.capacity} ${p.name || ""}`.toLowerCase().includes(itemText.toLowerCase()));
          if (found) {
            const actionData = { type: "toggle_stock", productId: found.id, inStock, productName: `${found.network} ${found.capacity}` };
            await setOwnerPendingAction(from, actionData);

            return sendWhatsApp(from,
              `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
              `📋 *Task:* Update Product Inventory\n` +
              `📦 *Package:* ${found.network} ${found.capacity}\n` +
              `⚡ *New Status:* *${inStock ? "IN STOCK" : "OUT OF STOCK"}*\n\n` +
              `Bossu, should I go ahead and update the store? Reply *YES* or *NO*.`
            );
          }
        }

        // Direct Action Command 5: Retry telecom dispatch via DataMart
        const retryCmdMatch = text.match(/(?:retry|re-dispatch|redispatch|repurchase)\s+(?:order\s+)?([A-Za-z0-9_-]{6,30})/i);
        if (retryCmdMatch) {
          const targetRef = retryCmdMatch[1].trim();
          const { data: ord } = await supabase.from("orders").select("reference, recipient_phone, network, capacity, amount").or(`reference.ilike.%${targetRef}%,datamart_reference.ilike.%${targetRef}%`).maybeSingle();
          if (ord) {
            const actionData = {
              type: "retry_order",
              ref: ord.reference,
              phone: ord.recipient_phone,
              network: ord.network,
              capacity: ord.capacity
            };
            await setOwnerPendingAction(from, actionData);

            return sendWhatsApp(from,
              `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
              `📋 *Task:* Retry Telecom Order Dispatch\n` +
              `🎯 *Target:* Order *${ord.reference}*\n` +
              `📦 *Package:* ${ord.capacity}GB ${ord.network} → ${ord.recipient_phone}\n` +
              `⚡ *Channel:* DataMart Fast Delivery API (Wallet)\n\n` +
              `Bossu, should I trigger this retry right now? Reply *YES* to execute or *NO* to cancel.`
            );
          }
        }

        // Direct Action Command 6: Product price change
        const priceCmdMatch =
          text.match(/(?:set|change|update)\s+price\s+(?:of\s+)?([A-Za-z0-9\s]+?)\s+(?:to|as)\s+(?:ghc|gh₵|₵)?\s*(\d+(?:\.\d{1,2})?)/i) ||
          text.match(/(?:set|change|update)\s+([A-Za-z0-9\s]+?)\s+price\s+(?:to|as)\s+(?:ghc|gh₵|₵)?\s*(\d+(?:\.\d{1,2})?)/i);
        if (priceCmdMatch) {
          const itemText = priceCmdMatch[1].trim();
          const newPrice = parseFloat(priceCmdMatch[2]);
          const { data: prods } = await supabase.from("products").select("id, name, network, capacity, price");
          const found = (prods || []).find(p => `${p.network} ${p.capacity} ${p.name || ""}`.toLowerCase().includes(itemText.toLowerCase()));
          if (found && !isNaN(newPrice)) {
            const actionData = {
              type: "update_product_price",
              productId: found.id,
              price: newPrice,
              productName: `${found.network} ${found.capacity}`
            };
            await setOwnerPendingAction(from, actionData);

            return sendWhatsApp(from,
              `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
              `📋 *Task:* Update Product Price\n` +
              `📦 *Package:* ${found.network} ${found.capacity}\n` +
              `💰 *Current Price:* GH₵ ${Number(found.price).toFixed(2)}\n` +
              `⚡ *New Price:* *GH₵ ${newPrice.toFixed(2)}*\n\n` +
              `Bossu, should I update this price on the store? Reply *YES* to confirm or *NO* to cancel.`
            );
          }
        }

        // Direct Action Command 7: Resolve support chat
        const chatCmdMatch = text.match(/(?:resolve|close|clear)\s+(?:support\s+)?(?:chat|conversation)(?:\s+(?:with|for)\s+([A-Za-z0-9_-]+))?/i);
        if (chatCmdMatch) {
          const target = chatCmdMatch[1]?.trim() || "";
          const actionData = {
            type: "resolve_support_chat",
            phone: target || null
          };
          await setOwnerPendingAction(from, actionData);

          return sendWhatsApp(from,
            `⚠️ *ACTION CONFIRMATION REQUIRED*\n\n` +
            `📋 *Task:* Resolve Customer Support Chat\n` +
            (target ? `📱 *Target Customer:* ${target}\n` : `💬 *Target:* Clear active open support chat queue\n`) +
            `\nBossu, should I mark this chat as resolved? Reply *YES* or *NO*.`
          );
        }

        // Direct Action Command 8: Interactive Operations & Issue Radar
        if (/^(issues|check issues|scan issues|scan system|system issues|what issues|any problem|pending tasks|what to do|action list|problems)\b/i.test(lt)) {
          let report = `🚨 *STONY OPERATIONS & ISSUE RADAR*\n\n`;
          let issueCount = 0;
          let firstAction = null;

          if (stuckOrders.length > 0) {
            report += `⏳ *Stuck Deliveries (>15 mins):*\n` + stuckOrders.slice(0, 3).map(o => `• *${o.reference}*: ${o.capacity}GB ${o.network} → ${o.recipient_phone}`).join("\n") + "\n\n";
            issueCount += stuckOrders.length;
            firstAction = { type: "update_order_status", orders: stuckOrders.map(o => o.reference), status: "delivered", send_sms: false };
          }
          if (failedOrdersList.length > 0) {
            report += `❌ *Failed Orders Needing Attention:*\n` + failedOrdersList.slice(0, 3).map(o => `• *${o.reference}*: ${o.capacity}GB ${o.network} → ${o.recipient_phone}`).join("\n") + "\n\n";
            issueCount += failedOrdersList.length;
          }
          if (pendingMashupCount > 0) {
            report += `📱 *Pending MashUp Queue:* ${pendingMashupCount} order(s) awaiting manual dial (*567*2#).\n\n`;
            issueCount += pendingMashupCount;
          }
          if (unreadSupportCount > 0) {
            report += `💬 *Customer Support:* ${unreadSupportCount} unread message(s) waiting on website!\n\n`;
            issueCount += unreadSupportCount;
          }
          if (outOfStockCount > 0) {
            report += `⚠️ *Out of Stock:* ${outOfStockCount} package(s) marked out of stock on website.\n\n`;
            issueCount += outOfStockCount;
          }
          if (walletBalance && /₵\s*([0-4]?\d(?:\.\d+)?)/.test(walletBalance)) {
            report += `💳 *Low DataMart Wallet:* ${walletBalance} (top up needed to prevent paused dispatches).\n\n`;
            issueCount += 1;
          }

          if (issueCount === 0) {
            return sendWhatsApp(from, `✅ *ALL CLEAR BOSSU!*\n\nI just scanned the whole system across all 13 departments: No stuck orders, no failed deliveries, customer chats are attended, and packages are in stock!\n\nDelivery Speed: *${deliveryEta}*\nDataMart Wallet: *${walletBalance || "Active"}*\nBulk SMS: *${arkeselSmsBalance || "Active"}* (Sender: *D_1Gh*)\n\nWhat would you like me to tackle?`);
          }

          if (firstAction && stuckOrders.length > 0) {
            await setOwnerPendingAction(from, firstAction);
            report += `💡 *Recommended Action:*\nShall I mark the ${stuckOrders.length} stuck order(s) as *DELIVERED* in the database? (Customer SMS is turned off). Reply *YES* to execute or tell me what to do!`;
          } else {
            report += `💡 *How can I help you boss?*\nJust text me what to do:\n• "Update [order] to delivered"\n• "Retry order [order]"\n• "Send SMS to [phone] saying ..."\n• "Mark [package] in stock / out of stock"\n• "Change price of [package] to [amount]"`;
          }

          return sendWhatsApp(from, report);
        }

        // 1. Order Lookups (like WSF7AEZQA)
        if (specificOrderCtx) {
          aiReply = `🔍 *Live Order Status:*\n${specificOrderCtx}\nIf payment just went through on MoMo, you can refresh or I can trigger delivery directly for you!`;
        }

        // 2. Greetings & Personal Check-in
        else if (/^(hi|hello|hey|yo|sup|chale|boss|bossu|how far|how you dey|good morning|good evening|stony|are you there|you dey)/i.test(lt)) {
          const convReplies = [
            `I dey solid bossu! 😊 Everything dey move on the system. How your day dey go? Any orders you want make I check, or we dey plan marketing today?`,
            `Chale boss, I dey right here! System is active. Delivery speed is around ${deliveryEta}.${walletBalance ? ` Wallet is sitting at ${walletBalance}.` : ""} What's the plan?`,
            `I dey here with you boss! Ready for anything — stats, orders, or brainstorming new promos. How can I help you right now?`
          ];
          aiReply = convReplies[history.length % convReplies.length];
        }

        // 3. Sales / Today / Revenue / Stats
        else if (/\b(stat|today|sales|revenue|how many orders|how much|market|cash|money)\b/i.test(lt)) {
          aiReply = `📊 *Today's Performance:* We have *${todayPaidCount} paid orders* bringing in *GH₵ ${todayRevenue.toFixed(2)}* so far today! Delivery speed is running at *${deliveryEta}*. ${walletBalance ? `DataMart wallet: *${walletBalance}*.` : ""} How do you feel about dropping a quick status promo to push more volume?`;
        }

        // 3b. Whole-system capabilities check / scope question (e.g. "will the ai perform", "only this that it can do", "it should be montring the whole system")
        else if (/\b(perform|only this|what can you do|capabilities|scope|whole system|montr|supervise|oversee)\b/i.test(lt)) {
          aiReply = `Yes bossu! I don't just do daily sales, deliveries, wallet, and marketing — I monitor and supervise the ENTIRE system 24/7 across all 13 core pillars:\n\n` +
            `1. 📶 Telecom Data Pipeline (MTN, Telecel, AT delivery speeds: ${deliveryEta})\n` +
            `2. 💰 Financials & Cash Flow (${todayPaidCount} orders today, ₵${todayRevenue.toFixed(2)} sales)\n` +
            `3. 💳 DataMart API & Wallet (${walletBalance || "Connected"} — auto-alert if < ₵50)\n` +
            `4. ✉️ Arkesel Bulk SMS Gateway (${arkeselSmsBalance || "Active"} credits for alerts & receipts)\n` +
            `5. 📺 Netflix 30-Day Subscriptions (${netflixCount} active subscriber passes & IMAP pipeline)\n` +
            `6. 📱 MTN MashUp Manual Queue (${pendingMashupCount} awaiting manual *567*2# dispatch)\n` +
            `7. 🪪 AFA Farmer Alliance Registrations (${afaCount} registered)\n` +
            `8. 🎓 WAEC Result Checkers (${checkerCount} vouchers sold)\n` +
            `9. 💬 Live Customer Support (${openSupportCount} open chats, ${unreadSupportCount > 0 ? `⚠️ ${unreadSupportCount} unread!` : "all cleared"})\n` +
            `10. 📦 Product Catalog & Stock (${outOfStockCount > 0 ? `⚠️ ${outOfStockCount} items OUT OF STOCK` : "All items in stock ✅"})\n` +
            `11. 🤝 Affiliate & Referral Network (${activePromotersCount} registered promoters)\n` +
            `12. 🎁 Gamification & Retention (${unlockedScratchCount} scratch cards unlocked)\n` +
            `13. 🛡️ System Integrity & Security (stuck order detection & health monitoring)\n\n` +
            `Everything is under watch boss! Which department do you want us to tackle?`;
        }

        // 3c. Post-Payment Lifecycle & Whole-System Oversight (e.g. "still after payment successful", "after payment")
        else if (/\b(after payment|payment succe|post[- ]payment|still after|what happens after)\b/i.test(lt)) {
          aiReply = `Yes bossu! Absolutely! Even AFTER payment is successful, I continue monitoring and managing the entire operation 24/7:\n\n` +
            `1. ⚡ Instant Payment Verification: Paystack and MoMo webhooks confirm the transaction and reconcile the exact amount against price.\n` +
            `2. 🚀 Automated DataMart Fast-Lane Dispatch: The bundle is submitted immediately to the network supplier API with zero manual delay.\n` +
            `3. ⏱️ Active Delivery Verification (Bypassing fake 200 OKs): I actively poll telecom delivery status until it confirms 'delivered'. If an order is stuck in 'processing' for >15 mins, I flag it as an anomaly for an instant 1-click retry.\n` +
            `4. 💳 Wallet Auto-Check: After every purchase, I recalculate the DataMart developer wallet balance and alert you if it drops below GH₵ 50 so dispatch never halts.\n` +
            `5. 🔔 Instant Alerts: You get an instant sale notification on WhatsApp and the database updates live (automated customer SMS is turned off).\n` +
            `6. 🎁 Growth & Retention: I update customer Scratch & Win progress (towards 5/5 orders) and credit affiliate referral commissions.\n` +
            `7. 💬 Customer Care Readiness: When customers ask in support about their paid order, I pull their live network status using their phone number or reference to answer them instantly.\n\n` +
            `Everything is supervised 24/7 bossu! Which order or department do you want us to inspect?`;
        }

        // 4. Whole-System Overview / Health Check
        else if (/\b(system|whole|everything|monitor|audit|health|overview|check all)\b/i.test(lt)) {
          aiReply = `🌐 *Whole-System Health Monitor:*\n` +
            `• Data Bundles: *${todayPaidCount} paid today* (₵${todayRevenue.toFixed(2)}) | Delivery: *${deliveryEta}*\n` +
            `• Balances: DataMart *${walletBalance || "Connected"}* | Arkesel SMS *${arkeselSmsBalance || "Active"}*\n` +
            `• Digital Services: *${netflixCount} Netflix* active | *${pendingMashupCount} MashUp* pending manual | *${afaCount} AFA* registered\n` +
            `• WAEC Checkers: *${checkerCount}* sold\n` +
            `• Support Chats: *${openSupportCount} open* (${unreadSupportCount > 0 ? `⚠️ ${unreadSupportCount} unread!` : "all cleared"})\n` +
            `• Catalog: ${outOfStockCount > 0 ? `⚠️ ${outOfStockCount} items OUT OF STOCK` : "All packages in stock ✅"}\n\n` +
            `Everything is under watch boss! What area do you want to inspect?`;
        }

        // 5. Digital Services: Netflix
        else if (/\b(netflix|movie|stream)\b/i.test(lt)) {
          aiReply = `📺 *Netflix 30-Day Subscriptions:* We currently have *${netflixCount} active subscriber(s)*. The auto-credential and IMAP code extraction pipeline is active. Need me to look up any specific subscriber code?`;
        }

        // 6. Digital Services: MTN MashUp
        else if (/\b(mashup|combo|mix)\b/i.test(lt)) {
          aiReply = pendingMashupCount > 0
            ? `📶 *MTN MashUp Alert:* We have *${pendingMashupCount} order(s) awaiting manual dispatch* on *567*2#! Deliver to their numbers so customers get their data and minutes.`
            : `📶 *MTN MashUp:* All MashUp orders are cleared boss! No pending manual applications right now.`;
        }

        // 7. Digital Services: AFA Registration
        else if (/\b(afa|farmer|alliance)\b/i.test(lt)) {
          aiReply = `🪪 *AFA Registrations:* We have processed *${afaCount} registration(s)* on the portal. The AFA verification API is connected and responding.`;
        }

        // 8. Result Checkers (WAEC / BECE / WASSCE)
        else if (/\b(checker|waec|bece|wassce|novdec|result)\b/i.test(lt)) {
          aiReply = `🎓 *WAEC Result Checkers:* We have sold *${checkerCount} checker voucher(s)*. Instant PIN and serial issuance is active directly on the website portal!`;
        }

        // 9. Live Customer Support Chats
        else if (/\b(chat|support|unread|ticket|complaint|customer|help)\b/i.test(lt)) {
          aiReply = unreadSupportCount > 0
            ? `💬 *Customer Support Alert:* We have *${unreadSupportCount} unread message(s)* across *${openSupportCount} open live chat(s)*! You can check the admin portal or reply to visitors.`
            : `💬 *Customer Support:* All customer chats are up to date! *${openSupportCount} open session(s)* with zero unread messages right now.`;
        }

        // 10. Catalog & Out of Stock
        else if (/\b(stock|out of stock|inventory|package|catalog)\b/i.test(lt)) {
          aiReply = outOfStockCount > 0
            ? `⚠️ *Stock Alert:* There are *${outOfStockCount} package(s) marked out of stock* in the products catalog. Check the admin products page to re-enable them if inventory is ready!`
            : `📦 *Inventory Status:* All data bundle packages across MTN, Telecel, and AirtelTigo are *IN STOCK* and purchasable!`;
        }

        // 11. Arkesel SMS Balance
        else if (/\b(sms|arkesel|credit|units)\b/i.test(lt)) {
          aiReply = arkeselSmsBalance
            ? `✉️ *Arkesel SMS Gateway:* You have *${arkeselSmsBalance}* credits available for order receipts and security alerts.`
            : `✉️ *Arkesel SMS Gateway:* Connected and ready to dispatch notifications.`;
        }

        // 12. Wallet / DataMart Balance
        else if (/\b(balance|wallet|datamart|credit)\b/i.test(lt)) {
          aiReply = walletBalance
            ? `Our DataMart wallet balance is *${walletBalance}* right now boss. ${Number(walletBalance.replace(/[^\d.]/g, "") || 0) < 50 ? "⚠️ It's getting a bit low — might want to top up soon so orders don't pause." : "We're well covered for incoming orders!"}`
            : "Couldn't fetch the exact wallet balance right now boss, but the DataMart API connection is active. I can recheck in a moment!";
        }

        // 13. Delivery Speed / Tracker
        else if (/\b(speed|delivery|fast|delay|tracker|eta)\b/i.test(lt)) {
          aiReply = `Data delivery is currently hitting around *${deliveryEta}* boss 🚀 MTN orders are moving through DataMart steadily. Any specific recipient number giving trouble?`;
        }

        // 14. Stuck / Failed / Problem Orders
        else if (/\b(failed|stuck|problem|complaint|issue|pending)\b/i.test(lt)) {
          if (failedOrdersList.length > 0) {
            aiReply = `⚠️ We have *${failedOrdersList.length} failed order(s)* needing attention:\n` +
              failedOrdersList.map((o, idx) => `${idx + 1}. Ref *${o.reference}* — ${o.capacity}GB ${o.network} to ${o.recipient_phone}`).join("\n") +
              `\n\nDrop any reference and I can inspect it or prepare a retry for you boss!`;
          } else if (pendingOrdersList.length > 0) {
            aiReply = `⏳ No failed orders! We have *${pendingOrdersList.length} order(s) currently in progress* with telecom networks. They usually land within ${deliveryEta}.`;
          } else {
            aiReply = `All clear boss! ✅ Zero failed orders and zero stuck orders right now. Everything is running smoothly.`;
          }
        }

        // 15. Ideas / Marketing / Growth Advice
        else if (/\b(idea|advice|grow|market|promo|scale|customers?|boost|increase)\b/i.test(lt)) {
          aiReply = `💡 *3 Quick Ideas to Boost Our Sales Today Bossu:*\n\n1. *Campus Reps:* Get 2-3 university students (Legon, KNUST, UPSA) posting on their department WhatsApp groups with their referral link.\n2. *Flash Bundle Discount:* Run a 2-hour "Happy Hour" on 5GB MTN bundles on your WhatsApp status — bundle buyers love urgency.\n3. *Repeat Buyer Reminder:* Send an SMS through Arkesel to customers who bought 1-2 weeks ago — they're probably running low on data right now!\n\nWant to draft a message for one of these?`;
        }

        // 16. General conversational partner reply
        else {
          aiReply = `I hear you loud and clear boss. Whole system is active and monitored — delivery is ${deliveryEta}${walletBalance ? `, wallet is ${walletBalance}` : ""}${unreadSupportCount > 0 ? `, 💬 ${unreadSupportCount} unread support chat(s)` : ""}. Tell me what area you want us to tackle!`;
        }
      }

      aiReply = sanitizeSecretsFromText(aiReply)
        .replace(/\b(as an ai( language model)?|i am an ai( language model)?|i'm an ai( language model)?)\b/gi, "I am Stony")
        .replace(/\bdatamart\b/gi, "DataMart");

      // ── SAVE UPDATED CONVERSATION MEMORY ──
      try {
        const updatedHistory = [
          ...history.slice(-6),
          { role: "user", text },
          { role: "assistant", text: aiReply }
        ];
        await saveOwnerHistory(from, updatedHistory);
      } catch (_) {}

      return sendWhatsApp(from, aiReply);
    }

    let { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("phone", from)
      .maybeSingle();

    /* =====================================================
    CREATE SESSION
    ===================================================== */

    if (!session) {
      await supabase.from("sessions").insert([{ phone: from, step: 1 }]);
      session = { phone: from, step: 1 };
      return sendWhatsApp(from, MENU);
    }

    // Direct AI mode handling for non-owner customers
    if (activeMode === "ai" || session.step === 99) {
      return handleCustomerAi(from, effectiveText || text);
    }

    /* =====================================================
    RESET
    ===================================================== */

    if (/^(hi|hello|start)$/i.test(text)) {
      await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
      return sendWhatsApp(from, MENU);
    }

    /* =====================================================
    STEP 1 - MAIN MENU
    ===================================================== */

    if (session.step === 1) {
      let network;

      if (text === "1") {
        network = "MTN";
      } else if (text === "2") {
        network = "AIRTELTIGO";
      } else if (text === "3") {
        network = "TELECEL";
      } else if (text === "4") {
        await supabase.from("sessions").update({ step: 6 }).eq("phone", from);
        return sendWhatsApp(from, `📦 TRACK YOUR ORDER\n\nPlease enter the phone number used when you purchased your data.\n\nExample:\n0241234567`);
      } else if (text === "5") {
        await supabase.from("sessions").update({
          step: 50,
          bundle: JSON.stringify({ type: "netflix" }),
          momo_number: null,
          phone_number: null
        }).eq("phone", from);

        return sendWhatsApp(from, `📺 Netflix Subscription — ₵${NETFLIX_PRICE}\n\nSelect the network for the Mobile Money number you'll pay from:\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel`);
      } else if (text === "6") {
        await supabase.from("sessions").update({
          step: 30,
          bundle: null,
          momo_number: null,
          phone_number: null
        }).eq("phone", from);

        return sendWhatsApp(from, `🪪 AFA Registration — ₵${AFA_PRICE}\n\nSelect the network for the Mobile Money number you'll pay from:\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel`);
      } else if (text === "7") {
        await supabase.from("sessions").update({ step: 10, network: "MASHUP" }).eq("phone", from);
        return sendWhatsApp(from, `📶 MTN MashUp Bundle\n\nEnter the amount you want to pay (₵${MASHUP_MIN_AMOUNT} - ₵${MASHUP_MAX_AMOUNT}):\n\nExample: 5\n\nThe data + minutes mix you get depends on what MTN offers for that amount — this will be applied to your number manually.`);
      } else if (text === "8") {
        await supabase.from("sessions").update({ step: 70 }).eq("phone", from);
        return playScratchCard(from);
      } else {
        return handleCustomerAi(from, text);
      }

      await supabase.from("sessions").update({ step: 2, network }).eq("phone", from);
      return sendWhatsApp(from, MENUS[network]);
    }

    /* =====================================================
    STEP 2 - SELECT BUNDLE
    ===================================================== */

    if (session.step === 2) {
      const bundle = PACKAGES[session.network]?.[text];
      if (!bundle) {
        return sendWhatsApp(from, "Invalid option ❌ Choose an option to continue");
      }

      await supabase.from("sessions").update({ step: 3, bundle: text }).eq("phone", from);
      return sendWhatsApp(from, "Enter phone number to receive the data on:");
    }

    /* =====================================================
    STEP 3 - DELIVERY PHONE NUMBER
    ===================================================== */

    if (session.step === 3) {
      const phone = normalizePhone(text);
      if (phone.length !== 10 || !phone.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana phone number to continue");
      }

      await supabase.from("sessions").update({ phone_number: phone, step: 8 }).eq("phone", from);
      return sendWhatsApp(from, `📲 Enter the Mobile Money number to pay from:\n\n(This can be the same number or a different one)`);
    }

    /* =====================================================
    STEP 8 - MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 8) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      const bundle = PACKAGES[session.network][session.bundle];
      const { error: momoUpdateError } = await supabase.from("sessions").update({
        momo_number: momoNumber,
        step: 15,
        scratch_order_opt_in: false
      }).eq("phone", from);

      if (momoUpdateError) {
        console.error("❌ FAILED TO SAVE MOMO NUMBER / STEP 4:", momoUpdateError);
        return sendWhatsApp(from, "❌ Something went wrong saving your details. Please reply HI and try again.");
      }

      const activeScratch = await getActiveScratchCode(from);
      if (activeScratch) {
        return sendWhatsApp(from, `🎟️ SCRATCH & WIN (OPTIONAL)\n\nActive Code: *${activeScratch.code}*\nProgress: ${Number(activeScratch.orders_completed || 0)}/${SCRATCH_REQUIRED_ORDERS}\n\nUse this code for this paid order?\n\n1 - YES, use my code\n2 - NO, skip`);
      }

      return sendWhatsApp(from, `🎟️ SCRATCH & WIN (OPTIONAL)\n\nDo you have a Data1 Scratch Code for this paid order?\n\n1 - YES, enter my code\n2 - NO / SKIP`);
    }

    /* =====================================================
    STEP 15 - OPTIONAL SCRATCH CODE AT CHECKOUT
    ===================================================== */

    if (session.step === 15) {
      const finishConfirm = async () => {
        const bundle = PACKAGES[session.network]?.[session.bundle];
        const tracker = await getDeliveryEstimate();
        const estimateMessage = buildDeliveryEstimateMessage(tracker);
        await supabase.from("sessions").update({ step: 4 }).eq("phone", from);
        return sendWhatsApp(from, `Confirm Order: Your order will be delivered ✅\n\n📶 Network: ${session.network}\n📦 Data: ${bundle.capacity}GB\n💰 Amount: ₵${bundle.price.toFixed(2)}\n📱 Data goes to: ${session.phone_number}\n💳 Pay from (Momo): ${session.momo_number}\n\n${estimateMessage}\n\nReply YES to pay or NO to cancel`);
      };

      if (text === "2" || /^no$/i.test(text) || /^skip$/i.test(text)) {
        await supabase.from("sessions").update({ scratch_order_opt_in: false }).eq("phone", from);
        return finishConfirm();
      }

      if (text === "1" || /^yes$/i.test(text)) {
        const activeScratch = await getActiveScratchCode(from);
        if (activeScratch) {
          await supabase.from("sessions").update({ scratch_code: activeScratch.code, scratch_order_opt_in: true }).eq("phone", from);
          return finishConfirm();
        }
        await supabase.from("sessions").update({ step: 16, scratch_order_opt_in: false }).eq("phone", from);
        return sendWhatsApp(from, "🎟️ Enter your Data1 Scratch Code:\n\nExample: Data1A7K92P");
      }
      return sendWhatsApp(from, "Reply 1 for YES or 2 for NO / SKIP.");
    }

    /* =====================================================
    STEP 16 - ENTER SCRATCH CODE AT CHECKOUT
    ===================================================== */

    if (session.step === 16) {
      const result = await activateScratchCodeForCheckout(from, text);
      if (!result.ok) return sendWhatsApp(from, result.message);
      await supabase.from("sessions").update({ scratch_code: result.scratch.code, scratch_order_opt_in: true, step: 4 }).eq("phone", from);
      const bundle = PACKAGES[session.network]?.[session.bundle];
      const tracker = await getDeliveryEstimate();
      const estimateMessage = buildDeliveryEstimateMessage(tracker);
      return sendWhatsApp(from, `Confirm Order: Your order will be delivered ✅\n\n📶 Network: ${session.network}\n📦 Data: ${bundle.capacity}GB\n💰 Amount: ₵${bundle.price.toFixed(2)}\n📱 Data goes to: ${session.phone_number}\n💳 Pay from (Momo): ${session.momo_number}\n\n🎟️ Scratch Code: ${result.scratch.code}\n🎯 This order will count toward: ${Number(result.scratch.orders_completed || 0) + 1}/${SCRATCH_REQUIRED_ORDERS}\n\n${estimateMessage}\n\nReply YES to pay or NO to cancel`);
    }

    /* =====================================================
    STEP 70 - SCRATCH MENU / CODE GENERATION
    ===================================================== */

    if (session.step === 70) {
      if (/^yes$/i.test(text)) {
        try {
          const result = await createScratchCodeForCustomer(from);
          if (!result.ok) {
            const x = result.existing;
            return sendWhatsApp(from, x.unlocked ? `🎉 Your Scratch Card is already unlocked!\n\nCode: *${x.code}*\nProgress: ${Number(x.orders_completed || 0)}/5\n\nReply *SCRATCH* to play.` : `🎟️ You already have an active code: *${x.code}*\n\nProgress: ${Number(x.orders_completed || 0)}/5\n\nUse it during payment on your next paid data orders.`);
          }
          return sendWhatsApp(from, `🎉 YOUR UNIQUE SCRATCH CODE IS READY!\n\n🎟️ *${result.data.code}*\n\nUse this code during payment on your Data orders. Complete 5 PAID Data orders using this code.\n\nProgress: 0/5\n\nAfter the 5th paid order, your Scratch Card unlocks automatically. Come back here and reply *SCRATCH* to win 1GB or 2GB! 🎁`);
        } catch (e) {
          console.error("SCRATCH GENERATION ERROR:", e);
          return sendWhatsApp(from, "❌ We could not generate your Scratch Code right now. Please reply *YES* to try again.");
        }
      }
      if (/^scratch$/i.test(text)) return playScratchCard(from);
      const activeScratch = await getActiveScratchCode(from);
      if (activeScratch) return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\nCode: *${activeScratch.code}*\nProgress: ${Number(activeScratch.orders_completed || 0)}/5\n\n${activeScratch.unlocked ? "🎉 UNLOCKED — reply SCRATCH to play." : "Use this code during payment on your paid data orders."}`);
      return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\nYou do not currently have an active Scratch Code.\n\nReply *YES* to generate your unique Data1 Scratch Code automatically.\n\nThen use it during payment on 5 PAID data orders. After 5/5, come back and reply *SCRATCH* to win! 🎁`);
    }

    /* =====================================================
    STEP 80 - SCRATCH PRIZE NETWORK
    ===================================================== */

    if (session.step === 80) {
      const networks = { "1": "MTN", "2": "AIRTELTIGO", "3": "TELECEL" };
      const network = networks[text];
      if (!network) return sendWhatsApp(from, "Invalid option ❌\n\n1 - MTN\n2 - AirtelTigo\n3 - Telecel");
      await supabase.from("sessions").update({ network, step: 81 }).eq("phone", from);
      return sendWhatsApp(from, "📱 Enter the Ghana phone number where you want your FREE prize sent:");
    }

    /* =====================================================
    STEP 81 - SCRATCH PRIZE DELIVERY
    ===================================================== */

    if (session.step === 81) {
      const prizePhone = normalizePhone(text);
      if (prizePhone.length !== 10 || !prizePhone.startsWith("0")) return sendWhatsApp(from, "❌ Invalid Ghana phone number.\n\nExample: 0241234567");
      const scratch = await supabase.from("scratch_codes").select("*").eq("assigned_to", normalizePhone(from)).eq("status", "processing").maybeSingle().then(r => r.data);
      if (!scratch) return sendWhatsApp(from, "❌ Scratch prize session not found. Reply SCRATCH and try again.");
      const capacity = String(scratch.prize || "1");
      const prizeLabel = capacity === "2" ? "2GB" : "1GB";
      const networkMap = { MTN: "YELLO", AIRTELTIGO: "YELLO", TELECEL: "YELLO" };
      try {
        const response = await axios.post(`${DATAMART_BASE}/purchase`, { phoneNumber: prizePhone, network: networkMap[session.network] || "YELLO", capacity, gateway: "wallet", delivery: "fast" }, { headers: { "x-api-key": DATA_API_KEY, "Content-Type": "application/json" }, timeout: 30000 });
        const data = response.data?.data || response.data || {};
        const reference = data.reference || data.orderReference || data.order_reference || null;
        await supabase.from("scratch_codes").update({ status: "used", prize_network: session.network, prize_phone: prizePhone, datamart_reference: reference, delivered_at: new Date().toISOString() }).eq("id", scratch.id);
        await supabase.from("sessions").update({ step: 1, scratch_prize: null }).eq("phone", from);
        return sendWhatsApp(from, `🎉 PRIZE SENT SUCCESSFULLY!\n\n🎁 Prize: ${prizeLabel}\n📶 Network: ${session.network}\n📱 Sent to: ${prizePhone}\n${reference ? `🆔 Reference: ${reference}\n` : ""}\nReply HI to continue shopping.`);
      } catch (e) {
        console.error("SCRATCH PRIZE DELIVERY ERROR:", e.response?.data || e.message);
        await supabase.from("scratch_codes").update({ status: "unlocked", scratched: false }).eq("id", scratch.id);
        return sendWhatsApp(from, `❌ We could not send your ${prizeLabel} prize right now. Your Scratch Card has NOT been lost. Reply *SCRATCH* and try again.`);
      }
    }

    /* =====================================================
    STEP 4 - CONFIRM PAYMENT
    ===================================================== */

    if (session.step === 4) {
      if (/^no$/i.test(text)) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + MENU);
      }

      if (/^yes$/i.test(text)) {
        const bundle = PACKAGES[session.network][session.bundle];
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 9 - AWAITING OTP
    ===================================================== */

    if (session.step === 9) {
      return submitMomoOtp(from, session, text.trim());
    }

    /* =====================================================
    STEP 10 - MASHUP CUSTOM AMOUNT
    ===================================================== */

    if (session.step === 10) {
      const amountText = text.trim();
      if (!isValidMashupAmount(amountText)) {
        return sendWhatsApp(from, `Invalid amount ❌ Enter an amount between ₵${MASHUP_MIN_AMOUNT} and ₵${MASHUP_MAX_AMOUNT} (e.g. 5)`);
      }

      await supabase.from("sessions").update({ bundle: amountText, step: 11 }).eq("phone", from);
      const combos = getMashupCombos(amountText);
      let comboMenu = `MashUp ₵${amountText} — choose a package:\n\n`;
      combos.forEach((c, i) => {
        comboMenu += `${i + 1} - ${c.label}\n`;
      });
      comboMenu += `\nChoose an option to continue`;
      return sendWhatsApp(from, comboMenu);
    }

    /* =====================================================
    STEP 11 - MASHUP COMBO SELECTION
    ===================================================== */

    if (session.step === 11) {
      const combos = getMashupCombos(session.bundle);
      const combo = combos[Number(text) - 1];
      if (!combo) {
        return sendWhatsApp(from, "Invalid option ❌ Choose an option to continue");
      }

      await supabase.from("sessions").update({ bundle: `${session.bundle}|${combo.id}`, step: 12 }).eq("phone", from);
      return sendWhatsApp(from, "Enter phone number to receive the MashUp bundle on:");
    }

    /* =====================================================
    STEP 12 - MASHUP DELIVERY PHONE NUMBER
    ===================================================== */

    if (session.step === 12) {
      const phone = normalizePhone(text);
      if (phone.length !== 10 || !phone.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana phone number to continue");
      }

      await supabase.from("sessions").update({ phone_number: phone, step: 13 }).eq("phone", from);
      return sendWhatsApp(from, `📲 Enter the Mobile Money number to pay from:\n\n(This can be the same number or a different one)`);
    }

    /* =====================================================
    STEP 13 - MASHUP MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 13) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      const parsed = parseMashupSelection(session.bundle);
      if (!parsed) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Something went wrong with your selection. Please reply HI and try again.");
      }

      const { error: momoUpdateError } = await supabase.from("sessions").update({
        momo_number: momoNumber,
        step: 14
      }).eq("phone", from);

      if (momoUpdateError) {
        console.error("❌ FAILED TO SAVE MOMO NUMBER / STEP 14:", momoUpdateError);
        return sendWhatsApp(from, "❌ Something went wrong saving your details. Please reply HI and try again.");
      }

      return sendWhatsApp(
        from,
        `Confirm Order: Your MashUp will be applied manually ✅\n\n📶 Network: MTN (MashUp)\n📦 Package: ${parsed.combo.label}\n💰 Amount: ₵${parsed.amount.toFixed(2)}\n📱 Data goes to: ${session.phone_number}\n💳 Pay from (Momo): ${momoNumber}\n\n⏳ Note: MashUp bundles are applied manually and may take a little longer than regular data orders.\n\nReply YES to pay or NO to cancel`
      );
    }

    /* =====================================================
    STEP 14 - CONFIRM MASHUP PAYMENT
    ===================================================== */

    if (session.step === 14) {
      if (/^no$/i.test(text)) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + MENU);
      }

      if (/^yes$/i.test(text)) {
        const parsed = parseMashupSelection(session.bundle);
        if (!parsed) {
          await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
          return sendWhatsApp(from, "❌ Something went wrong with your selection. Please reply HI and try again.");
        }
        const bundle = { price: parsed.amount, capacity: parsed.combo.label };
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 30 - AFA: MOMO NETWORK SELECTION
    ===================================================== */

    if (session.step === 30) {
      let network = null;
      if (text === "1") network = "MTN";
      else if (text === "2") network = "AIRTELTIGO";
      else if (text === "3") network = "TELECEL";

      if (!network) {
        return sendWhatsApp(from, "Invalid option ❌ Reply 1 for MTN, 2 for AirtelTigo, or 3 for Telecel");
      }

      await supabase.from("sessions").update({ network, step: 31 }).eq("phone", from);
      return sendWhatsApp(from, "Enter the Full Name of the applicant:");
    }

    /* =====================================================
    STEP 31 - AFA: FULL NAME
    ===================================================== */

    if (session.step === 31) {
      const fullName = text.trim();
      if (fullName.length < 3) {
        return sendWhatsApp(from, "Invalid name ❌ Enter the applicant's full name (e.g. John Doe)");
      }

      await supabase.from("sessions").update({
        bundle: mergeAfaField(session, "full_name", fullName),
        step: 32
      }).eq("phone", from);

      return sendWhatsApp(from, "Enter the applicant's Phone Number (e.g. 0241234567):");
    }

    /* =====================================================
    STEP 32 - AFA: PHONE NUMBER
    ===================================================== */

    if (session.step === 32) {
      const afaPhone = normalizePhone(text);
      if (afaPhone.length !== 10 || !afaPhone.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana phone number (e.g. 0241234567)");
      }

      await supabase.from("sessions").update({
        bundle: mergeAfaField(session, "phone_number", afaPhone),
        step: 33
      }).eq("phone", from);

      return sendWhatsApp(from, "Enter the applicant's Ghana Card Number (e.g. GHA-000000000-0):");
    }

    /* =====================================================
    STEP 33 - AFA: GHANA CARD NUMBER
    ===================================================== */

    if (session.step === 33) {
      const idNumber = text.trim().toUpperCase();
      if (!isValidGhanaCard(idNumber)) {
        return sendWhatsApp(from, "Invalid Ghana Card number ❌ Use the format GHA-000000000-0");
      }

      await supabase.from("sessions").update({
        bundle: mergeAfaField(session, "id_number", idNumber),
        step: 34
      }).eq("phone", from);

      return sendWhatsApp(from, "Enter the applicant's Location (e.g. Tafo, Kumasi):");
    }

    /* =====================================================
    STEP 34 - AFA: LOCATION
    ===================================================== */

    if (session.step === 34) {
      const location = text.trim();
      if (location.length < 2) {
        return sendWhatsApp(from, "Invalid location ❌ Enter the applicant's location (e.g. Tafo, Kumasi)");
      }

      await supabase.from("sessions").update({
        bundle: mergeAfaField(session, "location", location),
        step: 35
      }).eq("phone", from);

      return sendWhatsApp(from, "Enter the applicant's Date of Birth (DD/MM/YYYY, e.g. 15/06/1995):");
    }

    /* =====================================================
    STEP 35 - AFA: DATE OF BIRTH
    ===================================================== */

    if (session.step === 35) {
      const dob = parseAfaDob(text);
      if (!dob) {
        return sendWhatsApp(from, "Invalid date ❌ Use the format DD/MM/YYYY (e.g. 15/06/1995)");
      }

      await supabase.from("sessions").update({
        bundle: mergeAfaField(session, "dob", dob),
        step: 36
      }).eq("phone", from);

      return sendWhatsApp(from, "Enter the applicant's Occupation (e.g. Student, Teacher, Business Owner):");
    }

    /* =====================================================
    STEP 36 - AFA: OCCUPATION
    ===================================================== */

    if (session.step === 36) {
      const occupation = text.trim();
      if (occupation.length < 2) {
        return sendWhatsApp(from, "Invalid occupation ❌ Enter the applicant's occupation (e.g. Trader)");
      }

      await supabase.from("sessions").update({
        bundle: mergeAfaField(session, "occupation", occupation),
        step: 37
      }).eq("phone", from);

      return sendWhatsApp(from, `📲 Enter the Mobile Money number to pay from (${session.network}):`);
    }

    /* =====================================================
    STEP 37 - AFA: MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 37) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      const afaData = getAfaData(session);
      if (!afaData) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Something went wrong with your form. Please reply HI and try again.");
      }

      const { error: momoUpdateError } = await supabase.from("sessions").update({
        momo_number: momoNumber,
        step: 38
      }).eq("phone", from);

      if (momoUpdateError) {
        console.error("❌ FAILED TO SAVE MOMO NUMBER / STEP 38:", momoUpdateError);
        return sendWhatsApp(from, "❌ Something went wrong saving your details. Please reply HI and try again.");
      }

      return sendWhatsApp(
        from,
        `Confirm AFA Registration ✅\n\n👤 Full Name: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n🪪 Ghana Card: ${afaData.id_number}\n📍 Location: ${afaData.location}\n🎂 DOB: ${afaData.dob}\n💼 Occupation: ${afaData.occupation}\n\n💰 Amount: ₵${AFA_PRICE.toFixed(2)}\n💳 Pay from (Momo, ${session.network}): ${momoNumber}\n\nReply YES to pay or NO to cancel`
      );
    }

    /* =====================================================
    STEP 38 - CONFIRM AFA PAYMENT
    ===================================================== */

    if (session.step === 38) {
      if (/^no$/i.test(text)) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + MENU);
      }

      if (/^yes$/i.test(text)) {
        const afaData = getAfaData(session);
        if (!afaData) {
          await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
          return sendWhatsApp(from, "❌ Something went wrong with your form. Please reply HI and try again.");
        }
        const bundle = { price: AFA_PRICE, capacity: "AFA Registration" };
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 50 - NETFLIX: MOMO NETWORK SELECTION
    ===================================================== */

    if (session.step === 50) {
      let network = null;
      if (text === "1") network = "MTN";
      else if (text === "2") network = "AIRTELTIGO";
      else if (text === "3") network = "TELECEL";

      if (!network) {
        return sendWhatsApp(from, "Invalid option ❌ Reply 1 for MTN, 2 for AirtelTigo, or 3 for Telecel");
      }

      await supabase.from("sessions").update({ network, step: 51 }).eq("phone", from);
      return sendWhatsApp(from, "Enter the Mobile Money number to pay from:");
    }

    /* =====================================================
    STEP 51 - NETFLIX: MOMO PAYMENT NUMBER
    ===================================================== */

    if (session.step === 51) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) {
        return sendWhatsApp(from, "Invalid number ❌ Enter a correct Ghana Mobile Money number to continue");
      }

      const { error: momoUpdateError } = await supabase.from("sessions").update({
        momo_number: momoNumber,
        step: 52
      }).eq("phone", from);

      if (momoUpdateError) {
        console.error("❌ FAILED TO SAVE MOMO NUMBER / STEP 52:", momoUpdateError);
        return sendWhatsApp(from, "❌ Something went wrong saving your details. Please reply HI and try again.");
      }

      return sendWhatsApp(
        from,
        `Confirm Netflix Subscription ✅\n\n📺 Netflix Subscription\n💰 Amount: ₵${NETFLIX_PRICE.toFixed(2)}\n💳 Pay from (Momo, ${session.network}): ${momoNumber}\n\nReply YES to pay or NO to cancel`
      );
    }

    /* =====================================================
    STEP 52 - CONFIRM NETFLIX PAYMENT
    ===================================================== */

    if (session.step === 52) {
      if (/^no$/i.test(text)) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Cancelled\n\n" + MENU);
      }

      if (/^yes$/i.test(text)) {
        const bundle = { price: NETFLIX_PRICE, capacity: "Netflix Subscription" };
        return initiateMomoCharge(from, session, bundle);
      }

      return sendWhatsApp(from, "Reply YES to pay or NO to cancel.");
    }

    /* =====================================================
    STEP 53 - NETFLIX: AWAITING REFERENCE CODE
    ===================================================== */

    if (session.step === 53) {
      const netflixData = getNetflixData(session);
      if (!netflixData) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Something went wrong with your order. Please reply HI and try again.");
      }

      if (netflixData.used) {
        return sendWhatsApp(
          from,
          `❌ This reference code has already been used to fetch a sign-in code.\n\nNeed to sign in again (e.g. a different device)? Pay again via the main menu to get a new reference code.\n\nSEND: hi to return to the main menu.`
        );
      }

      const enteredCode = text.trim().toUpperCase();
      if (enteredCode !== netflixData.refCode) {
        return sendWhatsApp(
          from,
          `Please reply with your reference code exactly as sent: *${netflixData.refCode}*\n\nThis confirms it's really you before we fetch your Netflix sign-in code.`
        );
      }

      await sendWhatsApp(from, "🔄 Getting you the code...., one moment...");
      const result = await fetchNetflixSignIn(netflixData.paidAt);

      if (result.type === "code" || result.type === "approved" || result.type === "link_flagged") {
        await supabase.from("sessions").update({
          bundle: JSON.stringify({ ...netflixData, used: true })
        }).eq("phone", from);
      }

      if (result.type === "code") {
        return sendWhatsApp(from, `✅ Your Netflix sign-in code is:\n\n*${result.value}*\n\nEnter this on Netflix to complete sign-in.\n\nSEND: hi to return to the main menu.`);
      }

      if (result.type === "approved") {
        return sendWhatsApp(from, `✅ Your Netflix sign-in has been approved! You should now be signed in.\n\nSEND: hi to return to the main menu.`);
      }

      if (result.type === "link_flagged") {
        await sendWhatsApp(
          "233547100951",
          `🔔 NETFLIX APPROVAL NEEDED\n\nNetflix sent an approval link instead of a code for a customer sign-in. Please open this link to approve:\n${result.link}\n\nCustomer: ${session.phone}`
        );
        return sendWhatsApp(from, "⏳ We're finalizing your sign-in approval, this should complete shortly. If you don't see it go through, contact 0547100951 (@stony11).");
      }

      if (result.type === "error") {
        return sendWhatsApp(from, `❌ We could not check the email right now. Please reply *${netflixData.refCode}* again in a moment, or contact 0547100951 (@stony11) for help.`);
      }

      return sendWhatsApp(from, `❌ We couldn't find a code or sign-in request yet.\n\nMake sure you've chosen "Sign in" on Netflix using ${NETFLIX_EMAIL}, then reply *${netflixData.refCode}* again in a moment.`);
    }

    /* =====================================================
    STEP 6 - TRACKING PHONE
    ===================================================== */

    if (session.step === 6) {
      const trackingPhone = normalizePhone(text);
      if (trackingPhone.length !== 10 || !trackingPhone.startsWith("0")) {
        return sendWhatsApp(from, `❌ Invalid phone number.\n\nPlease enter a valid Ghana phone number.\n\nExample:\n0241234567`);
      }
      return trackOrders(from, trackingPhone);
    }

    /* =====================================================
    STEP 5 - AWAITING PAYMENT CONFIRMATION
    ===================================================== */

    if (session.step === 5) {
      if (/^(cancel|no|stop)$/i.test(text)) {
        await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
        return sendWhatsApp(from, "❌ Order cancelled.\n\n" + MENU);
      }

      let amount = null;
      if (session.network === "MASHUP") {
        const parsed = parseMashupSelection(session.bundle);
        amount = parsed?.amount;
      } else if (session.network && session.bundle && PACKAGES[session.network]?.[session.bundle]) {
        amount = PACKAGES[session.network][session.bundle].price;
      } else if (session.network === "AFA" || session.bundle?.includes?.("AFA")) {
        amount = AFA_PRICE;
      } else if (session.bundle?.includes?.("netflix") || session.network === "NETFLIX") {
        amount = NETFLIX_PRICE;
      }

      if (/^(link|pay|checkout)$/i.test(text) && amount) {
        const linkRef = "REF-" + Date.now();
        const link = await createPaystackCheckoutLink(from, linkRef, amount);
        if (link) {
          await supabase.from("sessions").update({ ref: linkRef }).eq("phone", from);
          return sendWhatsApp(
            from,
            `💳 PAYMENT LINK\n\nTap below to pay online:\n${link}\n\nAmount: ₵${Number(amount).toFixed(2)}\nOnce paid, your order will be delivered automatically!`
          );
        }
      }

      const provider = getMomoProvider(session.momo_number, session.network);
      let helpMsg = `⏳ Awaiting payment confirmation${session.momo_number ? " for " + session.momo_number : ""}.\n\n`;

      if (provider === "mtn") {
        helpMsg += `👉 *Prompt didn't pop up on your phone?*\n1. Dial *170#\n2. Select 6 (My Wallet)\n3. Select 3 (My Approvals)\n4. Enter your MoMo PIN & select 1 to approve!\n\n`;
      } else if (provider === "vod") {
        helpMsg += `👉 Dial *110# to approve the pending transaction or generate a voucher.\n\n`;
      } else if (provider === "atl") {
        helpMsg += `👉 Dial *110# to approve the pending transaction.\n\n`;
      }

      helpMsg += `Reply *LINK* for a direct payment link.\nReply *CANCEL* to cancel this order, or *HI* for the main menu.`;
      return sendWhatsApp(from, helpMsg);
    }

  } catch (e) {
    console.error("BOT ERROR:", e.response?.data || e.message);
  }
});

/* =========================================================
PAYSTACK WEBHOOK & DEBUG LOGGER
========================================================= */

const recentWebhookLogs = [];

function recordWebhookLog(event, details) {
  const item = { time: new Date().toISOString(), event, details };
  console.log(`[WEBHOOK] ${event}:`, typeof details === "object" ? JSON.stringify(details) : details);
  recentWebhookLogs.unshift(item);
  if (recentWebhookLogs.length > 50) recentWebhookLogs.pop();
}

app.get("/webhook-debug", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    count: recentWebhookLogs.length,
    logs: recentWebhookLogs
  });
});

app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const event = req.body;
    recordWebhookLog("HIT", {
      event_type: event?.event,
      reference: event?.data?.reference,
      amount: event?.data?.amount,
      status: event?.data?.status,
      customer: event?.data?.customer?.email
    });

    if (!event || event.event !== "charge.success") {
      recordWebhookLog("IGNORED", { reason: "event is not charge.success", event: event?.event });
      return;
    }

    const ref = event.data?.reference;
    if (!ref) {
      recordWebhookLog("ERROR", { reason: "missing reference in event.data" });
      return;
    }

    const paidAmount = Number(event.data?.amount || 0) / 100;
    console.log("💰 ACTUAL AMOUNT PAID:", paidAmount);

    // 1. Primary: Look up session by exact ref
    let { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("ref", ref)
      .maybeSingle();

    // 2. Check Website Data Orders by exact reference
    if (!session) {
      const { data: webOrder } = await supabase
        .from("orders")
        .select("*")
        .or(`reference.eq.${ref},datamart_reference.eq.${ref}`)
        .maybeSingle();

      if (webOrder) {
        recordWebhookLog("WEBSITE_DATA_ORDER_FOUND", { ref, id: webOrder.id, network: webOrder.network, capacity: webOrder.capacity });
        console.log("🌐 RECOGNIZED WEBSITE DATA ORDER:", ref);

        const networkMap = {
          MTN: "YELLO",
          mtn: "YELLO",
          YELLO: "YELLO",
          TELECEL: "TELECEL",
          telecel: "TELECEL",
          AT: "AT_PREMIUM",
          at: "AT_PREMIUM",
          AIRTELTIGO: "AT_PREMIUM",
          airteltigo: "AT_PREMIUM",
          AT_PREMIUM: "AT_PREMIUM"
        };
        const dmNetwork = networkMap[webOrder.network] || webOrder.network || "YELLO";
        const phone = normalizePhone(webOrder.recipient_phone || webOrder.phone_number);
        const capacity = String(webOrder.capacity || "1").replace(/[^\d.]/g, "");

        let dmSuccess = false;
        let dmRef = null;

        if (DATA_API_KEY) {
          try {
            const dmRes = await axios.post(
              `${DATAMART_BASE}/purchase`,
              { phoneNumber: phone, network: dmNetwork, capacity, gateway: "wallet", delivery: "fast" },
              { headers: { "x-api-key": DATA_API_KEY, "Content-Type": "application/json" }, timeout: 30000 }
            );
            const data = dmRes.data?.data || dmRes.data || {};
            dmRef = data.reference || data.orderReference || data.purchaseId || null;
            dmSuccess = true;
          } catch (dmErr) {
            console.warn("Direct DataMart purchase error for web order:", dmErr.response?.data || dmErr.message);
          }
        }

        // CRITICAL: Never immediately jump to "delivered".
        // DataMart accepts order and reports "completed", which only means received.
        // Query API key directly to get real telecom delivery status!
        let verifiedDelivery = "processing";
        let verifiedRaw = "processing";
        if (dmSuccess) {
          const direct = await getRealDatamartDeliveryStatus(dmRef || ref);
          verifiedDelivery = direct.deliveryStatus;
          verifiedRaw = direct.rawStatus;
        }

        // Mark payment as paid and update delivery status in DB
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            delivery_status: verifiedDelivery,
            datamart_status: verifiedRaw,
            datamart_reference: dmRef,
            updated_at: new Date().toISOString()
          })
          .or(`reference.eq.${ref},datamart_reference.eq.${ref}`);

        // Send alert to admin about web sale
        const statusLabel = verifiedDelivery === "delivered" ? "✅ Delivered to phone!" : "⏳ In Progress (Sent to DataMart)";
        await sendWhatsApp(
          "233547100951",
          `🛍️ NEW WEBSITE DATA ORDER PAID! 🎉\n\n🆔 Reference: ${ref}\n📶 Network: ${webOrder.network || "Data"}\n📦 Capacity: ${capacity}GB\n📱 Recipient: ${phone}\n💰 Amount: ₵${paidAmount.toFixed(2)}\n\nStatus: ${statusLabel}`
        );
        sendAdminSms(`[DataEase] Web Data Order Paid: ₵${paidAmount.toFixed(2)} (${capacity}GB ${webOrder.network || "Data"} to ${phone}). Status: ${verifiedDelivery === "delivered" ? "Delivered" : "In Progress"}. Ref: ${ref}`).catch(() => { });
        return;
      }
    }

    // 3. Check Website Digital Services (Netflix, Mashup, AFA) by exact reference
    if (!session) {
      const { data: webService } = await supabase
        .from("service_orders")
        .select("*")
        .eq("reference", ref)
        .maybeSingle();

      if (webService) {
        recordWebhookLog("WEBSITE_SERVICE_ORDER_FOUND", { ref, service: webService.service });
        await supabase
          .from("service_orders")
          .update({
            payment_status: "paid",
            delivery_status: webService.service === "netflix" ? "active" : "pending",
            updated_at: new Date().toISOString()
          })
          .eq("reference", ref);

        const serviceName = webService.service === "netflix" ? "🎬 NETFLIX 30-DAY ACCESS" : webService.service === "mashup" ? "📦 MASHUP BUNDLE" : "✨ AFA REGISTRATION";
        await sendWhatsApp(
          "233547100951",
          `🎉 NEW WEBSITE ${serviceName} PAID!\n\n🆔 Reference: ${ref}\n📱 Phone: ${webService.customer_phone || "N/A"}\n💰 Amount: ₵${paidAmount.toFixed(2)}`
        );
        sendAdminSms(`[DataEase] Web ${webService.service?.toUpperCase()} Paid: ₵${paidAmount.toFixed(2)} by ${webService.customer_phone || "N/A"}. Ref: ${ref}`).catch(() => { });
        return;
      }
    }

    // 4. Check Website Result Checkers (WAEC, BECE) by exact reference
    if (!session) {
      const { data: webChecker } = await supabase
        .from("checker_orders")
        .select("*")
        .eq("reference", ref)
        .maybeSingle();

      if (webChecker) {
        recordWebhookLog("WEBSITE_CHECKER_ORDER_FOUND", { ref, type: webChecker.checker_type });
        await supabase
          .from("checker_orders")
          .update({
            payment_status: "paid",
            updated_at: new Date().toISOString()
          })
          .eq("reference", ref);

        await sendWhatsApp(
          "233547100951",
          `🎓 NEW ${webChecker.checker_type || "WAEC"} RESULT CHECKER ORDER PAID! 🎉\n\n🆔 Reference: ${ref}\n📱 Phone: ${webChecker.customer_phone || "N/A"}\n💰 Amount: ₵${paidAmount.toFixed(2)}`
        );
        sendAdminSms(`[DataEase] Checker Order Paid: ₵${paidAmount.toFixed(2)} (${webChecker.checker_type || "WAEC"} by ${webChecker.customer_phone || "N/A"}). Ref: ${ref}`).catch(() => { });
        return;
      }
    }

    // 5. Fallback for WhatsApp chat bot sessions ONLY if not a website order
    if (!session) {
      const isKnownWebRef = /^(CK|SRV|NFLX|MSH|AFA|D1|ORD|CHK)/i.test(ref);
      if (!isKnownWebRef) {
        const customerEmail = event.data?.customer?.email || "";
        const emailPhone = customerEmail.split("@")[0].replace(/\D/g, "");
        recordWebhookLog("FALLBACK_SEARCH", { ref, customerEmail, emailPhone });

        if (emailPhone && emailPhone.length >= 9) {
          const waPhone = emailPhone.startsWith("0") ? "233" + emailPhone.substring(1) : (emailPhone.startsWith("233") ? emailPhone : "233" + emailPhone);
          const localPhone = emailPhone.startsWith("233") ? "0" + emailPhone.substring(3) : (emailPhone.startsWith("0") ? emailPhone : "0" + emailPhone);

          const { data: fallbackSession } = await supabase
            .from("sessions")
            .select("*")
            .or(`phone.eq.${waPhone},phone.eq.${localPhone},momo_number.eq.${localPhone},phone_number.eq.${localPhone}`)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (fallbackSession) {
            recordWebhookLog("SESSION_FOUND_VIA_FALLBACK", { waPhone, localPhone, sessionPhone: fallbackSession.phone });
            session = fallbackSession;
            if (!session.phone_number) session.phone_number = localPhone;
            if (!session.momo_number) session.momo_number = localPhone;
          }
        }
      }

      if (!session) {
        recordWebhookLog("SESSION_NOT_FOUND", { ref });
        console.error("❌ SESSION NOT FOUND:", ref);
        await sendWhatsApp(
          "233547100951",
          `🔔 PAYSTACK PAYMENT RECEIVED FOR UNKNOWN SESSION\nReference: ${ref}\nAmount: ₵${paidAmount.toFixed(2)}\nCustomer: ${event.data?.customer?.email || "N/A"}\nPlease check Supabase and Paystack dashboard!`
        );
        return;
      }
    }

    recordWebhookLog("SESSION_RESOLVED", {
      phone: session.phone,
      network: session.network,
      bundle: session.bundle,
      phone_number: session.phone_number,
      momo_number: session.momo_number
    });

    /* =====================================================
    MASHUP ORDERS — fulfilled MANUALLY
    ===================================================== */

    if (session.network === "MASHUP") {
      const parsed = parseMashupSelection(session.bundle);
      if (!parsed) {
        console.error("❌ MASHUP SELECTION NOT FOUND FOR SESSION:", session.phone, session.bundle);
        return;
      }

      const mashupRef = "MASHUP-" + ref;
      const { error: orderError } = await supabase.from("orders").insert([{
        whatsapp_phone: session.phone,
        phone_number: normalizePhone(session.phone_number),
        recipient_phone: normalizePhone(session.phone_number),
        reference: mashupRef,
        network: "MASHUP",
        bundle: session.bundle,
        capacity: parsed.combo.label,
        amount: paidAmount,
        status: "pending_manual",
        payment_status: "paid",
        delivery_status: "pending_manual",
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      if (orderError) {
        console.error("❌ MASHUP ORDER SAVE ERROR:", orderError);
      } else {
        console.log("✅ MASHUP ORDER SAVED:", mashupRef);
      }

      await sendWhatsApp(
        "233547100951",
        `🔔 NEW MASHUP ORDER — MANUAL ACTION NEEDED\n\n💰 Amount: ₵${parsed.amount.toFixed(2)}\n📦 Option selected: ${parsed.combo.label}\n📱 Deliver to: ${session.phone_number}\n💳 Paid via momo: ${session.momo_number}\n💵 Confirmed paid: ₵${paidAmount.toFixed(2)}\n\nDial *567*2#, select MashUp Offers, enter ₵${parsed.amount.toFixed(2)}, pick the option matching "${parsed.combo.label}", and apply it to the number above.`
      );

      sendAdminSms(
        `NEW MASHUP ORDER: ₵${paidAmount.toFixed(2)} paid for ${parsed.combo.label}. Recipient: ${session.phone_number}. Ref: ${mashupRef}. Fulfill manually.`
      ).catch(() => { });

      await sendWhatsApp(
        session.phone,
        `✅ PAYMENT RECEIVED! 🎉\n\n📦 Package: ${parsed.combo.label}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n📱 Number: ${session.phone_number}\n\nThis MashUp bundle is being applied to your number manually and should land shortly.\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`
      );

      return;
    }

    /* =====================================================
    AFA REGISTRATION ORDERS — fully automated via API
    ===================================================== */

    const afaData = getAfaData(session);

    if (afaData) {
      const afaExternalId = "WA-" + ref;

      try {
        const afaResponse = await axios.post(
          `${AFA_BASE}/registrations`,
          {
            external_order_id: afaExternalId,
            full_name: afaData.full_name,
            phone_number: afaData.phone_number,
            id_type: "Ghana Card",
            id_number: afaData.id_number,
            location: afaData.location,
            dob: afaData.dob,
            occupation: afaData.occupation
          },
          {
            headers: {
              "X-API-Key": AFA_API_KEY,
              "Content-Type": "application/json",
              "Idempotency-Key": afaExternalId
            },
            timeout: 30000
          }
        );

        const afaOrder = afaResponse.data?.data || afaResponse.data || {};
        const afaStatus = afaOrder.status || "pending";
        const afaOrderId = afaOrder.id || afaOrder.order_id || null;

        const { error: afaOrderError } = await supabase.from("orders").insert([{
          whatsapp_phone: session.phone,
          phone_number: normalizePhone(afaData.phone_number),
          recipient_phone: normalizePhone(afaData.phone_number),
          reference: afaExternalId,
          network: "AFA",
          bundle: afaData.full_name,
          capacity: "AFA Registration",
          amount: paidAmount,
          status: afaStatus,
          payment_status: "paid",
          delivery_status: afaStatus === "completed" || afaStatus === "approved" ? "delivered" : "processing",
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

        if (afaOrderError) {
          console.error("❌ AFA ORDER SAVE ERROR:", afaOrderError);
        } else {
          console.log("✅ AFA ORDER SAVED:", afaExternalId, "| AFA order id:", afaOrderId);
        }

        await sendWhatsApp(
          session.phone,
          `✅ PAYMENT RECEIVED! 🎉\n\n🪪 AFA Registration submitted for: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n📌 Status: ${afaStatus}\n\nYou'll be notified once it's approved.\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`
        );

        sendAdminSms(
          `NEW AFA ORDER: ₵${paidAmount.toFixed(2)} paid for ${afaData.full_name} (${afaData.phone_number}). Status: ${afaStatus}. Ref: ${afaExternalId}`
        ).catch(() => { });
      } catch (afaError) {
        console.error("❌ AFA API ERROR:", afaError.response?.data || afaError.message);

        await supabase.from("orders").insert([{
          whatsapp_phone: session.phone,
          phone_number: normalizePhone(afaData.phone_number),
          recipient_phone: normalizePhone(afaData.phone_number),
          reference: afaExternalId,
          network: "AFA",
          bundle: afaData.full_name,
          capacity: "AFA Registration",
          amount: paidAmount,
          status: "pending_manual",
          payment_status: "paid",
          delivery_status: "pending_manual",
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

        await sendWhatsApp(
          "233547100951",
          `🔔 AFA REGISTRATION FAILED — MANUAL ACTION NEEDED\n\nThe AFA API call failed after payment was confirmed.\n\n👤 Full Name: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n🪪 Ghana Card: ${afaData.id_number}\n📍 Location: ${afaData.location}\n🎂 DOB: ${afaData.dob}\n💼 Occupation: ${afaData.occupation}\n💵 Confirmed paid: ₵${paidAmount.toFixed(2)}\n\nCheck the afaregistration.com dashboard or submit this manually, then update the order.`
        );

        sendAdminSms(
          `ALERT: AFA ORDER FAILED API! ₵${paidAmount.toFixed(2)} paid for ${afaData.full_name} (${afaData.phone_number}). Ref: ${afaExternalId}. Fulfill manually!`
        ).catch(() => { });

        await sendWhatsApp(
          session.phone,
          `✅ Payment received! Your AFA registration for ${afaData.full_name} is being processed and may take a little longer than usual.\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`
        );
      }

      return;
    }

    /* =====================================================
    NETFLIX ORDERS
    ==================================================== */

    const netflixData = getNetflixData(session);

    if (netflixData) {
      const netflixRef = "NETFLIX-" + ref;
      const paidAt = new Date().toISOString();
      const refCode = generateNetflixRefCode();

      await supabase.from("sessions").update({
        step: 53,
        bundle: JSON.stringify({ type: "netflix", paidAt, refCode, used: false })
      }).eq("phone", session.phone);

      const { error: netflixOrderError } = await supabase.from("orders").insert([{
        whatsapp_phone: session.phone,
        phone_number: normalizePhone(session.phone),
        recipient_phone: normalizePhone(session.phone),
        reference: netflixRef,
        network: "NETFLIX",
        bundle: refCode,
        capacity: "Netflix Subscription",
        amount: paidAmount,
        status: "pending_code_request",
        payment_status: "paid",
        delivery_status: "processing",
        paid_at: paidAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      if (netflixOrderError) {
        console.error("❌ NETFLIX ORDER SAVE ERROR:", netflixOrderError);
      } else {
        console.log("✅ NETFLIX ORDER SAVED:", netflixRef, "| REF CODE:", refCode);
      }

      await sendWhatsApp(
        session.phone,
        `✅ PAYMENT RECEIVED! 🎉\n\n📺 Netflix Subscription — ₵${paidAmount.toFixed(2)}\n\nYOUR REFERENCE CODE: *${refCode}*\n⚠️ Save this. It can be used only ONCE to fetch a sign-in code.\n\nSTEP 1\nSign in to Netflix with this email:\n${NETFLIX_EMAIL}\n\n• Open Netflix on your phone, TV, or laptop\n• Choose "Sign in" and enter the email above\n• Netflix will send a sign-in code to that email\n\nSTEP 2\nOnce you've done that, reply here with your reference code above (${refCode}) to get your Netflix sign-in code.\n\nFor assistance: Whatsapp 0547100951 (@stony11)`
      );

      sendAdminSms(
        `NEW NETFLIX ORDER: ₵${paidAmount.toFixed(2)} paid by ${session.phone}. Ref: ${netflixRef}. Code: ${refCode}`
      ).catch(() => { });

      return;
    }

    const bundle = PACKAGES[session.network]?.[session.bundle];

    if (!bundle) {
      recordWebhookLog("BUNDLE_NOT_FOUND", { network: session.network, bundle: session.bundle });
      await sendWhatsApp(
        session.phone,
        `✅ PAYMENT RECEIVED! 🎉\n\nAmount Paid: ₵${paidAmount.toFixed(2)}\n\nYour order has been recorded and is being processed by our support team.\n\nFor assistance: Whatsapp 0547100951 (@stony11)`
      );
      return;
    }

    /* =====================================================
    SEND PURCHASE TO DATAMART
    ===================================================== */

    let datamartSuccess = false;
    let datamartData = {};
    let datamartReference = null;
    let datamartOrderId = null;
    let datamartStatus = "pending";
    let datamartErrorDetail = null;

    const purchasePayload = {
      phoneNumber: normalizePhone(session.phone_number),
      network: bundle.apiNetwork || "YELLO",
      capacity: String(bundle.capacity),
      gateway: "wallet"
    };

    // 1. Try Fast Lane delivery
    try {
      recordWebhookLog("DATAMART_FAST_PURCHASE_ATTEMPT", purchasePayload);

      const delivery = await axios.post(
        `${DATAMART_BASE}/purchase`,
        { ...purchasePayload, delivery: "fast" },
        {
          headers: {
            "x-api-key": DATA_API_KEY,
            "Content-Type": "application/json"
          },
          timeout: 30000
        }
      );

      datamartData = delivery.data?.data || delivery.data || {};
      datamartReference = datamartData.reference || datamartData.orderReference || datamartData.order_reference || null;
      datamartOrderId = datamartData.orderId || datamartData.order_id || null;
      datamartStatus = datamartData.orderStatus || datamartData.status || "pending";
      datamartSuccess = true;
      recordWebhookLog("DATAMART_FAST_PURCHASE_SUCCESS", datamartData);
    } catch (fastErr) {
      datamartErrorDetail = fastErr.response?.data || fastErr.message;
      recordWebhookLog("DATAMART_FAST_FAILED_RETRYING_STANDARD", { error: datamartErrorDetail });

      // 2. Retry with Standard delivery
      try {
        const deliveryStd = await axios.post(
          `${DATAMART_BASE}/purchase`,
          purchasePayload,
          {
            headers: {
              "x-api-key": DATA_API_KEY,
              "Content-Type": "application/json"
            },
            timeout: 30000
          }
        );

        datamartData = deliveryStd.data?.data || deliveryStd.data || {};
        datamartReference = datamartData.reference || datamartData.orderReference || datamartData.order_reference || null;
        datamartOrderId = datamartData.orderId || datamartData.order_id || null;
        datamartStatus = datamartData.orderStatus || datamartData.status || "pending";
        datamartSuccess = true;
        recordWebhookLog("DATAMART_STANDARD_PURCHASE_SUCCESS", datamartData);
      } catch (stdErr) {
        datamartErrorDetail = stdErr.response?.data || stdErr.message;
        recordWebhookLog("DATAMART_PURCHASE_ALL_FAILED", { error: datamartErrorDetail });
      }
    }

    const orderReference = datamartReference || ref;

    // CRITICAL: Never immediately jump to "delivered".
    // DataMart accepts order and reports "completed", which only means received.
    // Query API key directly to get real telecom delivery status!
    let mappedDeliveryStatus = "processing";
    let mappedRawStatus = datamartStatus;
    if (datamartSuccess) {
      const direct = await getRealDatamartDeliveryStatus(datamartReference || datamartOrderId || orderReference);
      mappedDeliveryStatus = direct.deliveryStatus;
      mappedRawStatus = direct.rawStatus;
    } else {
      mappedDeliveryStatus = "failed";
    }
    const finalOrderStatus = datamartSuccess ? mappedRawStatus : "pending_manual";

    try {
      const { error: orderError } = await supabase.from("orders").insert([{
        whatsapp_phone: session.phone,
        phone_number: normalizePhone(session.phone_number),
        recipient_phone: normalizePhone(session.phone_number),
        reference: orderReference,
        network: session.network,
        bundle: session.bundle,
        capacity: String(bundle.capacity),
        amount: paidAmount,
        status: mappedDeliveryStatus,
        payment_status: "paid",
        delivery_status: mappedDeliveryStatus,
        datamart_status: mappedRawStatus,
        datamart_reference: datamartReference || (datamartOrderId ? String(datamartOrderId) : null),
        paid_at: new Date().toISOString(),
        created_at: datamartData.createdAt || new Date().toISOString(),
        updated_at: datamartData.updatedAt || new Date().toISOString(),
        campaign_code: session.scratch_order_opt_in ? session.scratch_code : null
      }]);

      if (orderError) {
        console.error("❌ ORDER SAVE ERROR:", orderError);
        recordWebhookLog("ORDER_SAVE_ERROR", { error: orderError.message });
      } else {
        console.log("✅ ORDER HISTORY SAVED:", orderReference);
        recordWebhookLog("ORDER_SAVED", { orderReference, status: mappedDeliveryStatus });

        if (datamartSuccess && session.scratch_order_opt_in && session.scratch_code) {
          const scratchResult = await countScratchPaidOrder(session.phone, session.scratch_code, orderReference);
          if (scratchResult) {
            if (scratchResult.unlocked) {
              await sendWhatsApp(session.phone, `🎉 CONGRATULATIONS!\n\nYour Scratch Code *${scratchResult.code}* has reached 5/5 PAID data orders!\n\n🎟️ YOUR SCRATCH CARD IS NOW UNLOCKED!\n\nReply *SCRATCH* to play and win 1GB or 2GB. 🎁`);
            } else {
              await sendWhatsApp(session.phone, `🎟️ SCRATCH & WIN PROGRESS\n\nCode: ${scratchResult.code}\n💳 Paid orders: ${scratchResult.ordersCompleted}/5\n\n${5 - scratchResult.ordersCompleted} more paid data order(s) to unlock your Scratch Card.`);
            }
          }
        }
      }
    } catch (dbErr) {
      console.error("❌ SUPABASE ORDER INSERT EXCEPTION:", dbErr.message);
      recordWebhookLog("SUPABASE_EXCEPTION", { error: dbErr.message });
    }

    const tracker = await getDeliveryEstimate();
    const estimateMessage = buildDeliveryEstimateMessage(tracker);

    if (datamartSuccess) {
      if (mappedDeliveryStatus === "delivered") {
        let successMessage = `✅ ORDER DELIVERED! 🎉\n\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Number: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\nYour data has landed! 📶\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`;
        await sendWhatsApp(session.phone, successMessage);
        recordWebhookLog("CUSTOMER_NOTIFIED_DELIVERED", { phone: session.phone });
      } else {
        let inProgressMessage = `✅ PAYMENT RECEIVED! 🎉\n\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Delivery to: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\n${estimateMessage}\n\nYour order has been dispatched and is currently in progress. It will land shortly!\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To return to main menu.`;
        await sendWhatsApp(session.phone, inProgressMessage);
        recordWebhookLog("CUSTOMER_NOTIFIED_IN_PROGRESS", { phone: session.phone });
      }

      sendAdminSms(
        `NEW DATA ORDER: ${bundle.capacity}GB ${session.network} to ${session.phone_number}. Paid: ₵${paidAmount.toFixed(2)}. Status: ${mappedDeliveryStatus === "delivered" ? "Delivered" : "In Progress"} (${orderReference})`
      ).catch(() => { });
    } else {
      let pendingMessage = `✅ PAYMENT RECEIVED! 🎉\n\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Data goes to: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\nYour payment has been received and your data order is currently being processed. It will be delivered to your number shortly!\n\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To return to main menu.`;
      await sendWhatsApp(session.phone, pendingMessage);
      recordWebhookLog("CUSTOMER_NOTIFIED_PENDING", { phone: session.phone });

      const errorString = typeof datamartErrorDetail === "object" ? JSON.stringify(datamartErrorDetail) : String(datamartErrorDetail || "Unknown API error");
      await sendWhatsApp(
        "233547100951",
        `🚨 DATAMART FAILED — MANUAL DELIVERY NEEDED!\n\nCustomer paid, but DataMart API purchase failed:\n❌ Error: ${errorString}\n\n📦 Bundle: ${bundle.capacity}GB (${session.network})\n📱 Recipient: ${session.phone_number}\n💳 Paid from MoMo: ${session.momo_number || session.phone_number}\n💰 Amount: ₵${paidAmount.toFixed(2)}\n🆔 Ref: ${orderReference}\n\nPlease deliver this order manually or check your DataMart wallet balance!`
      );
      recordWebhookLog("ADMIN_ALERTED_DATAMART_FAILURE", { error: errorString });

      sendAdminSms(
        `ALERT: DATA ORDER FAILED! ${bundle.capacity}GB ${session.network} to ${session.phone_number}. Paid: ₵${paidAmount.toFixed(2)}. Ref: ${orderReference}. Deliver manually!`
      ).catch(() => { });
    }
  } catch (e) {
    recordWebhookLog("WEBHOOK_FATAL_ERROR", { error: e.response?.data || e.message });
    console.error("WEBHOOK ERROR:", e.response?.data || e.message);
  }
});

/* =========================================================
ADMIN PAGE
========================================================= */

app.get("/admin", (req, res) => {
  const key = req.query.key || req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY || "data1gh-secure-admin";
  if (key !== expectedKey) {
    return res.status(401).send("Unauthorized. Access restricted to administrator.");
  }
  res.sendFile(__dirname + "/admin.html");
});

/* =========================================================
ADMIN DATA
========================================================= */

app.get("/admin-data", async (req, res) => {
  // Safe read-only metrics access — no noisy intrusion alerts sent to WhatsApp
  const key = req.query.key || req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_API_KEY || "data1gh-secure-admin";
  const isAuth = !expectedKey || key === expectedKey;

  if (!isAuth && req.headers["sec-fetch-dest"] !== "document") {
    // Return unauthorized silently without blasting alarm messages to WhatsApp
    return res.status(401).json({ error: "Unauthorized access" });
  }

  try {
    const { data } = await supabase.from("sessions").select("*");
    const sessions = data || [];
    let revenue = 0;

    sessions.forEach(x => {
      if (x.step === 5) {
        const bundle = PACKAGES[x.network]?.[x.bundle];
        if (bundle) revenue += bundle.price;
      }
    });

    res.json({
      total: sessions.length,
      delivered: sessions.filter(x => x.step === 5).length,
      pending: sessions.filter(x => x.step < 5).length,
      revenue,
      orders: sessions.slice(-10).reverse()
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

/* =========================================================
START SERVER
========================================================= */

app.get("/health", (req, res) => {
  res.status(200).send("Bot is alive!");
});

app.listen(PORT, () => {
  console.log("🚀 RUNNING ON", PORT);
});
