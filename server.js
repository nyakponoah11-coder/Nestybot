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
const STORE_API_URL = process.env.STORE_API_URL || "https://data-ease-shop-1.vercel.app/api/whatsapp-bot";
const SCRATCH_REQUIRED_ORDERS = 5;
const SCRATCH_ONE_GB_PROBABILITY = 0.90;

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
  if (!scratch) return sendWhatsApp(from, "🎟️ SCRATCH & WIN\n\nYou do not currently have an active Scratch Code.\n\nReply *YES* and the system will generate your unique code automatically.");
  if (!scratch.unlocked) return sendWhatsApp(from, `🎟️ SCRATCH & WIN\n\n🎟️️ Code: ${scratch.code}\n💳 Paid orders: ${Number(scratch.orders_completed || 0)}/${SCRATCH_REQUIRED_ORDERS}\n🔒 Status: LOCKED`);
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

1 - MTN Data
2 - AirtelTigo Data
3 - Telecel Data
4 - Track Order
5 - Netflix subscription
6 - AFA registration
7 - MashUp Bundle (MTN)
8 - 🎟️ Scratch & Win

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

/* =========================================================
GET REAL DATAMART DELIVERY STATUS
========================================================= */

async function getRealDatamartDeliveryStatus(referenceOrOrderId) {
  if (!referenceOrOrderId) return { deliveryStatus: "processing", rawStatus: "processing" };
  const cleanId = String(referenceOrOrderId).trim();

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
        if (statusField === "delivered") {
          return { deliveryStatus: "delivered", rawStatus: statusField };
        }
        if (statusField === "refunded") {
          return { deliveryStatus: "refunded", rawStatus: statusField };
        }
        if (statusField === "waiting") {
          return { deliveryStatus: "waiting", rawStatus: statusField };
        }
        return { deliveryStatus: "processing", rawStatus: statusField };
      } catch (e) {}
    }
  }

  return { deliveryStatus: "processing", rawStatus: "processing" };
}

/* =========================================================
SEND ADMIN SMS (ARKESEL)
========================================================= */

async function sendAdminSms(message) {
  try {
    let arkeselKey = process.env.ARKESEL_API_KEY;
    let adminPhone = process.env.ADMIN_ALERT_PHONE || "0547100951";
    let senderId = process.env.ARKESEL_SENDER_ID || "Data1gh";

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
          if (smap.arkesel_sender_id) {
            senderId = smap.arkesel_sender_id;
          }
        }
      } catch (err) {}
    }

    if (!arkeselKey) return;

    let target = String(adminPhone).replace(/\D/g, "");
    if (target.startsWith("233") && target.length === 12) target = "0" + target.slice(3);

    await axios.post(
      "https://sms.arkesel.com/api/v2/sms/send",
      { sender: senderId, message: message, recipients: [target] },
      {
        headers: { "api-key": arkeselKey, "Content-Type": "application/json", "Accept": "application/json" },
        timeout: 10000
      }
    );
  } catch (err) {}
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
AFA & NETFLIX HELPERS
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
  if (!NETFLIX_EMAIL || !NETFLIX_EMAIL_APP_PASSWORD) return { type: "error" };

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: NETFLIX_EMAIL, pass: NETFLIX_EMAIL_APP_PASSWORD },
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
      const codeMatch = bodyText.match(/(?:sign-?in|verification)\s+code[^\d]{0,20}(\d{4,8})/i) || bodyText.match(/\b(\d{4,8})\b/);
      if (codeMatch) return { type: "code", value: codeMatch[1] };
      return { type: "none" };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { type: "error" };
  } finally {
    try { await client.logout(); } catch (e) { }
  }
}

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
  if (["024", "054", "055", "059", "053", "025"].includes(prefix)) return "mtn";
  if (["020", "050"].includes(prefix)) return "vod";
  if (["027", "057", "026", "056"].includes(prefix)) return "atl";
  return momoProvider(fallbackNetwork) || "mtn";
}

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
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
        timeout: 20000
      }
    );
    return res.data?.data?.authorization_url || null;
  } catch (err) {
    return null;
  }
}

function formatDateTime(dateValue) {
  if (!dateValue) return { date: "N/A", time: "N/A" };
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return { date: "N/A", time: "N/A" };
  return {
    date: date.toLocaleDateString("en-GH", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Accra" }),
    time: date.toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Africa/Accra" })
  };
}

async function getDeliveryEstimate() {
  try {
    const response = await axios.get("https://api.datamartgh.shop/api/v1/data/delivery-status", { timeout: 15000 });
    const data = response.data?.data;
    if (!data) return null;
    const fastLane = (data.expressActive && data.expressFrontier?.placedAt ? data.expressFrontier : null);
    if (!fastLane) return null;
    return { estimatedTime: "5-15 mins" };
  } catch (e) {
    return null;
  }
}

function buildDeliveryEstimateMessage(tracker) {
  return "\n⏳ Delivery Estimate: Usually takes 5-30 minutes.";
}

async function getOrderStatus(reference) {
  try {
    const response = await axios.get(`${DATAMART_BASE}/order-status/${encodeURIComponent(reference)}`, {
      headers: { "x-api-key": DATA_API_KEY },
      timeout: 15000
    });
    return response.data?.data || null;
  } catch (e) {
    return null;
  }
}

function statusEmoji(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed": return "✅";
    case "processing": return "🔄";
    case "delivered": return "✅";
    case "failed": return "❌";
    default: return "📦";
  }
}

async function trackOrders(from, phoneNumber) {
  const phone = normalizePhone(phoneNumber);
  try {
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!orders || orders.length === 0) {
      return sendWhatsApp(from, `❌ No orders found for 📱 ${phone}`);
    }

    let message = `📦 YOUR LAST ${orders.length} ORDER(S)\n\n`;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      message += `${i + 1}. Ref: ${o.reference} | ${o.capacity}GB ${o.network} | Status: ${o.delivery_status || o.status}\n`;
    }
    return sendWhatsApp(from, message);
  } catch (e) {
    return sendWhatsApp(from, "❌ Could not check orders right now.");
  }
}

async function initiateMomoCharge(from, session, bundle) {
  const ref = "REF-" + Date.now();
  const provider = getMomoProvider(session.momo_number, session.network);
  try {
    const charge = await axios.post(
      "https://api.paystack.co/charge",
      {
        email: `${from}@test.com`,
        amount: Math.round(bundle.price * 100),
        currency: "GHS",
        reference: ref,
        mobile_money: { phone: session.momo_number, provider }
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" }, timeout: 30000 }
    );
    await supabase.from("sessions").update({ ref, step: 5 }).eq("phone", from);
    return sendWhatsApp(from, `📲 Payment prompt sent to ${session.momo_number} for ₵${bundle.price.toFixed(2)}. Approve on your phone!`);
  } catch (e) {
    const fallbackRef = "REF-" + Date.now();
    const authUrl = await createPaystackCheckoutLink(from, fallbackRef, bundle.price);
    if (authUrl) {
      await supabase.from("sessions").update({ ref: fallbackRef, step: 5 }).eq("phone", from);
      return sendWhatsApp(from, `💳 Pay online here:\n${authUrl}`);
    }
    await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
    return sendWhatsApp(from, "❌ Payment initiation failed. Reply HI to restart.");
  }
}

async function generateFullAdminReport() {
  try {
    return "👑 *DATA 1 GH — EXECUTIVE BOT DASHBOARD*\nSystem is active, healthy, and operational.";
  } catch (err) {
    return "📊 Dashboard currently unavailable.";
  }
}

/* =========================================================
EXPRESS WEBHOOKS
========================================================= */

app.get("/webhook", (req, res) => {
  res.send(req.query["hub.challenge"]);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    const adminPhones = ["233547100951", "0547100951", "233592753424", "0592753424"];
    if (process.env.ADMIN_ALERT_PHONE) adminPhones.push(String(process.env.ADMIN_ALERT_PHONE).replace(/\D/g, ""));
    const normFrom = String(from || "").replace(/\D/g, "");
    const isOwner = adminPhones.some(p => p && (normFrom === p || normFrom.endsWith(p.slice(-9))));

    if (/^(admin|dashboard|report)$/i.test(text)) {
      if (isOwner) {
        const adminReport = await generateFullAdminReport();
        return await sendWhatsApp(from, adminReport);
      } else {
        return await sendWhatsApp(from, "⚠️ Access restricted.");
      }
    }

    if (isOwner) {
      const { data: ownerSession } = await supabase
        .from("sessions")
        .select("step, bundle, notes")
        .eq("phone", from)
        .maybeSingle();

      if (/^(menu|customer)$/i.test(text)) {
        await supabase.from("sessions").update({ step: 1, bundle: null }).eq("phone", from);
        return sendWhatsApp(from, MENU);
      }

      // ── CHECK IF OWNER IS CONFIRMING A PENDING ACTION ──
      let pendingAction = null;
      try {
        if (ownerSession?.bundle) {
          const parsed = JSON.parse(ownerSession.bundle);
          if (parsed?.type) pendingAction = parsed;
        }
      } catch (_) {}

      if (pendingAction && /^(yes|yeah|yep|go|go ahead|do it|confirm|ok|okay|sure|yh|y)$/i.test(text.trim())) {
        const { type, ref, phone: aPhone, network, capacity, smsText } = pendingAction;
        await supabase.from("sessions").update({ bundle: null }).eq("phone", from);

        if (type === "retry_order" && ref) {
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
            
            await supabase.from("orders").update({ 
              delivery_status: "processing", 
              status: "processing",
              updated_at: new Date().toISOString() 
            }).eq("reference", ref);

            return sendWhatsApp(from, `✅ *Action Executed:* Retry successfully dispatched for *${capacity}GB* → *${aPhone}*.\n🆔 New Ref: ${newRef || ref}`);
          } catch (retryErr) {
            return sendWhatsApp(from, `❌ *Action Failed:* ${retryErr.response?.data?.message || retryErr.message}`);
          }
        }

        if (type === "send_sms") {
          await sendAdminSms(smsText || "DATA 1 GH: Your order has been updated.");
          return sendWhatsApp(from, `✅ *Action Executed:* Admin SMS alert dispatched successfully.`);
        }
      } else if (pendingAction && /^(no|nope|cancel|nah|stop)$/i.test(text.trim())) {
        await supabase.from("sessions").update({ bundle: null }).eq("phone", from);
        return sendWhatsApp(from, "Sharp, cancelled that action. What else is on your mind boss?");
      }

      let history = [];
      try {
        if (ownerSession?.notes) {
          const parsed = JSON.parse(ownerSession.notes);
          if (Array.isArray(parsed)) history = parsed;
        }
      } catch (_) {}

      let geminiKey = cleanApiKey(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "");
      let openAiKey = cleanApiKey(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "");

      let deliveryEta = "~5-30 minutes";
      let walletBalance = "Fetching...";
      let totalOrdersCount = 0;
      let todayRevenueVal = 0;

      try {
        if (DATA_API_KEY) {
          const b = await axios.get(`${DATAMART_BASE}/user/balance`, {
            headers: { "x-api-key": DATA_API_KEY },
            timeout: 4000
          });
          const bal = b?.data?.data?.walletBalance ?? b?.data?.walletBalance ?? b?.data?.data?.balance;
          if (bal != null) walletBalance = `GH₵ ${Number(bal).toFixed(2)}`;
        }
      } catch (_) {
        walletBalance = "Unavailable";
      }

      try {
        const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
        if (count != null) totalOrdersCount = count;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data: todayOrders } = await supabase.from("orders").select("amount, payment_status").gte("created_at", startOfDay.toISOString());
        
        if (todayOrders) {
          const paidToday = todayOrders.filter(o => /paid|success|complet/i.test(o.payment_status || ""));
          todayRevenueVal = paidToday.reduce((sum, o) => sum + Number(o.amount || 0), 0);
        }
      } catch (_) {}

      const ownerSystemPrompt =
        "You are Stony, the owner's personal AI business assistant, digital co-pilot, and whole-system partner at DATA 1 GH.\n" +
        "You are having a private conversation directly with the business owner on WhatsApp.\n" +
        "PERSONALITY: Trusted senior digital business partner. Use natural Ghanaian vibe ('bossu', 'chale', 'sharp'). NEVER say 'As an AI'. You are Stony.\n\n" +
        "STRICT OPERATIONAL RULE — HUMAN CONFIRMATION REQUIRED:\n" +
        "- You have READ-ONLY system access by default. You can NEVER execute database updates, order retries, or SMS dispatches autonomously.\n" +
        "- Whenever you identify a failed order, stuck transaction, or task requiring action, **propose** it and include a structured tag: `[SUGGEST_SMS: phone=059274356, text=We miss you]` or `[SUGGEST_RETRY: ref=REF123, phone=0241234567, network=MTN, capacity=5]`.\n\n" +
        `CURRENT REAL-TIME SYSTEM STATS:\n- DataMart Wallet Balance: ${walletBalance}\n- Total Orders Recorded: ${totalOrdersCount}\n- Today's Revenue: GH₵ ${todayRevenueVal.toFixed(2)}\n- Delivery Speed: ${deliveryEta}`;

      let aiReply = "";
      const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-pro", "gemini-3.5-flash"];

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
          } catch (_) {}
        }
      }

      // ── PARSE ACTION TAGS FROM AI ──
      if (aiReply) {
        const retryMatch = aiReply.match(/\[SUGGEST_RETRY:\s*ref=([^,\]]+),\s*phone=([^,\]]+),\s*network=([^,\]]+),\s*capacity=([^\]]+)\]/i);
        const smsMatch = aiReply.match(/\[SUGGEST_SMS:\s*phone=([^,\]]+),\s*text=([^\]]+)\]/i);

        if (retryMatch) {
          const [, rRef, rPhone, rNetwork, rCapacity] = retryMatch;
          const actionData = { type: "retry_order", ref: rRef.trim(), phone: rPhone.trim(), network: rNetwork.trim().toUpperCase(), capacity: rCapacity.trim() };
          await supabase.from("sessions").update({ bundle: JSON.stringify(actionData) }).eq("phone", from);
          aiReply = aiReply.replace(retryMatch[0], "").trim();
          aiReply += `\n\n👉 *Shall I run this retry for you boss?* Reply *yes* to confirm or *no* to cancel.`;
        } else if (smsMatch) {
          const [, sPhone, sText] = smsMatch;
          const actionData = { type: "send_sms", phone: sPhone.trim(), smsText: sText.trim() };
          await supabase.from("sessions").update({ bundle: JSON.stringify(actionData) }).eq("phone", from);
          aiReply = aiReply.replace(smsMatch[0], "").trim();
          aiReply += `\n\n👉 *Should I dispatch this SMS?* Reply *yes* to confirm or *no* to cancel.`;
        }
      }

      if (!aiReply) {
        const lt = text.toLowerCase();
        if (/balance|wallet|money/i.test(lt)) {
          aiReply = `💳 Our DataMart wallet balance is currently *${walletBalance}* bossu!`;
        } else if (/order|orders|how many/i.test(lt)) {
          aiReply = `📦 We have recorded *${totalOrdersCount} total orders* so far, with *GH₵ ${todayRevenueVal.toFixed(2)}* brought in today!`;
        } else {
          aiReply = `I dey here with you boss! Wallet is ${walletBalance} and we have ${totalOrdersCount} total orders on record. What should we look into?`;
        }
      }

      aiReply = aiReply
        .replace(/\b(as an ai( language model)?|i am an ai( language model)?|i'm an ai( language model)?)\b/gi, "I am Stony")
        .replace(/\bdatamart\b/gi, "DataMart");

      try {
        const updatedHistory = [
          ...history.slice(-6),
          { role: "user", text },
          { role: "assistant", text: aiReply }
        ];
        await supabase.from("sessions").update({ notes: JSON.stringify(updatedHistory), step: 99 }).eq("phone", from);
      } catch (_) {}

      return sendWhatsApp(from, aiReply);
    }

    let { data: session } = await supabase.from("sessions").select("*").eq("phone", from).maybeSingle();
    if (!session) {
      await supabase.from("sessions").insert([{ phone: from, step: 1 }]);
      return sendWhatsApp(from, MENU);
    }

    if (/^(hi|hello|start)$/i.test(text)) {
      await supabase.from("sessions").update({ step: 1 }).eq("phone", from);
      return sendWhatsApp(from, MENU);
    }

    if (session.step === 1) {
      let network;
      if (text === "1") network = "MTN";
      else if (text === "2") network = "AIRTELTIGO";
      else if (text === "3") network = "TELECEL";
      else if (text === "4") {
        await supabase.from("sessions").update({ step: 6 }).eq("phone", from);
        return sendWhatsApp(from, "📦 Enter your phone number to track orders:\nExample: 0241234567");
      } else {
        return sendWhatsApp(from, MENU);
      }
      await supabase.from("sessions").update({ step: 2, network }).eq("phone", from);
      return sendWhatsApp(from, MENUS[network]);
    }

    if (session.step === 2) {
      const bundle = PACKAGES[session.network]?.[text];
      if (!bundle) return sendWhatsApp(from, "Invalid option ❌");
      await supabase.from("sessions").update({ step: 3, bundle: text }).eq("phone", from);
      return sendWhatsApp(from, "Enter phone number to receive the data on:");
    }

    if (session.step === 3) {
      const phone = normalizePhone(text);
      if (phone.length !== 10 || !phone.startsWith("0")) return sendWhatsApp(from, "Invalid number ❌");
      await supabase.from("sessions").update({ phone_number: phone, step: 8 }).eq("phone", from);
      return sendWhatsApp(from, "📲 Enter the Mobile Money number to pay from:");
    }

    if (session.step === 8) {
      const momoNumber = normalizePhone(text);
      if (momoNumber.length !== 10 || !momoNumber.startsWith("0")) return sendWhatsApp(from, "Invalid number ❌");
      await supabase.from("sessions").update({ momo_number: momoNumber, step: 4 }).eq("phone", from);
      const bundle = PACKAGES[session.network][session.bundle];
      return sendWhatsApp(from, `Confirm Order:\n\nNetwork: ${session.network}\nBundle: ${bundle.capacity}GB\nPrice: ₵${bundle.price.toFixed(2)}\nRecipient: ${session.phone_number}\nPay from: ${momoNumber}\n\nReply YES to pay or NO to cancel`);
    }

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

    if (session.step === 6) {
      const trackingPhone = normalizePhone(text);
      return trackOrders(from, trackingPhone);
    }

  } catch (e) {
    console.error("BOT ERROR:", e.message);
  }
});

/* =========================================================
PAYSTACK WEBHOOK
========================================================= */

app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const event = req.body;
    if (!event || event.event !== "charge.success") return;
    const ref = event.data?.reference;
    if (!ref) return;
    const paidAmount = Number(event.data?.amount || 0) / 100;

    let { data: session } = await supabase.from("sessions").select("*").eq("ref", ref).maybeSingle();
    if (!session) return;

    const bundle = PACKAGES[session.network]?.[session.bundle];
    if (!bundle) return;

    const purchasePayload = {
      phoneNumber: normalizePhone(session.phone_number),
      network: bundle.apiNetwork || "YELLO",
      capacity: String(bundle.capacity),
      gateway: "wallet"
    };

    let datamartSuccess = false;
    let datamartReference = null;
    try {
      const delivery = await axios.post(`${DATAMART_BASE}/purchase`, { ...purchasePayload, delivery: "fast" }, {
        headers: { "x-api-key": DATA_API_KEY, "Content-Type": "application/json" },
        timeout: 30000
      });
      const data = delivery.data?.data || delivery.data || {};
      datamartReference = data.reference || data.orderReference || null;
      datamartSuccess = true;
    } catch (err) {}

    const orderReference = datamartReference || ref;
    await supabase.from("orders").insert([{
      whatsapp_phone: session.phone,
      phone_number: normalizePhone(session.phone_number),
      recipient_phone: normalizePhone(session.phone_number),
      reference: orderReference,
      network: session.network,
      bundle: session.bundle,
      capacity: String(bundle.capacity),
      amount: paidAmount,
      status: "processing",
      payment_status: "paid",
      delivery_status: "processing"
    }]);

    await sendWhatsApp(session.phone, `✅ Payment received! Your ${bundle.capacity}GB order is being processed.`);
  } catch (e) {}
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
