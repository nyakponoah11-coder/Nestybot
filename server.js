app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!msg) return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim();

    console.log("📩", from, text);

    // GET SESSION (ALWAYS FRESH)
    let { data: session } = await supabase
      .from("sessions")
      .select("*")
      .eq("phone", from)
      .maybeSingle();

    // CREATE SESSION IF NOT EXIST
    if (!session) {
      await supabase.from("sessions").insert([
        { phone: from, step: 1 }
      ]);

      return sendWhatsApp(from, MENU);
    }

    // RESET FLOW
    if (/^(hi|hello|start)$/i.test(text)) {
      await supabase
        .from("sessions")
        .update({ step: 1, network: null, bundle: null })
        .eq("phone", from);

      return sendWhatsApp(from, MENU);
    }

    // 🔥 STEP 1 (FIXED LOOP)
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

    // 🔥 STEP 2 (FIXED)
    if (session.step === 2) {
      const bundle = PACKAGES.MTN[text];

      if (!bundle) {
        return sendWhatsApp(from, "Invalid option ❌");
      }

      await supabase
        .from("sessions")
        .update({ step: 3, bundle: text })
        .eq("phone", from);

      return sendWhatsApp(from, "Enter phone number:");
    }

    // 🔥 STEP 3 (FIXED)
    if (session.step === 3) {
      const phone = text.replace(/\D/g, "");

      if (phone.length < 10) {
        return sendWhatsApp(from, "Invalid phone number ❌");
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
    console.error("WEBHOOK ERROR:", e);
  }
});
