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
// ============================================================

const MAPIN_CONFIG = {
  backendMode: "demo",
  appsScriptUrl: "",
  appsScriptApiKey: "",
  // Batas panjang teks per ucapan yang dikirim ke backend (anti-abuse)
  maxTextLength: 500,
  // Target latensi (ms) untuk indikator kualitas koneksi (PRD §13)
  latencyWarningMs: 2500
};
