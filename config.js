// ============================================================
// MAP-IN Translator V1.0 — Konfigurasi Frontend
// ============================================================
// Anda bisa mengubah nilai default di sini, ATAU mengaturnya
// langsung dari menu "⚙️ Pengaturan" di dalam aplikasi (disimpan
// di localStorage browser, tidak pernah dikirim ke pihak lain).
//
// backendMode — 3 pilihan:
//   "demo"       -> layanan terjemahan publik (MyMemory) langsung dari
//                   browser. Tanpa setup. Mode Grup Multi-HP TIDAK bisa
//                   dipakai (tidak ada server relay pesan).
//   "appsscript" -> backend Google Apps Script pribadi Anda (lihat
//                   backend/Code.gs & DEPLOY_GUIDE.md). API key
//                   tersimpan di server (Script Properties), ada rate
//                   limiting bawaan. Sesuai arsitektur keamanan PRD §11.
//   "firebase"   -> backend Firebase Realtime Database (paket Spark,
//                   gratis, TANPA kartu kredit) untuk relay pesan Mode
//                   Grup, dikombinasikan dengan LibreTranslate (mesin
//                   terjemahan open-source gratis) yang dipanggil
//                   LANGSUNG dari browser. TIDAK ADA server rahasia di
//                   sini — Database URL & aturan akses Firebase
//                   terlihat oleh siapa pun yang membuka source code,
//                   dan tidak ada rate limiting otomatis seperti di
//                   Apps Script. Dipilih atas permintaan eksplisit user
//                   yang mengutamakan gratis-tanpa-kartu di atas isolasi
//                   keamanan penuh. Lihat DEPLOY_GUIDE.md bagian
//                   "Opsi C" untuk rincian & mitigasi risikonya.
//
// TIPS: supaya SEMUA HP yang buka link ini otomatis pakai backend yang
// sama TANPA perlu buka menu ⚙️ Pengaturan satu-satu, isi nilai di
// bawah ini SEBELUM upload ke GitHub Pages.
//
// Nilai di sini hanya jadi DEFAULT AWAL — kalau seseorang mengubahnya
// lewat menu ⚙️ Pengaturan di HP-nya, perubahan itu tersimpan di
// localStorage HP tsb dan akan menimpa nilai default ini (khusus di HP
// itu saja, tidak memengaruhi HP lain).
//
// CATATAN KEAMANAN (mode appsscript): karena file ini ikut ter-upload
// ke GitHub Pages, appsScriptApiKey di bawah ini SECARA TEKNIS bisa
// dilihat siapa saja yang membuka source code halaman ini atau repo
// GitHub-nya (kalau repo-nya publik). Ini BUKAN kebocoran baru — sama
// seperti saat diketik manual di menu Pengaturan. Kalau datanya
// sensitif/rahasia perusahaan, jadikan repo GitHub-nya PRIVATE.
// ============================================================

const MAPIN_CONFIG = {
  backendMode: "https://mapin-translator-default-rtdb.asia-southeast1.firebasedatabase.app/",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbzzBDI1FCfMYhpPrN_aN9eTwPrYiviDcFrqo5V9znh_VdMWVZlxftJRQRpK69MCLMKhEA/exec",
  appsScriptApiKey: "MapinRahasia2026Musashi!",

  // --- Mode Firebase (Spark, gratis) ---
  // Isi dengan "Database URL" proyek Firebase Anda, formatnya:
  // https://NAMA-PROYEK-default-rtdb.asia-southeast1.firebasedatabase.app
  // (lihat DEPLOY_GUIDE.md bagian "Opsi C" untuk cara membuatnya).
  // Kosongkan ("") kalau belum siap — aplikasi akan menampilkan
  // pengingat untuk mengisi ini dulu sebelum Mode Grup Multi-HP aktif.
  firebaseDbUrl: "",
  // Mesin terjemahan gratis (open-source) untuk Mode Firebase, dipanggil
  // LANGSUNG dari browser (tanpa server rahasia). Default memakai mirror
  // publik komunitas LibreTranslate yang tidak mewajibkan API key. Kalau
  // mirror ini sedang tidak stabil, ganti ke mirror lain di menu
  // ⚙️ Pengaturan, atau self-host instance sendiri (lihat panduan).
  libreTranslateUrl: "https://translate.fedilab.app",

  // Batas panjang teks per ucapan yang dikirim ke backend (anti-abuse)
  maxTextLength: 500,
  // Target latensi (ms) untuk indikator kualitas koneksi (PRD §13)
  latencyWarningMs: 2500
};
