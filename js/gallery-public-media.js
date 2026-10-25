(() => {
  "use strict";
  const cfg=window.F4_GALLERY_SUPABASE_CONFIG;
  if(!cfg?.url||!cfg?.publishableKey||cfg.publishableKey.includes("ISI_PUBLISHABLE")) return;
  const endpoint=`${cfg.url.replace(/\/$/,"")}/functions/v1/gallery-public-media`;
  window.F4GalleryRemote = {
    async load(){
      const res=await fetch(endpoint,{headers:{"apikey":cfg.publishableKey,"Authorization":`Bearer ${cfg.publishableKey}`}});
      if(!res.ok) throw new Error(`Galeri online belum tersedia (${res.status})`);
      const body=await res.json();
      return Array.isArray(body.photos)?body.photos:[];
    }
  };
})();
