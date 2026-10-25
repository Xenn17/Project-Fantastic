/* Gallery memakai project Supabase F4NTASTIC utama. Jangan masukkan Secret/service_role. */
window.F4_GALLERY_SUPABASE_CONFIG = {
  url: "https://uxkieyunztzhiwrocnei.supabase.co",
  publishableKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4a2lleXVuenR6aGl3cm9jbmVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMDQwODIsImV4cCI6MjEwNzg4MDA4Mn0.nlWhlGbagxwZ2-XeHEa195n5sQmRtXn3xutTISDXR70",
};

window.F4GalleryClient = window.F4GalleryClient || null;
window.getF4GalleryClient = function(){
  if (!window.F4GalleryClient && window.supabase && window.F4_GALLERY_SUPABASE_CONFIG?.url && window.F4_GALLERY_SUPABASE_CONFIG?.publishableKey) {
    window.F4GalleryClient = window.supabase.createClient(window.F4_GALLERY_SUPABASE_CONFIG.url, window.F4_GALLERY_SUPABASE_CONFIG.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  return window.F4GalleryClient;
};
