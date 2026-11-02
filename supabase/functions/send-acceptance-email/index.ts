// Edge Function: kirim email hasil seleksi ke pendaftar Join Team.
// Dipanggil dari js/admin.js setelah admin klik TERIMA (kind=accept) atau
// TOLAK (kind=reject).
//
// PENTING: Supabase Edge Function TIDAK bisa membuka koneksi TCP/SMTP keluar
// (batasan platform), jadi email dikirim lewat HTTP API provider email.
//
// Pilih salah satu provider (yang sudah punya akun/bisa dibuat):
//   A. Resend  -> set secret RESEND_API_KEY       (https://resend.com)
//   B. Brevo   -> set secret BREVO_API_KEY        (https://brevo.com)
//
// Secrets lainnya:
//   RESEND_SENDER = "F4NTASTIC <no-reply@domainmu.com>"  (email dari domain
//                  yang sudah diverifikasi di provider)
//   F4NT_CALON_GROUP_LINK = link grup WhatsApp calon member (opsional)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CALON_GROUP_LINK = "https://chat.whatsapp.com/Cizpou7hMTOHCoe4Aaz6vI";

const escapeHtml = (value: string) =>
  String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function buildRejectHtml(name: string): string {
  const safe = escapeHtml(name);
  return `<!doctype html><html lang="id"><body style="margin:0;padding:0;background:#080808;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr><td align="center"><table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#121212;border:1px solid #ffffff1c;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:34px 38px 10px;text-align:center;"><div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;color:#cfaa58;font-weight:bold;">WE ARE FANTASTIC</div><div style="font-family:Arial,sans-serif;font-size:34px;font-weight:900;color:#f5f3ed;margin-top:6px;">F4NTASTIC</div></td></tr>
      <tr><td style="padding:26px 38px 0;"><div style="font-family:Arial,sans-serif;font-size:25px;font-weight:800;color:#f5f3ed;line-height:1.3;">UPDATE<br/><span style="color:#cfaa58;">SELEKSI TEAM.</span></div></td></tr>
      <tr><td style="padding:18px 38px 0;"><p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#c9c6be;">Halo <strong style="color:#f5f3ed;">${safe}</strong>,</p><p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#c9c6be;">Terima kasih sudah meluangkan waktu untuk mendaftar dan mempercayakan proses seleksi kepada F4NTASTIC.</p><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#c9c6be;">Setelah kami meninjau data pendaftaranmu, untuk saat ini kami belum dapat melanjutkanmu ke tahap berikutnya karena belum sesuai dengan kriteria yang dibutuhkan.</p></td></tr>
      <tr><td style="padding:22px 38px 0;"><div style="padding:16px;border-left:2px solid #cfaa58;background:#cfaa580d;font-family:Arial,sans-serif;font-size:12px;line-height:1.7;color:#99958c;">Jangan berkecil hati. Tetap semangat berkembang dan jangan ragu untuk mencoba lagi di kesempatan berikutnya.</div></td></tr>
      <tr><td style="padding:30px 38px 26px;"><div style="border-top:1px solid #ffffff1a;padding-top:22px;font-family:Arial,sans-serif;font-size:11px;line-height:1.7;color:#777;text-align:center;">Terima kasih sudah menjadi bagian dari cerita F4NTASTIC.<br/>Email ini dikirim otomatis oleh sistem F4NTASTIC.</div></td></tr>
    </table></td></tr>
  </table></body></html>`;
}

function buildHtml(name: string, link: string): string {
  const safe = escapeHtml(name);
  return `<!doctype html><html lang="id"><body style="margin:0;padding:0;background:#080808;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#121212;border:1px solid #cfaa5833;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:34px 38px 10px;text-align:center;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:4px;color:#cfaa58;font-weight:bold;">WE ARE FANTASTIC</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:900;color:#f5f3ed;letter-spacing:1px;margin-top:6px;">F4NTASTIC</div>
        </td></tr>
        <tr><td style="padding:26px 38px 0;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;color:#f5f3ed;line-height:1.3;">SELAMAT,<br/><span style="color:#cfaa58;">KAMU DITERIMA!</span></div>
        </td></tr>
        <tr><td style="padding:18px 38px 0;">
          <p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:#c9c6be;">Halo <strong style="color:#f5f3ed;">${safe}</strong>,</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:#c9c6be;">Kabar baik! Pendaftaranmu di F4NTASTIC sudah kami tinjau dan <strong style="color:#cfaa58;">kamu diterima</strong> sebagai calon member. Langkah selanjutnya: masuk ke grup <strong style="color:#f5f3ed;">Calon Member</strong> lewat tautan di bawah ini.</p>
        </td></tr>
        <tr><td style="padding:24px 38px 0;text-align:center;">
          <a href="${link}" style="display:inline-block;background:#cfaa58;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:1px;text-decoration:none;padding:16px 34px;border-radius:6px;">MASUK GRUP CALON MEMBER</a>
        </td></tr>
        <tr><td style="padding:18px 38px 0;text-align:center;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8f8b82;">Tautan tidak bisa diklik? Buka link ini:<br/><a href="${link}" style="color:#cfaa58;word-break:break-all;">${link}</a></span>
        </td></tr>
        <tr><td style="padding:30px 38px 26px;">
          <div style="border-top:1px solid #ffffff1a;padding-top:22px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.7;color:#777;text-align:center;">Setelah masuk grup: baca peraturan, perkenalkan diri, dan siapkan MRO.<br/>Email ini dikirim otomatis oleh sistem F4NTASTIC.</div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

/** Kirim email via Resend HTTP API. */
async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Resend gagal (${response.status}): ${JSON.stringify(body) || response.statusText}`);
}

/** Kirim email via Brevo HTTP API. */
async function sendViaBrevo(apiKey: string, fromEmail: string, fromName: string, to: string, subject: string, html: string): Promise<void> {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: fromName || "F4NTASTIC", email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Brevo gagal (${response.status}): ${JSON.stringify(body) || response.statusText}`);
}

/** Ambil bagian email dari "Nama <email@domain.com>". */
function extractSender(sender: string): { name: string; email: string } {
  const match = String(sender || "").match(/^(.*?)<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: "F4NTASTIC", email: String(sender || "").trim() };
}

Deno.serve(async (req) => {
  console.log("[send-acceptance-email] invoked", req.method);
  // Catatan: status 204 tidak boleh punya body, jika tidak Response() melempar error.
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  // Probe versi: GET untuk memastikan function yang aktif adalah kode terbaru.
  if (req.method === "GET") return json({ ok: true, service: "send-acceptance-email", version: "v5-accept-reject" });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "UNAUTHORIZED" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "UNAUTHORIZED" }, 401);

    // Hanya staff (admin/developer/owner) yang boleh memicu pengiriman.
    const { data: profile } = await supabase.from("profiles").select("role,roles").eq("id", user.id).maybeSingle();
    const roles = [...(profile?.roles ?? []), profile?.role ?? ""].map(r => String(r).toLowerCase());
    if (!["admin", "developer", "owner"].some(r => roles.includes(r))) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json();
    const appId = String(body?.application_id ?? "");
    const kind = body?.kind === "reject" ? "reject" : "accept";
    if (!appId) return json({ error: "MISSING_APPLICATION_ID" }, 400);

    const { data: app } = await supabase
      .from("applications")
      .select("id,name,ign,email,status")
      .eq("id", appId)
      .maybeSingle();
    if (!app) return json({ error: "NOT_FOUND" }, 404);
    if (app.status === "accepted" || app.status === "rejected") return json({ ok: true, skipped: true });

    const to = String(app.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: "NO_EMAIL" }, 400);

    const applicantName = app.name || app.ign || "Calon Member";
    const subject = kind === "accept" ? "Selamat, kamu diterima di F4NTASTIC!" : "Update Seleksi F4NTASTIC";
    const html = kind === "accept"
      ? buildHtml(applicantName, Deno.env.get("F4NT_CALON_GROUP_LINK") || CALON_GROUP_LINK)
      : buildRejectHtml(applicantName);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const brevoKey = Deno.env.get("BREVO_API_KEY");

    if (resendKey) {
      const sender = Deno.env.get("RESEND_SENDER") || Deno.env.get("EMAIL_FROM") || "";
      if (!sender) return json({ error: "RESEND_SENDER_NEEDED" }, 500);
      await sendViaResend(resendKey, sender, to, subject, html);
    } else if (brevoKey) {
      const sender = Deno.env.get("EMAIL_FROM") || "no-reply@" + (Deno.env.get("BREVO_SENDER_DOMAIN") || "f4ntastic.com");
      const { name, email } = extractSender(sender);
      if (!email) return json({ error: "EMAIL_FROM_NEEDED" }, 500);
      await sendViaBrevo(brevoKey, email, name, to, subject, html);
    } else {
      return json({ error: "EMAIL_API_NOT_CONFIGURED" }, 500);
    }

    return json({ ok: true, sent: true, to });
  } catch (err) {
    console.error("[send-acceptance-email] failed", err);
    return json({ error: String(err?.message ?? err) }, 500);
  }
});