import { data1db, getCachedSettings } from "./_supabase.js";

export interface ChatMessageParam {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIResponse {
  success: boolean;
  reply: string;
  provider: "gemini" | "groq" | "grok" | "openai" | "open-llm" | "local";
  modelUsed: string;
  error?: string;
}

/**
 * Builds standard system instructions with current store catalog,
 * telecom guidelines, order tracking, strict domain guardrails,
 * store owner custom training, and Ghanaian customer care tone.
 */
export async function buildCustomerSupportSystemPrompt(
  supabase: any,
  extraContext?: string,
  settingsMap?: Record<string, string>
): Promise<string> {
  const settings = settingsMap || (await getCachedSettings(supabase).catch(() => ({})));

  const storeName = settings.shop_name || settings.store_name || "DATA 1 GH";
  const supportPhone = settings.support_phone || "0541234567";
  const whatsappUrl =
    settings.whatsapp_channel_url ||
    (settings.whatsapp_number ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}` : "https://whatsapp.com");
  const deliveryPolicy =
    settings.announcement_text ||
    "⚡ Instant Automated Delivery Guarantee: MTN, Telecel & AT packages delivered in under 60 seconds! 24/7 Automated.";

  // Fetch live active catalog from zero-egress data1db first, falling back to supabase
  let products: any[] = [];
  try {
    const localProds = data1db.loadTable("products");
    if (Array.isArray(localProds) && localProds.length > 0) {
      products = localProds
        .filter((p: any) => p.in_stock !== false)
        .sort((a: any, b: any) => Number(a.price || 0) - Number(b.price || 0));
    }
  } catch (_) {}

  if (products.length === 0 && supabase) {
    try {
      const { data } = await supabase
        .from("products")
        .select("network, capacity, price, in_stock")
        .eq("in_stock", true)
        .order("price", { ascending: true });
      products = data || [];
    } catch (_) {}
  }

  const mtnProducts = products.filter((p) => String(p.network).toUpperCase() === "MTN");
  const telecelProducts = products.filter((p) => String(p.network).toUpperCase() === "TELECEL");
  const atProducts = products.filter((p) => String(p.network).toUpperCase() === "AT");

  const formatList = (prods: any[]) =>
    prods.length > 0
      ? prods.map((p) => `${p.capacity}: GH₵ ${Number(p.price).toFixed(2)}`).join(" | ")
      : "Check site for live stock";

  // Fetch live stats from zero-egress data1db
  let totalOrders = 0;
  let deliveredCount = 0;
  try {
    const localOrders = data1db.loadTable("orders");
    if (Array.isArray(localOrders) && localOrders.length > 0) {
      totalOrders = localOrders.length;
      deliveredCount = localOrders.filter((o: any) => String(o.delivery_status || "").toLowerCase() === "delivered").length;
    }
  } catch (_) {}

  const customInstructions = (settings.ai_system_instructions || "").trim();

  const defaultTrainingDirective = `1. TALK LIKE A REAL HUMAN BEING & NEVER LOOP:
   - You are a real, warm, intelligent, and friendly human customer care specialist and store ambassador.
   - NEVER sound like a canned robot, an automated menu, or an AI language model. Never say "As an AI" or repeat robotic bulleted menus.
   - Listen to what the visitor actually says. If you've already answered something in the chat history, do not repeat yourself in a loop.

2. ANSWER ANY QUESTION AT THE FRONT END (OPEN-MINDED HUMAN WISDOM):
   - Visitors will ask all kinds of questions: about data packages, order tracking, phone codes, or general life, news, sports, weather, technology, study advice, jokes, or casual conversation.
   - Answer ANY question thoughtfully, politely, and warmly like a real human being! Never refuse questions by saying "I only answer data questions". Engage with them genuinely.

3. THE GOLDEN BUSINESS BRIDGE (ALWAYS COME BACK TO THE STORE):
   - After answering whatever question the visitor asked, gracefully, warmly, and naturally transition the conversation back to the business!
   - Examples:
     • "Chale, that match was incredible! By the way bossu, make sure your data doesn't finish while streaming the highlights — we've got super fast MTN, Telecel and AT bundles that land on your phone in under 60 seconds!"
     • "Haha that's very true bossu! How is your day going? By the way, are you looking to top up any non-expiry data for your phone today too?"
     • "Glad I could help with that! Let me know if you want to check our data bundle rates or track an order while you're here."
   - Always keep the business active and welcoming without being aggressive.`;

  return `You are "Kofi" (also known as Stony), the real, warm, intelligent, and open-minded Customer Support Specialist for "${storeName}" (Ghana's premier instant mobile data and services platform).

=== 👑 STORE OWNER'S CUSTOM TRAINING & FINE-TUNING (HIGHEST PRIORITY) ===
The store owner has trained you with these specific instructions. You MUST strictly adhere to and prioritize the owner's directives:
${customInstructions || defaultTrainingDirective}
===================================================================================

=== CRITICAL BEHAVIORAL DIRECTIVES ===
1. STRICTLY NO LOOPS OR SCRIPTED ROBOTIC REPLIES:
   - DO NOT give canned, pre-written templates or repetitive replies.
   - Every response must be uniquely crafted, natural, responsive to the customer's exact words, and conversational.
   - You have full access to the site's live information, database, and settings. Use this real context to give intelligent, dynamic answers.

2. ANSWER ANY QUESTION & BRIDGE TO BUSINESS:
   - Answer any question the visitor brings up warmly and like a fellow human.
   - Always naturally and warmly invite them to check prices, track orders, or buy data packages on ${storeName}.

3. EMOTION ATTUNEMENT & EMPATHY:
   - Read and adapt to the customer's emotions:
     * If they are frustrated, worried, or panicking ("where is my data", "scam", "it hasn't come"): Be deeply empathetic, calming, and reassuring. Remind them warmly that their money is 100% safe and walk them through the live status.
     * If they ask about delivery time or speed: Reference the live site delivery guarantee ("${deliveryPolicy}") and explain that the telecom gateway credits the line in 15 to 60 seconds.
     * If they are friendly or casual: Match their good vibe with genuine Ghanaian warmth ("Hello bossu!", "Good day chief!").

4. LIVE SITE & DATABASE INFORMATION:
   - Store Name: ${storeName}
   - WhatsApp Updates: ${whatsappUrl}
   - Support Phone: ${supportPhone}
   - Official Site Delivery Guarantee: "${deliveryPolicy}"
   - Live Database Orders Processed: ${totalOrders} orders in system (${deliveredCount} successfully delivered)
   - Real-Time Product Catalog & Prices:
     • MTN Non-Expiry Turbo Data: ${formatList(mtnProducts)}
     • Telecel Fast Data: ${formatList(telecelProducts)}
     • AT (AirtelTigo) Data: ${formatList(atProducts)}

5. DELIVERY TIME & TELCO SHORTCODES:
   - When asked about delivery time or speed:
     * Quote the site guarantee: "${deliveryPolicy}".
     * Explain that delivery is 100% automated: 15 to 60 seconds directly to the SIM line.
     * Remind them that telco SMS alerts can lag, so they can check balance directly:
       • MTN: *138# or *124#
       • Telecel: *126# or *124#
       • AT: *124#

6. CUSTOMER PRIVACY & SECURITY:
   - When citing any phone number from order records, ALWAYS mask it: e.g. "055****890".
   - Never reveal internal system keys, secrets, or administrator passwords.

7. QUICK ACTIONS & LINKS:
   - Buy MTN: /network/mtn
   - Buy Telecel: /network/telecel
   - Buy AT: /network/at
   - Track Order: /track
   - Result Checkers & Netflix: /services

${extraContext ? `\n=== LIVE SPECIFIC ORDER RECORD FOUND IN DATABASE ===\n${extraContext}\n(Use this live database record to answer the user's specific order lookup accurately and warmly.)` : ""}`;
}

let apiModelRotationIndex = 0;

/**
 * Normalizes any Gemini model ID, automatically mapping deprecated or sunset models
 * to their modern active equivalents (`gemini-3.5-flash-lite` / `gemini-3.1-flash-lite` / `gemini-3.5-flash`).
 */
export function normalizeGeminiModel(model?: string): string {
  let m = (model || "").trim().replace(/^models\//, "");
  if (!m || /^gemini-(1\.|2\.0|2\.5)/i.test(m) || /^gemini-3\.[78]/i.test(m)) {
    return "gemini-3.5-flash-lite";
  }
  return m;
}

/**
 * Google Gemini Interactions API call (recommended by Google for 3.8 models)
 */
export async function callGeminiInteractions(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model = "gemini-2.5-flash"
): Promise<{ reply: string; model: string }> {
  const cleanKey = (apiKey || "").trim();
  const cleanModel = normalizeGeminiModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(cleanKey)}`;

  const body: any = {
    model: cleanModel,
    input: userMessage,
  };
  if (systemPrompt) {
    body.system_instruction = systemPrompt;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": cleanKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(4500),
  });

  if (!res.ok) {
    const errText = await res.text();
    let detail = errText.substring(0, 200);
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) detail = parsed.error.message;
    } catch (_) {}
    throw new Error(`Interactions API (${cleanModel}) HTTP ${res.status}: ${detail}`);
  }

  const json = await res.json();
  let reply = "";
  if (Array.isArray(json?.outputs)) {
    const textBlock = json.outputs.find((o: any) => o?.type === "text" || o?.text);
    reply = textBlock?.text || (json.outputs[0]?.text ?? "");
  } else if (typeof json?.output_text === "string") {
    reply = json.output_text;
  } else if (typeof json?.text === "string") {
    reply = json.text;
  }

  if (!reply) {
    throw new Error(`Interactions API (${cleanModel}) returned empty output.`);
  }

  return { reply: reply.trim(), model: cleanModel };
}

/**
 * Direct call to a single specific Gemini model
 */
export async function callGeminiSingle(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessageParam[],
  apiKey: string,
  model = "gemini-2.5-flash"
): Promise<{ reply: string; model: string }> {
  const cleanKey = (apiKey || "").trim();
  const cleanModel = normalizeGeminiModel(model);

  // Prepare alternating turns starting strictly with a 'user' turn
  const rawTurns: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const h of history.slice(-10)) {
    const text = (h.content || "").trim();
    if (text) {
      rawTurns.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text }],
      });
    }
  }

  // Gemini requires the conversation to start with 'user', not 'model'
  while (rawTurns.length > 0 && rawTurns[0].role === "model") {
    rawTurns.shift();
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const turn of rawTurns) {
    if (contents.length > 0 && contents[contents.length - 1].role === turn.role) {
      contents[contents.length - 1].parts[0].text += `\n${turn.parts[0].text}`;
    } else {
      contents.push(turn);
    }
  }

  if (contents.length > 0 && contents[contents.length - 1].role === "user") {
    contents[contents.length - 1].parts[0].text += `\n${userMessage}`;
  } else {
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(cleanKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": cleanKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 1024,
      },
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (res.ok) {
    const json = await res.json();
    const parts: any[] = json?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p) => typeof p?.text === "string" && !p.thought)
      .map((p) => p.text)
      .join("")
      .trim();
    if (text) {
      return { reply: text, model: cleanModel };
    }
  }

  const errText = await res.text().catch(() => "");
  let detail = errText.substring(0, 200);
  try {
    const parsed = JSON.parse(errText);
    if (parsed?.error?.message) detail = parsed.error.message;
  } catch (_) {}

  throw new Error(`HTTP ${res.status}: ${detail}`);
}

/**
 * 1. Call Google Gemini API with fallback rotation
 */
export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessageParam[],
  apiKey: string,
  model = "gemini-3.5-flash-lite"
): Promise<{ reply: string; model: string }> {
  const primaryModel = normalizeGeminiModel(model);

  const modelsToTry = Array.from(
    new Set([
      primaryModel,
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
    ])
  );

  let lastError = "";

  for (const mod of modelsToTry) {
    try {
      return await callGeminiSingle(systemPrompt, userMessage, history, apiKey, mod);
    } catch (e: any) {
      lastError = e?.message || "Gemini network error";
      console.warn(`[AI Rotator] Gemini failed on model ${mod}:`, lastError);
      // If key is invalid or forbidden, stop retrying other Gemini models
      if (/API_KEY_INVALID|HTTP 401|HTTP 403/i.test(lastError)) {
        break;
      }
    }
  }

  throw new Error(`Gemini failed: ${lastError}`);
}

/**
 * 2. Call Groq Cloud LPU API (or xAI Grok if xAI key provided)
 */
export async function callGroqOrGrok(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessageParam[],
  apiKey: string,
  model = "openai/gpt-oss-120b"
): Promise<{ reply: string; model: string }> {
  const isXaiKey = apiKey.startsWith("xai-") || model.toLowerCase().includes("grok");

  const groqModels = Array.from(
    new Set([
      model,
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3.8-27b",
      "llama-3.3-70b-versatile",
    ])
  );
  const xaiModels = Array.from(new Set([model, "grok-2-latest", "grok-beta"]));

  const primaryUrl = isXaiKey
    ? "https://api.x.ai/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";
  const modelsToTry = isXaiKey ? xaiModels : groqModels;

  let lastError = "";

  for (const mod of modelsToTry) {
    try {
      const messages: Array<{ role: string; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      for (const h of history.slice(-6)) {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content,
        });
      }

      messages.push({ role: "user", content: userMessage });

      const reqBody: Record<string, any> = {
        model: mod,
        messages,
        temperature: 0.7,
        max_tokens: 3000,
      };
      if (mod.includes("gpt-oss")) {
        reqBody.reasoning_effort = "low";
      }

      const res = await fetch(primaryUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `${isXaiKey ? "xAI" : "Groq"} (${mod}) HTTP ${res.status}: ${errText.substring(0, 150)}`;
        console.warn(`[AI Rotator] ${lastError}`);
        if (res.status === 401 || res.status === 403) break;
        continue;
      }

      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (text && text.trim()) {
        return { reply: text.trim(), model: mod };
      }
    } catch (e: any) {
      lastError = e?.message || `${isXaiKey ? "xAI" : "Groq"} network error`;
      console.warn(`[AI Rotator] ${isXaiKey ? "xAI" : "Groq"} exception on ${mod}:`, lastError);
    }
  }

  throw new Error(`${isXaiKey ? "xAI Grok" : "Groq"} rotation failed: ${lastError}`);
}

/**
 * 3. Call OpenAI API
 */
export async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessageParam[],
  apiKey: string,
  model = "gpt-4o-mini"
): Promise<{ reply: string; model: string }> {
  const modelsToTry = Array.from(new Set([model, "gpt-4o-mini"]));
  let lastError = "";

  for (const mod of modelsToTry) {
    try {
      const url = "https://api.openai.com/v1/chat/completions";

      const messages: Array<{ role: string; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      for (const h of history.slice(-6)) {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content,
        });
      }

      messages.push({ role: "user", content: userMessage });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: mod,
          messages,
          temperature: 0.7,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(5500),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastError = `OpenAI (${mod}) HTTP ${res.status}: ${errText.substring(0, 150)}`;
        console.warn(`[AI Rotator] ${lastError}`);
        if (res.status === 401 || res.status === 403 || res.status === 429) break;
        continue;
      }

      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (text) {
        return { reply: text.trim(), model: mod };
      }
    } catch (e: any) {
      lastError = e?.message || "OpenAI network error";
      console.warn(`[AI Rotator] OpenAI exception on ${mod}:`, lastError);
    }
  }

  throw new Error(`OpenAI rotation failed: ${lastError}`);
}

/**
 * 4. Free Open-Minded LLM Engine (zero key required fallback)
 */
export async function callFreeOpenLLM(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessageParam[] = []
): Promise<{ reply: string; model: string }> {
  const url = "https://text.pollinations.ai/";
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const h of history.slice(-6)) {
    messages.push({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.content,
    });
  }

  messages.push({
    role: "user",
    content: userMessage,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      model: "openai",
      temperature: 0.7,
      max_tokens: 700,
    }),
    signal: AbortSignal.timeout(4500),
  });

  if (!res.ok) {
    throw new Error(`Open LLM endpoint returned HTTP ${res.status}`);
  }

  const text = (await res.text()).trim();
  if (!text || text.startsWith("<!DOCTYPE") || text.startsWith("<html") || text.includes("502 Bad Gateway")) {
    throw new Error("Open LLM returned invalid or empty text response");
  }

  return { reply: text, model: "open-llm" };
}

/**
 * 5. Human-like Ghanaian Assistant Engine (Offline emergency fallback)
 */
export async function generateLocalAssistantReply(
  userMessage: string,
  context?: string,
  history: ChatMessageParam[] = [],
  settings: Record<string, string> = {}
): Promise<string> {
  const storeName = settings.shop_name || settings.store_name || "DATA 1 GH";
  const lower = userMessage.toLowerCase().trim();

  // 1. Robotic / Bot check
  if (
    lower.includes("bot") ||
    lower.includes("robot") ||
    lower.includes("automated") ||
    lower.includes("are you real") ||
    lower.includes("human") ||
    lower.includes("are you a machine")
  ) {
    return `Haha, no vex bossu! 😊 I'm right here with you on the ${storeName} support desk. Tell me what happened with your line or what you need, and I'll attend to you directly!`;
  }

  // 2. Casual Human Chat & General Questions (Answers warmly like a person, then bridges to business)
  const isGeneralQuery =
    lower.includes("how are you") ||
    lower.includes("how you dey") ||
    lower.includes("how body") ||
    lower.includes("who are you") ||
    lower.includes("your name") ||
    lower.includes("what is your name") ||
    lower.includes("tell me a joke") ||
    lower.includes("joke") ||
    lower.includes("weather") ||
    lower.includes("accra") ||
    lower.includes("ghana") ||
    lower.includes("football") ||
    lower.includes("premier league") ||
    lower.includes("advice") ||
    lower.includes("help me");

  if (isGeneralQuery) {
    if (lower.includes("how are you") || lower.includes("how you dey") || lower.includes("how body")) {
      return `Everything is solid on this side bossu! 😊 Feeling sharp and ready to attend to you. How is your day going? By the way, hope your internet connection is running strong — let me know if you need any instant MTN, Telecel, or AT data top-up today!`;
    }
    if (lower.includes("who are you") || lower.includes("your name")) {
      return `I'm Kofi, your customer care advisor at ${storeName}! 🇬🇭 Always here to assist you with quick bundle purchases, order tracking, and anything about the site. What can I get sorted for you today chief?`;
    }
    if (lower.includes("joke")) {
      return `Haha check this: Why did the smartphone cross the road? Because it was searching for ${storeName}'s instant 4G turbo data on the other side! 😂 Hope that brings a smile bossu. Are you looking to top up any bundle for your phone right now?`;
    }
    if (lower.includes("football") || lower.includes("match")) {
      return `Chale, sports talk is always lively! ⚽ As long as you have good data streaming the highlights, you won't miss any action. By the way, we deliver non-expiry MTN, Telecel, and AT data in under 60 seconds right here if you need more bundle for the games!`;
    }
    return `That's a great thought bossu! I'm always happy to talk with you. 😊 By the way, while you're here on ${storeName}, are you looking to check our data bundle rates, track an order, or get anything sorted for your SIM line?`;
  }

  // 3. Order context already found
  if (context && context.includes("ORDER FOUND:")) {
    return `Good news bossu! I found your order in our live system: 🔍\n\n${context}\n\nOur automated gateway dispatches orders in 15 to 60 seconds. Let me know if you need anything else!`;
  }

  // 4. Order tracking request
  if (
    lower.includes("track") ||
    lower.includes("my order") ||
    lower.includes("status") ||
    lower.includes("check order")
  ) {
    return `I can track your order for you right away bossu! 🔍\n\nKindly send me either:\n1. Your **Order Reference** (e.g. ORD-xxxxxxxx)\n2. Or the **Recipient Phone Number** you used for the purchase.\n\nOnce you type it, I will pull up the live record immediately!`;
  }

  // 5. Delivery speed / duration
  if (
    lower.includes("how long") ||
    lower.includes("delivery time") ||
    lower.includes("how fast") ||
    lower.includes("speed") ||
    lower.includes("instant") ||
    lower.includes("how is delivery")
  ) {
    return `⚡ **Delivery is Instant & 100% Automated on ${storeName}!**\n\n` +
      `• **MTN Turbo Data:** 15 to 60 seconds directly to your SIM.\n` +
      `• **Telecel & AT:** 15 to 60 seconds.\n` +
      `• Our gateway works 24/7 without manual delay.\n\n` +
      `If your order was already paid for, you can check your line balance via:\n` +
      `• **MTN:** *138# or *124#\n` +
      `• **Telecel:** *126# or *124#\n` +
      `• **AT:** *124#`;
  }

  // 6. Network pricing questions
  if (lower.includes("mtn") && (lower.includes("rate") || lower.includes("price") || lower.includes("cost") || lower.includes("how much") || lower.includes("gb"))) {
    return `Here are our popular non-expiry **MTN Turbo Data** packages bossu:\n\n` +
      `• 1GB, 2GB, 3GB, 5GB, 10GB, 20GB, 50GB & 100GB available!\n` +
      `• 100% Non-expiry & super fast 4G/5G speeds.\n\n` +
      `You can view live rates and order directly on our MTN section!`;
  }

  if (lower.includes("telecel") && (lower.includes("rate") || lower.includes("price") || lower.includes("cost") || lower.includes("how much") || lower.includes("gb"))) {
    return `Here are our fast **Telecel Data** rates bossu:\n\n` +
      `• Instant SIM crediting with zero expiry.\n` +
      `• Available from 1GB up to 50GB+ at unbeatable rates.\n\n` +
      `Check out the Telecel bundles page to order right now!`;
  }

  if (lower.includes("at") && (lower.includes("rate") || lower.includes("price") || lower.includes("cost") || lower.includes("how much") || lower.includes("gb"))) {
    return `Our **AT (AirtelTigo)** packages are active bossu:\n\n` +
      `• 100% Non-expiry data delivered instantly to your number.\n` +
      `• Select AT from the homepage or services menu to top up!`;
  }

  // 7. Balance check shortcodes
  if (lower.includes("check balance") || lower.includes("shortcode") || lower.includes("balance code") || lower.includes("check my balance")) {
    return `Here are the official USSD shortcodes to check your data balance directly on your phone bossu:\n\n` +
      `• 🟡 **MTN:** Dial *138# or *124#\n` +
      `• 🔴 **Telecel:** Dial *126# or *124#\n` +
      `• 🔵 **AT (AirtelTigo):** Dial *124#\n\n` +
      `Telco SMS notifications can sometimes delay, but dialing the shortcode shows your exact real-time volume immediately!`;
  }

  // 8. Panic / Delay reassurance
  if (lower.includes("scam") || lower.includes("fake") || lower.includes("where is my data") || lower.includes("haven't received") || lower.includes("not yet")) {
    return `Please don't worry bossu, your money and data are 100% safe! 🙏\n\n` +
      `We process thousands of orders daily. If your data has not appeared within 2 minutes:\n` +
      `1. Please dial ***138#** (MTN) or ***126#** (Telecel) directly, as telco SMS alerts often delay even after data has arrived.\n` +
      `2. If still zero, please drop your **Order Reference** or **Phone Number** right here so I can track the live gateway dispatch for you!`;
  }

  // 9. Friendly Greetings
  const greetingWords = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "bossu", "chale", "sup", "yo"];
  if (lower.length <= 30 && greetingWords.some((g) => lower === g || lower.startsWith(g + " ") || lower.endsWith(" " + g))) {
    return `Hello bossu! 👋 Welcome to ${storeName}.\n\nI am your live customer support specialist. Are you looking to buy a bundle, track an order, or check delivery speed? How can I assist you right now?`;
  }

  // 10. Open human response with gentle bridge to business (never loops or repeats identical scripts)
  return `I hear you loud and clear bossu! 😊 I'm right here with you on ${storeName}. Feel free to ask me anything you need, check bundle rates for MTN, Telecel, or AT, or drop your phone number or reference to track an order. What can I assist you with today?`;
}

/**
 * MAIN DISPATCHER: Executes model rotation
 * Order: 1. Google Gemini ➔ 2. Groq LPU / xAI Grok ➔ 3. OpenAI ➔ 4. Free Open LLM ➔ 5. Local Engine
 */
export async function askCustomerSupportAI(params: {
  userMessage: string;
  history?: Array<{ role?: string; sender?: string; content?: string; text?: string }>;
  extraContext?: string;
  supabase: any;
  settings?: Record<string, string>;
}): Promise<AIResponse> {
  let settingsMap = params.settings;
  if (!settingsMap) {
    try {
      settingsMap = await getCachedSettings(params.supabase);
    } catch (_) {
      settingsMap = {};
    }
  }
  settingsMap = settingsMap || {};

  const systemPrompt = await buildCustomerSupportSystemPrompt(
    params.supabase,
    params.extraContext,
    settingsMap
  );

  // Normalize history
  const normalizedHistory: ChatMessageParam[] = (params.history || []).map((h) => ({
    role: (h.role || (h.sender === "ai" || h.sender === "support" ? "assistant" : "user")) as "user" | "assistant",
    content: h.content || h.text || "",
  }));

  const errors: string[] = [];

  const geminiKey = (
    settingsMap.gemini_api_key ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ""
  ).trim();

  const groqKey = (
    settingsMap.groq_api_key ||
    settingsMap.grok_api_key ||
    process.env.GROQ_API_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    process.env.GROK_API_KEY ||
    ""
  ).trim();

  const openaiKey = (
    settingsMap.openai_api_key ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();

  const preferred = (
    settingsMap.primary_ai_provider ||
    settingsMap.ai_preferred_provider ||
    (groqKey ? "groq" : "gemini")
  ).toLowerCase();

  const tryGroq = async (): Promise<AIResponse | null> => {
    if (!groqKey) return null;
    try {
      const groqModel = settingsMap!.groq_model || settingsMap!.grok_model || "llama-3.3-70b-versatile";
      console.log(`[AI Rotator] Attempting Groq / Grok (${groqModel})...`);
      const res = await callGroqOrGrok(
        systemPrompt,
        params.userMessage,
        normalizedHistory,
        groqKey,
        groqModel
      );
      return {
        success: true,
        reply: res.reply,
        provider: "groq",
        modelUsed: res.model,
      };
    } catch (err: any) {
      console.warn("[AI Rotator] Groq failed:", err.message);
      errors.push(`Groq: ${err.message}`);
      return null;
    }
  };

  const tryGemini = async (): Promise<AIResponse | null> => {
    if (!geminiKey) return null;
    try {
      const geminiModel = normalizeGeminiModel(settingsMap!.gemini_model || "gemini-2.5-flash");
      console.log(`[AI Rotator] Attempting Google Gemini (${geminiModel})...`);
      const res = await callGemini(
        systemPrompt,
        params.userMessage,
        normalizedHistory,
        geminiKey,
        geminiModel
      );
      return {
        success: true,
        reply: res.reply,
        provider: "gemini",
        modelUsed: res.model,
      };
    } catch (err: any) {
      console.warn("[AI Rotator] Gemini failed:", err.message);
      errors.push(`Gemini: ${err.message}`);
      return null;
    }
  };

  const tryOpenAI = async (): Promise<AIResponse | null> => {
    if (!openaiKey) return null;
    try {
      const openaiModel = settingsMap!.openai_model || "gpt-4o-mini";
      console.log(`[AI Rotator] Attempting OpenAI (${openaiModel})...`);
      const res = await callOpenAI(
        systemPrompt,
        params.userMessage,
        normalizedHistory,
        openaiKey,
        openaiModel
      );
      return {
        success: true,
        reply: res.reply,
        provider: "openai",
        modelUsed: res.model,
      };
    } catch (err: any) {
      console.warn("[AI Rotator] OpenAI failed:", err.message);
      errors.push(`OpenAI: ${err.message}`);
      return null;
    }
  };

  const baseRunners = [tryGroq, tryGemini, tryOpenAI];
  const rotStart = apiModelRotationIndex % 2;
  apiModelRotationIndex = (apiModelRotationIndex + 1) % 100000;
  const providerChain =
    preferred === "openai"
      ? [tryOpenAI, tryGroq, tryGemini]
      : rotStart === 0
      ? [tryGroq, tryGemini, tryOpenAI]
      : [tryGemini, tryGroq, tryOpenAI];

  for (const runner of providerChain) {
    const result = await runner();
    if (result && result.reply) {
      return result;
    }
  }

  // 4. PRIORITY 4: Free Open-Minded LLM Engine
  try {
    console.log("[AI Rotator] Rotating to Free Open-Minded LLM Engine...");
    const openRes = await callFreeOpenLLM(
      systemPrompt,
      params.userMessage,
      normalizedHistory
    );
    if (openRes.reply) {
      return {
        success: true,
        reply: openRes.reply,
        provider: "open-llm",
        modelUsed: openRes.model,
      };
    }
  } catch (openErr: any) {
    console.warn("[AI Rotator] Free Open LLM error:", openErr.message);
    errors.push(`OpenLLM: ${openErr.message}`);
  }

  // 5. PRIORITY 5: Built-in Intelligent Local Support Engine (offline emergency fallback)
  console.log("[AI Rotator] Using Local Smart Assistant Engine (offline fallback)...");
  const localReply = await generateLocalAssistantReply(
    params.userMessage,
    params.extraContext,
    normalizedHistory,
    settingsMap
  );
  return {
    success: true,
    reply: localReply,
    provider: "local",
    modelUsed: "local-assistant-v1",
    error: errors.length > 0 ? errors.join(" | ") : undefined,
  };
}

/**
 * Diagnostic tool: Test individual provider credentials
 */
export async function testAIProvider(
  provider: "gemini" | "groq" | "grok" | "openai",
  apiKey: string,
  model?: string
): Promise<{ success: boolean; message: string; modelUsed?: string }> {
  const cleanKey = (apiKey || "").trim();
  if (!cleanKey) {
    return { success: false, message: `Please enter an API key for ${provider.toUpperCase()}` };
  }

  const testPrompt = "Hello! Please reply in one short sentence confirming you are online and working.";

  try {
    if (provider === "gemini") {
      const rawModel = (model || "").trim();
      const targetModel = normalizeGeminiModel(rawModel);

      try {
        const res = await callGemini("You are a helpful assistant.", testPrompt, [], cleanKey, targetModel);
        return {
          success: true,
          message: `Connected to Google Gemini (${res.model})! Online & verified. Reply: "${res.reply}"`,
          modelUsed: res.model,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Model "${targetModel}" test failed: ${err.message}`,
          modelUsed: targetModel,
        };
      }
    }

    if (provider === "groq" || provider === "grok") {
      const isXaiKey = cleanKey.startsWith("xai-") || (model && model.toLowerCase().includes("grok"));
      const targetModel = model || (isXaiKey ? "grok-2-latest" : "llama-3.3-70b-versatile");
      const name = isXaiKey ? "xAI Grok" : "Groq Cloud";
      try {
        const res = await callGroqOrGrok("You are a helpful assistant.", testPrompt, [], cleanKey, targetModel);
        return {
          success: true,
          message: `Connected to ${name} (${res.model})! Reply: "${res.reply}"`,
          modelUsed: res.model,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Model "${targetModel}" test failed: ${err.message}`,
          modelUsed: targetModel,
        };
      }
    }

    if (provider === "openai") {
      const targetModel = model || "gpt-4o-mini";
      try {
        const res = await callOpenAI("You are a helpful assistant.", testPrompt, [], cleanKey, targetModel);
        return {
          success: true,
          message: `Connected to OpenAI (${res.model})! Reply: "${res.reply}"`,
          modelUsed: res.model,
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Model "${targetModel}" test failed: ${err.message}`,
          modelUsed: targetModel,
        };
      }
    }

    return { success: false, message: "Unknown provider" };
  } catch (err: any) {
    return { success: false, message: err?.message || `Failed to connect to ${provider}` };
  }
}

/**
 * Autonomous Stony Owner AI Co-Pilot caller for Admin Site & WhatsApp
 * Directly uses the configured AI (Grok, Gemini, Groq) from Admin Settings,
 * talks like a smart Ghanaian business partner, and supports rich action execution.
 */
export async function callOwnerCoPilotAI({
  userMessage,
  history = [],
  settings = {},
  liveContext = "",
  storeUrl = "https://www.data1gh.com",
}: {
  userMessage: string;
  history?: Array<{ role?: string; content?: string; text?: string; sender?: string }>;
  settings?: Record<string, string>;
  liveContext?: string;
  storeUrl?: string;
}): Promise<{ reply: string; provider: string; model: string; executedAction?: any; stagedAction?: any }> {
  const groqKey = (
    settings.groq_api_key ||
    process.env.GROQ_API_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    settings.grok_api_key ||
    settings.xai_api_key ||
    process.env.GROK_API_KEY ||
    ""
  ).trim();

  const geminiKey = (
    settings.gemini_api_key ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();

  const preferred = (
    settings.primary_ai_provider ||
    settings.ai_preferred_provider ||
    settings.ai_provider ||
    (groqKey ? "groq" : "gemini")
  ).toLowerCase();

  const openaiKey = (
    settings.openai_api_key ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();

  const geminiModel = normalizeGeminiModel(settings.gemini_model || "gemini-2.5-flash");
  const isXai = groqKey.startsWith("xai-");
  const groqModel = settings.groq_model || (isXai ? "grok-2-latest" : "llama-3.3-70b-versatile");

  const normalizedHistory: Array<{ role: string; content: string }> = (history || []).slice(-8).map((h) => ({
    role: h.role === "assistant" || h.sender === "ai" || h.sender === "stony" ? "assistant" : "user",
    content: h.content || h.text || "",
  }));

  const copilotInstructions = (settings.copilot_custom_instructions || "").trim();
  const customerInstructions = (settings.ai_system_instructions || "").trim();
  const customDirectives = copilotInstructions || customerInstructions;

  let triggerRulesText = "";
  if (settings.copilot_trigger_rules) {
    try {
      const parsed = typeof settings.copilot_trigger_rules === "string" ? JSON.parse(settings.copilot_trigger_rules) : settings.copilot_trigger_rules;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const activeRules = parsed.filter((r: any) => r.active !== false);
        if (activeRules.length > 0) {
          triggerRulesText = `SPECIFIC OWNER IF-THEN TRAINING RULES:\n` + activeRules.map((r: any, idx: number) => {
            return `${idx + 1}. When the owner requests/asks about "${r.trigger}": ${r.responseType === "reply" ? `Reply strictly with: "${r.replyText}"` : `Execute action "${r.actionType}"`}`;
          }).join("\n");
        }
      }
    } catch (_) {}
  }

  const systemPrompt = `You are Stony, the owner's personal AI business assistant, digital co-pilot, and whole-system commercial partner at DATA 1 GH.
You are having a direct, private conversation with the verified business owner (on WhatsApp and the Admin Co-Pilot Drawer).

OFFICIAL STORE ACCESS & PLATFORM:
- Storefront: ${storeUrl}
- Admin Dashboard: ${storeUrl}/admin
- Support Phone: 0547100951 | SMS Sender ID: D_1Gh

AUTHENTIC GHANAIAN PARTNER TONE & STYLE:
- Talk like a real, smart, loyal Ghanaian human partner and co-pilot ("bossu", "chale", "sharp", "no wahala", "all good").
- Be concise, direct, warm, and factual (1 to 3 short paragraphs / 2 to 5 sentences).
- NEVER sound like an AI, a chatbot, or a robotic template. NEVER say "As an AI language model". You are Stony.
- When the owner asks how things are, state actual facts from the LIVE BUSINESS CONTEXT below (DataMart wallet balance, SMS credits, today's sales, delivery speeds, top customers).

FULL EXECUTIVE & QUERY AUTHORITY ACROSS THE WHOLE SITE:
You have complete administrative authority to perform ANY requested operation or data query on the site IMMEDIATELY when the owner asks:
1. Update order delivery status (delivered, processing, pending, failed, cancelled, refunded)
2. Update payment status (paid, pending, refunded)
3. Change product package prices (MTN, Telecel, AirtelTigo)
4. Toggle product stock (in stock / out of stock)
5. Send single customer SMS via Arkesel with Sender ID "D_1Gh"
6. Broadcast bulk SMS to all customers or agents
7. Generate free data vouchers / scratch codes
8. Toggle the free data giveaway campaign on or off
9. Credit agent wallets and list agents
10. Update the storefront popup announcement banner
11. Change the website color scheme / theme
12. Resync with DataMart API for live carrier delivery status or retry dispatches
13. Inspect orders and customer records
14. Query top customer phone numbers with the most orders: [EXECUTE_ACTION: {"action_type": "query_top_customers", "payload": {"limit": 5}}]
15. Fetch live accurate carrier delivery speeds: [EXECUTE_ACTION: {"action_type": "query_delivery_times", "payload": {}}]
16. Look up customer order history by phone: [EXECUTE_ACTION: {"action_type": "lookup_phone", "payload": {"phone": "<phone>"}}]

STRUCTURED ACTION DISPATCH (EXECUTE IMMEDIATELY):
Whenever the owner asks you to perform ANY action or query on the site, ALWAYS append an [EXECUTE_ACTION: ...] tag at the end of your response so it executes immediately:
[EXECUTE_ACTION: {"action_type": "<type>", "payload": {<parameters>}}]
For example:
- To query customer with most orders: [EXECUTE_ACTION: {"action_type": "query_top_customers", "payload": {"limit": 5}}]
- To get live delivery times: [EXECUTE_ACTION: {"action_type": "query_delivery_times", "payload": {}}]
- To look up phone orders: [EXECUTE_ACTION: {"action_type": "lookup_phone", "payload": {"phone": "0244123456"}}]
- To update order status: [EXECUTE_ACTION: {"action_type": "update_order_status", "payload": {"reference": "ORD-123456", "delivery_status": "delivered"}}]
- To change product price: [EXECUTE_ACTION: {"action_type": "update_product_price", "payload": {"network": "MTN", "capacity": "1", "price": 4.50}}]
- To toggle stock: [EXECUTE_ACTION: {"action_type": "toggle_product_stock", "payload": {"name": "MTN 10GB", "in_stock": false}}]
- To send SMS: [EXECUTE_ACTION: {"action_type": "send_sms", "payload": {"phone": "0244123456", "message": "Your bundle has been delivered!"}}]
- To credit agent: [EXECUTE_ACTION: {"action_type": "credit_agent", "payload": {"phone": "0547100951", "amount": 50}}]
- To generate vouchers: [EXECUTE_ACTION: {"action_type": "generate_vouchers", "payload": {"count": 5, "network": "MTN", "capacity": "1"}}]
- To toggle free data campaign: [EXECUTE_ACTION: {"action_type": "toggle_free_data", "payload": {"active": true}}]
- To update announcement: [EXECUTE_ACTION: {"action_type": "update_announcement", "payload": {"message": "Special flash discount today!", "title": "Store Notice", "enabled": true}}]
- To change theme: [EXECUTE_ACTION: {"action_type": "change_theme_color", "payload": {"color": "emerald"}}]
- To resync order: [EXECUTE_ACTION: {"action_type": "resync_datamart", "payload": {"reference": "ORD-123456"}}]

${triggerRulesText ? `\n${triggerRulesText}\n` : ""}
${customDirectives ? `\nOWNER'S CUSTOM TRAINING DIRECTIVES:\n${customDirectives}\n` : ""}
${liveContext ? `\nCURRENT LIVE BUSINESS REALITY:\n${liveContext}\n` : ""}`;

  // Chain helpers
  const tryGroq = async () => {
    if (!groqKey) return null;
    const res = await callGroqOrGrok(systemPrompt, userMessage, normalizedHistory, groqKey, groqModel);
    return { reply: res.reply, provider: isXai ? "grok" : "groq", model: res.model };
  };

  const tryGemini = async () => {
    if (!geminiKey) return null;
    const res = await callGemini(systemPrompt, userMessage, normalizedHistory, geminiKey, geminiModel);
    return { reply: res.reply, provider: "gemini", model: res.model };
  };

  const tryOpenAI = async () => {
    if (!openaiKey) return null;
    const res = await callOpenAI(systemPrompt, userMessage, normalizedHistory, openaiKey, settings.openai_model || "gpt-4o-mini");
    return { reply: res.reply, provider: "openai", model: res.model };
  };

  const tryFreeLLM = async () => {
    const res = await callFreeOpenLLM(systemPrompt, userMessage, normalizedHistory as any);
    return { reply: res.reply, provider: "open-llm", model: res.model };
  };

  const chain: Array<() => Promise<any>> = [];
  const coPilotRot = apiModelRotationIndex % 2;
  apiModelRotationIndex = (apiModelRotationIndex + 1) % 100000;
  if (preferred === "openai") {
    chain.push(tryOpenAI, tryGroq, tryGemini, tryFreeLLM);
  } else if (coPilotRot === 0) {
    chain.push(tryGroq, tryGemini, tryOpenAI, tryFreeLLM);
  } else {
    chain.push(tryGemini, tryGroq, tryOpenAI, tryFreeLLM);
  }

  let finalRes: { reply: string; provider: string; model: string } | null = null;
  for (const fn of chain) {
    try {
      const r = await fn();
      if (r?.reply) {
        finalRes = r;
        break;
      }
    } catch (e: any) {
      console.warn(`[callOwnerCoPilotAI] provider failed:`, e?.message);
    }
  }

  if (!finalRes) {
    finalRes = {
      reply: `I hear you loud and clear bossu! System is active and monitored.\n${liveContext ? `\n${liveContext.slice(0, 300)}` : ""}\nWhat would you like me to tackle?`,
      provider: "fallback",
      model: "local",
    };
  }

  // Parse any action tags
  let executedAction: any = null;
  let stagedAction: any = null;
  let cleanReply = finalRes.reply;

  const execMatch = cleanReply.match(/\[EXECUTE_ACTION:\s*(\{[\s\S]*?\})\]/i);
  if (execMatch) {
    try {
      executedAction = JSON.parse(execMatch[1]);
      cleanReply = cleanReply.replace(execMatch[0], "").trim();
    } catch (_) {}
  }

  const suggestMatch = cleanReply.match(/\[SUGGEST_ACTION:\s*(\{[\s\S]*?\})\]/i);
  if (suggestMatch) {
    try {
      stagedAction = JSON.parse(suggestMatch[1]);
      cleanReply = cleanReply.replace(suggestMatch[0], "").trim();
    } catch (_) {}
  }

  return {
    reply: cleanReply,
    provider: finalRes.provider,
    model: finalRes.model,
    executedAction,
    stagedAction,
  };
}
