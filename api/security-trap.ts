import { getSupabase, setCorsHeaders, sendSecurityAlert } from "./_supabase.js";
import { getClientIp } from "./_firewall.js";

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);

  const supabase = getSupabase();
  const clientIp = getClientIp(req);
  const userAgent = String(req.headers?.["user-agent"] || "");
  const targetUrl = String(req.url || req.query?.probe || "");
  const incidentId = `TRAP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  console.warn(`[SECURITY HONEYPOT TRIGGERED] Attacker from IP ${clientIp} probed ${targetUrl}`);

  // Send immediate high-priority alert to owner
  sendSecurityAlert(supabase, {
    type: "🚨 Malicious Reconnaissance / Exploit Probe",
    endpoint: targetUrl.slice(0, 100),
    ip: clientIp,
    userAgent: userAgent.slice(0, 120),
    details: `Incident ID: ${incidentId}\nAttacker IP: ${clientIp}\nTrap Endpoint: ${targetUrl}\nUser-Agent: ${userAgent.slice(0, 100)}\nThreat: Automated scanner or manual exploit probe trapped and blocked.`,
    severity: "critical",
  }).catch(() => {});

  return res.status(403).json({
    status: "blocked",
    error: "Forbidden: Security violation detected. Your IP and activity have been logged and reported.",
    incident_id: incidentId,
    ip: clientIp,
  });
}
