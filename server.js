const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;

// ===== MEMORY SESSION (FIXED) =====
const sessions = {};

// ===== PACKAGES =====
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 5, capacity: "1", apiNetwork: "YELLO" },
    "2": { size: "2GB", price: 10, capacity: "2", apiNetwork: "YELLO" },
  }
};

const MENU = `Welcome 💙\n\n1 - MTN Data`;
const BUNDLE_MENU = `MTN Bundles:\n1 - 1GB ₵5\n2 - 2GB ₵10`;

// ===== SEND WHATSAPP =====
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

    console.log("📩", from, text);

    // CREATE SESSION IF NOT EXISTS
    if (!sessions[from]) {
      sessions[from] = { step: 1 };
      return sendWhatsApp(from, MENU);
    }

    const session = sessions[from];

    // RESET
    if (/^(hi|hello|start)$/i.test(text)) {
      sessions[from] = { step: 1 };
      return sendWhatsApp(from, MENU);
    }

    // STEP 1 → NETWORK
    if (session.step === 1) {
      if (text === "1") {
        session.step = 2;
        session.network = "MTN";
        return sendWhatsApp(from, BUNDLE_MENU);
      }
      return sendWhatsApp(from, MENU);
    }

    // STEP 2 → BUNDLE
    if (session.step === 2) {
      const bundle = PACKAGES.MTN[text];
      if (!bundle) return sendWhatsApp(from, "Invalid option");

      session.step = 3;
      session.bundle = text;

      return sendWhatsApp(from, "Enter phone number:");
    }

    // STEP 3 → PHONE + PAYMENT
    if (session.step === 3) {
      const phone = text.replace(/\D/g, "");
      if (phone.length < 10) return sendWhatsApp(from, "Invalid number");

      const bundle = PACKAGES.MTN[session.bundle];
      const ref = "REF-" + Date.now();

      const link = await createPaystackLink(bundle.price, ref, from);

      // store temporarily
      session.phone = phone;
      session.ref = ref;

      session.step = 4;

      return sendWhatsApp(from, `Pay here:\n${link}`);
    }

  } catch (e) {
    console.error("Webhook error:", e);
  }
});

// ===== PAYSTACK WEBHOOK =====
app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const event = req.body;
    if (event.event !== "charge.success") return;

    const ref = event.data.reference;

    // find session by ref
    const entry = Object.values(sessions).find(s => s.ref === ref);
    if (!entry) return;

    const bundle = PACKAGES.MTN[entry.bundle];

    const ok = await deliverData(entry.phone, bundle);

    if (ok) {
      await sendWhatsApp(event.data.customer.email.split("@")[0], "✅ Data delivered!");
    }

  } catch (e) {
    console.error("Payment webhook error:", e);
  }
});

// ===== SERVER =====
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Running on port", PORT);
});
