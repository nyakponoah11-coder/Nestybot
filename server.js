const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* ===== ENV ===== */
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const DATA_API_KEY = process.env.DATA_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* ===== PACKAGES ===== */
const PACKAGES = {
  MTN: {
    "1": { price: 4.50, capacity: "1", apiNetwork: "YELLO" },
"2": { price: 9.20, capacity: "2", apiNetwork: "YELLO" },
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
"13": { price: 206.50, capacity: "50", apiNetwork: "YELLO" },
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
"11": { price: 121.00, capacity: "30", apiNetwork: "YELLO" },
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
"11": { price: 400.75, capacity: "100", apiNetwork: "YELLO" },
  }
};

/* ===== MENUS ===== */
const MENU = `Welcome 💙

1 - MTN Data
2 - AirtelTigo Data
3 - Telecel Data`;

const MENUS = {
  MTN: `MTN Bundles:
1 - 1GB ₵4.50
2 - 2GB ₵9.20
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
13 - 50GB ₵206.50`,

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
11 - 30GB ₵121.00`,

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
11 - 100GB ₵400.75`
};

/* ===== SEND WHATSAPP ===== */
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

/* ===== VERIFY ===== */
app.get("/webhook", (req, res) => {
  res.send(req.query["hub.challenge"]);
});

/* ===== BOT ===== */
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    console.log("📩", from, text);

    let { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("phone", from)
      .maybeSingle();

    /* ===== CREATE SESSION ===== */
    if (!session) {
      await supabase.from("sessions").insert([{ phone: from, step: 1 }]);
      return sendWhatsApp(from, MENU);
    }

    /* ===== RESET ===== */
    if (/^(hi|hello|start)$/i.test(text)) {
      await supabase.from("sessions")
        .update({ step: 1 })
        .eq("phone", from);

      return sendWhatsApp(from, MENU);
    }

    /* ===== STEP 1 ===== */
    if (session.step === 1) {
      let network;

      if (text === "1") network = "MTN";
      else if (text === "2") network = "AIRTELTIGO";
      else if (text === "3") network = "TELECEL";
      else return sendWhatsApp(from, MENU);

      await supabase.from("sessions")
        .update({ step: 2, network })
        .eq("phone", from);

      return sendWhatsApp(from, MENUS[network]);
    }

    /* ===== STEP 2 ===== */
    if (session.step === 2) {
      const bundle = PACKAGES[session.network]?.[text];
      if (!bundle) return sendWhatsApp(from, "Invalid option ❌");

      await supabase.from("sessions")
        .update({ step: 3, bundle: text })
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

      await supabase.from("sessions")
        .update({
          phone_number: phone,
          step: 4
        })
        .eq("phone", from);

      return sendWhatsApp(from,
`Confirm Order ✅

Network: ${session.network}
Data: ${bundle.capacity}GB
Amount: ₵${bundle.price}
Phone: ${phone}

Reply YES to pay or NO to cancel`);
    }

    /* ===== STEP 4 (CONFIRM) ===== */
    if (session.step === 4) {

      if (/^no$/i.test(text)) {
        await supabase.from("sessions")
          .update({ step: 1 })
          .eq("phone", from);

        return sendWhatsApp(from, "❌ Cancelled\n\n" + MENU);
      }

      if (/^yes$/i.test(text)) {
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
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
          }
        );

        await supabase.from("sessions")
          .update({ ref, step: 5 })
          .eq("phone", from);

        return sendWhatsApp(from,
`💳 Payment Ready

Tap to pay:
${pay.data.data.authorization_url}`);
      }

      return sendWhatsApp(from, "Reply YES or NO");
    }

  } catch (e) {
    console.error("BOT ERROR:", e);
  }
});

/* ===== SUCCESS PAGE ===== */
app.get("/success", (req, res) => {
  res.send("<h2>Payment Successful ✅</h2>");
});

/* ===== PAYSTACK WEBHOOK ===== */
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
      .maybeSingle();

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
        headers: { "x-api-key": DATA_API_KEY }
      }
    );

    console.log("DELIVERY:", delivery.data);

    await sendWhatsApp(session.phone, "✅ Data delivered successfully!");

  } catch (e) {
    console.error("WEBHOOK ERROR:", e.response?.data || e.message);
  }
});

/* ===== START ===== */
app.listen(PORT, () => {
  console.log("🚀 RUNNING ON", PORT);
});
