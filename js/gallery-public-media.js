(() => {
  "use strict";
  const cfg = window.F4_GALLERY_SUPABASE_CONFIG;
  if (!cfg?.url || !cfg?.publishableKey || cfg.publishableKey.includes("ISI_PUBLISHABLE")) return;
  const base = cfg.url.replace(/\/$/, "");
  window.F4GalleryRemote = {
    async load() {
      const headers = { apikey: cfg.publishableKey, Authorization: `Bearer ${cfg.publishableKey}` };
      const selects = ["id,label,title,description,image_path,media_type,created_at,sort_order,category:gallery_categories(name)", "id,title,description,image_path,created_at,sort_order,category:gallery_categories(name)"];
      let rows = null, lastStatus = 0;
      for (const select of selects) { const query = `${base}/rest/v1/gallery_photos?select=${select}&is_published=eq.true&order=sort_order.asc,created_at.desc`; const res = await fetch(query, { headers }); lastStatus = res.status; if (res.ok) { rows = await res.json(); break; } }
      if (!rows) throw new Error(`Galeri online belum tersedia (${lastStatus})`);
      return (rows || []).map(photo => {
        const category = Array.isArray(photo.category) ? photo.category[0] : photo.category;
        return { id: photo.id, title: photo.title, description: photo.description || "", category: category?.name || "", imageUrl: `${base}/storage/v1/object/public/gallery-photos/${encodeURIComponent(photo.image_path).replace(/%2F/g, "/")}`, mediaType: photo.media_type || "image", label: photo.label || category?.name || "", createdAt: photo.created_at, sortOrder: photo.sort_order };
      });
    }
  };
})();
