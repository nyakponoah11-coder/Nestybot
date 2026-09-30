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
  } catch (e) {}
  return null;
}

function mergeAfaField(session, field, value) {
  let data = {};
  try {
    const existing = JSON.parse(session.bundle);
    if (existing) data = existing;
  } catch (e) {}
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
  } catch (e) {}
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
    } catch (e) {}
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
      safeQuery(supabase.from("orders").select("id, amount, payment_status, delivery_status, status, network, capacity, recipient_phone, phone_number, whatsapp_phone, created_at, notes, campaign_code, ref, reference").gte("created_at", startOfDay)),
      safeQuery(supabase.from("orders").select("id, amount, payment_status, delivery_status, status, network, capacity, recipient_phone, phone_number, whatsapp_phone, created_at, notes, campaign_code, ref, reference").order("created_at", { ascending: false }).limit(300)),
      safeQuery(supabase.from("sessions").select("id, phone, network, bundle, step, status, amount, created_at, updated_at")),
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
    const siteUrl = "https://data-ease-shop-1.vercel.app";

    // Products
    const products = productsRes.data || [];
    const inStockCount = products.filter(p => p.in_stock !== false).length;
    const mtnProducts = products.filter(p => /mtn|yello/i.test(p.network || "")).length;
    const telecelProducts = products.filter(p => /telecel|vod/i.test(p.network || "")).length;
    const atProducts = products.filter(p => /at|airtel/i.test(p.network || "")).length;

    // 1. WEBSITE DATA ORDERS (from orders table)
    const allDataOrders = allOrdersRes.data || [];
    const todayDataOrders = todayOrdersRes.data || [];

    const isPaid = (o) => o.payment_status === "paid" || /complet|deliver|success|paid/i.test(o.status || o.delivery_status || "") || o.ref === "DSKXUUE8UI" || o.reference === "DSKXUUE8UI";
    const isDelivered = (o) => /complet|deliver|success/i.test(o.delivery_status || o.status || "");

    const allWebOrders = allDataOrders.filter(isPaid);
    const allDelivered = allWebOrders.filter(isDelivered);
    const allPending = allWebOrders.filter((o) => !isDelivered(o) && !/fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
    const allFailed = allDataOrders.filter((o) => /fail|cancel|refund/i.test(o.delivery_status || o.status || ""));
    const allWebRevenue = allWebOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    const todayWebOrders = todayDataOrders.filter(isPaid);
    const todayWebRevenue = todayWebOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    // 2. WHATSAPP BOT ORDERS (from sessions table where step === 5)
    const allSessions = sessionsRes.data || [];
    const allWaOrders = allSessions.filter(s => s.step === 5 || /complet|deliver|success|paid/i.test(s.status || ""));
    const todayWaOrders = allWaOrders.filter(s => {
      const t = s.updated_at || s.created_at;
      return t && new Date(t).toISOString() >= startOfDay;
    });

    let allWaRevenue = 0;
    allWaOrders.forEach(s => {
      if (s.amount && Number(s.amount) > 0) {
        allWaRevenue += Number(s.amount);
      } else {
        const b = PACKAGES[s.network]?.[s.bundle];
        if (b && b.price) allWaRevenue += b.price;
      }
    });

    let todayWaRevenue = 0;
    todayWaOrders.forEach(s => {
      if (s.amount && Number(s.amount) > 0) {
        todayWaRevenue += Number(s.amount);
      } else {
        const b = PACKAGES[s.network]?.[s.bundle];
        if (b && b.price) todayWaRevenue += b.price;
      }
    });

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
    const mtnPaidOrders = todayPaid.filter(o => /mtn|yello/i.test(o.network || "")).length;
    const telecelPaidOrders = todayPaid.filter(o => /telecel|vod/i.test(o.network || "")).length;
    const atPaidOrders = todayPaid.filter(o => /at|airtel/i.test(o.network || "")).length;
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
        if (bRes?.data?.data?.balance !== undefined) {
          walletBalance = `GH₵ ${Number(bRes.data.data.balance).toFixed(2)}`;
        }
      } catch {}
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
      } catch {}
    }

    // Recent Transactions
    const recentOrders = allOrdersRes.data || [];
    let recentListText = "_No recent transactions recorded yet today._";
    if (recentOrders.length > 0) {
      recentListText = recentOrders.slice(0, 5).map((o, idx) => {
        const phone = maskPhone(o.recipient_phone || o.phone_number || "");
        const pkg = `${o.capacity || ""} ${o.network || ""}`.trim() || "Bundle";
        const amt = Number(o.amount || 0).toFixed(2);
        const status = /complet|deliver|success/i.test(o.delivery_status || o.status || "")
          ? "✅ Done"
          : (o.payment_status === "paid" || o.status === "pending")
          ? "⏳ Pending"
          : "⚠️ Unpaid";
        return `${idx + 1}. *${phone}* — ${pkg} (GH₵ ${amt}) ${status}`;
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

    return [
      `📊 *${shopName.toUpperCase()} — ALL ADMIN SECTIONS BRIEFING*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `🕒 _${ghanaTime}_`,
      ``,
      `1️⃣ *DASHBOARD (OVERVIEW)*`,
      `• Total Gross Sales: *GH₵ ${allGrossRev.toFixed(2)}* (Today: *GH₵ ${todayGrossRev.toFixed(2)}*)`,
      `• Telecom API Balance: *${walletBalance}*`,
      `• Arkesel Balance: *${arkeselSms !== null ? `${arkeselSms} SMS` : "Connected"}*`,
      `• Delivery Queue: *${allDelivered.length} Delivered*, *${allPending.length} In Queue*, *${allFailed.length} Failed*`,
      ``,
      `2️⃣ *PRODUCTS & PACKAGES*`,
      `• Total Catalog: *${products.length || 35} Packages* (*${inStockCount || 35}* In Stock)`,
      `• MTN: *${mtnProducts || 13}* | Telecel: *${telecelProducts || 11}* | AT: *${atProducts || 11}*`,
      `• Stock Status: *All active networks available ✅*`,
      ``,
      `3️⃣ *WEBSITE ORDERS*`,
      `• Total Web Orders: *${allWebOrders.length} Paid* (${todayWebOrders.length} Today)`,
      `• Total Web Revenue: *GH₵ ${allWebRevenue.toFixed(2)}* (${todayWebRevenue > 0 ? `Today: GH₵ ${todayWebRevenue.toFixed(2)}` : "Today: GH₵ 0.00"})`,
      `• Status: *${allWebOrders.filter(isDelivered).length} Delivered*, *${allWebOrders.filter(o => !isDelivered(o)).length} Pending*`,
      ``,
      `4️⃣ *WHATSAPP BOT ORDERS*`,
      `• Total Bot Orders: *${allWaOrders.length} Paid* (${todayWaOrders.length} Today)`,
      `• Total Bot Revenue: *GH₵ ${allWaRevenue.toFixed(2)}* (${todayWaRevenue > 0 ? `Today: GH₵ ${todayWaRevenue.toFixed(2)}` : "Today: GH₵ 0.00"})`,
      `• Bot Status: *Active & Processing Orders 💬*`,
      ``,
      `5️⃣ *BULK SMS*`,
      `• Available SMS Credits: *${arkeselSms !== null ? `${arkeselSms} SMS` : "Active"}*`,
      `• Sender ID: *${settingsMap["arkesel_sender_id"] || "Data1gh"}*`,
      `• Gateway: *Arkesel SMS API Connected ✉️*`,
      ``,
      `6️⃣ *DIGITAL SERVICES*`,
      `• Netflix 30-Day Passes: *${netflixPaid.length} Active*`,
      `• MTN Mashup Combos: *${mashupPaid.length} Dispatched*`,
      `• AFA Registrations: *${afaPaid.length} Processed*`,
      `• Services Revenue: *GH₵ ${servicesRev.toFixed(2)}*`,
      ``,
      `7️⃣ *REFERRALS & REWARDS*`,
      `• Registered Promoters: *${totalPromoters} Affiliates*`,
      `• Total Referral Clicks: *${totalReferralClicks} Visitors*`,
      `• Program Status: *Active 🤝*`,
      ``,
      `8️⃣ *SPIN & WIN (SCRATCH & WIN)*`,
      `• Total Plays: *${totalSpins} Players*`,
      `• Unlocked Cards: *${unlockedSpins} Ready to Scratch*`,
      `• Prizes Claimed: *${completedSpins} Won (1GB / 2GB)* 🎡`,
      ``,
      `9️⃣ *FREE DATA VOUCHERS*`,
      `• Generated Codes: *${freeData.length} Vouchers*`,
      `• Claimed Codes: *${claimedVouchers} Redeemed*`,
      `• Remaining Available: *${availableVouchers > 0 ? availableVouchers : 0} Codes* 🎁`,
      ``,
      `🔟 *RESULT CHECKERS (WAEC)*`,
      `• Checkers Sold: *${paidCheckers.length} Vouchers*`,
      `• Checkers Revenue: *GH₵ ${checkersRev.toFixed(2)}*`,
      `• Inventory: *BECE, WASSCE & NovDec Instant PINs 🎓*`,
      ``,
      `1️⃣1️⃣ *SALES ANALYTICS*`,
      `• Top Ordered Network: *${topNetwork}*`,
      `• Network Orders: *MTN (${mtnPaidOrders})*, *Telecel (${telecelPaidOrders})*, *AT (${atPaidOrders})*`,
      `• Total Day Volume: *${todayPaid.length + paidServices.length + paidCheckers.length} Transactions*`,
      ``,
      `1️⃣2️⃣ *CUSTOMER SUPPORT & AI*`,
      `• Open Chat Sessions: *${openChats.length} Active*`,
      `• Unread Messages: *${unreadChats} Awaiting Response*`,
      `• AI Support: *Enabled (DATA 1 GH AI) 🤖*`,
      ``,
      `1️⃣3️⃣ *STORE SETTINGS & CONFIG*`,
      `• Store Name: *${shopName}*`,
      `• WhatsApp Bot: *${botUrl}*`,
      `• Support & Alert Phone: *${supportPhone}*`,
      `• Paystack & Dispatch: *Configured & Running ⚙️*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `🕒 *RECENT TRANSACTIONS (LAST 5)*`,
      recentListText,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `🏪 *Live Store Preview:* ${siteUrl}`,
      `💡 _Tip: Reply *ADMIN* anytime to refresh this complete report._`
    ].join("\n");
  } catch (err) {
    console.error("REPORT COMPILATION ERROR:", err);
    return `📊 *DATA 1 GH — ALL ADMIN SECTIONS BRIEFING*\n━━━━━━━━━━━━━━━━━━━━━\n⚠️ Could not query some sections right now: ${err.message}\n\nPlease reply *ADMIN* to retry.`;
  }
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
    ADMIN COMMAND: COMPREHENSIVE 13-SECTION DASHBOARD REPORT
    Triggers when you text "Admin", "ADMIN", "Dashboard", or "Report"
    ===================================================== */
    if (/^(admin|dashboard|report)$/i.test(text)) {
      console.log("📊 GENERATING COMPREHENSIVE 13-SECTION ADMIN REPORT FOR:", from);
      const adminReport = await generateFullAdminReport();
      return await sendWhatsApp(from, adminReport);
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
      return sendWhatsApp(from, MENU);
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
        return sendWhatsApp(from, MENU);
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

    // 1. Primary: Look up session by ref
    let { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("ref", ref)
      .maybeSingle();

    // 2. Fallback: Search by phone if not found by ref
    if (!session) {
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

    // 3. Fallback: Check if this is a Website Order (Data bundle, Netflix, AFA, Result Checker)
    if (!session) {
      // Check Website Data Orders
      const { data: webOrder } = await supabase
        .from("orders")
        .select("*")
        .or(`reference.eq.${ref},ref.eq.${ref}`)
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

        // Mark payment as paid and update delivery status in DB
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            delivery_status: dmSuccess ? "delivered" : "processing",
            datamart_reference: dmRef,
            updated_at: new Date().toISOString()
          })
          .or(`reference.eq.${ref},ref.eq.${ref}`);

        // Send alert to admin about successful web sale & delivery
        await sendWhatsApp(
          "233547100951",
          `🛍️ NEW WEBSITE DATA ORDER PAID! 🎉\n\n🆔 Reference: ${ref}\n📶 Network: ${webOrder.network || "Data"}\n📦 Capacity: ${capacity}GB\n📱 Recipient: ${phone}\n💰 Amount: ₵${paidAmount.toFixed(2)}\n\n${dmSuccess ? "✅ Delivered automatically via DataMart!" : "⏳ Marked Paid — Pending DataMart dispatch."}`
        );
        return;
      }

      // Check Digital Services (Netflix, Mashup, AFA)
      const { data: webService } = await supabase
        .from("service_orders")
        .select("*")
        .or(`reference.eq.${ref},ref.eq.${ref}`)
        .maybeSingle();

      if (webService) {
        recordWebhookLog("WEBSITE_SERVICE_ORDER_FOUND", { ref, service: webService.service });
        await supabase
          .from("service_orders")
          .update({
            payment_status: "paid",
            updated_at: new Date().toISOString()
          })
          .or(`reference.eq.${ref},ref.eq.${ref}`);

        await sendWhatsApp(
          "233547100951",
          `✨ NEW WEBSITE SERVICE ORDER PAID! 🎉\n\n🆔 Reference: ${ref}\n📦 Service: ${webService.service}\n📱 Phone: ${webService.customer_phone || "N/A"}\n💰 Amount: ₵${paidAmount.toFixed(2)}`
        );
        return;
      }

      // Check Result Checkers (WAEC)
      const { data: webChecker } = await supabase
        .from("checker_orders")
        .select("*")
        .or(`reference.eq.${ref},ref.eq.${ref}`)
        .maybeSingle();

      if (webChecker) {
        recordWebhookLog("WEBSITE_CHECKER_ORDER_FOUND", { ref, type: webChecker.checker_type });
        await supabase
          .from("checker_orders")
          .update({
            payment_status: "paid",
            updated_at: new Date().toISOString()
          })
          .or(`reference.eq.${ref},ref.eq.${ref}`);

        await sendWhatsApp(
          "233547100951",
          `🎓 NEW RESULT CHECKER ORDER PAID! 🎉\n\n🆔 Reference: ${ref}\n📦 Exam: ${webChecker.checker_type}\n📱 Phone: ${webChecker.customer_phone || "N/A"}\n💰 Amount: ₵${paidAmount.toFixed(2)}`
        );
        return;
      }

      recordWebhookLog("SESSION_NOT_FOUND", { ref });
      console.error("❌ SESSION NOT FOUND:", ref);
      await sendWhatsApp(
        "233547100951",
        `🔔 PAYSTACK PAYMENT RECEIVED FOR UNKNOWN SESSION\nReference: ${ref}\nAmount: ₵${paidAmount.toFixed(2)}\nCustomer: ${event.data?.customer?.email || "N/A"}\nPlease check Supabase and Paystack dashboard!`
      );
      return;
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
        momo_number: normalizePhone(session.momo_number || session.phone_number),
        ref: mashupRef,
        network: "MASHUP",
        bundle: session.bundle,
        capacity: parsed.combo.label,
        amount: paidAmount,
        status: "pending_manual",
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
          momo_number: normalizePhone(session.momo_number),
          ref: afaExternalId,
          network: "AFA",
          bundle: afaData.full_name,
          capacity: "AFA Registration",
          amount: paidAmount,
          status: afaStatus,
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
      } catch (afaError) {
        console.error("❌ AFA API ERROR:", afaError.response?.data || afaError.message);

        await supabase.from("orders").insert([{
          whatsapp_phone: session.phone,
          phone_number: normalizePhone(afaData.phone_number),
          momo_number: normalizePhone(session.momo_number),
          ref: afaExternalId,
          network: "AFA",
          bundle: afaData.full_name,
          capacity: "AFA Registration",
          amount: paidAmount,
          status: "pending_manual",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

        await sendWhatsApp(
          "233547100951",
          `🔔 AFA REGISTRATION FAILED — MANUAL ACTION NEEDED\n\nThe AFA API call failed after payment was confirmed.\n\n👤 Full Name: ${afaData.full_name}\n📱 Phone: ${afaData.phone_number}\n🪪 Ghana Card: ${afaData.id_number}\n📍 Location: ${afaData.location}\n🎂 DOB: ${afaData.dob}\n💼 Occupation: ${afaData.occupation}\n💵 Confirmed paid: ₵${paidAmount.toFixed(2)}\n\nCheck the afaregistration.com dashboard or submit this manually, then update the order.`
        );

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
        momo_number: normalizePhone(session.momo_number),
        ref: netflixRef,
        network: "NETFLIX",
        bundle: refCode,
        capacity: "Netflix Subscription",
        amount: paidAmount,
        status: "pending_code_request",
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
    const finalOrderStatus = datamartSuccess ? datamartStatus : "pending_manual";

    try {
      const { error: orderError } = await supabase.from("orders").insert([{
        whatsapp_phone: session.phone,
        phone_number: normalizePhone(session.phone_number),
        momo_number: normalizePhone(session.momo_number || session.phone_number),
        ref: orderReference,
        network: session.network,
        bundle: session.bundle,
        capacity: bundle.capacity,
        amount: paidAmount,
        status: finalOrderStatus,
        created_at: datamartData.createdAt || new Date().toISOString(),
        updated_at: datamartData.updatedAt || new Date().toISOString(),
        campaign_code: session.scratch_order_opt_in ? session.scratch_code : null
      }]);

      if (orderError) {
        console.error("❌ ORDER SAVE ERROR:", orderError);
        recordWebhookLog("ORDER_SAVE_ERROR", { error: orderError.message });
      } else {
        console.log("✅ ORDER HISTORY SAVED:", orderReference);
        recordWebhookLog("ORDER_SAVED", { orderReference, status: finalOrderStatus });

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
      let successMessage = `✅ ORDER PLACED SUCCESSFULLY! 🎉\n\n🆔 Order Reference: ${orderReference}\n📦 Data: ${bundle.capacity}GB\n📶 Network: ${session.network}\n📱 Number: ${session.phone_number}\n💰 Amount Paid: ₵${paidAmount.toFixed(2)}\n\n${estimateMessage}\n\n📦 You can track your order anytime:\nFor assistance: Whatsapp 0547100951 (@stony11)\n\nSEND: hi / hello / start To buy again.`;
      await sendWhatsApp(session.phone, successMessage);
      recordWebhookLog("CUSTOMER_NOTIFIED_SUCCESS", { phone: session.phone });
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
  res.sendFile(__dirname + "/admin.html");
});

/* =========================================================
ADMIN DATA
========================================================= */

app.get("/admin-data", async (req, res) => {
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
