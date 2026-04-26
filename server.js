const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ================= ENV ================= */
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ================= PACKAGES ================= */
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 5, capacity: "1", apiNetwork: "YELLO" },
    "2": { size: "2GB", price: 10, capacity: "2", apiNetwork: "YELLO" }
  },
  AIRTELTIGO: {
    "1": { size: "1GB", price: 4, capacity: "1", apiNetwork: "AT" },
    "2": { size: "2GB", price: 9, capacity: "2", apiNetwork: "AT" }
  }
};

/* ================= MENUS ================= */
const MENU = `Welcome 💙

1 - MTN Data
2 - AirtelTigo Data`;

const MTN_MENU = `MTN Bundles:
1 - 1GB ₵5
2 - 2GB ₵10`;

const AIRTEL_MENU = `AirtelTigo Bundles:
1 - 1GB ₵4
2 - 2GB ₵9`;

/* ================= SEND MESSAGE ================= */
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

/* ================= VERIFY ================= */
app.get("/webhook", (req, res) => {
  res.send(req.query["hub.challenge"]);
});

/* ================= BOT ================= */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    console.log("📩", from, text);

    /* ===== UPSERT SESSION ===== */
    await supabase
      .from("sessions")
      .upsert([{ phone: from, step: 1 }], { onConflict: "phone" });

    let { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("phone", from)
      .single();

    /* ===== RESET ===== */
    if (/^(hi|hello|start)$/i.test(text)) {
      await supabase
        .from("sessions")
        .update({ step: 1 })
        .eq("phone", from);

      return sendWhatsApp(from, MENU);
    }

    /* ===== STEP 1 ===== */
    if (session.step === 1) {
      if (text === "1") {
        await supabase
          .from("sessions")
          .update({ step: 2, network: "MTN" })
          .eq("phone", from);

        return sendWhatsApp(from, MTN_MENU);
      }

      if (text === "2") {
        await supabase
          .from("sessions")
          .update({ step: 2, network: "AIRTELTIGO" })
          .eq("phone", from);

        return sendWhatsApp(from, AIRTEL_MENU);
      }

      return sendWhatsApp(from, MENU);
    }

    /* ===== STEP 2 ===== */
    if (session.step === 2) {
      const bundle = PACKAGES[session.network][text];

      if (!bundle) {
        return sendWhatsApp(from, "Invalid option ❌");
      }

      await supabase
        .from("sessions")
        .update({
          step: 3,
          bundle: text
        })
        .eq("phone", from);

      return sendWhatsApp(from, "Enter phone number:");
    }

    /* ===== STEP 3 ===== */
    if (session.step === 3) {
      const phone = text.replace(/\D/g, "");

      if (phone.length < 10) {
        return sendWhatsApp(from, "Invalid number ❌");
      }

      const bundle = PACKAGES[session.network][session.bundle];
      const ref = "REF-" + Date.now();

      const pay = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: `${from}@test.com`,
          amount: bundle.price * 100,
          currency: "GHS",
          reference: ref,
          callback_url: "https://nestybot.onrender.com/success"
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`
          }
        }
      );

      await supabase
        .from("sessions")
        .update({
          phone_number: phone,
          ref,
          step: 4
        })
        .eq("phone", from);

      return sendWhatsApp(from, `Pay here:\n${pay.data.data.authorization_url}`);
    }

  } catch (e) {
    console.error("BOT ERROR:", e);
  }
});

/* ================= SUCCESS PAGE ================= */
app.get("/success", (req, res) => {
  res.send(`
    <h2>Payment Successful ✅</h2>
    <p>Your data will be delivered shortly.</p>
  `);
});

/* ================= PAYSTACK WEBHOOK ================= */
app.post("/paystack-webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    console.log("🔥 WEBHOOK HIT");

    const event = req.body;
    if (event.event !== "charge.success") return;

    const ref = event.data.reference;

    const { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("ref", ref)
      .single();

    if (!session) return;

    const bundle = PACKAGES[session.network][session.bundle];

    const delivery = await axios.post(
      "https://api.datamartgh.shop/api/developer/purchase",
      {
        phoneNumber: session.phone_number,
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

    console.log("DELIVERY:", delivery.data);

    await sendWhatsApp(session.phone, "✅ Data delivered successfully!");

  } catch (e) {
    console.error("WEBHOOK ERROR:", e.response?.data || e.message);
  }
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 BOT RUNNING ON", PORT);
});
