import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const CALON_GROUP_LINK = "https://chat.whatsapp.com/Cizpou7hMTOHCoe4Aaz6vI";

const escapeHtml = (value: string) =>
  String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 204 });
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
    if (!appId) return json({ error: "MISSING_APPLICATION_ID" }, 400);

    const { data: app } = await supabase
      .from("applications")
      .select("id,name,ign,email,status")
      .eq("id", appId)
      .maybeSingle();
    if (!app) return json({ error: "NOT_FOUND" }, 404);
    if (app.status === "accepted") return json({ ok: true, skipped: true });

    const to = String(app.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json({ error: "NO_EMAIL" }, 400);

    const host = Deno.env.get("SMTP_HOST");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASSWORD");
    if (!host || !smtpUser || !smtpPass) return json({ error: "SMTP_NOT_CONFIGURED" }, 500);

    const secure = Deno.env.get("SMTP_SECURE") !== "false";
    const port = Number(Deno.env.get("SMTP_PORT") ?? (secure ? 465 : 587));
    const from = Deno.env.get("SMTP_FROM") || smtpUser;
    const link = Deno.env.get("F4NT_CALON_GROUP_LINK") || CALON_GROUP_LINK;

    const client = new SmtpClient();
    if (secure) {
      await client.connectTLS({ hostname: host, port, username: smtpUser, password: smtpPass });
    } else {
      await client.connect({ hostname: host, port, username: smtpUser, password: smtpPass });
    }
    await client.send({
      from,
      to: [to],
      subject: "Selamat, kamu diterima di F4NTASTIC! 🎉",
      html: buildHtml(app.name || app.ign || "Calon Member", link),
    });
    await client.close();

    return json({ ok: true, sent: true, to });
  } catch (err) {
    return json({ error: String(err?.message ?? err) }, 500);
  }
});