import { sendSecurityAlert } from "./_supabase.js";

// Comprehensive signatures for intrusion, RCE, PowerShell, SQLi, and probes
export const INTRUSION_SIGNATURES: {
  category: string;
  pattern: RegExp;
  severity: "critical" | "warning";
}[] = [
  // 1. PowerShell & Windows Command Execution
  {
    category: "PowerShell RCE Injection",
    pattern: /\b(?:powershell(?:\.exe)?|pwsh(?:\.exe)?|invoke-expression|\biex\b|downloadstring|downloadfile|system\.management\.automation|invoke-webrequest|\biwr\b|start-process|set-executionpolicy|new-object\s+net\.webclient|invoke-command|get-process|get-service|get-wmiobject|get-ciminstance|get-content|powershell\s+-[a-zA-Z])\b/i,
    severity: "critical",
  },
  {
    category: "Windows Command Prompt Exploit",
    pattern: /\b(?:cmd(?:\.exe)?\s*\/(?:c|k)|certutil(?:\.exe)?\s*-(?:urlcache|decode|f)|bitsadmin(?:\.exe)?|rundll32(?:\.exe)?|cscript(?:\.exe)?|wscript(?:\.exe)?|regsvr32(?:\.exe)?|vssadmin|wmic(?:\.exe)?|whoami(?:\.exe)?|systeminfo(?:\.exe)?|tasklist(?:\.exe)?|ipconfig\s*\/all|net\s+(?:user|localgroup|share))\b/i,
    severity: "critical",
  },

  // 2. Linux Shell / OS Command Injection
  {
    category: "Unix Shell / Bash Command Injection",
    pattern: /(?:\/bin\/(?:bash|sh|zsh|dash)|(?:^|[;&|`\n])\s*(?:bash|sh|zsh)\s+-c|(?:^|[;&|`\n])\s*(?:curl|wget)\s+https?:\/\/|\|\s*(?:bash|sh|zsh)\b)/i,
    severity: "critical",
  },
  {
    category: "Destructive Command / Reverse Shell",
    pattern: /(?:;\s*(?:rm\s+-rf|cat\s+\/etc|whoami|uname\s+-a|killall|ncat|netcat|nc\s+-e|\/dev\/tcp\/))/i,
    severity: "critical",
  },
  {
    category: "Arbitrary Code Execution (eval/system)",
    pattern: /(?:\b(?:eval|passthru|shell_exec|proc_open|popen|system)\s*\(|child_process(?:\.exec|\.spawn))/i,
    severity: "critical",
  },

  // 3. System Probing & Secret Extraction ("Questioning the System")
  {
    category: "System Probing & Secret Extraction",
    pattern: /(?:\b(?:ignore\s+(?:all\s+)?previous\s+instructions|system\s+prompt|reveal\s+(?:all\s+|your\s+)?(?:secret|password|keys)|dump\s+(?:the\s+)?database|show\s+(?:all\s+)?passwords|what\s+is\s+your\s+system\s+prompt|show\s+me\s+the\s+keys)\b)/i,
    severity: "critical",
  },

  // 4. SQL Injection
  {
    category: "SQL Injection Probe",
    pattern: /(?:\bunion\s+(?:all\s+)?select\b|\b(?:and|or)\s+['"]?1['"]?\s*=\s*['"]?1\b|\bwaitfor\s+delay\b|\bpg_sleep\s*\(|\bbenchmark\s*\(|;\s*drop\s+(?:table|database|schema)\b|information_schema\.(?:tables|columns)|xp_cmdshell)/i,
    severity: "critical",
  },

  // 5. Path Traversal & Sensitive File Harvesting
  {
    category: "Path Traversal Probe",
    pattern: /(?:\.\.[/\\]\.\.[/\\]|\/etc\/(?:passwd|shadow|hosts)|[a-zA-Z]:\\windows\\system32|win\.ini)/i,
    severity: "critical",
  },
  {
    category: "Environment / Secret File Probe",
    pattern: /(?:(?:\/|\b)\.env(?:\.local|\.production|\.backup)?\b|(?:\/|\b)\.git(?:\/|\\|\b)|wp-config\.php|phpmyadmin|actuator\/env|swagger-ui|\/shell\b)/i,
    severity: "critical",
  },
];

// In-memory blocked IPs cache for zero-latency rejection
let memoryBlockedIps = new Set<string>();
let memoryBlockedIpsLoadedAt = 0;
const BLOCKED_IPS_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

export async function loadBlockedIps(supabase: any): Promise<Set<string>> {
  const now = Date.now();
  if (memoryBlockedIps.size > 0 && now - memoryBlockedIpsLoadedAt < BLOCKED_IPS_TTL_MS) {
    return memoryBlockedIps;
  }
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "firewall_blocked_ips")
      .maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        memoryBlockedIps = new Set(parsed.map((ip: any) => String(ip).trim().toLowerCase()));
        memoryBlockedIpsLoadedAt = now;
        return memoryBlockedIps;
      }
    }
  } catch (_) {}
  return memoryBlockedIps;
}

export async function blockClientIp(ip: string, reason: string, supabase: any): Promise<void> {
  const clean = String(ip || "").trim().toLowerCase();
  if (!clean || clean === "unknown ip" || clean === "127.0.0.1" || clean === "::1") return;
  memoryBlockedIps.add(clean);
  try {
    const list = Array.from(memoryBlockedIps);
    await supabase.from("settings").upsert({
      key: "firewall_blocked_ips",
      value: JSON.stringify(list),
    }, { onConflict: "key" });
  } catch (err) {
    console.warn("Failed to persist blocked IP:", err);
  }
}

export async function revokeCompromisedApiKey(rawKey: string, reason: string, supabase: any): Promise<string | null> {
  const clean = String(rawKey || "").trim();
  if (!clean || clean.length < 5) return null;

  try {
    const { data } = await supabase.from("settings").select("value").eq("key", "netflix_partners").maybeSingle();
    if (data?.value) {
      let partners: any[] = [];
      try { partners = JSON.parse(data.value); } catch (_) {}
      if (Array.isArray(partners)) {
        let revokedName: string | null = null;
        partners = partners.map((p: any) => {
          if (p && String(p.api_key || "").trim() === clean) {
            revokedName = p.name || p.id;
            return {
              ...p,
              status: "disabled",
              banned: true,
              banned_at: new Date().toISOString(),
              ban_reason: reason,
            };
          }
          return p;
        });
        if (revokedName) {
          await supabase.from("settings").upsert({
            key: "netflix_partners",
            value: JSON.stringify(partners),
          }, { onConflict: "key" });
          return revokedName;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to revoke compromised API key:", err);
  }
  return null;
}

/**
 * Extracts client IP from request headers
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return (
    req.headers?.["x-real-ip"] ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "Unknown IP"
  );
}

/**
 * Scans incoming request URL, query parameters, body, and headers for intrusion patterns.
 * If an attack pattern is detected:
 * 1. An immediate high-priority security alert is sent to the owner (WhatsApp / SMS)
 * 2. The attacker's IP/Device is permanently blocked
 * 3. Any API key used in the request is instantly revoked and disabled
 * 4. The request is immediately blocked with HTTP 403 Forbidden
 * 5. Returns true (caller should terminate handling)
 */
export async function detectAndBlockIntrusion(
  req: any,
  res: any,
  supabase: any
): Promise<boolean> {
  try {
    const clientIp = getClientIp(req);
    const clientIpLower = clientIp.toLowerCase();

    // 1. FAST CHECK: Drop request immediately if IP is already blacklisted
    const blockedIps = await loadBlockedIps(supabase);
    if (blockedIps.has(clientIpLower)) {
      res.status(403).json({
        status: "blocked",
        error: "Forbidden: Device & IP permanently banned due to security violations.",
        ip: clientIp,
      });
      return true;
    }

    const url = String(req.url || "");
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : req.body && typeof req.body === "object"
        ? JSON.stringify(req.body)
        : "";
    const userAgent = String(req.headers?.["user-agent"] || "");
    const referer = String(req.headers?.["referer"] || "");

    // Combined input string for firewall pattern matching
    const testString = `${url} ${rawBody} ${userAgent} ${referer}`;

    for (const sig of INTRUSION_SIGNATURES) {
      if (sig.pattern.test(testString)) {
        const incidentId = `SEC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        // Truncate suspicious fragment for the alert message
        const match = testString.match(sig.pattern);
        const matchSnippet = match ? match[0].slice(0, 100) : "Attack pattern matched";

        // Extract API key if request contained one
        const apiKey =
          req.headers?.["x-api-key"] ||
          req.headers?.["x-partner-key"] ||
          req.headers?.["authorization"] ||
          req.query?.api_key ||
          (req.body && typeof req.body === "object" ? req.body.api_key : "") ||
          "";

        console.warn(`[SECURITY FIREWALL] Blocked ${sig.category} from ${clientIp} on ${url}`);

        // 2. Auto-Block Attacker IP permanently
        await blockClientIp(clientIp, `${sig.category}: ${matchSnippet}`, supabase);

        // 3. Auto-Revoke Compromised API key if provided
        let revokedPartner: string | null = null;
        if (apiKey) {
          revokedPartner = await revokeCompromisedApiKey(apiKey, `Auto-revoked: ${sig.category}`, supabase);
        }

        // 4. Trigger immediate high-priority alert to owner via SMS & WhatsApp
        let alertDetails = `Incident ID: ${incidentId}\nAttacker IP: ${clientIp} (PERMANENTLY BLOCKED)\nThreat: ${sig.category}\nTarget: ${url.slice(0, 80)}\nTrigger: "${matchSnippet}"\nUser-Agent: ${userAgent.slice(0, 80)}`;
        if (revokedPartner) {
          alertDetails += `\n⚠️ COMPROMISED API KEY REVOKED: Partner "${revokedPartner}" has been disabled immediately!`;
        } else if (apiKey) {
          alertDetails += `\n⚠️ API Key Detected in Attack: "${String(apiKey).slice(0, 15)}..." (Access Revoked)`;
        }

        sendSecurityAlert(supabase, {
          type: `🚨 FIREWALL AUTO-BAN: ${sig.category}`,
          endpoint: url.slice(0, 100),
          ip: clientIp,
          userAgent: userAgent.slice(0, 120),
          details: alertDetails,
          severity: sig.severity,
        }).catch((err: any) => {
          console.error("Failed to dispatch security alert:", err);
        });

        // 5. Block with 403 Forbidden
        res.status(403).json({
          status: "blocked",
          error: "Forbidden: Security violation detected by System Firewall. Your IP has been permanently blacklisted and the session terminated.",
          threat: sig.category,
          incident_id: incidentId,
          ip_blocked: true,
          api_key_revoked: Boolean(apiKey),
          timestamp: new Date().toISOString(),
        });

        return true;
      }
    }
  } catch (err) {
    console.error("Firewall inspection error:", err);
  }

  return false;
}
