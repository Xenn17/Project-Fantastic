import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Response(JSON.stringify({ error: "Server configuration missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin
    .from("gallery_photos")
    .select("id, title, description, image_path, sort_order, created_at, category:gallery_categories(name)")
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return new Response(JSON.stringify({ error: "Unable to load published gallery media" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const result = await Promise.all((data ?? []).map(async (photo) => {
    const { data: signed, error: signError } = await admin.storage.from("gallery-photos").createSignedUrl(photo.image_path, 3600);
    if (signError || !signed?.signedUrl) return null;
    const category = Array.isArray(photo.category) ? photo.category[0] : photo.category;
    return {
      id: photo.id,
      title: photo.title,
      description: photo.description ?? "",
      category: category?.name ?? "",
      imageUrl: signed.signedUrl,
      createdAt: photo.created_at,
      sortOrder: photo.sort_order,
    };
  }));

  return new Response(JSON.stringify({ photos: result.filter(Boolean) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
