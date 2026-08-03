const express = require("express");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/* =========================================================
   DATAMART API
========================================================= */

const DATAMART_BASE =
  "https://api.datamartgh.shop/api/developer";

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
   MAIN MENU
========================================================= */

const MENU = `Welcome to Data1gh🇬🇭

1 - MTN Data
2 - AirtelTigo Data
3 - Telecel Data
4 - Track Order
5 - Netflix subscription
6 - AFA registration

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
        text: {
          body: text
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

  } catch (e) {

    console.error(
      "WA ERROR:",
      e.response?.data || e.message
    );

  }
}

/* =========================================================
   NORMALIZE PHONE
========================================================= */

function normalizePhone(phone) {

  let value = String(phone || "")
    .replace(/\D/g, "");

  if (
    value.startsWith("233") &&
    value.length === 12
  ) {
    value = "0" + value.substring(3);
  }

  return value;
}

/* =========================================================
   FORMAT DATE
========================================================= */

function formatDateTime(dateValue) {

  if (!dateValue) {
    return {
      date: "N/A",
      time: "N/A"
    };
  }

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) {
    return {
      date: "N/A",
      time: "N/A"
    };
  }

  return {

    date: date.toLocaleDateString(
      "en-GH",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Accra"
      }
    ),

    time: date.toLocaleTimeString(
      "en-GH",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Africa/Accra"
      }
    )

  };
}

/* =========================================================
   CALCULATE DELIVERY DURATION
========================================================= */

function calculateDuration(
  placedAt,
  deliveredAt
) {

  const placed =
    new Date(placedAt);

  const delivered =
    new Date(deliveredAt);

  if (
    isNaN(placed.getTime()) ||
    isNaN(delivered.getTime())
  ) {
    return null;
  }

  const difference =
    delivered.getTime() -
    placed.getTime();

  if (difference <= 0) {
    return null;
  }

  const totalMinutes =
    Math.round(
      difference / 60000
    );

  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  if (hours > 0 && minutes > 0) {

    return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;

  }

  if (hours > 0) {

    return `${hours} hour${hours === 1 ? "" : "s"}`;

  }

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/* =========================================================
   GET DELIVERY TRACKER
========================================================= */

async function getDeliveryEstimate() {

  try {

    const response =
      await axios.get(
        `${DATAMART_BASE}/delivery-tracker`,
        {
          headers: {
            "x-api-key": DATA_API_KEY
          },
          timeout: 15000
        }
      );

    const data =
      response.data?.data;

    if (!data) {
      return null;
    }

    const lastDelivered =
      data.lastDelivered;

    if (!lastDelivered) {

      return {
        active:
          data.scanner?.active || false,

        waiting:
          data.scanner?.waiting || false,

        estimatedTime:
          null,

        placedTime:
          null,

        deliveredTime:
          null
      };
    }

    /*
      Example from DataMart:

      Tracking #1557392 —
      placed at Apr 03, 10:03 AM,
      delivered at Apr 03, 11:51 AM
    */

    const summary =
      lastDelivered.summary || "";

    const match =
      summary.match(
        /placed at (.*?), delivered at (.*)$/i
      );

    let placedText = null;
    let deliveredText = null;
    let estimatedTime = null;

    if (match) {

      placedText =
        match[1].trim();

      deliveredText =
        match[2].trim();

      /*
        The summary does not include
        the year, so use the current year.
      */

      const currentYear =
        new Date().getFullYear();

      const placedDate =
        new Date(
          `${placedText} ${currentYear}`
        );

      const deliveredDate =
        new Date(
          `${deliveredText} ${currentYear}`
        );

      estimatedTime =
        calculateDuration(
          placedDate,
          deliveredDate
        );
    }

    return {

      active:
        data.scanner?.active || false,

      waiting:
        data.scanner?.waiting || false,

      trackingId:
        lastDelivered.trackingId ||
        null,

      summary,

      placedTime:
        placedText,

      deliveredTime:
        deliveredText,

      estimatedTime
    };

  } catch (e) {

    console.error(
      "DELIVERY TRACKER ERROR:",
      e.response?.data ||
      e.message
    );

    return null;
  }
}

/* =========================================================
   BUILD DELIVERY ESTIMATE MESSAGE
========================================================= */

function buildDeliveryEstimateMessage(
  tracker
) {

  if (!tracker) {

    return `

⏳ Delivery Estimate:
Delivery timing is currently being checked.

The latest estimate will be available through Track Order.`;

  }

  if (
    tracker.estimatedTime &&
    tracker.placedTime &&
    tracker.deliveredTime
  ) {

    return `

📊 Latest Delivery Information

📦 Last order placed: ${tracker.placedTime}
✅ Delivered at: ${tracker.deliveredTime}

⏱️ Estimated delivery time: ${tracker.estimatedTime}


This estimate is based on the latest completed delivery batch.`;

  }

  if (tracker.active) {

    return `

📊 Delivery Information

🔄 DataMart delivery scanner is currently checking orders.

⏳ Estimated delivery time:
Currently being processed.

You can use 4 - Track Order to check your order status.`;

  }

  return `

⏳ Delivery Estimate:
Currently being checked by the delivery system.

You can use 4 - Track Order to check your order status.`;

}

/* =========================================================
   GET DATAMART ORDER STATUS
========================================================= */

async function getOrderStatus(
  reference
) {

  try {

    const response =
      await axios.get(
        `${DATAMART_BASE}/order-status/${encodeURIComponent(reference)}`,
        {
          headers: {
            "x-api-key": DATA_API_KEY
          },
          timeout: 15000
        }
      );

    return response.data?.data || null;

  } catch (e) {

    console.error(
      "ORDER STATUS ERROR:",
      e.response?.data ||
      e.message
    );

    return null;
  }
}

/* =========================================================
   STATUS EMOJI
========================================================= */

function statusEmoji(status) {

  switch (
    String(status || "")
      .toLowerCase()
  ) {

    case "completed":
      return "✅";

    case "processing":
      return "🔄";

    case "waiting":
      return "⏳";

    case "pending":
      return "🕐";

    case "failed":
      return "❌";

    case "refunded":
      return "💸";

    default:
      return "📦";
  }
}

/* =========================================================
   TRACK ORDERS
========================================================= */

async function trackOrders(
  from,
  phoneNumber
) {

  const phone =
    normalizePhone(phoneNumber);

  try {

    /*
      We use the orders table for history.
      Each successful purchase is saved there.
    */

    const {
      data: orders,
      error
    } = await supabase
      .from("orders")
      .select("*")
      .eq(
        "phone_number",
        phone
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .limit(3);

    if (error) {

      console.error(
        "TRACK SEARCH ERROR:",
        error
      );

      return sendWhatsApp(
        from,
`❌ We could not check your orders right now.

Please try again later.`
      );
    }

    if (
      !orders ||
      orders.length === 0
    ) {

      return sendWhatsApp(
        from,
`❌ No orders found for:

📱 ${phone}

Make sure you entered the same number used when purchasing.`
      );
    }

    let message =
`📦 YOUR LAST ${orders.length} ORDER${orders.length === 1 ? "" : "S"}

`;

    for (
      let i = 0;
      i < orders.length;
      i++
    ) {

      const order =
        orders[i];

      const reference =
        order.ref ||
        order.reference;

      let live =
        null;

      if (reference) {

        live =
          await getOrderStatus(
            reference
          );
      }

      const status =
        live?.orderStatus ||
        order.status ||
        "pending";

      const network =
        live?.network ||
        order.network ||
        "N/A";

      const capacity =
        live?.capacity ??
        order.capacity ??
        "N/A";

      const customerNumber =
        live?.phoneNumber ||
        order.phone_number ||
        phone;

      /*
        IMPORTANT:
        Amount always comes from Paystack/order record,
        NOT Datamart price.
      */

      const amount =
        Number(
          order.amount || 0
        );

      const dateTime =
        formatDateTime(
          live?.createdAt ||
          order.created_at
        );

      message +=
`━━━━━━━━━━━━━━━━
${i + 1}. 📦 ORDER

🆔 Reference:
${reference || "N/A"}

📶 Network: ${network}
📦 Data: ${capacity}GB
📱 Number:${customerNumber}
💰 Amount Paid: ₵${amount.toFixed(2)} ${statusEmoji(status)} Status: ${String(status).toUpperCase()}
📅 Date: ${dateTime.date}
🕐 Time: ${dateTime.time}

━━━━━━━━━━━━━━━━

`;

      /*
        Update current status in database.
      */

      if (
        live &&
        reference
      ) {

        await supabase
          .from("orders")
          .update({
            status,
            updated_at:
              live.updatedAt ||
              new Date().toISOString()
          })
          .eq(
            "ref",
            reference
          );
      }
    }

    message +=
`\nReply HI to return to the main menu.`;

    return sendWhatsApp(
      from,
      message
    );

  } catch (e) {

    console.error(
      "TRACK ERROR:",
      e.response?.data ||
      e.message
    );

    return sendWhatsApp(
      from,
`❌ Something went wrong while checking your orders.

Please try again.`
    );
  }
}

/* =========================================================
   WEBHOOK VERIFY
========================================================= */

app.get(
  "/webhook",
  (req, res) => {

    res.send(
      req.query["hub.challenge"]
    );

  }
);

/* =========================================================
   WHATSAPP WEBHOOK
========================================================= */

app.post(
  "/webhook",
  async (req, res) => {

    res.sendStatus(200);

    try {

      const msg =
        req.body.entry?.[0]
          ?.changes?.[0]
          ?.value?.messages?.[0];

      if (!msg) return;

      const from =
        msg.from;

      const text =
        (msg.text?.body || "")
          .trim();

      console.log(
        "📩",
        from,
        text
      );

      let {
        data: session
      } = await supabase
        .from("sessions")
        .select("*")
        .eq(
          "phone",
          from
        )
        .maybeSingle();

      /* =====================================================
         CREATE SESSION
      ===================================================== */

      if (!session) {

        await supabase
          .from("sessions")
          .insert([
            {
              phone: from,
              step: 1
            }
          ]);

        return sendWhatsApp(
          from,
          MENU
        );
      }

      /* =====================================================
         RESET
      ===================================================== */

      if (
        /^(hi|hello|start)$/i.test(
          text
        )
      ) {

        await supabase
          .from("sessions")
          .update({
            step: 1
          })
          .eq(
            "phone",
            from
          );

        return sendWhatsApp(
          from,
          MENU
        );
      }

      /* =====================================================
         STEP 1 - MAIN MENU
      ===================================================== */

      if (
        session.step === 1
      ) {

        let network;

        if (text === "1") {

          network = "MTN";

        } else if (text === "2") {

          network = "AIRTELTIGO";

        } else if (text === "3") {

          network = "TELECEL";

        }

        /*
          4 = TRACK ORDER
        */

        else if (text === "4") {

          /*
            Use 6 internally for tracking.
            Customer menu number remains 4.
          */

          await supabase
            .from("sessions")
            .update({
              step: 6
            })
            .eq(
              "phone",
              from
            );

          return sendWhatsApp(
            from,

`📦 TRACK YOUR ORDER

Please enter the phone number used when you purchased your data.

Example:
0241234567`
          );
        }

        /*
          5 = NETFLIX
        */

        else if (text === "5") {

          return sendWhatsApp(
            from,
            "Subscribe to Netflix here:\nhttps://data-ease-shop.lovable.app/services"
          );
        }

        /*
          6 = AFA
        */

        else if (text === "6") {

          return sendWhatsApp(
            from,
            "Register for AFA here:\nhttps://data-ease-shop.lovable.app/services"
          );
        }

        else {

          return sendWhatsApp(
            from,
            MENU
          );
        }

        await supabase
          .from("sessions")
          .update({
            step: 2,
            network
          })
          .eq(
            "phone",
            from
          );

        return sendWhatsApp(
          from,
          MENUS[network]
        );
      }

      /* =====================================================
         STEP 2 - SELECT BUNDLE
      ===================================================== */

      if (
        session.step === 2
      ) {

        const bundle =
          PACKAGES[
            session.network
          ]?.[text];

        if (!bundle) {

          return sendWhatsApp(
            from,
            "Invalid option ❌ Choose an option to continue"
          );
        }

        await supabase
          .from("sessions")
          .update({
            step: 3,
            bundle: text
          })
          .eq(
            "phone",
            from
          );

        return sendWhatsApp(
          from,
          "Enter phone number:"
        );
      }

      /* =====================================================
         STEP 3 - PHONE NUMBER
      ===================================================== */

      if (
        session.step === 3
      ) {

        const phone =
          normalizePhone(text);

        if (
          phone.length !== 10 ||
          !phone.startsWith("0")
        ) {

          return sendWhatsApp(
            from,
            "Invalid number ❌ Enter a correct Ghana phone number to continue"
          );
        }

        const bundle =
          PACKAGES[
            session.network
          ][session.bundle];

        await supabase
          .from("sessions")
          .update({
            phone_number: phone,
            step: 4
          })
          .eq(
            "phone",
            from
          );

        /*
          =====================================================
          GET LATEST DELIVERY ESTIMATE
          BEFORE PAYMENT
          =====================================================
        */

        const tracker =
          await getDeliveryEstimate();

        const estimateMessage =
          buildDeliveryEstimateMessage(
            tracker
          );

        return sendWhatsApp(
          from,

`Confirm Order: Your order will be delivered ✅

📶 Network: ${session.network}
📦 Data:${bundle.capacity}GB
💰 Amount: ₵${bundle.price.toFixed(2)}
📱 Phone: ${phone}

${estimateMessage}

Reply YES to pay or NO to cancel`
        );
      }

      /* =====================================================
         STEP 4 - CONFIRM PAYMENT
      ===================================================== */

      if (
        session.step === 4
      ) {

        if (
          /^no$/i.test(text)
        ) {

          await supabase
            .from("sessions")
            .update({
              step: 1
            })
            .eq(
              "phone",
              from
            );

          return sendWhatsApp(
            from,
            "❌ Cancelled\n\n" +
            MENU
          );
        }

        if (
          /^yes$/i.test(text)
        ) {

          const bundle =
            PACKAGES[
              session.network
            ][session.bundle];

          const ref =
            "REF-" +
            Date.now();

          const pay =
            await axios.post(

              "https://api.paystack.co/transaction/initialize",

              {
                email:
                  `${from}@test.com`,

                /*
                  Paystack amount is in pesewas.
                */

                amount:
                  Math.round(
                    bundle.price * 100
                  ),

                currency:
                  "GHS",

                reference:
                  ref,

                callback_url:
                  "https://nestybot.onrender.com/success"
              },

              {
                headers: {
                  Authorization:
                    `Bearer ${PAYSTACK_SECRET}`,

                  "Content-Type":
                    "application/json"
                }
              }
            );

          await supabase
            .from("sessions")
            .update({
              ref,
              step: 5
            })
            .eq(
              "phone",
              from
            );

          return sendWhatsApp(
            from,

`💳 PAYMENT

Your order is ready for payment.

Tap to pay:

${pay.data.data.authorization_url}

After payment, your data order will be processed automatically.`
          );
        }

        return sendWhatsApp(
          from,
          "Reply YES to pay or NO to cancel."
        );
      }

      /* =====================================================
         STEP 6 - TRACKING PHONE
      ===================================================== */

      if (
        session.step === 6
      ) {

        const trackingPhone =
          normalizePhone(text);

        if (
          trackingPhone.length !== 10 ||
          !trackingPhone.startsWith("0")
        ) {

          return sendWhatsApp(
            from,

`❌ Invalid phone number.

Please enter a valid Ghana phone number.

Example:
0241234567`
          );
        }

        return trackOrders(
          from,
          trackingPhone
        );
      }

    } catch (e) {

      console.error(
        "BOT ERROR:",
        e.response?.data ||
        e.message
      );

    }
  }
);

/* =========================================================
   SUCCESS PAGE
========================================================= */

app.get(
  "/success",
  (req, res) => {

    res.send(`
      <html>
        <head>
          <title>Payment Successful</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>

        <body style="
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
        ">

          <h2>
            Payment Successful ✅
          </h2>

          <p>
            Your order has been placed successfully 🎉💙
          </p>

        </body>
      </html>
    `);

  }
);

/* =========================================================
   PAYSTACK WEBHOOK
========================================================= */

app.post(
  "/paystack-webhook",
  async (req, res) => {

    /*
      Respond immediately to Paystack.
    */

    res.sendStatus(200);

    try {

      console.log(
        "🔥 PAYSTACK WEBHOOK HIT"
      );

      const event =
        req.body;

      if (
        event.event !==
        "charge.success"
      ) {
        return;
      }

      const ref =
        event.data.reference;

      /*
        =====================================================
        ACTUAL AMOUNT PAID
        =====================================================

        Paystack sends amount in pesewas.

        Example:
        2350 = ₵23.50
      */

      const paidAmount =
        Number(
          event.data.amount
        ) / 100;

      console.log(
        "💰 ACTUAL AMOUNT PAID:",
        paidAmount
      );

      /* =====================================================
         FIND SESSION
      ===================================================== */

      const {
        data: session
      } = await supabase
        .from("sessions")
        .select("*")
        .eq(
          "ref",
          ref
        )
        .maybeSingle();

      if (!session) {

        console.error(
          "❌ SESSION NOT FOUND:",
          ref
        );

        return;
      }

      /* =====================================================
         GET PACKAGE
      ===================================================== */

      const bundle =
        PACKAGES[
          session.network
        ]?.[session.bundle];

      if (!bundle) {

        console.error(
          "❌ BUNDLE NOT FOUND"
        );

        return;
      }

      /* =====================================================
         SEND PURCHASE TO DATAMART
      ===================================================== */

      const delivery =
        await axios.post(

          `${DATAMART_BASE}/purchase`,

          {
            phoneNumber:
              session.phone_number,

            network:
              bundle.apiNetwork,

            capacity:
              bundle.capacity,

            gateway:
              "wallet"
          },

          {
            headers: {
              "x-api-key":
                DATA_API_KEY,

              "Content-Type":
                "application/json"
            },

            timeout:
              30000
          }
        );

      console.log(
        "DELIVERY:",
        delivery.data
      );

      /* =====================================================
         DATAMART RESPONSE
      ===================================================== */

      const datamartData =
        delivery.data?.data ||
        delivery.data ||
        {};

      const datamartReference =
        datamartData.reference ||
        datamartData.orderReference ||
        datamartData.order_reference;

      const datamartOrderId =
        datamartData.orderId ||
        datamartData.order_id ||
        null;

      const datamartStatus =
        datamartData.orderStatus ||
        datamartData.status ||
        "pending";

      /*
        =====================================================
        SAVE ORDER HISTORY
        =====================================================

        IMPORTANT:

        amount = actual Paystack amount.
        NOT Datamart price.
      */

      if (datamartReference) {

        const {
          error: orderError
        } = await supabase
          .from("orders")
          .insert([

            {
              whatsapp_phone:
                session.phone,

              phone_number:
                normalizePhone(
                  session.phone_number
                ),

              ref:
                datamartReference,

              network:
                session.network,

              bundle:
                session.bundle,

              capacity:
                bundle.capacity,

              amount:
                paidAmount,

              status:
                datamartStatus,

              created_at:
                datamartData.createdAt ||
                new Date().toISOString(),

              updated_at:
                datamartData.updatedAt ||
                new Date().toISOString()
            }

          ]);

        if (orderError) {

          console.error(
            "❌ ORDER SAVE ERROR:",
            orderError
          );

        } else {

          console.log(
            "✅ ORDER HISTORY SAVED:",
            datamartReference
          );

        }

      }

      /* =====================================================
         GET CURRENT DELIVERY ESTIMATE
      ===================================================== */

      const tracker =
        await getDeliveryEstimate();

      const estimateMessage =
        buildDeliveryEstimateMessage(
          tracker
        );

      /* =====================================================
         CUSTOMER SUCCESS MESSAGE
      ===================================================== */

      let successMessage =
`✅ ORDER PLACED SUCCESSFULLY! 🎉

🆔 Order Reference:
${datamartReference || ref}

📦 Data: ${bundle.capacity}GB
📶 Network: ${session.network}
📱 Number: ${session.phone_number}
💰 Amount Paid: ₵${paidAmount.toFixed(2)}

${estimateMessage}

📦 You can track your order anytime:
For assistance:
0547100951

Say:
hi / hello / start
to buy again.`;

      await sendWhatsApp(
        session.phone,
        successMessage
      );

      console.log(
        "✅ CUSTOMER NOTIFIED"
      );

      console.log(
        "DATAMART ORDER ID:",
        datamartOrderId
      );

      console.log(
        "DATAMART REFERENCE:",
        datamartReference
      );

    } catch (e) {

      console.error(
        "WEBHOOK ERROR:",
        e.response?.data ||
        e.message
      );

    }
  }
);

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get(
  "/admin",
  (req, res) => {

    res.sendFile(
      __dirname +
      "/admin.html"
    );

  }
);

/* =========================================================
   ADMIN DATA
========================================================= */

app.get(
  "/admin-data",
  async (req, res) => {

    try {

      const {
        data
      } = await supabase
        .from("sessions")
        .select("*");

      const sessions =
        data || [];

      let revenue = 0;

      sessions.forEach(
        x => {

          if (
            x.step === 5
          ) {

            const bundle =
              PACKAGES[
                x.network
              ]?.[x.bundle];

            if (bundle) {

              revenue +=
                bundle.price;

            }

          }

        }
      );

      res.json({

        total:
          sessions.length,

        delivered:
          sessions.filter(
            x =>
              x.step === 5
          ).length,

        pending:
          sessions.filter(
            x =>
              x.step < 5
          ).length,

        revenue,

        orders:
          sessions
            .slice(-10)
            .reverse()

      });

    } catch (e) {

      res.json({
        error:
          e.message
      });

    }
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      "🚀 RUNNING ON",
      PORT
    );

  }
);
