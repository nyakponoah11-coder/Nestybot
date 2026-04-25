const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// ===== ENV =====
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== PACKAGES =====
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 5, capacity: "1", apiNetwork: "YELLO" },
    "2": { size: "2GB", price: 10, capacity: "2", apiNetwork: "YELLO" },
  }
};

// ===== MENUS =====
const MENU = `Welcome 💙\n\n1 - MTN Data`;
const BUNDLE_MENU = `MTN Bundles:\n1 - 1GB ₵5\n2 - 2GB ₵10`;

// ===== SEND WA =====
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
    console.log("✅ Sent:", text);
  } catch (e) {
    console.error("❌ WA ERROR:", e.response?.data || e.message);
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
      .insert({ whatsapp_from: from, step: 1 })
      .select()
      .single();

    return newSession;
  }

  return data;
}

async function updateSession(from, fields) {
  await supabase.from("bot_sessions").update(fields).eq("whatsapp_from", from);
}

async function clearSession(from) {
  await supabase.from("bot_sessions").delete().eq("whatsapp_from", from);
}

// ===== PAYSTACK =====
async function createPaystackLink(amount, ref, from) {
  const res = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: `${from}@nesty.com`,
      amount: amount * 100,
      currency: "GHS",
      reference: ref
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
        gateway: "wallet"
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
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    console.log("📩", text);

    const session = await getSession(from);

    // RESET
    if (/^(hi|hello|start)$/i.test(text)) {
      await updateSession(from, { step: 1 });
      return sendWhatsApp(from, MENU);
    }

    // STEP 1
    if (session.step === 1) {
      if (text === "1") {
        await updateSession(from, { step: 2, network: "MTN" });
        return sendWhatsApp(from, BUNDLE_MENU);
      }
      return sendWhatsApp(from, MENU);
    }

    // STEP 2
    if (session.step === 2) {
      const bundle = PACKAGES.MTN[text];
      if (!bundle) return sendWhatsApp(from, "Invalid");

      await updateSession(from, { step: 3, bundle: text });
      return sendWhatsApp(from, "Enter phone number:");
    }

    // STEP 3
    if (session.step === 3) {
      const phone = text.replace(/\D/g, "");
      const bundle = PACKAGES.MTN[session.bundle];
      const ref = "REF-" + Date.now();

      const link = await createPaystackLink(bundle.price, ref, from);

      await supabase.from("orders").insert({
        reference: ref,
        whatsapp_from: from,
        recipient_number: phone,
        network: "MTN",
        bundle: session.bundle,
        price_ghs: bundle.price
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

  await deliverData(order);

  await sendWhatsApp(order.whatsapp_from, "✅ Data delivered!");
});

// ===== SERVER =====
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Running on port", PORT);
});
