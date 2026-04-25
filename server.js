const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   🔥 SAFE START (PREVENT STATUS 1)
========================= */
function mustEnv(name) {
  if (!process.env[name]) {
    console.error(`❌ Missing ENV: ${name}`);
    process.exit(1);
  }
  return process.env[name];
}

const VERIFY_TOKEN = mustEnv("VERIFY_TOKEN");
const ACCESS_TOKEN = mustEnv("ACCESS_TOKEN");
const PHONE_ID = mustEnv("PHONE_ID");
const PAYSTACK_SECRET = mustEnv("PAYSTACK_SECRET");
const DATA_API_KEY = mustEnv("DATA_API_KEY");
const SUPABASE_URL = mustEnv("SUPABASE_URL");
const SUPABASE_KEY = mustEnv("SUPABASE_KEY");

/* =========================
   SUPABASE INIT
========================= */
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================
   PACKAGES
========================= */
const PACKAGES = {
  MTN: {
    "1": { size: "1GB", price: 5, capacity: "1", apiNetwork: "YELLO" },
    "2": { size: "2GB", price: 10, capacity: "2", apiNetwork: "YELLO" }
  }
};

const MENU = `Welcome 💙\n\n1 - MTN Data`;
const BUNDLE_MENU = `MTN Bundles:\n1 - 1GB ₵5\n2 - 2GB ₵10`;

/* =========================
   WHATSAPP SENDER
========================= */
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

/* =========================
   PAYSTACK
========================= */
async function createPaystackLink(amount, ref, email) {
  const res = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: `${email}@nesty.com`,
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

/* =========================
   DELIVERY
========================= */
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
   MAIN BOT
========================= */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    console.log("📩", from, text);

    // GET SESSION
    let { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("phone", from)
      .maybeSingle();

    // CREATE SESSION
    if (!session) {
      await supabase.from("sessions").insert([
        { phone: from, step: 1 }
      ]);

      return sendWhatsApp(from, MENU);
    }

    // RESET
    if (/^(hi|hello|start)$/i.test(text)) {
      await supabase
        .from("sessions")
        .update({ step: 1 })
        .eq("phone", from);

      return sendWhatsApp(from, MENU);
    }

    // STEP 1
    if (session.step === 1) {
      if (text === "1") {
        await supabase
          .from("sessions")
          .update({ step: 2, network: "MTN" })
          .eq("phone", from);

        return sendWhatsApp(from, BUNDLE_MENU);
      }

      return sendWhatsApp(from, MENU);
    }

    // STEP 2
    if (session.step === 2) {
      const bundle = PACKAGES.MTN[text];
      if (!bundle) return sendWhatsApp(from, "Invalid option ❌");

      await supabase
        .from("sessions")
        .update({ step: 3, bundle: text })
        .eq("phone", from);

      return sendWhatsApp(from, "Enter phone number:");
    }

    // STEP 3
    if (session.step === 3) {
      const phone = text.replace(/\D/g, "");
      if (phone.length < 10) {
        return sendWhatsApp(from, "Invalid number ❌");
      }

      const bundle = PACKAGES.MTN[session.bundle];
      const ref = "REF-" + Date.now();

      const link = await createPaystackLink(bundle.price, ref, from);

      await supabase
        .from("sessions")
        .update({
          phone_number: phone,
          ref,
          step: 4
        })
        .eq("phone", from);

      return sendWhatsApp(from, `Pay here:\n${link}`);
    }

  } catch (e) {
    console.error("BOT ERROR:", e);
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Bot running on port", PORT);
});
