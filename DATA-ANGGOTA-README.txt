F4NTASTIC DIVISION DIRECTORY — IMPOR DATA ANGGOTA

1. Data anggota 14 divisi ada di data/division-members-seed.json dan data/division-members.js.
2. directory.html memuat seed anggota lokal agar daftar anggota tidak kosong saat database belum di-seed.
3. Untuk Supabase, jalankan supabase-divisions.sql terlebih dahulu (jika belum), lalu supabase-division-members-seed.sql.
4. Data yang tidak bisa dimasukkan ke tabel karena ID kosong, ID ML duplikat global, atau lebih dari dua role tetap disimpan di data/division-members-review.json dan seed lokal. Jangan mengarang nilai pengganti.
5. Divisi 09: baris Piakk dipertahankan sebagai anggota dari sumber; Leader Piakk juga tetap ada di metadata, perlu konfirmasi apakah baris itu identitas Leader.
6. Beberapa kapasitas/jumlah anggota sumber tidak cocok. Nilai kapasitas roster tetap dipertahankan di data/divisions.js; jumlah anggota yang ditampilkan dari daftar aktual dapat berbeda.
7. SQL belum dijalankan pada project Supabase pengguna.
