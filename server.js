const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ENV
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;

// SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 🔥 FIX: prevent duplicate webhook processing
const processedMessages = new Set();

// PACKAGES
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 5, capacity: "1", apiNetwork: "YELLO" },
    "2": { size: "2GB", price: 10, capacity: "2", apiNetwork: "YELLO" }
  }
};

const MENU = `Welcome 💙\n\n1 - MTN Data`;
const BUNDLE_MENU = `MTN Bundles:\n1 - 1GB ₵5\n2 - 2GB ₵10`;

// SEND WHATSAPP
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

// PAYSTACK
async function createPaystackLink(amount, ref, email) {
  const res = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: `${email}@test.com`,
      amount: amount * 100,
      currency: "GHS",
      reference: ref
    },
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`
      }
    }
  );

  return res.data.data.authorization_url;
}

// DELIVERY
async function deliverData(phone, bundle) {
  try {
    await axios.post(
      "https://api.datamartgh.shop/api/developer/purchase",
      {
        phoneNumber: phone,
        network: bundle.apiNetwork,
        capacity: bundle.capacity,
        gateway: "wallet"
      },
      {
        headers: {
          "x-api-key": DATA_API_KEY
        }
      }
    );

    return true;
  } catch (e) {
    console.error("DELIVERY ERROR:", e.response?.data || e.message);
    return false;
  }
}

/* =========================
   WEBHOOK VERIFY
========================= */
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

/* =========================
   MAIN WHATSAPP BOT
========================= */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // MUST respond fast

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const messageId = msg.id;
    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    // 🔥 FIX: stop duplicate webhook processing
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);

    setTimeout(() => processedMessages.delete(messageId), 5 * 60 * 1000);

    console.log("📩", from, text);

    // GET LAST ORDER
    let { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("phone", from)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    // NEW USER
    if (!order) {
      await supabase.from("orders").insert([
        { phone: from, step: 1, status: "active" }
      ]);

      return sendWhatsApp(from, MENU);
    }

    // RESET FLOW
    if (text.toLowerCase() === "start") {
      await supabase
        .from("orders")
        .update({ step: 1, bundle: null, reference: null })
        .eq("id", order.id);

      return sendWhatsApp(from, MENU);
    }

    // STEP 1
    if (order.step === 1) {
      if (text === "1") {
        await supabase
          .from("orders")
          .update({ step: 2, network: "MTN" })
          .eq("id", order.id);

        return sendWhatsApp(from, BUNDLE_MENU);
      }

      return sendWhatsApp(from, MENU);
    }

    // STEP 2
    if (order.step === 2) {
      const bundle = PACKAGES.MTN[text];

      if (!bundle) {
        return sendWhatsApp(from, "Invalid option. Try again.");
      }

      await supabase
        .from("orders")
        .update({
          step: 3,
          bundle: text,
          amount: bundle.price
        })
        .eq("id", order.id);

      return sendWhatsApp(from, "Enter phone number:");
    }

    // STEP 3
    if (order.step === 3) {
      const phone = text.replace(/\D/g, "");

      if (phone.length < 10) {
        return sendWhatsApp(from, "Invalid phone number");
      }

      const ref = "REF-" + Date.now();

      await supabase
        .from("orders")
        .update({
          phone,
          reference: ref,
          step: 4
        })
        .eq("id", order.id);

      const link = await createPaystackLink(order.amount, ref, from);

      return sendWhatsApp(from, `Pay here:\n${link}`);
    }
  } catch (e) {
    console.error("BOT ERROR:", e);
  }
});

/* =========================
   PAYSTACK WEBHOOK
========================= */
app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const event = req.body;
    if (event.event !== "charge.success") return;

    const ref = event.data.reference;

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("reference", ref)
      .single();

    if (!order) return;

    const bundle = PACKAGES.MTN[order.bundle];

    const ok = await deliverData(order.phone, bundle);

    if (ok) {
      await supabase
        .from("orders")
        .update({ status: "delivered", step: 5 })
        .eq("reference", ref);

      await sendWhatsApp(order.phone, "✅ Data delivered successfully!");
    }
  } catch (e) {
    console.error("PAYSTACK ERROR:", e);
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Bot running on port", PORT);
});
