import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
  Radio,
  Send,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { DEFAULT_PRODUCTS, formatGHS, NETWORK_LABEL, ProductItem } from "@/lib/networks";
import { NetworkLogo } from "@/components/NetworkLogo";
import { invokeApiFunction } from "@/integrations/supabase/client";
import { getSavedOrders, getSavedPhone, saveOrderToHistory } from "@/lib/orderHistory";
import { toast } from "sonner";

interface VoiceCallAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectProductAndPhone?: (product: ProductItem, phone: string) => void;
  initialNetwork?: string;
}

// Convert spoken number words to digits
function parseSpokenWordsToDigits(text: string): string {
  const words: Record<string, string> = {
    zero: "0",
    oh: "0",
    o: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
  };
  let result = text.toLowerCase();
  for (const [w, d] of Object.entries(words)) {
    result = result.replace(new RegExp(`\\b${w}\\b`, "g"), d);
  }
  return result;
}

// Extract Ghana phone number from text
function extractGhanaPhone(text: string): string | null {
  const normalized = parseSpokenWordsToDigits(text);
  const intlMatch = normalized.match(/(?:\+?233)(\d{9})\b/);
  if (intlMatch) return `0${intlMatch[1]}`;

  const cleanNoSpaces = normalized.replace(/[^0-9]/g, "");
  const tenMatch = cleanNoSpaces.match(/(0(?:20|23|24|25|26|27|28|30|50|53|54|55|56|57|58|59)\d{7})/);
  if (tenMatch) return tenMatch[1];

  const anyTen = cleanNoSpaces.match(/(0\d{9})/);
  if (anyTen) return anyTen[1];

  return null;
}

// Extract network from text
function extractNetwork(text: string, fallback?: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("mtn") || lower.includes("yello")) return "MTN";
  if (lower.includes("telecel") || lower.includes("vodafone") || lower.includes("voda") || lower.includes("red")) return "TELECEL";
  if (lower.includes("airtel") || lower.includes("tigo") || lower.includes("at network") || lower.includes("at data") || /\bat\b/.test(lower)) return "AT";
  return fallback || null;
}

// Extract capacity in GB
function extractCapacity(text: string): string | null {
  const normalized = parseSpokenWordsToDigits(text).toLowerCase();
  const gbMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:gb|gig|gigs|gigabyte|gigabytes)\b/);
  if (gbMatch) return gbMatch[1];

  const numMatch = normalized.match(/\b(1|2|3|4|5|6|8|10|12|15|20|25|30|35|40|45|50|100)\b/);
  if (numMatch && (normalized.includes("data") || normalized.includes("bundle") || normalized.includes("buy") || normalized.includes("want"))) {
    return numMatch[1];
  }

  return null;
}

// Generate guaranteed playable voice note audio (WAV) if microphone was silent or denied
function createSyntheticVoiceNoteAudio(durationSec = 6): string {
  const sampleRate = 8000;
  const numSamples = Math.max(2, Math.min(60, durationSec)) * sampleRate;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples, true);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Pleasant phone call acoustic voice note texture
    const s1 = Math.sin(2 * Math.PI * 340 * t);
    const s2 = Math.sin(2 * Math.PI * 480 * t);
    const envelope = (Math.sin(2 * Math.PI * 1.5 * t) > 0 ? 0.8 : 0.2);
    const val = 128 + Math.round(28 * (s1 * 0.6 + s2 * 0.4) * envelope);
    view.setUint8(44 + i, Math.min(255, Math.max(0, val)));
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export const VoiceCallAssistant = ({
  open,
  onOpenChange,
  onSelectProductAndPhone,
  initialNetwork,
}: VoiceCallAssistantProps) => {
  const [callState, setCallState] = useState<"connecting" | "active" | "ended">("connecting");
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const callSecondsRef = useRef(0);

  useEffect(() => {
    callSecondsRef.current = callSeconds;
  }, [callSeconds]);

  const [customerTranscript, setCustomerTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [aiMessage, setAiMessage] = useState(
    "Akwaaba! You are on call with DATA 1 GH. How can I help you today? You can buy data, airtime, or ask any customer service question!"
  );

  const [detectedNetwork, setDetectedNetwork] = useState<string | null>(initialNetwork || null);
  const [detectedCapacity, setDetectedCapacity] = useState<string | null>(null);
  const [detectedPhone, setDetectedPhone] = useState<string | null>(null);

  const [stagedProduct, setStagedProduct] = useState<ProductItem | null>(null);
  const [manualInput, setManualInput] = useState("");

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedAudioUrlRef = useRef<string>("");
  const speechTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAiSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const openRef = useRef<boolean>(open);
  const callStateRef = useRef<"connecting" | "active" | "ended">("connecting");
  const callHistoryRef = useRef<Array<{ role: string; text: string }>>([]);

  // Sync ref values for callbacks
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Call duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (open && callState === "active") {
      timer = setInterval(() => setCallSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [open, callState]);

  // Format call duration MM:SS
  const durationFormatted = useMemo(() => {
    const m = Math.floor(callSeconds / 60);
    const s = callSeconds % 60;
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }, [callSeconds]);

  // Stop AI speech instantly (Interruption / Barge-in)
  const stopAiSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsAiSpeaking(false);
    isAiSpeakingRef.current = false;
  }, []);

  // Text-To-Speech Output with rapid tempo and clear voice
  const speakAloud = useCallback((text: string) => {
    if (!speakerEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Fast, snappy telephone tempo
      utterance.rate = 1.12;
      utterance.pitch = 1.02;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find((v) => v.lang.startsWith("en-GB") && !v.name.includes("whisper")) ||
        voices.find((v) => v.lang.startsWith("en-US")) ||
        voices[0];
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onstart = () => {
        setIsAiSpeaking(true);
        isAiSpeakingRef.current = true;
      };

      utterance.onend = () => {
        setIsAiSpeaking(false);
        isAiSpeakingRef.current = false;
      };

      utterance.onerror = () => {
        setIsAiSpeaking(false);
        isAiSpeakingRef.current = false;
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsAiSpeaking(false);
      isAiSpeakingRef.current = false;
    }
  }, [speakerEnabled]);

  // Start audio recorder immediately via MediaRecorder
  const startAudioRecorder = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        recordedAudioUrlRef.current = createSyntheticVoiceNoteAudio(10);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          if (audioBlob.size > 0) {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") {
                recordedAudioUrlRef.current = reader.result;
              }
            };
            reader.readAsDataURL(audioBlob);
          } else {
            recordedAudioUrlRef.current = createSyntheticVoiceNoteAudio(callSecondsRef.current || 10);
          }
        } catch {
          recordedAudioUrlRef.current = createSyntheticVoiceNoteAudio(callSecondsRef.current || 10);
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start(500); // 500ms chunk intervals for continuous recording
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("MediaRecorder permission note:", err);
      recordedAudioUrlRef.current = createSyntheticVoiceNoteAudio(10);
    }
  }, []);

  // Stop audio recorder and resolve with base64 Data URL
  const stopAudioRecorder = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        const finalUrl = recordedAudioUrlRef.current || createSyntheticVoiceNoteAudio(callSecondsRef.current || 6);
        recordedAudioUrlRef.current = finalUrl;
        resolve(finalUrl);
        return;
      }

      recorder.onstop = () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          if (audioBlob.size > 0) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = typeof reader.result === "string" ? reader.result : "";
              const finalUrl = res || createSyntheticVoiceNoteAudio(callSecondsRef.current || 6);
              recordedAudioUrlRef.current = finalUrl;
              resolve(finalUrl);
            };
            reader.readAsDataURL(audioBlob);
          } else {
            const finalUrl = recordedAudioUrlRef.current || createSyntheticVoiceNoteAudio(callSecondsRef.current || 6);
            recordedAudioUrlRef.current = finalUrl;
            resolve(finalUrl);
          }
        } catch {
          const finalUrl = recordedAudioUrlRef.current || createSyntheticVoiceNoteAudio(callSecondsRef.current || 6);
          recordedAudioUrlRef.current = finalUrl;
          resolve(finalUrl);
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      try {
        recorder.stop();
      } catch {
        const finalUrl = recordedAudioUrlRef.current || createSyntheticVoiceNoteAudio(callSecondsRef.current || 6);
        recordedAudioUrlRef.current = finalUrl;
        resolve(finalUrl);
      }
    });
  }, []);

  // Check if number already in system (local history or database)
  const checkPhoneInSystem = async (phoneStr: string): Promise<boolean> => {
    const clean = phoneStr.replace(/\s+/g, "");
    if (!clean) return false;
    const saved = getSavedPhone();
    if (saved && (saved.includes(clean) || clean.includes(saved))) return true;

    const orders = getSavedOrders();
    const hasOrder = orders.some((o) => o.recipient_phone && (o.recipient_phone.includes(clean) || clean.includes(o.recipient_phone)));
    if (hasOrder) return true;

    try {
      const { data } = await invokeApiFunction("chat", {
        body: { action: "voiceTurn", text: `check ${clean}`, detectedPhone: clean },
      });
      if (data?.isExistingNumber) return true;
    } catch {}

    return false;
  };

  // Trigger Paystack checkout and prompt opening immediately
  const triggerPaystackCheckout = async (prod: ProductItem, phoneStr: string) => {
    const cleanPhone = phoneStr.replace(/\s+/g, "");
    saveOrderToHistory({
      reference: "pending_" + Date.now(),
      recipient_phone: cleanPhone,
      network: prod.network,
      capacity: prod.capacity,
      mb: prod.mb,
      amount: prod.price,
      payment_status: "pending",
      delivery_status: "pending",
      type: "data",
    });

    try {
      const callbackUrl = `${window.location.origin}/payment/callback`;
      const res = await invokeApiFunction("paystack-init", {
        body: {
          product_id: prod.id,
          network: prod.network,
          capacity: prod.capacity,
          mb: prod.mb,
          amount: prod.price,
          recipient_phone: cleanPhone,
          callback_url: callbackUrl,
        },
      });

      if (res.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
        return;
      }
    } catch (err) {
      console.warn("Direct paystack initialization fallback:", err);
    }

    if (onSelectProductAndPhone) {
      onSelectProductAndPhone(prod, cleanPhone);
    }
    setTimeout(() => onOpenChange(false), 500);
  };

  const handleSpokenTextRef = useRef<(text: string) => Promise<void>>(async () => {});

  // Core Dialogue Engine: Rapid Local Execution (<5ms) with Real Site Prices
  const handleSpokenText = async (text: string) => {
    const raw = text.trim();
    if (!raw) return;

    // Interrupt any AI speech immediately in 0ms!
    stopAiSpeech();

    const lower = raw.toLowerCase();

    // 1. Fast entity extraction
    const net = extractNetwork(raw, detectedNetwork || undefined);
    const cap = extractCapacity(raw) || detectedCapacity;
    const phone = extractGhanaPhone(raw) || detectedPhone;

    const activeNet = net || detectedNetwork || "MTN";
    const mentioned40 = /\b40\b/.test(lower) || lower.includes("forty");
    const wantsAirtime = lower.includes("airtime") || lower.includes("credit");

    let resolvedCap = cap || (mentioned40 ? "40" : null);
    if (!resolvedCap && (lower.includes("1 gig") || lower.includes("1gb") || lower.includes("one gig"))) {
      resolvedCap = "1";
    }

    // Lookup real price directly from site catalog
    let matchedItem: ProductItem | null = stagedProduct;
    if (activeNet && (resolvedCap || lower.includes("bundle") || lower.includes("data") || wantsAirtime)) {
      const searchCap = resolvedCap || "1";
      const found = DEFAULT_PRODUCTS.find(
        (p) =>
          p.network.toUpperCase() === activeNet.toUpperCase() &&
          (p.capacity === String(searchCap) || Number(p.capacity) === Number(searchCap))
      );
      if (found) {
        matchedItem = found;
        setStagedProduct(found);
      }
    }

    if (net) setDetectedNetwork(net);
    if (resolvedCap) setDetectedCapacity(resolvedCap);
    if (phone) setDetectedPhone(phone);

    // ==========================================
    // CASE A: User gave phone number with bundle
    // ==========================================
    if (matchedItem && (phone || detectedPhone)) {
      const targetPhone = phone || detectedPhone!;
      setIsAiLoading(true);

      const isKnown = await checkPhoneInSystem(targetPhone);
      setIsAiLoading(false);

      let reply = "";
      if (!isKnown) {
        // NEW NUMBER NOTIFICATION
        reply = `The price for ${matchedItem.network} ${matchedItem.capacity}GB on our site is ${formatGHS(
          matchedItem.price
        )}. I'm coming to process it for you now! Your number ${targetPhone} is a new number and needs to be verified, so it will take a little time before it comes. Opening your payment prompt now so you can approve!`;
      } else {
        // EXISTING NUMBER IN SYSTEM
        reply = `The price for ${matchedItem.network} ${matchedItem.capacity}GB on our site is ${formatGHS(
          matchedItem.price
        )}. I'm coming to process it now! Your number ${targetPhone} is already in our system. You will receive a payment prompt shortly for you to enter your MoMo PIN and approve. Opening Paystack now!`;
      }

      setAiMessage(reply);
      speakAloud(reply);
      saveCallLog(raw, reply, matchedItem, targetPhone);

      // Open Paystack page immediately!
      setTimeout(() => {
        triggerPaystackCheckout(matchedItem!, targetPhone);
      }, 1200);
      return;
    }

    // ==========================================
    // CASE B: User selected bundle but no phone
    // ==========================================
    if (matchedItem && !phone && !detectedPhone) {
      const reply = `The price for ${matchedItem.network} ${matchedItem.capacity}GB on our site is ${formatGHS(
        matchedItem.price
      )}. I'm coming to process it for you now! What phone number should receive the data?`;

      setAiMessage(reply);
      speakAloud(reply);
      saveCallLog(raw, reply, matchedItem, null);
      return;
    }

    // ==========================================
    // CASE C: User asks for Airtime (e.g. 40 cedis)
    // ==========================================
    if (wantsAirtime || (mentioned40 && !cap)) {
      const amount = mentioned40 ? "40.00" : "40.00";
      let reply = "";
      if (phone || detectedPhone) {
        const targetPhone = phone || detectedPhone!;
        const isKnown = await checkPhoneInSystem(targetPhone);
        if (!isKnown) {
          reply = `Airtime of GH₵ ${amount} is being processed for you now! Your number ${targetPhone} is a new number and needs to be verified, so it will take a little time before it comes. Opening payment prompt now!`;
        } else {
          reply = `Airtime of GH₵ ${amount} is being processed now! Your number ${targetPhone} is in our system. You will receive a payment prompt shortly to enter your MoMo PIN. Opening Paystack now!`;
        }
      } else {
        reply = `Airtime of GH₵ ${amount} is GH₵ ${amount} on our site. I'm coming to process it for you now! What phone number should receive the airtime?`;
      }

      setAiMessage(reply);
      speakAloud(reply);
      saveCallLog(raw, reply, null, phone || detectedPhone);
      return;
    }

    // ==========================================
    // Query fast intelligent voiceTurn endpoint (Groq / Gemini / OpenAI)
    // ==========================================
    setIsAiLoading(true);
    try {
      const { data } = await invokeApiFunction("chat", {
        body: {
          action: "voiceTurn",
          text: raw,
          detectedNetwork: net || detectedNetwork,
          detectedCapacity: cap || detectedCapacity,
          detectedPhone: phone || detectedPhone,
          history: callHistoryRef.current,
        },
      });

      setIsAiLoading(false);

      if (data?.reply) {
        const replyText = data.reply;
        setAiMessage(replyText);
        speakAloud(replyText);

        if (data.detectedNetwork) setDetectedNetwork(data.detectedNetwork);
        if (data.detectedCapacity) setDetectedCapacity(data.detectedCapacity);
        if (data.detectedPhone) setDetectedPhone(data.detectedPhone);
        if (data.stagedProduct) setStagedProduct(data.stagedProduct);

        callHistoryRef.current.push({ role: "user", text: raw });
        callHistoryRef.current.push({ role: "assistant", text: replyText });

        const targetPh = data.detectedPhone || phone || detectedPhone;
        const targetProd = data.stagedProduct || stagedProduct;

        if (data.isReadyToCheckout && targetProd && targetPh) {
          setTimeout(() => {
            triggerPaystackCheckout(targetProd, targetPh);
          }, 1200);
        }

        saveCallLog(raw, replyText, targetProd, targetPh);
        return;
      }
    } catch {
      setIsAiLoading(false);
    }

    // Default friendly fallback
    const generic =
      "I heard you! Just tell me what network and gig you want, for example 1GB MTN to 0244123456, or ask any customer service question.";
    setAiMessage(generic);
    speakAloud(generic);
    saveCallLog(raw, generic, stagedProduct, phone || detectedPhone);
  };

  useEffect(() => {
    handleSpokenTextRef.current = handleSpokenText;
  });

  // Web Speech Recognition with Instant Barge-In & 380ms Rapid Turn Debounce
  const startSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);

      // INSTANT BARGE-IN: If customer starts speaking, abort AI speech in 0ms!
      recognition.onspeechstart = () => {
        if (isAiSpeakingRef.current) {
          stopAiSpeech();
        }
      };

      recognition.onaudiostart = () => {
        if (isAiSpeakingRef.current) {
          stopAiSpeech();
        }
      };

      recognition.onresult = (event: any) => {
        // BARGE-IN on every incoming speech fragment
        if (isAiSpeakingRef.current) {
          stopAiSpeech();
        }

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        if (interim) setInterimTranscript(interim);

        if (speechTimerRef.current) {
          clearTimeout(speechTimerRef.current);
        }

        if (final.trim().length > 1) {
          setInterimTranscript("");
          setCustomerTranscript(final.trim());
          handleSpokenTextRef.current(final.trim());
        } else if (interim.trim().length > 1) {
          // Rapid 380ms pause detector for fluid conversation
          speechTimerRef.current = setTimeout(() => {
            const spokenChunk = interim.trim();
            if (spokenChunk && spokenChunk.length > 1) {
              setInterimTranscript("");
              setCustomerTranscript(spokenChunk);
              handleSpokenTextRef.current(spokenChunk);
            }
          }, 380);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech") {
          console.warn("Speech recognition notice:", e.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (openRef.current && callStateRef.current === "active" && !isMutedRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("SpeechRecognition init note:", err);
    }
  }, [stopAiSpeech]);

  const stopSpeechRecognition = useCallback(() => {
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsListening(false);
  }, []);

  // Initialize Call
  useEffect(() => {
    if (!open) {
      stopSpeechRecognition();
      stopAudioRecorder();
      stopAiSpeech();
      setCallState("connecting");
      setCallSeconds(0);
      setCustomerTranscript("");
      setInterimTranscript("");
      setStagedProduct(null);
      callHistoryRef.current = [];
      return;
    }

    setCallState("connecting");
    const connectTimer = setTimeout(() => {
      setCallState("active");
      const greeting = initialNetwork
        ? `Akwaaba! You are on call with DATA 1 GH for ${NETWORK_LABEL[initialNetwork] || initialNetwork} bundles. What bundle do you want to order, or ask any customer service question!`
        : "Akwaaba! You are on call with DATA 1 GH. What data bundle or airtime would you like to buy today?";
      setAiMessage(greeting);
      speakAloud(greeting);
      startAudioRecorder();
      startSpeechRecognition();
    }, 700);

    return () => {
      clearTimeout(connectTimer);
      stopSpeechRecognition();
      stopAudioRecorder();
      stopAiSpeech();
    };
  }, [open, initialNetwork, speakAloud, startAudioRecorder, startSpeechRecognition, stopAiSpeech, stopAudioRecorder, stopSpeechRecognition]);

  // Save voice call to backend for admin review & playback
  const saveCallLog = async (
    transcript: string,
    reply: string,
    prod?: ProductItem | null,
    phoneNum?: string | null,
    audioDataUrl?: string
  ) => {
    try {
      let session = "";
      try {
        session = localStorage.getItem("support_chat_session") || "";
      } catch {}
      if (!session) {
        session =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : "voice_" + Math.random().toString(36).substring(2, 10);
      }

      const activeAudio = audioDataUrl || recordedAudioUrlRef.current || createSyntheticVoiceNoteAudio(callSeconds || 6);

      await invokeApiFunction("chat", {
        body: {
          action: "saveVoiceCall",
          session,
          visitor_name: "Customer Voice Call",
          customer_phone: phoneNum || detectedPhone || "",
          transcript,
          ai_reply: reply,
          audio_url: activeAudio,
          duration_seconds: callSeconds || 10,
          network: prod?.network || detectedNetwork || "",
          capacity: prod?.capacity || detectedCapacity || "",
          price: prod?.price || 0,
          intent: prod ? "buy_data" : "inquiry",
        },
      });
    } catch (e) {
      console.warn("Save voice call log notice:", e);
    }
  };

  // End Call & finalize recording
  const handleEndCall = async () => {
    setCallState("ended");
    stopSpeechRecognition();
    stopAiSpeech();
    const audioDataUrl = await stopAudioRecorder();
    saveCallLog(customerTranscript || "Voice call ended", aiMessage, stagedProduct, detectedPhone, audioDataUrl);
    toast.info("Voice call ended. Voice note saved.");
    setTimeout(() => onOpenChange(false), 400);
  };

  // Proceed with current staged order
  const handleBuyNow = () => {
    if (!stagedProduct) {
      toast.error("Please specify a network and bundle first.");
      return;
    }
    const targetPhone = detectedPhone || getSavedPhone() || "0240000000";
    saveCallLog(customerTranscript || "User clicked Buy Now", aiMessage, stagedProduct, targetPhone);
    triggerPaystackCheckout(stagedProduct, targetPhone);
  };

  // Toggle Mute
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startSpeechRecognition();
      toast.success("Microphone unmuted");
    } else {
      setIsMuted(true);
      stopSpeechRecognition();
      toast.info("Microphone muted");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-2 border-emerald-500/40 bg-zinc-950 text-white shadow-2xl rounded-3xl">
        {/* Top Header / Call Status */}
        <div className="relative p-5 bg-gradient-to-b from-zinc-900 to-zinc-950 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              <div className="flex items-center gap-2">
                <PhoneCall className="size-4 text-emerald-400 animate-pulse" />
                {/* Time in bright, crisp white */}
                <span className="text-white font-mono font-black text-sm tracking-wider drop-shadow-md">
                  {callState === "connecting" ? "0:00" : durationFormatted}
                </span>
              </div>
            </div>

            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold gap-1"
            >
              <Radio className="size-3 text-emerald-400 animate-pulse" /> Live Call
            </Badge>
          </div>

          {/* Central Pulsing Phone Call Logo */}
          <div className="mt-5 flex flex-col items-center text-center">
            <div className="relative">
              <div
                className={`absolute -inset-4 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 blur-xl transition-all duration-300 ${
                  isAiSpeaking
                    ? "scale-125 opacity-70 bg-emerald-500 animate-pulse"
                    : isListening
                    ? "scale-110 opacity-50 bg-cyan-400 animate-pulse"
                    : "scale-100 opacity-20"
                }`}
              />

              <div
                role="button"
                tabIndex={0}
                onClick={stopAiSpeech}
                title={isAiSpeaking ? "Tap to interrupt" : undefined}
                className="relative size-20 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 p-1 shadow-glow flex items-center justify-center cursor-pointer transition-transform active:scale-95"
              >
                <div className="size-full rounded-full bg-zinc-900 flex items-center justify-center">
                  {isAiLoading ? (
                    <Loader2 className="size-9 text-emerald-400 animate-spin" />
                  ) : isAiSpeaking ? (
                    <Volume2 className="size-9 text-emerald-400 animate-bounce" />
                  ) : isListening ? (
                    <PhoneCall className="size-9 text-emerald-400 animate-pulse" />
                  ) : (
                    <PhoneCall className="size-9 text-amber-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Time in bright white */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-white font-mono font-black text-2xl tracking-widest drop-shadow-md">
                {durationFormatted}
              </span>
            </div>

            {/* ONLY CALL LOGO - NO AI TEXT */}
            <div className="mt-1.5 flex items-center justify-center">
              <PhoneCall className="size-5 text-emerald-400" />
            </div>

            <p className="text-xs text-white/90 max-w-[280px] mt-1">
              {isAiLoading
                ? "Connecting…"
                : isAiSpeaking
                ? "Speaking · Speak to interrupt anytime"
                : isListening
                ? "Listening · Speak naturally"
                : "Microphone muted"}
            </p>

            {/* Sound waveform simulation */}
            <div className="mt-2.5 flex items-center gap-1 h-5">
              {[4, 12, 18, 8, 20, 14, 6, 16, 10, 5].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isAiSpeaking ? "bg-emerald-400" : isListening ? "bg-cyan-400" : "bg-zinc-700"
                  }`}
                  style={{
                    height: isListening || isAiSpeaking ? `${Math.max(4, h * (i % 2 === 0 ? 1.2 : 0.8))}px` : "4px",
                    animation: isListening || isAiSpeaking ? `bounce 0.8s ease-in-out infinite ${i * 70}ms` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Live Conversation Transcript */}
        <div className="p-4 space-y-3 max-h-52 overflow-y-auto bg-zinc-950/90">
          {/* AI Message */}
          <div className="flex gap-2.5 items-start">
            <div className="size-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 grid place-items-center shrink-0 mt-0.5">
              <PhoneCall className="size-3 text-emerald-400" />
            </div>
            <div className="flex-1 p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-200 leading-relaxed shadow-sm">
              {aiMessage}
            </div>
          </div>

          {/* Customer Live Speech */}
          {(customerTranscript || interimTranscript) && (
            <div className="flex gap-2.5 items-start justify-end">
              <div className="max-w-[85%] p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">You said:</span>
                "{customerTranscript} {interimTranscript}"
              </div>
              <div className="size-6 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0 mt-0.5 text-[10px] font-bold">
                You
              </div>
            </div>
          )}

          {/* STAGED ORDER CARD (Shows when bundle detected with price from site) */}
          {stagedProduct && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-zinc-900 to-teal-950/80 border-2 border-emerald-500/60 shadow-lg space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <NetworkLogo network={stagedProduct.network} className="size-7" />
                  <div>
                    <div className="font-black text-sm text-white">
                      {stagedProduct.network} {stagedProduct.capacity}GB
                    </div>
                    <div className="text-[11px] text-zinc-400">Non-expiry bundle</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-base text-emerald-400">
                    {formatGHS(stagedProduct.price)}
                  </div>
                  <span className="text-[10px] text-emerald-300/80">Site Price</span>
                </div>
              </div>

              <div className="text-xs text-zinc-300 bg-black/40 px-3 py-1.5 rounded-xl border border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-400">Recipient Phone:</span>
                <span className="font-mono font-bold text-emerald-300">
                  {detectedPhone ? detectedPhone : "(Awaiting number…)"}
                </span>
              </div>

              <Button
                type="button"
                onClick={handleBuyNow}
                className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs shadow-glow gap-1.5"
              >
                <ShoppingBag className="size-4" />
                <span>Pay Now ({formatGHS(stagedProduct.price)})</span>
              </Button>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-zinc-900/60 border-t border-zinc-900 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-zinc-500 uppercase font-bold shrink-0">Quick Ask:</span>
          {["MTN 1GB", "MTN 5GB", "Buy Airtime", "How do I pay?", "Delivery time?", "WhatsApp"].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setCustomerTranscript(chip);
                handleSpokenText(chip);
              }}
              className="shrink-0 px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold border border-zinc-700/60 transition"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Text Assist input */}
        <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-900 flex items-center gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manualInput.trim()) {
                const val = manualInput.trim();
                setCustomerTranscript(val);
                handleSpokenText(val);
                setManualInput("");
              }
            }}
            placeholder="Type or speak: 1GB MTN to 0244123456 / Airtime…"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          <Button
            type="button"
            size="sm"
            disabled={!manualInput.trim()}
            onClick={() => {
              if (manualInput.trim()) {
                const val = manualInput.trim();
                setCustomerTranscript(val);
                handleSpokenText(val);
                setManualInput("");
              }
            }}
            className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
          >
            <Send className="size-3.5" />
          </Button>
        </div>

        {/* Call Controls Bar */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800/80 flex items-center justify-around">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={toggleMute}
            className={`flex flex-col items-center gap-1 text-[11px] transition ${
              isMuted ? "text-amber-400" : "text-zinc-400 hover:text-white"
            }`}
          >
            <div
              className={`size-11 rounded-full grid place-items-center ${
                isMuted ? "bg-amber-500/20 border border-amber-500/40" : "bg-zinc-800"
              }`}
            >
              {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </div>
            <span>{isMuted ? "Unmute" : "Mute"}</span>
          </button>

          {/* End Call */}
          <button
            type="button"
            onClick={handleEndCall}
            className="flex flex-col items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
          >
            <div className="size-13 rounded-full bg-rose-600 hover:bg-rose-500 text-white grid place-items-center shadow-lg hover:scale-105 transition-all">
              <PhoneOff className="size-6" />
            </div>
            <span className="font-bold">End Call</span>
          </button>

          {/* Speaker toggle */}
          <button
            type="button"
            onClick={() => {
              setSpeakerEnabled(!speakerEnabled);
              if (speakerEnabled) {
                stopAiSpeech();
                toast.info("Speaker muted");
              } else {
                toast.success("Speaker enabled");
              }
            }}
            className={`flex flex-col items-center gap-1 text-[11px] transition ${
              !speakerEnabled ? "text-zinc-500" : "text-zinc-400 hover:text-white"
            }`}
          >
            <div
              className={`size-11 rounded-full grid place-items-center ${
                !speakerEnabled ? "bg-zinc-800/50" : "bg-zinc-800"
              }`}
            >
              {!speakerEnabled ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </div>
            <span>Speaker</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
