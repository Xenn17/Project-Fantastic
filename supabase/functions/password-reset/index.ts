// Edge Function: reset password via Resend (tanpa email Supabase Auth).
// Action "request" -> buat token + kirim email lewat Resend.
// Action "confirm" -> validasi token + ubah password lewat admin API.
//
// Secrets: RESEND_API_KEY, RESEND_SENDER, F4NT_SITE_URL
// (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis tersedia.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const escapeHtml = (value: string) =>
  String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const TOKEN_TTL_MINUTES = 60;
const THROTTLE_SECONDS = 60;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function buildHtml(name: string, link: string): string {
  const safe = escapeHtml(name || "Member");
  return `<!doctype html><html lang="id"><body style="margin:0;padding:0;background:#080808;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr><td align="center"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#121212;border:1px solid #cfaa5833;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:34px 38px 10px;text-align:center;"><div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;color:#cfaa58;font-weight:bold;">WE ARE FANTASTIC</div><div style="font-family:Arial,sans-serif;font-size:34px;font-weight:900;color:#f5f3ed;margin-top:6px;">F4NTASTIC</div></td></tr>
      <tr><td style="padding:26px 38px 0;"><div style="font-family:Arial,sans-serif;font-size:25px;font-weight:800;color:#f5f3ed;line-height:1.3;">RESET<br/><span style="color:#cfaa58;">PASSWORD.</span></div></td></tr>
      <tr><td style="padding:18px 38px 0;"><p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#c9c6be;">Halo <strong style="color:#f5f3ed;">${safe}</strong>,</p><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#c9c6be;">Kami menerima permintaan untuk mengganti password akun F4NTASTIC kamu. Klik tombol di bawah untuk membuat password baru. Tautan ini berlaku <strong style="color:#f5f3ed;">${TOKEN_TTL_MINUTES} menit</strong> dan hanya bisa dipakai sekali.</p></td></tr>
      <tr><td style="padding:24px 38px 0;text-align:center;"><a href="${link}" style="display:inline-block;background:#cfaa58;color:#111;font-family:Arial,sans-serif;font-size:14px;font-weight:800;letter-spacing:1px;text-decoration:none;padding:16px 34px;border-radius:6px;">BUAT PASSWORD BARU</a></td></tr>
      <tr><td style="padding:18px 38px 0;text-align:center;"><span style="font-family:Arial,sans-serif;font-size:12px;color:#8f8b82;">Kalau tombol tidak bisa dibuka, salin tautan ini:<br/><a href="${link}" style="color:#cfaa58;word-break:break-all;">${link}</a></span></td></tr>
      <tr><td style="padding:30px 38px 26px;"><div style="border-top:1px solid #ffffff1a;padding-top:22px;font-family:Arial,sans-serif;font-size:11px;line-height:1.7;color:#777;text-align:center;">Kalau kamu tidak meminta reset password, abaikan email ini — password kamu tidak berubah.<br/>Email ini dikirim otomatis oleh sistem F4NTASTIC.</div></td></tr>
    </table></td></tr>
  </table></body></html>`;
}

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Resend gagal (${response.status}): ${JSON.stringify(body) || response.statusText}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, service: "password-reset", version: "v1-resend" });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    if (action === "request") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "INVALID_EMAIL" }, 400);

      // Selalu balas sukses agar tidak membocorkan email terdaftar/tidak.
      const { data: userId } = await admin.rpc("f4_find_user_by_email", { p_email: email });
      if (!userId) return json({ ok: true, sent: false });

      const { data: recent } = await admin
        .from("password_reset_tokens")
        .select("id,created_at")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - THROTTLE_SECONDS * 1000).toISOString())
        .limit(1);
      if (recent?.length) return json({ ok: true, sent: false, throttled: true });

      const resendKey = Deno.env.get("RESEND_API_KEY");
      const sender = Deno.env.get("RESEND_SENDER") || Deno.env.get("EMAIL_FROM") || "";
      if (!resendKey || !sender) return json({ error: "EMAIL_API_NOT_CONFIGURED" }, 500);

      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

      const { error: insertError } = await admin.from("password_reset_tokens").insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (insertError) throw insertError;

      // Bersihkan token lama tanpa menghalangi pengiriman.
      try { await admin.rpc("f4_cleanup_reset_tokens"); } catch (_) {}

      const site = (Deno.env.get("F4NT_SITE_URL") || "https://f4ntastic.com").replace(/\/$/, "");
      const link = `${site}/reset-password.html?token=${token}`;
      const { data: profile } = await admin.from("profiles").select("full_name,username").eq("id", userId).maybeSingle();
      const name = profile?.full_name || profile?.username || "Member";

      await sendViaResend(resendKey, sender, email, "Reset Password F4NTASTIC", buildHtml(name, link));
      return json({ ok: true, sent: true });
    }

    if (action === "confirm") {
      const token = String(body?.token ?? "").trim();
      const password = String(body?.password ?? "");
      if (!token || token.length < 32) return json({ error: "INVALID_TOKEN" }, 400);
      if (password.length < 8) return json({ error: "WEAK_PASSWORD" }, 400);

      const tokenHash = await sha256Hex(token);
      const { data: row } = await admin
        .from("password_reset_tokens")
        .select("id,user_id,expires_at,used_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (!row) return json({ error: "INVALID_TOKEN" }, 400);
      if (row.used_at) return json({ error: "TOKEN_USED" }, 400);
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "TOKEN_EXPIRED" }, 400);

      const { error: updateError } = await admin.auth.admin.updateUserById(row.user_id, { password });
      if (updateError) return json({ error: updateError.message }, 400);

      const { error: markError } = await admin
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      if (markError) console.error("Gagal menandai token terpakai", markError);

      await admin.from("password_reset_tokens").delete().eq("user_id", row.user_id).is("used_at", null);
      return json({ ok: true, reset: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (err) {
    console.error("[password-reset] failed", err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});