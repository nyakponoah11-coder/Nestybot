const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

// ============ ENV VARS (set these in Render) ============
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;       // WhatsApp Cloud API token
const PHONE_ID = process.env.PHONE_ID;               // WhatsApp phone number ID
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET; // sk_live_... or sk_test_...
const DATA_API_KEY = process.env.DATA_API_KEY;       // Datamart API key
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============ PACKAGE CATALOG ============
const PACKAGES = {
  MTN: {
    "1":  { size: "1GB",  price: 4.80,  capacity: "1",  apiNetwork: "YELLO" },
    "2":  { size: "2GB",  price: 9.50,  capacity: "2",  apiNetwork: "YELLO" },
    "3":  { size: "3GB",  price: 14.80, capacity: "3",  apiNetwork: "YELLO" },
    "4":  { size: "4GB",  price: 19.80, capacity: "4",  apiNetwork: "YELLO" },
    "5":  { size: "5GB",  price: 24.50, capacity: "5",  apiNetwork: "YELLO" },
    "6":  { size: "6GB",  price: 29.50, capacity: "6",  apiNetwork: "YELLO" },
    "7":  { size: "8GB",  price: 37.00, capacity: "8",  apiNetwork: "YELLO" },
    "8":  { size: "10GB", price: 45.00, capacity: "10", apiNetwork: "YELLO" },
    "9":  { size: "15GB", price: 65.00, capacity: "15", apiNetwork: "YELLO" },
    "10": { size: "20GB", price: 85.00, capacity: "20", apiNetwork: "YELLO" },
    "11": { size: "25GB", price: 105.00,capacity: "25", apiNetwork: "YELLO" },
    "12": { size: "30GB", price: 126.00,capacity: "30", apiNetwork: "YELLO" },
    "13": { size: "40GB", price: 162.00,capacity: "40", apiNetwork: "YELLO" },
    "14": { size: "50GB", price: 208.90,capacity: "50", apiNetwork: "YELLO" },
  },
  TELECEL: {
    "1": { size: "5GB",  price: 25.00, capacity: "5",  apiNetwork: "TELECEL" },
    "2": { size: "10GB", price: 38.00, capacity: "10", apiNetwork: "TELECEL" },
  },
};

const NETWORK_MENU = `Welcome to Nesty💙\n\n1 - MTN Data\n2 - Telecel Data`;

const MTN_MENU = `MTN Bundles:\n\n1 - 1GB ₵4.80\n2 - 2GB ₵9.50\n3 - 3GB ₵14.80\n4 - 4GB ₵19.80\n5 - 5GB ₵24.50\n6 - 6GB ₵29.50\n7 - 8GB ₵37.00\n8 - 10GB ₵45.00\n9 - 15GB ₵65.00\n10 - 20GB ₵85.00\n11 - 25GB ₵105.00\n12 - 30GB ₵126.00\n13 - 40GB ₵162.00\n14 - 50GB ₵208.90\n\nReply with the bundle number:`;

const TELECEL_MENU = `Telecel Bundles:\n\n1 - 5GB ₵25.00\n2 - 10GB ₵38.00\n\nReply with the bundle number:`;

// ============ WHATSAPP HELPER ============
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
    console.error("WhatsApp send error:", e.response?.data || e.message);
  }
}

// ============ SESSION HELPERS ============
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
        network: null,
        bundle: null,
      })
      .select()
      .single();

    return newSession;
  }

  return data;
}
// ============ PAYSTACK ============
async function createPaystackLink(amountGhs, reference, from) {
  const res = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: `${from}@nestydatagh.com`,
      amount: Math.round(amountGhs * 100), // pesewas
      currency: "GHS",
      reference,
      metadata: { whatsapp_from: from },
    },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
  );
  return res.data.data.authorization_url;
}

// ============ DATAMART DELIVERY ============
async function deliverData(order) {
  try {
    const res = await axios.post(
      "https://api.datamartgh.shop/api/developer/purchase",
      {
        phoneNumber: order.recipient_number,
        network: PACKAGES[order.network][order.bundle_size_key].apiNetwork,
        capacity: PACKAGES[order.network][order.bundle_size_key].capacity,
        gateway: "wallet",
        ref: order.reference,
      },
      { headers: { "x-api-key": DATA_API_KEY } }
    );
    console.log("Datamart response:", res.data);
    return { ok: true };
  } catch (e) {
    console.error("Datamart error:", e.response?.data || e.message);
    return { ok: false, error: JSON.stringify(e.response?.data || e.message) };
  }
}

// ============ WHATSAPP WEBHOOK (verify) ============
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ============ WHATSAPP WEBHOOK (messages) ============
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // ack immediately
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();
    const session = await getSession(from);
    console.log("FROM:", from);
    console.log("TEXT:", text);
    console.log("SESSION:", session);

    // Restart triggers
    if (/^(hi|hello|menu|start|hey)$/i.test(text) {
      await saveSession(from, { step: 1, network: null, bundle: null, recipient_number: null });
      return sendWhatsApp(from, NETWORK_MENU);
    }

    // Step 1: choose network
    if (session.step === 1) {
      if (text === "1") {
        await saveSession(from, { step: 2, network: "MTN" });
        return sendWhatsApp(from, MTN_MENU);
      }
      if (text === "2") {
        await saveSession(from, { step: 2, network: "TELECEL" });
        return sendWhatsApp(from, TELECEL_MENU);
      }
      return sendWhatsApp(from, "Please reply 1 or 2.\n\n" + NETWORK_MENU);
    }

    // Step 2: choose bundle
    if (session.step === 2) {
      const bundle = PACKAGES[session.network]?.[text];
      if (!bundle) return sendWhatsApp(from, "Invalid choice. Reply with the bundle number.");
      await saveSession(from, { step: 3, bundle: text });
      return sendWhatsApp(from, `You picked ${bundle.size} for ₵${bundle.price.toFixed(2)}.\n\nNow send the recipient phone number (e.g. 0241234567):`);
    }

    // Step 3: recipient number
    if (session.step === 3) {
      const phone = text.replace(/\s+/g, "");
      if (!/^0\d{9}$/.test(phone)) {
        return sendWhatsApp(from, "Invalid number. Send a 10-digit number starting with 0 (e.g. 0241234567).");
      }
      const bundle = PACKAGES[session.network][session.bundle];
      const reference = `NDG-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

      const payLink = await createPaystackLink(bundle.price, reference, from);

      await supabase.from("orders").insert({
        reference,
        whatsapp_from: from,
        recipient_number: phone,
        network: session.network,
        bundle_size: session.bundle, // store the key (e.g. "8")
        price_ghs: bundle.price,
        payment_status: "pending",
        delivery_status: "pending",
        paystack_link: payLink,
      });

      await clearSession(from);

      return sendWhatsApp(
        from,
        `Order created ✅\n\nNetwork: ${session.network}\nBundle: ${bundle.size}\nRecipient: ${phone}\nAmount: ₵${bundle.price.toFixed(2)}\n\nPay here:\n${payLink}\n\nYour data will be delivered automatically after payment.`
      );
    }
  } catch (e) {
    console.error("Webhook error:", e);
  }
});

// ============ PAYSTACK WEBHOOK ============
app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);
  try {
    const event = req.body;
    if (event.event !== "charge.success") return;

    const reference = event.data.reference;

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (!order) return console.error("Order not found:", reference);
    if (order.payment_status === "paid") return; // already processed

    await supabase
      .from("orders")
      .update({ payment_status: "paid", updated_at: new Date().toISOString() })
      .eq("reference", reference);

    // Deliver via Datamart
    const result = await deliverData({
      ...order,
      bundle_size_key: order.bundle_size, // the "8" key
    });

    if (result.ok) {
      await supabase
        .from("orders")
        .update({ delivery_status: "delivered", updated_at: new Date().toISOString() })
        .eq("reference", reference);
      await sendWhatsApp(
        order.whatsapp_from,
        `✅ Payment received!\nYour ${PACKAGES[order.network][order.bundle_size].size} for ${order.recipient_number} is being delivered. Thank you for choosing NestyDatagh💙`
      );
    } else {
      await supabase
        .from("orders")
        .update({
          delivery_status: "failed",
          delivery_error: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq("reference", reference);
      await sendWhatsApp(
        order.whatsapp_from,
        `⚠️ Payment received but delivery failed. Our team has been notified and will resolve this shortly.`
      );
    }
  } catch (e) {
    console.error("Paystack webhook error:", e);
  }
});

// ============ HEALTH ============
app.get("/", (_req, res) => res.send("NestyDatagh bot is running ✅"));

app.listen(PORT, () => console.log(`Bot listening on ${PORT}`));
