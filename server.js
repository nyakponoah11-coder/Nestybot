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
   MENUS
   ========================================================= */

const MENU = `Welcome to Data1gh🇬🇭

1 - MTN Data
2 - AirtelTigo Data
3 - Telecel Data

Other Services:

4 - Netflix subscription
5 - AFA registration
6 - Track Order

Choose an option to continue`;

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
    console.error(
      "WA ERROR:",
      e.response?.data || e.message
    );
  }
}

/* =========================================================
   PHONE NUMBER NORMALIZER
   ========================================================= */

function normalizePhone(phone) {
  let value = String(phone || "").replace(/\D/g, "");

  /*
    Convert Ghana international format:

    233241234567
          ↓
    0241234567
  */

  if (value.startsWith("233") && value.length === 12) {
    value = "0" + value.substring(3);
  }

  return value;
}

/* =========================================================
   DATAMART ORDER STATUS
   ========================================================= */

async function getDatamartOrderStatus(reference) {
  try {
    const response = await axios.get(
      `https://api.datamartgh.shop/api/developer/order-status/${encodeURIComponent(reference)}`,
      {
        headers: {
          "x-api-key": DATA_API_KEY
        }
      }
    );

    return response.data?.data || null;

  } catch (e) {
    console.error(
      "DATAMART STATUS ERROR:",
      e.response?.data || e.message
    );

    return null;
  }
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
    date: date.toLocaleDateString("en-GH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Africa/Accra"
    }),

    time: date.toLocaleTimeString("en-GH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Accra"
    })
  };
}

/* =========================================================
   STATUS DISPLAY
   ========================================================= */

function statusEmoji(status) {

  switch (String(status || "").toLowerCase()) {

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
   SAVE ORDER
   ========================================================= */

async function saveOrder(order) {

  try {

    const { error } = await supabase
      .from("orders")
      .upsert(
        [order],
        {
          onConflict: "ref"
        }
      );

    if (error) {
      console.error(
        "SAVE ORDER ERROR:",
        error
      );

      return false;
    }

    console.log(
      "✅ ORDER SAVED:",
      order.ref
    );

    return true;

  } catch (e) {

    console.error(
      "SAVE ORDER ERROR:",
      e.message
    );

    return false;
  }
}

/* =========================================================
   TRACK LAST 3 ORDERS
   ========================================================= */

async function trackOrders(from, phoneNumber) {

  const phone = normalizePhone(phoneNumber);

  try {

    /*
      First search exact normalized number.
    */

    let { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("phone_number", phone)
      .order("created_at", {
        ascending: false
      })
      .limit(3);


    if (error) {

      console.error(
        "ORDER SEARCH ERROR:",
        error
      );

      return sendWhatsApp(
        from,
        `❌ We could not check your orders right now.

Please try again shortly.`
      );
    }


    if (!orders || orders.length === 0) {

      return sendWhatsApp(
        from,
        `❌ No orders found for:

📱 ${phone}

Make sure you entered the same phone number used when purchasing the data.`
      );
    }


    let message =
      `📦 YOUR LAST ${orders.length} ORDER${orders.length > 1 ? "S" : ""}\n\n`;


    /*
      Check every order against Datamart
      so the user gets the LIVE status.
    */

    for (let i = 0; i < orders.length; i++) {

      const order = orders[i];

      let liveOrder =
        await getDatamartOrderStatus(
          order.ref
        );


      /*
        If Datamart responds, update
        our local order information.
      */

      if (liveOrder) {

        const liveStatus =
          liveOrder.orderStatus ||
          order.status ||
          "pending";

        await supabase
          .from("orders")
          .update({
            status: liveStatus,
            updated_at:
              liveOrder.updatedAt ||
              new Date().toISOString()
          })
          .eq("ref", order.ref);


        const dateTime =
          formatDateTime(
            liveOrder.createdAt ||
            order.created_at
          );


        const network =
          liveOrder.network ||
          order.network ||
          "N/A";


        const capacity =
          liveOrder.capacity ??
          order.capacity ??
          "N/A";


        const price =
          liveOrder.price ??
          order.amount ??
          "N/A";


        message +=
`━━━━━━━━━━━━━━━━
${i + 1}. 📦 ORDER

🆔 Reference: ${liveOrder.reference || order.ref}
📶 Network: ${network}
📦 Data: ${capacity}GB
📱 Number: ${liveOrder.phoneNumber || order.phone_number}
💰 Amount: ₵${Number(price).toFixed(2)}

${statusEmoji(liveStatus)} Status: ${String(liveStatus).toUpperCase()}

📅 Date: ${dateTime.date}
🕐 Time: ${dateTime.time}
━━━━━━━━━━━━━━━━

`;

      } else {

        /*
          If Datamart cannot be reached,
          still show the saved order.
        */

        const dateTime =
          formatDateTime(
            order.created_at
          );


        message +=
`━━━━━━━━━━━━━━━━
${i + 1}. 📦 ORDER

🆔 Reference: ${order.ref}
📶 Network: ${order.network || "N/A"}
📦 Data: ${order.capacity || "N/A"}GB
📱 Number: ${order.phone_number}
💰 Amount: ₵${Number(order.amount || 0).toFixed(2)}

${statusEmoji(order.status)} Status: ${String(order.status || "pending").toUpperCase()}

📅 Date: ${dateTime.date}
🕐 Time: ${dateTime.time}

⚠️ Live status temporarily unavailable.
━━━━━━━━━━━━━━━━

`;
      }
    }


    message +=
      `\nReply *HI* to return to the main menu.`;

    return sendWhatsApp(
      from,
      message
    );


  } catch (e) {

    console.error(
      "TRACK ORDER ERROR:",
      e.response?.data || e.message
    );


    return sendWhatsApp(
      from,
      `❌ Something went wrong while checking your orders.

Please try again.`
    );
  }
}

/* =========================================================
   VERIFY
   ========================================================= */

app.get("/webhook", (req, res) => {
  res.send(
    req.query["hub.challenge"]
  );
});

/* =========================================================
   BOT
   ========================================================= */

app.post("/webhook", async (req, res) => {

  res.sendStatus(200);

  try {

    const msg =
      req.body.entry?.[0]
        ?.changes?.[0]
        ?.value
        ?.messages?.[0];


    if (!msg) return;


    const from =
      msg.from;


    const text =
      (msg.text?.body || "").trim();


    console.log(
      "📩",
      from,
      text
    );


    let { data: session } =
      await supabase
        .from("sessions")
        .select("*")
        .eq("phone", from)
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
      /^(hi|hello|start)$/i.test(text)
    ) {

      await supabase
        .from("sessions")
        .update({
          step: 1
        })
        .eq("phone", from);


      return sendWhatsApp(
        from,
        MENU
      );
    }


    /* =====================================================
       TRACK ORDER MENU
       ===================================================== */

    if (
      text === "6" &&
      session.step === 1
    ) {

      await supabase
        .from("sessions")
        .update({
          step: 6
        })
        .eq("phone", from);


      return sendWhatsApp(
        from,
`📦 TRACK YOUR ORDER

Enter the phone number used when you purchased the data.

Example:
0241234567`
      );
    }


    /* =====================================================
       TRACK ORDER - ENTER PHONE
       ===================================================== */

    if (session.step === 6) {

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


      /*
        Search the last 3 purchases
        and check their live status.
      */

      return trackOrders(
        from,
        trackingPhone
      );
    }


    /* =====================================================
       STEP 1
       ===================================================== */

    if (session.step === 1) {

      let network;


      if (text === "1") {

        network = "MTN";

      } else if (text === "2") {

        network = "AIRTELTIGO";

      } else if (text === "3") {

        network = "TELECEL";

      } else if (text === "4") {

        return sendWhatsApp(
          from,
          "Subscribe to Netflix here:\n https://data-ease-shop.lovable.app/services"
        );

      } else if (text === "5") {

        return sendWhatsApp(
          from,
          "Register for AFA here:\n https://data-ease-shop.lovable.app/services"
        );

      } else {

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
        .eq("phone", from);


      return sendWhatsApp(
        from,
        MENUS[network]
      );
    }


    /* =====================================================
       STEP 2
       ===================================================== */

    if (session.step === 2) {

      const bundle =
        PACKAGES[
          session.network
        ]?.[text];


      if (!bundle) {

        return sendWhatsApp(
          from,
          "Invalid option ❌ Choose any option to continue"
        );
      }


      await supabase
        .from("sessions")
        .update({
          step: 3,
          bundle: text
        })
        .eq("phone", from);


      return sendWhatsApp(
        from,
        "Enter phone number:"
      );
    }


    /* =====================================================
       STEP 3
       ===================================================== */

    if (session.step === 3) {

      const phone =
        normalizePhone(text);


      if (
        phone.length !== 10 ||
        !phone.startsWith("0")
      ) {

        return sendWhatsApp(
          from,
          "Invalid number ❌ Enter correct number to continue"
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
        .eq("phone", from);


      return sendWhatsApp(
        from,

`Confirm Order: Your order will be delivered✅

Network: ${session.network}
Data: ${bundle.capacity}GB
Amount: ₵${bundle.price}
Phone: ${phone}

Reply YES to pay or NO to cancel`
      );
    }


    /* =====================================================
       STEP 4 - CONFIRM
       ===================================================== */

    if (session.step === 4) {


      if (
        /^no$/i.test(text)
      ) {

        await supabase
          .from("sessions")
          .update({
            step: 1
          })
          .eq("phone", from);


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

              amount:
                bundle.price * 100,

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
                  `Bearer ${PAYSTACK_SECRET}`
              }
            }
          );


        await supabase
          .from("sessions")
          .update({
            ref,
            step: 5
          })
          .eq("phone", from);


        return sendWhatsApp(
          from,

`💳 Payment Link

Your order is ready for payment.

Tap to pay:
${pay.data.data.authorization_url}

We’ll deliver your order shortly ✅`
        );
      }


      return sendWhatsApp(
        from,
        "Reply YES or NO"
      );
    }


  } catch (e) {

    console.error(
      "BOT ERROR:",
      e.response?.data ||
      e.message
    );
  }
});

/* =========================================================
   SUCCESS PAGE
   ========================================================= */

app.get("/success", (req, res) => {

  res.send(
    "<h2>Payment Successful ✅, Order placed successfully🎉💙 </h2>"
  );

});

/* =========================================================
   PAYSTACK WEBHOOK
   ========================================================= */

app.post(
  "/paystack-webhook",
  async (req, res) => {

    res.sendStatus(200);


    try {

      console.log(
        "🔥 WEBHOOK HIT"
      );


      const event =
        req.body;


      if (
        event.event !==
        "charge.success"
      ) {
        return;
      }


      const paystackRef =
        event.data.reference;


      const { data: session } =
        await supabase
          .from("sessions")
          .select("*")
          .eq("ref", paystackRef)
          .maybeSingle();


      if (!session) {

        console.error(
          "❌ SESSION NOT FOUND FOR:",
          paystackRef
        );

        return;
      }


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


      /* =================================================
         SEND PURCHASE TO DATAMART
         ================================================= */

      const delivery =
        await axios.post(

          "https://api.datamartgh.shop/api/developer/purchase",

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
                DATA_API_KEY
            }
          }
        );


      console.log(
        "DELIVERY:",
        delivery.data
      );


      /* =================================================
         GET DATAMART ORDER DATA
         ================================================= */

      const datamartData =
        delivery.data?.data ||
        delivery.data;


      /*
        Datamart's tracking endpoint uses
        the Datamart reference.

        We try the common reference fields
        returned by the purchase response.
      */

      const datamartReference =
        datamartData?.reference ||
        datamartData?.orderReference ||
        datamartData?.order_reference;


      const datamartOrderId =
        datamartData?.orderId ||
        datamartData?.order_id ||
        null;


      if (!datamartReference) {

        console.error(
          "⚠️ DATAMART REFERENCE NOT FOUND IN PURCHASE RESPONSE:",
          delivery.data
        );


        /*
          We still tell the customer the order
          was placed, but tracking cannot work
          until Datamart gives us a reference.
        */

        await sendWhatsApp(
          session.phone,

`✅ Order placed successfully!

NOTE: Delivery time varies (10min-30min).

For assistance contact:
0547100951

Say:
hi / hello / start

to buy again.`
        );

        return;
      }


      /* =================================================
         SAVE ORDER HISTORY
         ================================================= */

      const saved =
        await saveOrder({

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
            bundle.price,

          status:
            datamartData?.orderStatus ||
            datamartData?.status ||
            "pending",

          created_at:
            datamartData?.createdAt ||
            new Date().toISOString(),

          updated_at:
            datamartData?.updatedAt ||
            new Date().toISOString()
        });


      console.log(
        "ORDER HISTORY SAVED:",
        saved,
        datamartReference,
        datamartOrderId
      );


      /* =================================================
         CUSTOMER MESSAGE
         ================================================= */

      await sendWhatsApp(
        session.phone,

`✅ Order placed successfully!

🆔 Order Reference:
${datamartReference}

📦 ${bundle.capacity}GB
📶 ${session.network}
📱 ${session.phone_number}

NOTE: Delivery time varies (10min-30min).

You can track your order anytime by choosing:

6 - Track Order

For assistance:
0547100951

Say:
hi / hello / start

to buy again.`
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
      __dirname + "/admin.html"
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

      const { data } =
        await supabase
          .from("sessions")
          .select("*");


      let revenue = 0;


      (data || []).forEach(
        x => {

          if (x.step === 5) {

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
          data?.length || 0,

        delivered:
          (data || [])
            .filter(
              x => x.step === 5
            )
            .length,

        pending:
          (data || [])
            .filter(
              x => x.step < 5
            )
            .length,

        revenue,

        orders:
          (data || [])
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
   START
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
