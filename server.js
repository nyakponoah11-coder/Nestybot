const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

console.log("🚀 Starting NestyDatagh bot...");

const app = express();
app.use(express.json());

// ===== ENV =====
const {
  PORT = 3000,
  VERIFY_TOKEN,
  ACCESS_TOKEN,
  PHONE_ID,
  PAYSTACK_SECRET,
  DATA_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

// ===== CHECK ENV (IMPORTANT) =====
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase credentials");
}
if (!ACCESS_TOKEN || !PHONE_ID) {
  console.error("❌ Missing WhatsApp credentials");
}

// ===== SUPABASE =====
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== PACKAGES =====
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 4.8, capacity: "1", apiNetwork: "YELLO" },
    "2": { size: "2GB", price: 9.5, capacity: "2", apiNetwork: "YELLO" },
  },
  TELECEL: {
    "1": { size: "5GB", price: 25, capacity: "5", apiNetwork: "TELECEL" },
  },
};

const NETWORK_MENU = `Welcome to Nesty💙\n\n1 - MTN Data\n2 - Telecel Data`;
const MTN_MENU = `MTN Bundles:\n\n1 - 1GB ₵4.80\n2 - 2GB ₵9.50\n\nReply with bundle number:`;
const TELECEL_MENU = `Telecel Bundles:\n\n1 - 5GB ₵25\n\nReply with bundle number:`;

// ===== HELPERS =====
function normalize(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function sendWhatsApp(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );
  } catch (e) {
    console.error("WA send error:", e.response?.data || e.message);
  }
}

// ===== SESSION =====
async function getSession(from) {
  let { data } = await supabase
    .from("bot_sessions")
    .select("*")
    .eq("whatsapp_from", from)
    .maybeSingle();

  if (!data) {
    const { data: newSession } = await supabase
      .from("bot_sessions")
      .insert({
        whatsapp_from: from,
        step: 1,
      })
      .select()
      .single();

    return newSession;
  }

  return data;
}

async function updateSession(from, fields) {
  await supabase
    .from("bot_sessions")
    .update(fields)
    .eq("whatsapp_from", from);
}

async function clearSession(from) {
  await supabase.from("bot_sessions").delete().eq("whatsapp_from", from);
}

// ===== PAYSTACK =====
async function createPaystackLink(amount, reference, from) {
  const res = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: `${from}@nesty.com`,
      amount: Math.round(amount * 100),
      currency: "GHS",
      reference,
    },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );
  return res.data.data.authorization_url;
}

// ===== DELIVERY =====
async function deliverData(order) {
  try {
    const bundle = PACKAGES[order.network][order.bundle];
    await axios.post(
      "https://api.datamartgh.shop/api/developer/purchase",
      {
        phoneNumber: order.recipient_number,
        network: bundle.apiNetwork,
        capacity: bundle.capacity,
        gateway: "wallet",
      },
      { headers: { "x-api-key": DATA_API_KEY } }
    );
    return true;
  } catch (e) {
    console.error("Delivery error:", e.response?.data || e.message);
    return false;
  }
}

// ===== VERIFY =====
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// ===== MAIN BOT =====
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const raw = msg.text?.body || "";
    const text = normalize(raw);

    const session = await getSession(from);

    console.log("FROM:", from);
    console.log("TEXT:", raw);
    console.log("STEP:", session.step);

    // RESET
    if (["hi", "hello", "menu", "start"].includes(text)) {
      await updateSession(from, { step: 1, network: null, bundle: null });
      return sendWhatsApp(from, NETWORK_MENU);
    }

    // STEP 1
    if (session.step === 1) {
      if (text === "1") {
        await updateSession(from, { step: 2, network: "MTN" });
        return sendWhatsApp(from, MTN_MENU);
      }
      if (text === "2") {
        await updateSession(from, { step: 2, network: "TELECEL" });
        return sendWhatsApp(from, TELECEL_MENU);
      }
      return sendWhatsApp(from, NETWORK_MENU);
    }

    // STEP 2
    if (session.step === 2) {
      const bundle = PACKAGES[session.network]?.[text];
      if (!bundle) return sendWhatsApp(from, "Invalid choice");

      await updateSession(from, { step: 3, bundle: text });
      return sendWhatsApp(from, "Enter phone number:");
    }

    // STEP 3
    if (session.step === 3) {
      const phone = raw.replace(/\D/g, "");
      if (phone.length < 10) return sendWhatsApp(from, "Invalid number");

      const bundle = PACKAGES[session.network][session.bundle];
      const reference = "NDG-" + Date.now();

      const link = await createPaystackLink(bundle.price, reference, from);

      await supabase.from("orders").insert({
        reference,
        whatsapp_from: from,
        recipient_number: phone,
        network: session.network,
        bundle: session.bundle,
        price_ghs: bundle.price,
        payment_status: "pending",
      });

      await clearSession(from);

      return sendWhatsApp(from, `Pay here:\n${link}`);
    }
  } catch (e) {
    console.error("Webhook error:", e);
  }
});

// ===== PAYSTACK WEBHOOK =====
app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);

  const event = req.body;
  if (event.event !== "charge.success") return;

  const ref = event.data.reference;

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("reference", ref)
    .maybeSingle();

  if (!order) return;

  await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("reference", ref);

  const ok = await deliverData(order);

  if (ok) {
    await sendWhatsApp(order.whatsapp_from, "✅ Data delivered!");
  } else {
    await sendWhatsApp(order.whatsapp_from, "⚠️ Delivery failed");
  }
});

// ===== SERVER =====
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
