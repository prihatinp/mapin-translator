// ============================================================
// MAP-IN Translator V1.0 — Konfigurasi Frontend
// ============================================================
// Anda bisa mengubah nilai default di sini, ATAU mengaturnya
// langsung dari menu "⚙️ Pengaturan" di dalam aplikasi (disimpan
// di localStorage browser, tidak pernah dikirim ke pihak lain).
//
// backendMode:
//   "demo"       -> memanggil layanan terjemahan publik (MyMemory)
//                   langsung dari browser. Tanpa setup, TAPI tanpa
//                   proteksi API key. Hanya untuk uji coba/non-sensitif.
//   "appsscript" -> memanggil backend Google Apps Script pribadi Anda
//                   (lihat backend/Code.gs & DEPLOY_GUIDE.md). Sesuai
//                   arsitektur keamanan pada PRD §11.
//
// TIPS: supaya SEMUA HP yang buka link ini otomatis pakai backend
// Produksi TANPA perlu buka menu ⚙️ Pengaturan satu-satu, isi 3 nilai
// di bawah ini SEBELUM upload ke GitHub Pages, contoh:
//
//   backendMode: "appsscript",
//   appsScriptUrl: "https://script.google.com/macros/s/AKfycb.../exec",
//   appsScriptApiKey: "kode-rahasia-yang-sama-dengan-Script-Properties",
//
// Nilai di sini hanya jadi DEFAULT AWAL — kalau seseorang mengubahnya
// lewat menu ⚙️ Pengaturan di HP-nya, perubahan itu tersimpan di
// localStorage HP tsb dan akan menimpa nilai default ini (khusus di HP
// itu saja, tidak memengaruhi HP lain).
//
// CATATAN KEAMANAN: karena file ini ikut ter-upload ke GitHub Pages,
// appsScriptApiKey di bawah ini SECARA TEKNIS bisa dilihat siapa saja
// yang membuka source code halaman ini atau repo GitHub-nya (kalau
// repo-nya publik). Ini BUKAN kebocoran baru — sifatnya sama seperti
// saat diketik manual di menu Pengaturan (sama-sama dikirim di setiap
// permintaan jaringan). Fungsinya di sini lebih sebagai "kunci aplikasi
// bersama" (mencegah bot/orang asing sembarangan memanggil backend &
// menghabiskan kuota terjemahan), BUKAN rahasia tingkat tinggi. Kalau
// datanya sensitif/rahasia perusahaan, jadikan repo GitHub-nya PRIVATE
// (Settings > General > Danger Zone > Change visibility), atau upgrade
// ke GitHub Pages plan yang mendukung repo privat.
// ============================================================

const MAPIN_CONFIG = {
  backendMode: "appsscript",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbzzBDI1FCfMYhpPrN_aN9eTwPrYiviDcFrqo5V9znh_VdMWVZlxftJRQRpK69MCLMKhEA/exec",
  appsScriptApiKey: "MapinRahasia2026Musashi!",
  // Batas panjang teks per ucapan yang dikirim ke backend (anti-abuse)
  maxTextLength: 500,
  // Target latensi (ms) untuk indikator kualitas koneksi (PRD §13)
  latencyWarningMs: 2500
};
