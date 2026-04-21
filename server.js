const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// ---- ENV ----
const {
  ACCESS_TOKEN,
  PHONE_ID,
  VERIFY_TOKEN,
  PAYSTACK_SECRET,
  DATA_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PORT = 3000,
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- BUNDLES ----
const PACKAGES = {
  MTN: {
    "1":  { size: "1GB",  price: 4.8,   capacity: "1",  apiNetwork: "YELLO" },
    "2":  { size: "2GB",  price: 9.5,   capacity: "2",  apiNetwork: "YELLO" },
    "3":  { size: "3GB",  price: 14.8,  capacity: "3",  apiNetwork: "YELLO" },
    "4":  { size: "4GB",  price: 19.8,  capacity: "4",  apiNetwork: "YELLO" },
    "5":  { size: "5GB",  price: 24.5,  capacity: "5",  apiNetwork: "YELLO" },
    "6":  { size: "6GB",  price: 29.5,  capacity: "6",  apiNetwork: "YELLO" },
    "7":  { size: "8GB",  price: 37,    capacity: "8",  apiNetwork: "YELLO" },
    "8":  { size: "10GB", price: 45,    capacity: "10", apiNetwork: "YELLO" },
    "9":  { size: "15GB", price: 65,    capacity: "15", apiNetwork: "YELLO" },
    "10": { size: "20GB", price: 85,    capacity: "20", apiNetwork: "YELLO" },
    "11": { size: "25GB", price: 105,   capacity: "25", apiNetwork: "YELLO" },
    "12": { size: "30GB", price: 126,   capacity: "30", apiNetwork: "YELLO" },
    "13": { size: "40GB", price: 162,   capacity: "40", apiNetwork: "YELLO" },
    "14": { size: "50GB", price: 208.9, capacity: "50", apiNetwork: "YELLO" },
  },
  TELECEL: {
    "1": { size: "5GB",  price: 25, capacity: "5",  apiNetwork: "TELECEL" },
    "2": { size: "10GB", price: 38, capacity: "10", apiNetwork: "TELECEL" },
  },
};

if (!users[from]) {
  users[from] = { step: 0 };
}

let reply = "";

// STEP 0
if (users[from].step === 0) {
  users[from].step = 1;
  reply = NETWORK_MENU;
}

// STEP 1
else if (users[from].step === 1) {
  if (text === "1") {
    users[from].network = "MTN";
    users[from].step = 2;
    reply = MTN_MENU;
  } else if (text === "2") {
    users[from].network = "TELECEL";
    users[from].step = 2;
    reply = TELECEL_MENU;
  } else {
    reply = "Reply with 1 or 2";
  }
}

// STEP 2
else if (users[from].step === 2) {
  const selected = PACKAGES[users[from].network][text];

  if (!selected) {
    reply = "Invalid bundle. Try again.";
  } else {
    users[from].bundle = text;
    users[from].size = selected.size;
    users[from].step = 3;
    reply = "Enter your phone number:";
  }
}

const TELECEL_MENU =
`Telecel Bundles:

${Object.entries(PACKAGES.TELECEL)
  .map(([k, v]) => `${k} - ${v.size} ₵${v.price}`)
  .join("\n")}

Reply with the bundle number:`;

// ---- WHATSAPP ----
async function sendWhatsApp(to, body) {
  try {
    await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, text: { body } }),
    });
  } catch (e) { console.error("WA send failed:", e.message); }
}

// ---- DATAMART ----
async function deliverData(phoneNumber, apiNetwork, capacity) {
  const res = await fetch("https://api.datamartgh.shop/api/developer/purchase", {
    method: "POST",
    headers: { "X-API-Key": DATA_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, network: apiNetwork, capacity, gateway: "wallet" }),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Datamart ${res.status}: ${txt}`);
  try {
    const j = JSON.parse(txt);
    if (j.status && j.status !== "success") throw new Error(j.message || txt);
  } catch (_) {}
  return txt;
}

// ---- PAYSTACK ----
async function createPaystackLink(amountGhs, reference, whatsappFrom) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${whatsappFrom}@nestydatagh.com`,
      amount: Math.round(amountGhs * 100), // pesewas
      currency: "GHS",
      reference,
    }),
  });
  const j = await res.json();
  if (!j.status) throw new Error(`Paystack: ${j.message}`);
  return j.data.authorization_url;
}

// ---- SESSION HELPERS ----
async function getSession(from) {
  const { data } = await supabase.from("bot_sessions").select("*").eq("whatsapp_from", from).maybeSingle();
  if (data) return data;
  const { data: created } = await supabase
    .from("bot_sessions").insert({ whatsapp_from: from, step: 0 }).select().single();
  return created;
}
async function updateSession(from, patch) {
  await supabase.from("bot_sessions").update({ ...patch, updated_at: new Date().toISOString() }).eq("whatsapp_from", from);
}
async function resetSession(from) {
  await supabase.from("bot_sessions").update({ step: 0, network: null, bundle: null, recipient_number: null }).eq("whatsapp_from", from);
}

// ---- BOT FLOW ----
async function handleMessage(from, text) {
  const msg = (text || "").trim();
  const session = await getSession(from);

  // Reset words
  if (/^(menu|start|hi|hello|reset)$/i.test(msg)) {
    await resetSession(from);
    return sendWhatsApp(from, NETWORK_MENU);
  }

  switch (session.step) {
    case 0: // pick network
      if (msg === "1") { await updateSession(from, { step: 1, network: "MTN" }); return sendWhatsApp(from, MTN_MENU); }
      if (msg === "2") { await updateSession(from, { step: 1, network: "TELECEL" }); return sendWhatsApp(from, TELECEL_MENU); }
      return sendWhatsApp(from, NETWORK_MENU);

    case 1: { // pick bundle
      const bundle = PACKAGES[session.network]?.[msg];
      if (!bundle) return sendWhatsApp(from, "Invalid choice. " + (session.network === "MTN" ? MTN_MENU : TELECEL_MENU));
      await updateSession(from, { step: 2, bundle: msg });
      return sendWhatsApp(from, `You picked ${bundle.size} for ₵${bundle.price.toFixed(2)}.\n\nEnter the recipient phone number (e.g. 0241234567):`);
    }

    case 2: { // recipient + create payment
      const phone = msg.replace(/\D/g, "");
      if (phone.length < 10) return sendWhatsApp(from, "Invalid number. Please enter a 10-digit number:");
      const bundle = PACKAGES[session.network][session.bundle];
      const reference = `NDG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        const link = await createPaystackLink(bundle.price, reference, from);
        await supabase.from("orders").insert({
          reference, whatsapp_from: from, recipient_number: phone,
          network: session.network, bundle_size: bundle.size, price_ghs: bundle.price,
          paystack_link: link,
        });
        await resetSession(from);
        return sendWhatsApp(from, `💳 Pay ₵${bundle.price.toFixed(2)} for ${bundle.size} (${session.network}) → ${phone}\n\n${link}\n\nData will be delivered automatically after payment.`);
      } catch (e) {
        console.error(e);
        return sendWhatsApp(from, "❌ Could not create payment link. Try again later.");
      }
    }
  }
}

// ---- ROUTES ----
app.get("/", (_, res) => res.send("NestyDatagh bot ✅"));

// WhatsApp verify
app.get("/webhook", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// WhatsApp incoming
app.post("/webhook", express.json(), async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (message?.type === "text") {
      await handleMessage(message.from, message.text.body);
    }
  } catch (e) { console.error("WA webhook err:", e); }
  res.sendStatus(200);
});

// Paystack webhook (RAW body for signature)
app.post("/paystack-webhook", express.raw({ type: "*/*" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  const sig = req.headers["x-paystack-signature"];
  const expected = crypto.createHmac("sha512", PAYSTACK_SECRET).update(raw).digest("hex");
  if (sig !== expected) return res.status(401).send("bad sig");

  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).send("bad json"); }
  if (event.event !== "charge.success") return res.send("ok");

  const reference = event.data.reference;
  const { data: order } = await supabase.from("orders").select("*").eq("reference", reference).maybeSingle();
  if (!order) return res.send("ok");

  await supabase.from("orders").update({ payment_status: "paid" }).eq("reference", reference);

  try {
    const bundle = Object.values(PACKAGES[order.network] || {}).find(b => b.size === order.bundle_size);
    if (!bundle) throw new Error("Unknown bundle");
    await deliverData(order.recipient_number, bundle.apiNetwork, bundle.capacity);
    await supabase.from("orders").update({ delivery_status: "delivered" }).eq("reference", reference);
    await sendWhatsApp(order.whatsapp_from,
      `✅ Payment received!\n\n${order.bundle_size} (${order.network}) is on the way to ${order.recipient_number}.\n\nThank you for choosing NestyDatagh 💙`);
  } catch (e) {
    console.error("Delivery failed:", e.message);
    await supabase.from("orders").update({ delivery_status: "failed", delivery_error: String(e.message).slice(0, 500) }).eq("reference", reference);
    await sendWhatsApp(order.whatsapp_from,
      `⚠️ Payment received but delivery delayed for ${order.bundle_size}. Reference: ${reference}`);
  }
  res.send("ok");
});

app.listen(PORT, () => console.log(`🚀 NestyDatagh bot on :${PORT}`));
