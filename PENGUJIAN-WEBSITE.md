# Catatan eksekusi dan pengujian F4NTASTIC

## Perubahan dalam paket ini
- Persistent login menggunakan sesi Supabase Auth yang disimpan di localStorage, dengan refresh token otomatis.
- Navbar akun sinkron dari sesi Auth, foto avatar, username, label `Member F4NTASTIC`, dropdown Profil Saya/Keluar, serta perilaku menu HP.
- Form DATA DIRI menggunakan upsert terverifikasi sehingga profil yang belum punya baris tidak dianggap sukses palsu.
- Validasi tanggal lahir dan panjang input, status loading, pesan error yang lebih informatif, dan status profil.
- Unggah foto JPG/PNG/WebP maksimal 5 MB, pratinjau, batal pratinjau, sinkron avatar, dan cooldown 24 jam yang ditegakkan trigger database.
- SQL migration memperketat akses tabel profiles, menambahkan fungsi RPC terbatas untuk cek username dan login dengan username, membuat profil saat akun Auth dibuat, mengunci role akun, dan menyiapkan bucket avatar.
- Pendaftaran baru diberi role `member` oleh trigger database. Migrasi juga menaikkan akun `arlec` menjadi `developer` jika username tersebut ada di tabel profiles saat migrasi dijalankan.

## Wajib dilakukan pada Supabase sebelum rilis
1. Cadangkan database dan pastikan proyek Supabase yang dipakai memang proyek F4NTASTIC.
2. Jalankan `supabase-auth.sql` di SQL Editor.
3. Jalankan `supabase-smoke-test.sql`; periksa semua hasil `PASS`, `missing_profile_rows = 0`, dan role akun `arlec`.
4. Jika `arlec` tidak muncul pada hasil, jangan menebak UUID. Periksa identitas akun yang benar di Auth dan tabel profiles terlebih dahulu.
5. Uji dengan akun tes: pendaftaran baru (role Member), login email, login username, pemulihan sesi setelah browser ditutup/dibuka, logout, penyimpanan DATA DIRI, unggah foto, penolakan pergantian foto kedua dalam 24 jam, dan isolasi data dua akun berbeda.
6. Uji login Google di domain produksi yang benar; pastikan redirect URL terdaftar di Supabase Auth.

## Pemeriksaan yang berhasil dilakukan di lingkungan ini
- `node --check` untuk seluruh berkas JavaScript.
- Pemeriksaan 13 halaman HTML: tidak ditemukan referensi lokal hilang atau ID HTML duplikat.
- Pemeriksaan keberadaan skrip lokal dan konsistensi anon key pada modul auth, navbar, dan profil.

## Batas pengujian
Koneksi jaringan dari lingkungan pengerjaan tidak dapat me-resolve host Supabase, sehingga request read-only ke endpoint Auth/RPC menghasilkan HTTP 000. Karena itu database aktif belum bisa dinyatakan lulus uji dari sini; jalankan smoke test SQL di dashboard Supabase sebelum deployment. Jangan pernah menambahkan service-role key ke file frontend.
