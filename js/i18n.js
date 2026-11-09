(() => {
  "use strict";
  const STORAGE_KEY = "f4ntastic-language";
  const supported = ["id", "en", "th"];
  const translations = {
    Layanan: { en: "Services", th: "บริการ" },
    "Info JOKI": { en: "JOKI Service", th: "บริการรับจ้างเล่น" },
    "Jual Beli Akun ML": {
      en: "ML Account Marketplace",
      th: "ซื้อขายบัญชี ML",
    },
    "Paid Edit Konten Video": {
      en: "Paid Video Editing",
      th: "รับตัดต่อวิดีโอ",
    },
    Home: { en: "Home", th: "หน้าแรก" },
    Tentang: { en: "About", th: "เกี่ยวกับเรา" },
    Galeri: { en: "Gallery", th: "แกลเลอรี" },
    Promosi: { en: "Promotion", th: "โปรโมชัน" },
    "Join Team": { en: "Join Team", th: "เข้าร่วมทีม" },
    Posko: { en: "Support", th: "ศูนย์ช่วยเหลือ" },
    "Hubungi Kami": { en: "Contact Us", th: "ติดต่อเรา" },
    Masuk: { en: "Log in", th: "เข้าสู่ระบบ" },
    Daftar: { en: "Register", th: "สมัครสมาชิก" },
    "Kembali ke login": { en: "Back to login", th: "กลับไปเข้าสู่ระบบ" },
    "KEMBALI KE LOGIN": { en: "BACK TO LOGIN", th: "กลับไปเข้าสู่ระบบ" },
    "KEMBALI KE ATAS": { en: "BACK TO TOP", th: "กลับขึ้นด้านบน" },
    "KEMBALI KE GALERI": { en: "BACK TO GALLERY", th: "กลับไปแกลเลอรี" },
    "Kategori sebelumnya": { en: "Previous category", th: "หมวดหมู่ก่อนหน้า" },
    "Kategori berikutnya": { en: "Next category", th: "หมวดหมู่ถัดไป" },
    "TAMBAH KATEGORI": { en: "ADD CATEGORY", th: "เพิ่มหมวดหมู่" },
    "TAMBAH ALBUM": { en: "ADD ALBUM", th: "เพิ่มอัลบั้ม" },
    "Tambah kategori": { en: "Add category", th: "เพิ่มหมวดหมู่" },
    "Tambah foto ke kategori": {
      en: "Add photo to category",
      th: "เพิ่มรูปภาพในหมวดหมู่",
    },
    "SIMPAN KATEGORI": { en: "SAVE CATEGORY", th: "บันทึกหมวดหมู่" },
    "SIMPAN PERUBAHAN": { en: "SAVE CHANGES", th: "บันทึกการเปลี่ยนแปลง" },
    "UPLOAD FOTO": { en: "UPLOAD PHOTO", th: "อัปโหลดรูปภาพ" },
    "SIMPAN & PUBLIKASIKAN": { en: "SAVE & PUBLISH", th: "บันทึกและเผยแพร่" },
    "HAPUS KATEGORI": { en: "DELETE CATEGORY", th: "ลบหมวดหมู่" },
    "HAPUS ALBUM": { en: "DELETE ALBUM", th: "ลบอัลบั้ม" },
    "Label kategori": { en: "Category label", th: "ป้ายกำกับหมวดหมู่" },
    "Nama kategori": { en: "Category name", th: "ชื่อหมวดหมู่" },
    "Deskripsi kategori": {
      en: "Category description",
      th: "คำอธิบายหมวดหมู่",
    },
    Kategori: { en: "Category", th: "หมวดหมู่" },
    Judul: { en: "Title", th: "ชื่อเรื่อง" },
    Deskripsi: { en: "Description", th: "คำอธิบาย" },
    "File foto": { en: "Photo file", th: "ไฟล์รูปภาพ" },
    "Belum ada media di galeri.": {
      en: "There is no media in the gallery yet.",
      th: "ยังไม่มีสื่อในแกลเลอรี",
    },
    "Belum ada media di kategori ini.": {
      en: "There is no media in this category yet.",
      th: "ยังไม่มีสื่อในหมวดหมู่นี้",
    },
    "Semua cerita, dalam satu bingkai. Tanpa filter, tanpa batas kategori.": {
      en: "Every story in one frame. No filters, no category limits.",
      th: "ทุกเรื่องราวในกรอบเดียว ไร้ฟิลเตอร์ ไร้ข้อจำกัดของหมวดหมู่",
    },
    "Lima bab perjalanan. Satu keluarga. Satu cerita.": {
      en: "Five chapters of our journey. One family. One story.",
      th: "ห้าบทของการเดินทาง หนึ่งครอบครัว หนึ่งเรื่องราว",
    },
    "Setiap pencapaian punya cerita. Setiap kenangan menyatukan kita.": {
      en: "Every achievement has a story. Every memory brings us together.",
      th: "ทุกความสำเร็จมีเรื่องราว ทุกความทรงจำทำให้เราใกล้ชิดกัน",
    },
    "Ikuti perjalanan keluarga F4NTASTIC dan jadilah bagian dari cerita berikutnya.":
      {
        en: "Follow the F4NTASTIC family journey and become part of the next story.",
        th: "ติดตามการเดินทางของครอบครัว F4NTASTIC และเป็นส่วนหนึ่งของเรื่องราวบทต่อไป",
      },
    "WE ARE F4NTASTIC, WE ARE FAMILY.": {
      en: "WE ARE F4NTASTIC, WE ARE FAMILY.",
      th: "WE ARE F4NTASTIC, WE ARE FAMILY.",
    },
    "Buat akun": { en: "Create account", th: "สร้างบัญชี" },
    "Buat password baru": {
      en: "Create a new password",
      th: "สร้างรหัสผ่านใหม่",
    },
    Email: { en: "Email", th: "อีเมล" },
    Password: { en: "Password", th: "รหัสผ่าน" },
    "Nama lengkap": { en: "Full name", th: "ชื่อเต็ม" },
    Username: { en: "Username", th: "ชื่อผู้ใช้" },
    Simpan: { en: "Save", th: "บันทึก" },
    Batal: { en: "Cancel", th: "ยกเลิก" },
    Batalkan: { en: "Cancel", th: "ยกเลิก" },
    Setuju: { en: "Agree", th: "ยอมรับ" },
    "Kirim Pendaftaran": { en: "Submit application", th: "ส่งใบสมัคร" },
    "DAFTAR AKUN": { en: "REGISTER ACCOUNT", th: "สมัครบัญชี" },
    "LOGIN DULU": { en: "LOG IN FIRST", th: "เข้าสู่ระบบก่อน" },
    "Aturan Dasar": { en: "Basic Rules", th: "กฎพื้นฐาน" },
    "Aturan bermain": { en: "Gaming rules", th: "กฎการเล่นเกม" },
    "Identitas squad:": { en: "Squad identity:", th: "อัตลักษณ์ของสควอด:" },
    "Dilarang berjualan": { en: "Selling is not allowed", th: "ห้ามซื้อขาย" },
    "Dilarang toxic, blame, dan saling menyalahkan.": {
      en: "Toxic behavior, blame, and finger-pointing are not allowed.",
      th: "ห้ามใช้คำพูดรุนแรง โทษผู้อื่น หรือกล่าวโทษกัน",
    },
    "Dilarang drama, bullying, mengolok-olok, dan perundungan": {
      en: "Drama, bullying, mocking, and harassment are not allowed.",
      th: "ห้ามสร้างดราม่า กลั่นแกล้ง ล้อเลียน หรือคุกคาม",
    },
    "Dilarang AFK, troll, bermain di luar role, atau coba-coba hero": {
      en: "No AFK, trolling, playing outside your role, or testing heroes during team play.",
      th: "ห้าม AFK ก่อกวน เล่นนอกตำแหน่ง หรือทดลองฮีโร่ระหว่างเล่นทีม",
    },
    "Wajib on mic": { en: "Mic is required", th: "ต้องเปิดไมค์" },
    "Member baru wajib MRO": {
      en: "New members must complete MRO",
      th: "สมาชิกใหม่ต้องทำ MRO",
    },
    "BEBAS MABAR": {
      en: "PLAY TOGETHER FREELY",
      th: "เล่นด้วยกันได้อย่างอิสระ",
    },
    "ANTI CIRCLE-CIRCLEAN": {
      en: "NO EXCLUSIVE CIRCLES",
      th: "ไม่แบ่งกลุ่มกีดกัน",
    },
    "CHAT ALL INGAME": { en: "IN-GAME ALL CHAT", th: "แชท All ในเกม" },
    "PENGADUAN.": { en: "SUPPORT.", th: "ศูนย์ช่วยเหลือ" },
    "BUKA POSKO PENGADUAN": {
      en: "OPEN SUPPORT CENTER",
      th: "เปิดศูนย์ช่วยเหลือ",
    },
    "LIHAT GALERI": { en: "VIEW GALLERY", th: "ดูแกลเลอรี" },
    "Jelajahi F4NTASTIC": { en: "Explore F4NTASTIC", th: "สำรวจ F4NTASTIC" },
    "Temukan kami": { en: "Find us", th: "พบกับเรา" },
    "HUBUNGI VIA WHATSAPP": {
      en: "CONTACT VIA WHATSAPP",
      th: "ติดต่อผ่าน WhatsApp",
    },
    Keluar: { en: "Log out", th: "ออกจากระบบ" },
    Profil: { en: "Profile", th: "โปรไฟล์" },
    "Belum diisi": { en: "Not filled in", th: "ยังไม่ได้กรอก" },
    "Belum terlihat akhir-akhir ini.": {
      en: "Not seen recently.",
      th: "ไม่มีการใช้งานล่าสุด",
    },
    "Hanya member F4NTASTIC yang dapat menggunakan Posko Pengaduan.": {
      en: "Only F4NTASTIC members can use the support center.",
      th: "เฉพาะสมาชิก F4NTASTIC เท่านั้นที่ใช้ศูนย์ช่วยเหลือได้",
    },
    "Belum ada laporan dari kamu. Ketika kamu mengirim, riwayatnya muncul di sini.":
      {
        en: "You have no reports yet. Your history will appear here after you submit one.",
        th: "ยังไม่มีรายงานของคุณ ประวัติจะแสดงที่นี่เมื่อคุณส่งรายงาน",
      },
    "Masukkan email terlebih dahulu.": {
      en: "Enter your email first.",
      th: "กรุณากรอกอีเมลก่อน",
    },
    "Layanan email belum dikonfigurasi. Hubungi admin F4NTASTIC.": {
      en: "Email service is not configured yet. Contact a F4NTASTIC admin.",
      th: "ยังไม่ได้ตั้งค่าบริการอีเมล โปรดติดต่อผู้ดูแล F4NTASTIC",
    },
    "Koleksi media F4NTASTIC.": {
      en: "F4NTASTIC media collection.",
      th: "คอลเลกชันสื่อของ F4NTASTIC",
    },
    "MOBILE LEGENDS COMMUNITY": {
      en: "MOBILE LEGENDS COMMUNITY",
      th: "คอมมูนิตี้ MOBILE LEGENDS",
    },
    "Jelajahi F4NTASTIC": { en: "Explore F4NTASTIC", th: "สำรวจ F4NTASTIC" },
    "Temukan kami": { en: "Find us", th: "พบกับเรา" },
    "OUR STORY / 01": { en: "OUR STORY / 01", th: "เรื่องราวของเรา / 01" },
    "BERAWAL DARI": { en: "BEGINNING WITH", th: "เริ่มต้นจาก" },
    "KEBERSAMAAN.": { en: "TOGETHERNESS.", th: "ความผูกพัน" },
    "OUR JOURNEY": { en: "OUR JOURNEY", th: "การเดินทางของเรา" },
    "Dari lima orang, lahir sebuah perjalanan besar. Dari sebuah tujuan, tumbuh sebuah keluarga.":
      {
        en: "From five people, a great journey began. From one purpose, a family grew.",
        th: "จากคนห้าคน สู่การเดินทางครั้งยิ่งใหญ่ จากเป้าหมายหนึ่งเดียว สู่ครอบครัวที่เติบโต",
      },
    "OUR VISUAL EVOLUTION / 02": {
      en: "OUR VISUAL EVOLUTION / 02",
      th: "พัฒนาการด้านภาพลักษณ์ / 02",
    },
    IDENTITAS: { en: "AN IDENTITY", th: "อัตลักษณ์" },
    "YANG BEREVOLUSI.": { en: "THAT EVOLVES.", th: "ที่เปลี่ยนแปลงไป" },
    "Logo dapat berkembang, sementara nilai dan persaudaraan F4NTASTIC tetap dijaga.":
      {
        en: "Our logo can evolve while F4NTASTIC values and brotherhood remain protected.",
        th: "โลโก้ของเราเปลี่ยนแปลงได้ แต่คุณค่าและมิตรภาพของ F4NTASTIC ยังคงเดิม",
      },
    "ANGGOTA AKTIF": { en: "ACTIVE MEMBERS", th: "สมาชิกที่ใช้งานอยู่" },
    "TOTAL DIVISI SQUAD": {
      en: "TOTAL SQUAD DIVISIONS",
      th: "จำนวนดิวิชันสควอดทั้งหมด",
    },
    "Sertifikat Turnament": {
      en: "Tournament Certificates",
      th: "ใบรับรองการแข่งขัน",
    },
    "WHAT WE STAND FOR / 02": {
      en: "WHAT WE STAND FOR / 02",
      th: "สิ่งที่เรายึดมั่น / 02",
    },
    "LEBIH DARI": { en: "MORE THAN", th: "มากกว่า" },
    "SEKADAR GAME.": { en: "JUST A GAME.", th: "แค่เกม" },
    "01 / THE BEGINNING": { en: "01 / THE BEGINNING", th: "01 / จุดเริ่มต้น" },
    "SEBUAH TIM.": { en: "A TEAM.", th: "ทีมหนึ่งทีม" },
    "Fondasi yang menjaga F4NTASTIC tetap tumbuh tanpa melupakan alasan kami memulai.":
      {
        en: "The foundation that keeps F4NTASTIC growing without forgetting why we began.",
        th: "รากฐานที่ทำให้ F4NTASTIC เติบโต โดยไม่ลืมเหตุผลที่เราเริ่มต้น",
      },
    "Visi F4NTASTIC": { en: "F4NTASTIC Vision", th: "วิสัยทัศน์ F4NTASTIC" },
    "Five values.": { en: "Five values.", th: "ห้าคุณค่า" },
    "One family.": { en: "One family.", th: "หนึ่งครอบครัว" },
    "MEET THE": { en: "MEET THE", th: "พบกับ" },
    "FOUNDER.": { en: "FOUNDER.", th: "ผู้ก่อตั้ง" },
    "FOTO FOUNDER": { en: "FOUNDER PHOTO", th: "รูปผู้ก่อตั้ง" },
    "Tambahkan foto melalui data.js": {
      en: "Add a photo through data.js",
      th: "เพิ่มรูปภาพผ่าน data.js",
    },
    "FOUNDING SPIRIT": { en: "FOUNDING SPIRIT", th: "จิตวิญญาณผู้ก่อตั้ง" },
    "THE PEOPLE WHO KEEP US MOVING / 04": {
      en: "THE PEOPLE WHO KEEP US MOVING / 04",
      th: "ผู้คนที่ทำให้เราเดินหน้าต่อ / 04",
    },
    "Orang-orang di balik komunitas. Setiap peran membantu menjaga keluarga F4NTASTIC tetap terhubung.":
      {
        en: "The people behind the community. Every role keeps the F4NTASTIC family connected.",
        th: "ผู้คนเบื้องหลังคอมมูนิตี้ ทุกบทบาทช่วยเชื่อมโยงครอบครัว F4NTASTIC",
      },
    "Tim yang berperan dalam mengelola, menjaga, dan mendukung jalannya komunitas WE ARE F4NTASTIC.":
      {
        en: "The team managing, protecting, and supporting the WE ARE F4NTASTIC community.",
        th: "ทีมที่บริหาร ดูแล และสนับสนุนคอมมูนิตี้ WE ARE F4NTASTIC",
      },
    "Orang-orang di balik layar yang mendukung perkembangan komunitas melalui kontribusi, kreativitas, dan dukungan teknis.":
      {
        en: "The people behind the scenes supporting the community through contribution, creativity, and technical support.",
        th: "ทีมเบื้องหลังที่สนับสนุนคอมมูนิตี้ด้วยการมีส่วนร่วม ความคิดสร้างสรรค์ และการสนับสนุนทางเทคนิค",
      },
    "F4NTASTIC ARCHIVE / 06": {
      en: "F4NTASTIC ARCHIVE / 06",
      th: "คลังความทรงจำ F4NTASTIC / 06",
    },
    EVERY: { en: "EVERY", th: "ทุก" },
    "MOMENT.": { en: "MOMENT.", th: "ช่วงเวลา" },
    "Jejak pertandingan, pertemuan, dan cerita kecil yang membuat F4NTASTIC terasa seperti rumah.":
      {
        en: "Matches, meetings, and small stories that make F4NTASTIC feel like home.",
        th: "ร่องรอยการแข่งขัน การพบปะ และเรื่องราวเล็ก ๆ ที่ทำให้ F4NTASTIC เหมือนบ้าน",
      },
    "F4NTASTIC PARTNERSHIP / 07": {
      en: "F4NTASTIC PARTNERSHIP / 07",
      th: "พันธมิตร F4NTASTIC / 07",
    },
    GROW: { en: "GROW", th: "เติบโต" },
    "TOGETHER.": { en: "TOGETHER.", th: "ไปด้วยกัน" },
    "Buka peluang kolaborasi bersama komunitas F4NTASTIC untuk brand, produk, event, dan partnership yang relevan dengan keluarga kami.":
      {
        en: "Open collaboration opportunities with the F4NTASTIC community for brands, products, events, and partnerships that fit our family.",
        th: "เปิดโอกาสร่วมมือกับคอมมูนิตี้ F4NTASTIC สำหรับแบรนด์ สินค้า อีเวนต์ และพันธมิตรที่เหมาะกับครอบครัวของเรา",
      },
    "LIHAT PAKET PROMOSI": {
      en: "VIEW PROMOTION PACKAGES",
      th: "ดูแพ็กเกจโปรโมชัน",
    },
    "Jangkau komunitas yang aktif dan relevan.": {
      en: "Reach an active and relevant community.",
      th: "เข้าถึงคอมมูนิตี้ที่มีความเคลื่อนไหวและตรงกลุ่ม",
    },
    "Format kerja sama fleksibel sesuai kebutuhan.": {
      en: "Flexible collaboration formats for your needs.",
      th: "รูปแบบความร่วมมือยืดหยุ่นตามความต้องการ",
    },
    "Komunikasi langsung bersama admin F4NTASTIC.": {
      en: "Direct communication with F4NTASTIC admins.",
      th: "สื่อสารโดยตรงกับแอดมิน F4NTASTIC",
    },
    "OPEN RECRUITMENT / 05": {
      en: "OPEN RECRUITMENT / 05",
      th: "เปิดรับสมาชิก / 05",
    },
    "READY TO BE": { en: "READY TO BE", th: "พร้อมเป็น" },
    "F4NTASTIC?": { en: "F4NTASTIC?", th: "F4NTASTIC ไหม" },
    "Punya semangat, mau berkembang, dan siap tumbuh bareng keluarga F4NTASTIC? Mulai langkahmu bersama kami.":
      {
        en: "Have the passion to grow with the F4NTASTIC family? Take your first step with us.",
        th: "มีความมุ่งมั่น อยากพัฒนา และพร้อมเติบโตไปกับครอบครัว F4NTASTIC ไหม เริ่มต้นก้าวแรกไปกับเรา",
      },
    "Aku Mau Join F4NT": {
      en: "I WANT TO JOIN F4NT",
      th: "ฉันอยากเข้าร่วม F4NT",
    },
    "Form pendaftaran dibuka .": {
      en: "Applications are open.",
      th: "เปิดรับสมัครแล้ว",
    },
    "Satu tujuan.": { en: "One purpose.", th: "หนึ่งเป้าหมาย" },
    "Satu prestasi.": { en: "One achievement.", th: "หนึ่งความสำเร็จ" },
    "Siap berkembang bersama.": {
      en: "Ready to grow together.",
      th: "พร้อมเติบโตไปด้วยกัน",
    },
    "Menjunjung loyalitas dan respect.": {
      en: "We value loyalty and respect.",
      th: "ยึดมั่นในความภักดีและความเคารพ",
    },
    "Membawa nama F4NTASTIC dengan bangga.": {
      en: "Carry the F4NTASTIC name with pride.",
      th: "ภาคภูมิใจกับชื่อ F4NTASTIC",
    },
    "MEMBER CARE / INTERNAL / 08": {
      en: "MEMBER CARE / INTERNAL / 08",
      th: "ดูแลสมาชิก / ภายใน / 08",
    },
    POSKO: { en: "SUPPORT", th: "ศูนย์ช่วยเหลือ" },
    "PENGADUAN.": { en: "CENTER.", th: "รับเรื่อง" },
    "Ruang aman untuk member F4NTASTIC menyampaikan masalah, melaporkan perilaku yang merugikan, dan meminta bantuan tim internal.":
      {
        en: "A safe space for F4NTASTIC members to share concerns, report harmful behavior, and ask the internal team for help.",
        th: "พื้นที่ปลอดภัยสำหรับสมาชิก F4NTASTIC ในการแจ้งปัญหา รายงานพฤติกรรมที่เป็นอันตราย และขอความช่วยเหลือจากทีมภายใน",
      },
    "Laporkan dengan fakta, bukan emosi.": {
      en: "Report with facts, not emotion.",
      th: "รายงานด้วยข้อเท็จจริง ไม่ใช้อารมณ์",
    },
    "BUKA POSKO PENGADUAN": {
      en: "OPEN SUPPORT CENTER",
      th: "เปิดศูนย์ช่วยเหลือ",
    },
    "YOUR NEXT CHAPTER STARTS HERE / 05": {
      en: "YOUR NEXT CHAPTER STARTS HERE / 05",
      th: "บทต่อไปของคุณเริ่มที่นี่ / 05",
    },
    "FIND YOUR": { en: "FIND YOUR", th: "ค้นหา" },
    "FAMILY.": { en: "FAMILY.", th: "ครอบครัว" },
    "Ikuti kanal resmi F4NTASTIC untuk terhubung, mengikuti kabar komunitas, dan menjadi bagian dari perjalanan kami.":
      {
        en: "Follow the official F4NTASTIC channels, stay connected, and be part of our journey.",
        th: "ติดตามช่องทางทางการของ F4NTASTIC เพื่อเชื่อมต่อ รับข่าวสาร และเป็นส่วนหนึ่งของการเดินทางของเรา",
      },
    PERSYARATAN: { en: "REQUIREMENTS", th: "ข้อกำหนด" },
    "JOIN F4NT.": { en: "JOIN F4NT.", th: "เข้าร่วม F4NT" },
    "Baca seluruh peraturan berikut sebelum mendaftar. Dengan menekan Setuju, kamu menyatakan siap menaati peraturan F4NTASTIC.":
      {
        en: "Read all rules before applying. By pressing Agree, you confirm that you are ready to follow F4NTASTIC rules.",
        th: "อ่านกฎทั้งหมดก่อนสมัคร เมื่อกดยอมรับ แสดงว่าคุณพร้อมปฏิบัติตามกฎของ F4NTASTIC",
      },
    "PERSYARATAN UMUM": { en: "GENERAL REQUIREMENTS", th: "ข้อกำหนดทั่วไป" },
    "Aturan Dasar": { en: "Basic Rules", th: "กฎพื้นฐาน" },
    "PERATURAN DALAM GAME": { en: "IN-GAME RULES", th: "กฎระหว่างเล่นเกม" },
    "Aturan bermain": { en: "Gaming Rules", th: "กฎการเล่น" },
    "PERATURAN GROUP UTAMA": { en: "MAIN GROUP RULES", th: "กฎกลุ่มหลัก" },
    "Menjaga ruang bersama": {
      en: "Protect the shared space",
      th: "ดูแลพื้นที่ส่วนรวม",
    },
    "Privasi grup:": { en: "Group privacy:", th: "ความเป็นส่วนตัวของกลุ่ม:" },
    "Dilarang berjualan": { en: "Selling is not allowed", th: "ห้ามซื้อขาย" },
    Bucin: { en: "Love is welcome", th: "มีความรักได้" },
    "Anti circle-circlean:": {
      en: "No exclusive circles:",
      th: "ห้ามแบ่งกลุ่มกีดกัน:",
    },
    "Setuju (10)": { en: "Agree (10)", th: "ยอมรับ (10)" },
    "Dengan menekan setuju, kamu menyatakan sudah membaca dan memahami seluruh persyaratan di atas.":
      {
        en: "By pressing Agree, you confirm that you have read and understood all requirements above.",
        th: "เมื่อกดยอมรับ แสดงว่าคุณอ่านและเข้าใจข้อกำหนดทั้งหมดข้างต้นแล้ว",
      },
    "F4NTASTIC berdiri sejak tahun 2024, tepatnya pada Season 33, yang didirikan oleh Keff / BEIVONG.":
      {
        en: "F4NTASTIC was founded in 2024, during Season 33, by Keff / BEIVONG.",
        th: "F4NTASTIC ก่อตั้งขึ้นในปี 2024 ช่วงซีซัน 33 โดย Keff / BEIVONG",
      },
    "Awal mula F4NTASTIC berawal dari lima orang yang memiliki kebiasaan bermain bersama dalam satu tim atau mabar berlima di Mobile Legends. Berawal dari kebersamaan dan kesamaan tujuan, mereka membentuk sebuah tim dengan ambisi untuk mengejar Global No. 1 Hero.":
      {
        en: "F4NTASTIC began with five people who regularly played together as a five-player Mobile Legends team. Their friendship and shared purpose became a team with the ambition to pursue Global No. 1 heroes.",
        th: "F4NTASTIC เริ่มจากคนห้าคนที่เล่น Mobile Legends ด้วยกันเป็นทีม ความผูกพันและเป้าหมายเดียวกันนำไปสู่การสร้างทีมที่มุ่งสู่ Global No. 1 Hero",
      },
    "Dari lima orang yang awalnya hanya bermain bersama demi mencapai target tersebut, perlahan tumbuh sebuah komunitas yang dibangun atas dasar kebersamaan, perjuangan, dan semangat untuk terus berkembang.":
      {
        en: "From five people playing toward one target, a community slowly grew on togetherness, perseverance, and the drive to keep improving.",
        th: "จากคนห้าคนที่เล่นเพื่อเป้าหมายเดียวกัน ค่อย ๆ เติบโตเป็นคอมมูนิตี้ที่สร้างจากความผูกพัน ความพยายาม และความมุ่งมั่นที่จะพัฒนา",
      },
    "F4NTASTIC bukan sekadar tempat untuk bermain game, melainkan sebuah perjalanan yang menyatukan banyak orang dengan tujuan yang sama. Seiring berjalannya waktu, F4NTASTIC terus berkembang, melewati berbagai tantangan, dan membangun identitasnya sendiri hingga menjadi komunitas yang memiliki sejarah, solidaritas, serta kebanggaan tersendiri bagi setiap anggotanya.":
      {
        en: "F4NTASTIC is more than a place to play. It is a journey that brings people with one purpose together. Over time, F4NTASTIC has grown through challenges and built its own history, solidarity, and pride for every member.",
        th: "F4NTASTIC ไม่ใช่เพียงที่เล่นเกม แต่คือการเดินทางที่รวมผู้คนซึ่งมีเป้าหมายเดียวกัน ตลอดเวลาเราผ่านความท้าทาย สร้างประวัติศาสตร์ ความสามัคคี และความภาคภูมิใจให้สมาชิกทุกคน",
      },
    "Logo lama": { en: "Former logo", th: "โลโก้เดิม" },
    "Logo sekarang": { en: "Current logo", th: "โลโก้ปัจจุบัน" },
    "S36 sampai sekarang": { en: "S36 to present", th: "S36 ถึงปัจจุบัน" },
    "Pergantian logo F4NTASTIC merupakan langkah baru dalam perjalanan tim untuk membangun identitas yang lebih kuat, modern, dan profesional. Perubahan ini bukan sekadar pembaruan tampilan, melainkan simbol evolusi, semangat baru, serta komitmen untuk terus berkembang dan meraih prestasi yang lebih tinggi. Logo baru dengan perpaduan warna emas, perak, dan hitam mencerminkan karakter F4NTASTIC yang semakin tegas dan berkelas. Mahkota emas melambangkan ambisi menuju kejayaan, simbol serigala merepresentasikan keberanian dan kekompakan, sementara warna hitam menggambarkan ketangguhan serta mental yang kuat dalam menghadapi setiap tantangan. Meskipun identitas visual berubah, nilai utama F4NTASTIC akan tetap sama: loyalitas, solidaritas, kerja keras, dan persaudaraan. Logo baru menjadi representasi dari tekad untuk melangkah ke level berikutnya tanpa melupakan sejarah, perjuangan, dan orang-orang yang telah menjadi bagian dari keluarga F4NTASTIC. Logo boleh berganti, identitas boleh berevolusi, tetapi semangat dan persaudaraan tetap abadi.":
      {
        en: "Changing the F4NTASTIC logo marked a new step toward a stronger, modern, and professional identity. The new gold, silver, and black design reflects ambition, courage, unity, resilience, loyalty, hard work, and brotherhood while honoring our history.",
        th: "การเปลี่ยนโลโก้ F4NTASTIC คือก้าวใหม่สู่ตัวตนที่แข็งแกร่ง ทันสมัย และเป็นมืออาชีพ สีทอง เงิน และดำสะท้อนความทะเยอทะยาน ความกล้า ความสามัคคี ความแข็งแกร่ง ความภักดี ความทุ่มเท และมิตรภาพ โดยยังคงเคารพประวัติศาสตร์ของเรา",
      },
    "Logo F4NTASTIC merupakan simbol identitas, kehormatan, dan semangat juang yang menyatukan setiap anggota dalam satu tujuan. Mahkota emas melambangkan cita-cita menuju kejayaan, serigala merepresentasikan keberanian dan kekompakan, sedangkan elemen perak menggambarkan keteguhan dan profesionalisme. Latar hitam menjadi simbol mental yang kuat dalam menghadapi berbagai tantangan. Melalui semboyan “I’ AM F4NTASTIC” dan “WE ARE FAMILY”, F4NTASTIC menegaskan bahwa setiap individu memiliki potensi untuk menjadi luar biasa, tetapi kekuatan sejati lahir ketika semua anggota bersatu. Kami tidak hanya berjuang untuk menang, tetapi juga membangun persaudaraan, menjaga loyalitas, dan menciptakan sejarah bersama. F4NTASTIC bukan sekadar tim. F4NTASTIC adalah keluarga, identitas, dan semangat untuk menjadi luar biasa. F4NTASTIC dibangun atas tiga prinsip utama: Strength — Kekuatan: memiliki mental yang tangguh dan tidak mudah menyerah. Excellence — Keunggulan: terus meningkatkan kemampuan untuk mencapai prestasi terbaik. Family — Persaudaraan: menjunjung solidaritas, kepercayaan, dan kebersamaan dalam setiap keadaan.":
      {
        en: "The F4NTASTIC logo represents identity, honor, and fighting spirit united by one purpose. Gold represents ambition, the wolf courage and unity, silver strength and professionalism, and black a resilient mindset. F4NTASTIC is a family built on Strength, Excellence, and Family.",
        th: "โลโก้ F4NTASTIC คือสัญลักษณ์ของตัวตน เกียรติยศ และจิตวิญญาณนักสู้ที่รวมเราไว้ด้วยเป้าหมายเดียว มงกุฎทองคือความทะเยอทะยาน หมาป่าคือความกล้าและความสามัคคี สีเงินคือความมั่นคงและความเป็นมืออาชีพ ส่วนสีดำคือจิตใจที่แข็งแกร่ง F4NTASTIC คือครอบครัวที่ยึดสามหลักการ Strength ความแข็งแกร่ง Excellence ความเป็นเลิศ และ Family ความเป็นพี่น้อง",
      },
    "Menjadikan F4NTASTIC sebagai komunitas yang solid, berprestasi, dan memiliki identitas kuat dalam dunia Mobile Legends, dengan menjunjung tinggi kebersamaan, loyalitas, sportivitas, serta semangat untuk terus berkembang dan mencapai prestasi tertinggi. Berawal dari lima orang yang memiliki satu tujuan, F4NTASTIC ingin berkembang menjadi komunitas yang bukan hanya berorientasi pada kemenangan, tetapi juga mampu membangun hubungan kekeluargaan, menciptakan lingkungan yang positif, serta menjadi tempat bagi setiap anggota untuk berkembang dan menunjukkan potensi terbaiknya.":
      {
        en: "To make F4NTASTIC a solid, accomplished Mobile Legends community with a strong identity, built on togetherness, loyalty, sportsmanship, and continuous growth. Starting from five people with one purpose, we aim to build a family where every member can grow and show their best potential.",
        th: "ทำให้ F4NTASTIC เป็นคอมมูนิตี้ Mobile Legends ที่แข็งแกร่ง มีผลงาน และมีตัวตนชัดเจน ยึดความผูกพัน ความภักดี น้ำใจนักกีฬา และการพัฒนาอย่างต่อเนื่อง จากคนห้าคนที่มีเป้าหมายเดียว เราต้องการสร้างครอบครัวที่สมาชิกทุกคนเติบโตและแสดงศักยภาพได้เต็มที่",
      },
    "Mempertahankan Brandingan Squad": {
      en: "Maintain the squad brand",
      th: "รักษาแบรนด์ของสควอด",
    },
    "Membangun Solidaritas dan Kekeluargaan": {
      en: "Build solidarity and family",
      th: "สร้างความสามัคคีและความเป็นครอบครัว",
    },
    "Mengembangkan Potensi Anggota": {
      en: "Develop member potential",
      th: "พัฒนาศักยภาพสมาชิก",
    },
    "Menjaga Loyalitas dan Komitmen": {
      en: "Protect loyalty and commitment",
      th: "รักษาความภักดีและความมุ่งมั่น",
    },
    "Membangun Komunitas yang Berkualitas": {
      en: "Build a quality community",
      th: "สร้างคอมมูนิตี้คุณภาพ",
    },
    "Menjadikan F4NTASTIC bukan sekadar tempat bermain, melainkan sebuah keluarga yang saling mendukung, menghargai, dan menjaga kebersamaan dalam setiap keadaan.":
      {
        en: "Make F4NTASTIC more than a place to play: a family that supports, respects, and stays together in every situation.",
        th: "ทำให้ F4NTASTIC เป็นมากกว่าที่เล่นเกม แต่เป็นครอบครัวที่สนับสนุน เคารพ และอยู่เคียงข้างกันในทุกสถานการณ์",
      },
    "Mempertahankan brandingan squad fantastic yang dimana para old member membranding F4NTASTIC dengan playernya memiliki global nomor 1 apapun hero nya Dan Fantastic selalu aktif di setiap tournament offline ataupun online untuk membantu memajukan esport mobile legend Indonesia":
      {
        en: "Maintain the F4NTASTIC squad brand, built by old members and Global No. 1 players across heroes, while staying active in offline and online tournaments to support Indonesian Mobile Legends esports.",
        th: "รักษาแบรนด์สควอด F4NTASTIC ที่สมาชิกเก่าและผู้เล่น Global No. 1 ในทุกฮีโร่ร่วมสร้าง พร้อมเข้าร่วมทัวร์นาเมนต์ออฟไลน์และออนไลน์เพื่อสนับสนุนอีสปอร์ต Mobile Legends ของอินโดนีเซีย",
      },
    "Memberikan ruang bagi setiap anggota untuk mengasah kemampuan, meningkatkan kualitas permainan, memperluas pengalaman kompetitif, serta menemukan potensi terbaik dalam dirinya.":
      {
        en: "Give every member room to sharpen skills, improve gameplay, gain competitive experience, and discover their best potential.",
        th: "เปิดพื้นที่ให้สมาชิกทุกคนฝึกฝนทักษะ พัฒนาการเล่น เพิ่มประสบการณ์การแข่งขัน และค้นพบศักยภาพที่ดีที่สุดของตนเอง",
      },
    "Menanamkan rasa tanggung jawab, loyalitas, dan komitmen terhadap komunitas dengan tetap menjunjung tinggi sikap saling menghormati serta menghargai kontribusi setiap anggota.":
      {
        en: "Build responsibility, loyalty, and commitment to the community while respecting every member and their contribution.",
        th: "ปลูกฝังความรับผิดชอบ ความภักดี และความมุ่งมั่นต่อคอมมูนิตี้ พร้อมเคารพสมาชิกและเห็นคุณค่าของทุกการมีส่วนร่วม",
      },
    "Menciptakan lingkungan komunitas yang positif, tertib, dan saling mendukung, dengan menghindari konflik yang tidak perlu serta mengutamakan komunikasi dan penyelesaian masalah secara dewasa.":
      {
        en: "Create a positive, orderly, and supportive community by avoiding unnecessary conflict and prioritizing mature communication and problem solving.",
        th: "สร้างคอมมูนิตี้ที่ดี เป็นระเบียบ และสนับสนุนกัน หลีกเลี่ยงความขัดแย้งที่ไม่จำเป็น และให้ความสำคัญกับการสื่อสารและการแก้ปัญหาอย่างมีวุฒิภาวะ",
      },
    "Mengembangkan F4NTASTIC menjadi komunitas yang semakin dikenal, memiliki identitas yang kuat, serta mampu menciptakan generasi anggota yang berprestasi dan menjaga nama baik komunitas.":
      {
        en: "Grow F4NTASTIC into a recognized community with a strong identity, a high-achieving generation of members, and a good name to protect.",
        th: "พัฒนา F4NTASTIC ให้เป็นคอมมูนิตี้ที่เป็นที่รู้จัก มีตัวตนแข็งแกร่ง สร้างสมาชิกรุ่นใหม่ที่มีผลงาน และรักษาชื่อเสียงของคอมมูนิตี้",
      },
    "Menjaga Warisan dan Sejarah F4NTASTIC": {
      en: "Protect F4NTASTIC heritage and history",
      th: "รักษามรดกและประวัติศาสตร์ของ F4NTASTIC",
    },
    "Mempertahankan semangat awal yang dibangun oleh Keff / BEIVONG sejak Season 33 tahun 2024, agar nilai kebersamaan, perjuangan, dan tujuan bersama tetap menjadi fondasi bagi generasi F4NTASTIC berikutnya.":
      {
        en: "Preserve the original spirit built by Keff / BEIVONG since Season 33 in 2024, keeping togetherness, perseverance, and shared purpose as the foundation for future F4NTASTIC generations.",
        th: "รักษาจิตวิญญาณแรกเริ่มที่ Keff / BEIVONG สร้างไว้ตั้งแต่ซีซัน 33 ปี 2024 ให้ความผูกพัน ความพยายาม และเป้าหมายร่วมเป็นรากฐานของ F4NTASTIC รุ่นต่อไป",
      },
    SOLIDARITY: { en: "SOLIDARITY", th: "ความสามัคคี" },
    "Mengutamakan kebersamaan dan persatuan.": {
      en: "Put togetherness and unity first.",
      th: "ให้ความผูกพันและความเป็นหนึ่งเดียวมาก่อน",
    },
    LOYALTY: { en: "LOYALTY", th: "ความภักดี" },
    "Menjaga komitmen serta kepercayaan.": {
      en: "Protect commitment and trust.",
      th: "รักษาความมุ่งมั่นและความไว้วางใจ",
    },
    ACHIEVEMENT: { en: "ACHIEVEMENT", th: "ความสำเร็จ" },
    "Terus berjuang untuk meraih prestasi.": {
      en: "Keep fighting for achievement.",
      th: "มุ่งมั่นต่อไปเพื่อคว้าความสำเร็จ",
    },
    RESPECT: { en: "RESPECT", th: "ความเคารพ" },
    "Menghargai setiap anggota tanpa terkecuali.": {
      en: "Respect every member without exception.",
      th: "เคารพสมาชิกทุกคนโดยไม่มีข้อยกเว้น",
    },
    FAMILY: { en: "FAMILY", th: "ครอบครัว" },
    "Menjadikan komunitas sebagai rumah untuk tumbuh bersama.": {
      en: "Make the community a home where we grow together.",
      th: "ทำให้คอมมูนิตี้เป็นบ้านที่เราเติบโตไปด้วยกัน",
    },
    THE: { en: "THE", th: "ทีม" },
    "CREW.": { en: "CREW.", th: "ของเรา" },
    "FOUNDER & LEADER": { en: "FOUNDER & LEADER", th: "ผู้ก่อตั้งและผู้นำ" },
    "Beivong x F4NT": { en: "Beivong x F4NT", th: "Beivong x F4NT" },
    "Semua player ML memiliki kesempatan untuk berkembang lebih baik lagi. Namun, mereka harus didukung oleh lingkungan yang bagus untuk menemani proses mereka. Menurut saya, lingkungan F4NTASTIC yang saya bentuk dapat mempermudah mereka mencapai apa yang mereka kejar, dan itu sudah terbukti.":
      {
        en: "Every ML player has the chance to improve. They need a good environment to support their process. I believe the F4NTASTIC environment I built helps them reach what they pursue, and that has been proven.",
        th: "ผู้เล่น ML ทุกคนมีโอกาสพัฒนาให้ดีขึ้น แต่พวกเขาต้องมีสภาพแวดล้อมที่ดีคอยสนับสนุน ผมเชื่อว่าสภาพแวดล้อม F4NTASTIC ที่สร้างขึ้นช่วยให้พวกเขาไปถึงเป้าหมาย และสิ่งนี้ได้รับการพิสูจน์แล้ว",
      },
    Instagram: { en: "Instagram", th: "Instagram" },
    TikTok: { en: "TikTok", th: "TikTok" },
    Discord: { en: "Discord", th: "Discord" },
    YouTube: { en: "YouTube", th: "YouTube" },
    "jadilah pria yg baik,lalu menghilang,nikmati kesendirian dengan ketenangan":
      {
        en: "Be a good man, then disappear. Enjoy solitude in peace.",
        th: "จงเป็นผู้ชายที่ดี แล้วหายไป ใช้ชีวิตลำพังอย่างสงบ",
      },
    "THE CREW": { en: "THE CREW", th: "ทีมงาน" },
    "SUPPORT CREW": { en: "SUPPORT CREW", th: "ฝ่ายสนับสนุน" },
    "CREW.": { en: "CREW.", th: "ทีมงาน" },
    SUPPORT: { en: "SUPPORT", th: "ฝ่ายสนับสนุน" },
    "selesaikan apa yang sudah kamu mulai semangat terus kamu pasti bisa": {
      en: "Finish what you started. Keep going, you can do it.",
      th: "ทำสิ่งที่เริ่มไว้ให้สำเร็จ สู้ต่อไป คุณทำได้",
    },
    "We are family": { en: "We are family", th: "เราเป็นครอบครัวเดียวกัน" },
    "The Man, the Myth, the Legend.": {
      en: "The Man, the Myth, the Legend.",
      th: "บุรุษ ตำนาน และเรื่องเล่า",
    },
    "Seorang admin kompe yang merangkap jadi chef cuisine": {
      en: "A competitive admin who is also a cuisine chef.",
      th: "แอดมินสายแข่งขันที่ควบตำแหน่งเชฟอาหาร",
    },
    "fix what's wrong, and keep stepping": {
      en: "Fix what's wrong, and keep stepping.",
      th: "แก้ไขสิ่งที่ผิด แล้วก้าวต่อไป",
    },
    "_g usah chat all_": {
      en: "_No need to use all chat_",
      th: "_ไม่ต้องใช้แชท All_",
    },
    "tetaplah hidup walaupun tidak berguna": {
      en: "Keep living even when you feel useless.",
      th: "จงมีชีวิตต่อไป แม้รู้สึกว่าไร้ประโยชน์",
    },
    "safe health": { en: "Stay safe and healthy", th: "ปลอดภัยและสุขภาพดี" },
    "Saya tidak bisa hidup tanpa meta ciki": {
      en: "I cannot live without the Ciki meta.",
      th: "ฉันอยู่ไม่ได้ถ้าไม่มีเมต้า Ciki",
    },
    "Setidaknya kamu sudah mencobanya. Ya... walaupun kamu belum berhasil, kan?":
      {
        en: "At least you tried. Well... even if you did not succeed, right?",
        th: "อย่างน้อยคุณก็ได้ลองนะ แม้จะยังไม่สำเร็จก็ตาม ใช่ไหมล่ะ",
      },
    "Di antara baris kode dan sunyi malam, aku membangun dunia yang bisa kusebut milikku.":
      {
        en: "Between lines of code and quiet nights, I build a world I can call my own.",
        th: "ท่ามกลางบรรทัดโค้ดและความเงียบยามค่ำคืน ฉันสร้างโลกที่เรียกว่าเป็นของฉัน",
      },
    "Manusia tidak pernah saling memahami, kecuali mereka merasakan penderitaan yang sama":
      {
        en: "People never truly understand one another unless they feel the same pain.",
        th: "มนุษย์ไม่เคยเข้าใจกันอย่างแท้จริง จนกว่าจะได้สัมผัสความเจ็บปวดเดียวกัน",
      },
    "Momen keluarga F4NTASTIC": {
      en: "F4NTASTIC family moments",
      th: "ช่วงเวลาครอบครัว F4NTASTIC",
    },
    "Momen offline F4NTASTIC": {
      en: "F4NTASTIC offline moments",
      th: "ช่วงเวลาออฟไลน์ของ F4NTASTIC",
    },
    "Anggota F4NTASTIC": { en: "F4NTASTIC members", th: "สมาชิก F4NTASTIC" },
    "Kenangan F4NTASTIC": {
      en: "F4NTASTIC memories",
      th: "ความทรงจำ F4NTASTIC",
    },
    COMMUNITY: { en: "COMMUNITY", th: "คอมมูนิตี้" },
    "MEETS OPPORTUNITY.": { en: "MEETS OPPORTUNITY.", th: "พบโอกาส" },
    "ONE FRAME. ONE FAMILY.": {
      en: "ONE FRAME. ONE FAMILY.",
      th: "หนึ่งภาพ หนึ่งครอบครัว",
    },
    "ONE TEAM.": { en: "ONE TEAM.", th: "หนึ่งทีม" },
    "WE LOOK AFTER OUR OWN.": {
      en: "WE LOOK AFTER OUR OWN.",
      th: "เราดูแลคนของเรา",
    },
    "● MEMBER ONLY": { en: "● MEMBER ONLY", th: "● สำหรับสมาชิกเท่านั้น" },
    "● PRIVATE REVIEW": { en: "● PRIVATE REVIEW", th: "● ตรวจสอบเป็นส่วนตัว" },
    "● EVIDENCE FIRST": {
      en: "● EVIDENCE FIRST",
      th: "● ให้ความสำคัญกับหลักฐาน",
    },
    "Instagram@f4nt.official": {
      en: "Instagram @f4nt.official",
      th: "Instagram @f4nt.official",
    },
    "TikTok@official.f4ntastic": {
      en: "TikTok @official.f4ntastic",
      th: "TikTok @official.f4ntastic",
    },
    "DiscordJoin our server": {
      en: "Discord Join our server",
      th: "Discord เข้าร่วมเซิร์ฟเวอร์ของเรา",
    },
    "General Admin": { en: "General Admin", th: "แอดมินทั่วไป" },
    "Admin Ladies": { en: "Ladies Admin", th: "แอดมินฝ่ายหญิง" },
    "Admin Official": { en: "Official Admin", th: "แอดมินฝ่ายทางการ" },
    "Admin Discord": { en: "Discord Admin", th: "แอดมิน Discord" },
    "ADMIN COMPETITIVE / EXTERNAL": {
      en: "COMPETITIVE / EXTERNAL ADMIN",
      th: "แอดมินแข่งขัน / ภายนอก",
    },
    "ADMIN LADIES": { en: "LADIES ADMIN", th: "แอดมินฝ่ายหญิง" },
    "GENERAL ADMIN": { en: "GENERAL ADMIN", th: "แอดมินทั่วไป" },
    "ASSISTANT GENERAL": { en: "GENERAL ASSISTANT", th: "ผู้ช่วยทั่วไป" },
    "ASSISTANT OFFICIAL": { en: "OFFICIAL ASSISTANT", th: "ผู้ช่วยฝ่ายทางการ" },
    "ASSISTANT WEB ARCHITECT": {
      en: "WEB ARCHITECT ASSISTANT",
      th: "ผู้ช่วยสถาปนิกเว็บ",
    },
    "F4NTASTIC WEB ARCHITECT": {
      en: "F4NTASTIC WEB ARCHITECT",
      th: "สถาปนิกเว็บ F4NTASTIC",
    },
    "Lebih dari sekadar permainan. Ini tentang tujuan, perjuangan, dan keluarga yang tumbuh bersama.":
      {
        en: "More than just a game. It is about purpose, perseverance, and a family that grows together.",
        th: "มากกว่าแค่เกม นี่คือเรื่องของเป้าหมาย ความพยายาม และครอบครัวที่เติบโตไปด้วยกัน",
      },
    "Lebih dari sekadar permainan. Ini tentang tujuan, perjuangan, dan": {
      en: "More than just a game. It is about purpose, perseverance, and",
      th: "มากกว่าแค่เกม นี่คือเรื่องของเป้าหมาย ความพยายาม และ",
    },
    "Tujuan yang kami perjuangkan.": {
      en: "The purpose we stand for.",
      th: "เป้าหมายที่เราร่วมต่อสู้",
    },
    "F4NTASTIC — WE ARE F4NTASTIC, WE ARE FAMILY.": {
      en: "F4NTASTIC — WE ARE F4NTASTIC, WE ARE FAMILY.",
      th: "F4NTASTIC — WE ARE F4NTASTIC, WE ARE FAMILY.",
    },
    "Kenali perjalanan, visi, founder, dan pengurus F4NTASTIC.": {
      en: "Discover the journey, vision, founder, and team behind F4NTASTIC.",
      th: "ทำความรู้จักการเดินทาง วิสัยทัศน์ ผู้ก่อตั้ง และทีมงานของ F4NTASTIC",
    },
    "Satu prestasi.": { en: "One achievement.", th: "หนึ่งความสำเร็จ" },
    "Satu tujuan.": { en: "One purpose.", th: "หนึ่งเป้าหมาย" },
    "Tujuan yang kami perjuangkan.": {
      en: "The purpose we stand for.",
      th: "เป้าหมายที่เราร่วมต่อสู้",
    },
    "keluarga yang tumbuh bersama.": {
      en: "a family that grows together.",
      th: "ครอบครัวที่เติบโตไปด้วยกัน",
    },
    "Deskripsi belum diisi.": {
      en: "Description not provided yet.",
      th: "ยังไม่มีคำอธิบาย",
    },
    "ROSTER TIM": { en: "TEAM ROSTER", th: "รายชื่อผู้เล่นในทีม" },
    "TAMU F4NTASTIC": { en: "F4NTASTIC GUEST", th: "ผู้เยือน F4NTASTIC" },
    "CALON MEMBER F4NTASTIC": {
      en: "F4NTASTIC PROSPECT",
      th: "ผู้สมัครสมาชิก F4NTASTIC",
    },
    "MEMBER F4NTASTIC": { en: "F4NTASTIC MEMBER", th: "สมาชิก F4NTASTIC" },
    "LEADER SQUAD F4NTASTIC": {
      en: "F4NTASTIC SQUAD LEADER",
      th: "หัวหน้าสควอด F4NTASTIC",
    },
    "ADMIN F4NTASTIC": { en: "F4NTASTIC ADMIN", th: "ผู้ดูแล F4NTASTIC" },
    "DEVELOPER F4NTASTIC": {
      en: "F4NTASTIC DEVELOPER",
      th: "นักพัฒนา F4NTASTIC",
    },
    "OWNER F4NTASTIC": { en: "F4NTASTIC OWNER", th: "เจ้าของ F4NTASTIC" },
    "Tamu F4NTASTIC": { en: "F4NTASTIC Guest", th: "ผู้เยือน F4NTASTIC" },
    "Calon Member F4NTASTIC": {
      en: "F4NTASTIC Prospect",
      th: "ผู้สมัครสมาชิก F4NTASTIC",
    },
    "Member F4NTASTIC": { en: "F4NTASTIC Member", th: "สมาชิก F4NTASTIC" },
    "Leader Squad F4NTASTIC": {
      en: "F4NTASTIC Squad Leader",
      th: "หัวหน้าสควอด F4NTASTIC",
    },
    "Admin F4NTASTIC": { en: "F4NTASTIC Admin", th: "ผู้ดูแล F4NTASTIC" },
    "Developer F4NTASTIC": {
      en: "F4NTASTIC Developer",
      th: "นักพัฒนา F4NTASTIC",
    },
    "Owner F4NTASTIC": { en: "F4NTASTIC Owner", th: "เจ้าของ F4NTASTIC" },
    Owner: { en: "Owner", th: "เจ้าของ" },
    Developer: { en: "Developer", th: "นักพัฒนา" },
    Admin: { en: "Admin", th: "ผู้ดูแล" },
    "Leader Squad": { en: "Squad Leader", th: "หัวหน้าสควอด" },
    Member: { en: "Member", th: "สมาชิก" },
    "Calon Member": { en: "Prospective Member", th: "ผู้สมัครสมาชิก" },
    Tamu: { en: "Guest", th: "ผู้เยือน" },
    "Belum ada file dipilih.": {
      en: "No file selected yet.",
      th: "ยังไม่ได้เลือกไฟล์",
    },
    "PILIH FOTO": { en: "CHOOSE PHOTO", th: "เลือกรูปภาพ" },
    "Biarkan kosong jika tidak menambah foto": {
      en: "Leave empty if you are not adding a photo",
      th: "เว้นว่างหากไม่ต้องการเพิ่มรูปภาพ",
    },
  };
  const reverse = new Map();
  Object.entries(translations).forEach(([source, values]) =>
    Object.entries(values).forEach(([lang, value]) =>
      reverse.set(`${lang}\u0000${value}`, source),
    ),
  );
  const originalText = new WeakMap();
  const normalize = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  function language() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (supported.includes(saved)) return saved;
    const preferred = (navigator.language || "").toLowerCase();
    return preferred.startsWith("th")
      ? "th"
      : preferred.startsWith("en")
        ? "en"
        : "id";
  }
  function sourceFor(value, lang) {
    const clean = normalize(value);
    if (!clean) return "";
    const known = reverse.get(`${lang}\u0000${clean}`);
    return known || clean;
  }
  function translateNode(node, lang) {
    if (!originalText.has(node))
      originalText.set(node, sourceFor(node.nodeValue, lang));
    const source = originalText.get(node),
      value = translations[source]?.[lang] || source;
    if (node.nodeValue.trim())
      node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), value);
  }
  function translate(lang) {
    document.documentElement.lang = lang === "th" ? "th" : lang;
    document.body.dataset.language = lang;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (translations[key]?.[lang])
        element.textContent = translations[key][lang];
    });
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) =>
          node.parentElement?.closest(
            "script,style,noscript,.f4-language-switcher",
          )
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      },
    );
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => translateNode(node, lang));
    document
      .querySelectorAll("[title],[aria-label],[placeholder]")
      .forEach((element) =>
        ["title", "aria-label", "placeholder"].forEach((attribute) => {
          const source = sourceFor(element.getAttribute(attribute), lang);
          if (translations[source]?.[lang])
            element.setAttribute(attribute, translations[source][lang]);
        }),
      );
    document
      .querySelectorAll(".f4-language-option")
      .forEach((option) =>
        option.classList.toggle("is-active", option.dataset.language === lang),
      );
    localStorage.setItem(STORAGE_KEY, lang);
  }
  function mountSwitcher() {
    if (document.querySelector(".f4-language-switcher")) return;
    const wrap = document.createElement("div");
    wrap.className = "f4-language-switcher";
    wrap.setAttribute("aria-label", "Language");
    [
      ["id", "ID"],
      ["en", "EN"],
      ["th", "TH"],
    ].forEach(([code, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "f4-language-option";
      button.dataset.language = code;
      button.textContent = label;
      button.addEventListener("click", () => translate(code));
      wrap.append(button);
    });
    const header = document.querySelector(".site-header");
    wrap.style.cssText =
      "position:fixed;right:18px;bottom:18px;z-index:2000;margin:0;";
    if (header) {
      wrap.classList.add("f4-language-header");
      document.body.append(wrap);
    } else {
      wrap.classList.add("f4-language-floating");
      document.body.append(wrap);
    }
  }
  const style = document.createElement("style");
  style.textContent =
    ".f4-language-switcher{display:inline-flex;align-items:center;gap:3px;padding:5px 6px;border:1px solid rgba(207,170,88,.55);background:rgba(8,8,8,.94);box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap}.f4-language-header{position:fixed;right:18px;bottom:18px;z-index:2000;margin:0}.f4-language-floating{position:fixed;right:18px;bottom:18px;z-index:2000;margin:0}.f4-language-option{border:0;background:transparent;color:#aaa;padding:6px 7px;font:700 9px/1 Manrope,sans-serif;letter-spacing:.5px;cursor:pointer}.f4-language-option:hover,.f4-language-option.is-active{background:#d2ad55;color:#111}html[lang=th] body{font-family:'Noto Sans Thai','Leelawadee UI',Tahoma,Arial,sans-serif;letter-spacing:0}html[lang=th] h1,html[lang=th] h2,html[lang=th] h3,html[lang=th] button,html[lang=th] input,html[lang=th] select,html[lang=th] textarea{font-family:'Noto Sans Thai','Leelawadee UI',Tahoma,Arial,sans-serif}html[lang=th] h1,html[lang=th] h2,html[lang=th] h3{line-height:1.12;letter-spacing:0}html[lang=th] p,html[lang=th] label,html[lang=th] li{line-height:1.85}html[lang=th] .eyebrow,html[lang=th] .kicker,html[lang=th] .brand-caption{letter-spacing:.08em}html[lang=th] .main-nav{gap:7px}html[lang=th] .main-nav>a{font-size:7px;line-height:1.35;letter-spacing:0}html[lang=th] .main-nav .nav-cta{padding:7px!important;font-size:7px}html[lang=th] .main-nav .nav-account .nav-login.is-account-link{max-width:150px;padding:4px 5px!important}html[lang=th] .nav-account-copy strong{max-width:84px;font-size:7px}html[lang=th] .nav-account-copy small{font-size:6px}html[lang=th] .brand-caption{font-size:7px;letter-spacing:.08em}html[lang=th] .gallery-card-body,html[lang=th] .category-page-intro,html[lang=th] .collection-caption,html[lang=th] .connect-copy{line-height:1.9}html[lang=th] .goals-grid,html[lang=th] .admins-grid,html[lang=th] .logo-history-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch}html[lang=th] .why-grid,html[lang=th] .package-grid{grid-template-columns:repeat(2,minmax(0,1fr))}html[lang=th] .category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}html[lang=th] .gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}html[lang=th] .goals-grid>*,html[lang=th] .admins-grid>*,html[lang=th] .logo-history-grid>*,html[lang=th] .why-grid>*,html[lang=th] .package-grid>*,html[lang=th] .category-grid>*,html[lang=th] .gallery-grid>*{min-width:0;overflow-wrap:anywhere}@media(max-width:780px){html[lang=th] .main-nav{gap:0}html[lang=th] .main-nav>a{font-size:12px;line-height:1.65;letter-spacing:0}}@media(max-width:700px){html[lang=th] .goals-grid,html[lang=th] .admins-grid,html[lang=th] .logo-history-grid,html[lang=th] .why-grid,html[lang=th] .package-grid,html[lang=th] .category-grid,html[lang=th] .gallery-grid{grid-template-columns:1fr}.f4-language-header,.f4-language-floating{right:12px;bottom:12px}}";
  document.head.append(style);
  function boot() {
    mountSwitcher();
    translate(language());
    const observer = new MutationObserver((records) => {
      if (
        records.some((record) =>
          [...record.addedNodes].some(
            (node) => node.nodeType === 1 || node.nodeType === 3,
          ),
        )
      )
        translate(language());
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  window.F4Translate = translate;
  window.F4Translations = translations;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
