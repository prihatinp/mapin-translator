// ============================================================
// MAP-IN Translator V1.0 — Logic Frontend
// PT Musashi Autoparts Indonesia
// ============================================================

const LANGUAGES = [
  { code: "id", label: "Indonesia", stt: "id-ID", tts: "id-ID" },
  { code: "en", label: "Inggris",   stt: "en-US", tts: "en-US" },
  { code: "ja", label: "Jepang",    stt: "ja-JP", tts: "ja-JP" },
  { code: "vi", label: "Vietnam",   stt: "vi-VN", tts: "vi-VN" },
  { code: "th", label: "Thailand",  stt: "th-TH", tts: "th-TH" },
  { code: "ar", label: "Arab",      stt: "ar-SA", tts: "ar-SA" }
];

const state = {
  langA: "id",
  langB: "ja",
  nameA: "",
  nameB: "",
  speed: 1.0,
  mode: "ptt", // ptt | auto | meeting
  backend: localStorage.getItem("mapin_backend") || MAPIN_CONFIG.backendMode,
  appsScriptUrl: localStorage.getItem("mapin_url") || MAPIN_CONFIG.appsScriptUrl,
  appsScriptKey: localStorage.getItem("mapin_key") || MAPIN_CONFIG.appsScriptApiKey,
  firebaseDbUrl: (localStorage.getItem("mapin_fb_url") || MAPIN_CONFIG.firebaseDbUrl || "").replace(/\/+$/, ""),
  libreTranslateUrl: (localStorage.getItem("mapin_libre_url") || MAPIN_CONFIG.libreTranslateUrl || "").replace(/\/+$/, ""),
  glossary: JSON.parse(localStorage.getItem("mapin_glossary") || "[]"),
  sessionActive: false,
  transcriptLog: [],

  // ---- Mode Grup Multi-HP (2-5 pembicara, masing-masing HP sendiri) ----
  deviceMode: "single", // "single" | "dual" (dual = mode grup multi-HP)
  myName: "",
  myLang: "id",
  participantId: null,
  sessionCode: "",
  roomName: "",
  isHost: false,
  roomLocked: false,
  sessionConnected: false,
  pollTimer: null,
  pollSinceIndex: 0,
  seenMessageKeys: null, // Set — dipakai mode Firebase (relay via polling REST, tidak ada index numerik)
  participants: []
};

const $ = (id) => document.getElementById(id);

function labelA() { return (state.nameA && state.nameA.trim()) || "Pembicara A"; }
function labelB() { return (state.nameB && state.nameB.trim()) || "Pembicara B"; }

// ---------- Setup language selects ----------
function fillLangSelect(sel, selected) {
  sel.innerHTML = "";
  LANGUAGES.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.code;
    opt.textContent = l.label;
    if (l.code === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}
fillLangSelect($("langA"), state.langA);
fillLangSelect($("langB"), state.langB);
fillLangSelect($("myLangSelect"), state.myLang);
updateLangTags();

function langByCode(code) { return LANGUAGES.find(l => l.code === code); }
function updateLangTags() {
  $("langATag").textContent = "Bahasa " + langByCode(state.langA).label;
  $("langBTag").textContent = "Bahasa " + langByCode(state.langB).label;
}

$("langA").addEventListener("change", e => { state.langA = e.target.value; updateLangTags(); });
$("langB").addEventListener("change", e => { state.langB = e.target.value; updateLangTags(); });

// ---------- Nama pembicara (mode 1 HP) ----------
$("nameA").addEventListener("input", e => { state.nameA = e.target.value; });
$("nameB").addEventListener("input", e => { state.nameB = e.target.value; });

// ---------- Mode Grup: nama & bahasa saya ----------
$("myNameInput").addEventListener("input", e => { state.myName = e.target.value; });
$("myLangSelect").addEventListener("change", e => {
  state.myLang = e.target.value;
  $("myLangTag").textContent = "Bahasa Saya: " + langByCode(state.myLang).label;
});
$("myLangTag").textContent = "Bahasa Saya: " + langByCode(state.myLang).label;

// ---------- Speed toggle ----------
$("speedToggle").addEventListener("click", e => {
  const btn = e.target.closest("button[data-speed]");
  if (!btn) return;
  [...$("speedToggle").children].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  state.speed = parseFloat(btn.dataset.speed);
});

// ---------- Mode percakapan toggle (ptt/auto/meeting) ----------
const meetingNote = document.createElement("div");
meetingNote.className = "small-note";
meetingNote.style.marginTop = "8px";
meetingNote.style.maxWidth = "520px";
meetingNote.innerHTML = "🖥️ <strong>Mode Meeting/Zoom:</strong> arahkan output audio Zoom/Meet ke perangkat audio virtual (mis. VB-Audio Virtual Cable / BlackHole), lalu jadikan perangkat itu sebagai microphone default OS Anda. Panel B akan mendengarkan audio meeting secara terus-menerus dan menerjemahkannya ke Panel A. Lihat DEPLOY_GUIDE.md bagian 'Mode Meeting'.";

$("modeToggle").addEventListener("click", e => {
  const btn = e.target.closest("button[data-mode]");
  if (!btn) return;
  [...$("modeToggle").children].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  state.mode = btn.dataset.mode;
  meetingNote.remove();
  if (state.mode === "meeting") {
    $("modeToggle").parentElement.appendChild(meetingNote);
    $("nameB").value = "Peserta Meeting";
    state.nameB = "Peserta Meeting";
  }
  updateMicHints();
});

function updateMicHints() {
  let txt = "Tahan tombol untuk bicara (Push-to-Talk)";
  if (state.mode === "auto") txt = "Klik sekali untuk mulai/berhenti mendengarkan otomatis";
  if (state.mode === "meeting") txt = "Klik untuk mulai mendengarkan audio meeting secara terus-menerus";
  document.querySelectorAll("#classicPanels .mic-hint").forEach(h => h.textContent = txt);
}

// ---------- Network / latency indicator ----------
function updateNetStatus() {
  const online = navigator.onLine;
  $("netDot").className = "dot " + (online ? "online" : "offline");
  $("netText").textContent = online ? "Terhubung" : "Terputus";
}
window.addEventListener("online", updateNetStatus);
window.addEventListener("offline", updateNetStatus);
updateNetStatus();

async function pingLatency() {
  const t0 = performance.now();
  try {
    await fetch("https://api.mymemory.translated.net/get?q=ping&langpair=en|id", { cache: "no-store" });
    const ms = Math.round(performance.now() - t0);
    $("latencyText").textContent = ms + " ms";
    $("latencyText").style.color = ms > MAPIN_CONFIG.latencyWarningMs ? "#e04b4b" : "#3f9142";
  } catch {
    $("latencyText").textContent = "-- ms";
  }
}
setInterval(pingLatency, 15000);
pingLatency();

// ---------- Settings modal ----------
function openModal(id) { $(id).classList.add("open"); }
function closeModal(id) { $(id).classList.remove("open"); }
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => closeModal(b.dataset.close)));
function updateSettingsFieldsVisibility() {
  const backend = $("backendToggle").querySelector(".active").dataset.backend;
  $("appsScriptFields").style.display = backend === "appsscript" ? "block" : "none";
  $("firebaseFields").style.display = backend === "firebase" ? "block" : "none";
}

$("btnSettings").addEventListener("click", () => {
  $("appsScriptUrl").value = state.appsScriptUrl;
  $("appsScriptKey").value = state.appsScriptKey;
  $("firebaseDbUrl").value = state.firebaseDbUrl;
  $("libreTranslateUrl").value = state.libreTranslateUrl;
  [...$("backendToggle").children].forEach(b => b.classList.toggle("active", b.dataset.backend === state.backend));
  updateSettingsFieldsVisibility();
  openModal("settingsModal");
});
$("backendToggle").addEventListener("click", e => {
  const btn = e.target.closest("button[data-backend]");
  if (!btn) return;
  [...$("backendToggle").children].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  updateSettingsFieldsVisibility();
});
$("btnSaveSettings").addEventListener("click", () => {
  const backend = $("backendToggle").querySelector(".active").dataset.backend;
  state.backend = backend;
  state.appsScriptUrl = $("appsScriptUrl").value.trim();
  state.appsScriptKey = $("appsScriptKey").value.trim();
  state.firebaseDbUrl = $("firebaseDbUrl").value.trim().replace(/\/+$/, "");
  state.libreTranslateUrl = $("libreTranslateUrl").value.trim().replace(/\/+$/, "");
  localStorage.setItem("mapin_backend", state.backend);
  localStorage.setItem("mapin_url", state.appsScriptUrl);
  localStorage.setItem("mapin_key", state.appsScriptKey);
  localStorage.setItem("mapin_fb_url", state.firebaseDbUrl);
  localStorage.setItem("mapin_libre_url", state.libreTranslateUrl);
  updateBackendStatusPill();
  showCopyFeedback("✅ Pengaturan disimpan di HP ini.");
  setTimeout(() => closeModal("settingsModal"), 700);
});

// ---------- Indikator status backend (selalu terlihat di layar utama) ----------
function updateBackendStatusPill() {
  const dot = $("backendDot");
  const text = $("backendStatusText");
  if (state.backend === "appsscript") {
    if (state.appsScriptUrl && state.appsScriptKey) {
      dot.className = "dot online";
      text.textContent = "Backend: Produksi";
    } else {
      dot.className = "dot offline";
      text.textContent = "Backend: Produksi (belum lengkap)";
    }
  } else if (state.backend === "firebase") {
    if (state.firebaseDbUrl && state.libreTranslateUrl) {
      dot.className = "dot online";
      text.textContent = "Backend: Firebase";
    } else {
      dot.className = "dot offline";
      text.textContent = "Backend: Firebase (belum lengkap)";
    }
  } else {
    dot.className = "dot connecting";
    text.textContent = "Backend: Demo";
  }
}
updateBackendStatusPill();

// ---------- Tes Koneksi Backend — diagnosa langkah demi langkah dari HP ----------
async function testFirebaseConnection() {
  const resultEl = $("testConnectionResult");
  const dbUrl = $("firebaseDbUrl").value.trim().replace(/\/+$/, "");
  const libreUrl = $("libreTranslateUrl").value.trim().replace(/\/+$/, "");

  resultEl.style.color = "var(--muted)";
  resultEl.textContent = "🔄 Menguji koneksi...";

  if (!dbUrl) {
    resultEl.style.color = "#e04b4b";
    resultEl.textContent = "⚠️ Kolom Firebase Database URL masih kosong. Lihat DEPLOY_GUIDE.md bagian 'Opsi C' untuk cara membuatnya.";
    return;
  }
  if (!/^https:\/\/.+firebasedatabase\.app$|^https:\/\/.+\.firebaseio\.com$/.test(dbUrl)) {
    resultEl.style.color = "#e8a92c";
    resultEl.textContent = "🟡 Format URL tampak tidak biasa untuk Firebase Database URL (harusnya diakhiri .firebasedatabase.app atau .firebaseio.com). Tetap mencoba menghubungi...";
  }

  try {
    const res = await fetch(dbUrl + "/.json?shallow=true");
    if (!res.ok) {
      resultEl.style.color = "#e04b4b";
      resultEl.textContent = "❌ Firebase merespons error (status " + res.status + "). Cek lagi aturan keamanan (Rules) Database Anda — pastikan \".read\": true untuk uji coba ini.";
      return;
    }
  } catch (err) {
    resultEl.style.color = "#e04b4b";
    resultEl.textContent = "❌ Tidak bisa menjangkau Firebase Database URL (" + err.message + "). Cek lagi URL-nya di Firebase Console → Realtime Database.";
    return;
  }

  if (!libreUrl) {
    resultEl.style.color = "#e8a92c";
    resultEl.textContent = "🟡 Firebase terjangkau! Tapi kolom URL LibreTranslate masih kosong — isi dulu (mis. https://translate.fedilab.app).";
    return;
  }

  try {
    const res = await fetch(libreUrl + "/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: "test", source: "en", target: "id", format: "text" })
    });
    const data = await res.json();
    if (!res.ok || !data.translatedText) {
      resultEl.style.color = "#e8a92c";
      resultEl.textContent = "🟡 Firebase OK, tapi mirror LibreTranslate ini sedang bermasalah (" + (data.error || res.status) + "). Mode Grup tetap bisa dipakai — aplikasi otomatis pakai MyMemory sebagai cadangan sampai mirror ini pulih. Bisa juga ganti ke mirror lain di DEPLOY_GUIDE.md 'Opsi C'.";
      return;
    }
    resultEl.style.color = "var(--green)";
    resultEl.textContent = "✅ Berhasil! Firebase & LibreTranslate keduanya terjangkau. Simpan Pengaturan lalu coba Mode Grup lagi.";
  } catch (err) {
    resultEl.style.color = "#e8a92c";
    resultEl.textContent = "🟡 Firebase OK, tapi gagal menghubungi LibreTranslate (" + err.message + "). Mode Grup tetap bisa dipakai — aplikasi otomatis pakai MyMemory sebagai cadangan sampai mirror ini pulih atau diganti.";
  }
}

async function testBackendConnection() {
  const backend = $("backendToggle").querySelector(".active").dataset.backend;
  if (backend === "firebase") return testFirebaseConnection();

  const resultEl = $("testConnectionResult");
  const url = $("appsScriptUrl").value.trim();
  const key = $("appsScriptKey").value.trim();

  resultEl.style.color = "var(--muted)";
  resultEl.textContent = "🔄 Menguji koneksi...";

  if (!url) {
    resultEl.style.color = "#e04b4b";
    resultEl.textContent = "⚠️ Kolom URL masih kosong. Isi dulu URL Web App dari Apps Script.";
    return;
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
    resultEl.style.color = "#e04b4b";
    resultEl.textContent = "⚠️ Format URL tampak tidak sesuai. Harus mulai dengan https://script.google.com/macros/s/ dan berakhiran /exec (bukan /dev).";
    return;
  }

  // Langkah 1: cek server bisa dijangkau sama sekali (doGet, tidak butuh API key)
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      resultEl.style.color = "#e04b4b";
      resultEl.textContent = "⚠️ Server merespons tapi error (status " + res.status + "). Cek kembali deployment Apps Script Anda (Deploy > Manage deployments > pastikan 'Who has access' = Anyone).";
      return;
    }
    const data = await res.json();
    if (data.status !== "ok") {
      resultEl.style.color = "#e04b4b";
      resultEl.textContent = "⚠️ Server terjangkau tapi respons tidak sesuai. Pastikan Code.gs sudah ter-deploy versi terbaru.";
      return;
    }
  } catch (err) {
    resultEl.style.color = "#e04b4b";
    resultEl.textContent = "❌ Tidak bisa menjangkau URL sama sekali (" + err.message + "). Cek lagi: URL sudah benar-benar dari 'New deployment' (bukan draft), dan 'Who has access' = Anyone.";
    return;
  }

  if (!key) {
    resultEl.style.color = "#e8a92c";
    resultEl.textContent = "🟡 Server terjangkau! Tapi kolom API Key masih kosong — isi dengan nilai yang SAMA PERSIS seperti Script Properties > API_KEY di Apps Script.";
    return;
  }

  // Langkah 2: cek API key valid (panggil action translate ringan)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ apiKey: key, action: "translate", text: "test", source: "id", target: "en" })
    });
    const data = await res.json();
    if (data.error && /Unauthorized|API key/i.test(data.error)) {
      resultEl.style.color = "#e04b4b";
      resultEl.textContent = "❌ Server terjangkau, TAPI API Key tidak cocok. Cek lagi nilai Script Properties > API_KEY di Apps Script (harus sama persis, tanpa spasi tambahan).";
      return;
    }
    if (data.error) {
      resultEl.style.color = "#e8a92c";
      resultEl.textContent = "🟡 API Key valid, tapi ada pesan lain dari server: " + data.error;
      return;
    }
    resultEl.style.color = "var(--green)";
    resultEl.textContent = "✅ Berhasil! Server & API Key valid. Simpan Pengaturan lalu coba Mode Grup lagi.";
  } catch (err) {
    resultEl.style.color = "#e04b4b";
    resultEl.textContent = "❌ Gagal menguji API Key: " + err.message;
  }
}
$("btnTestConnection").addEventListener("click", testBackendConnection);

// ---------- Salin ke clipboard (URL & API Key) — berguna terutama di HP ----------
function showCopyFeedback(msg) {
  const el = $("copyFeedback");
  el.textContent = msg;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 2000);
}

async function copyToClipboard(text, label) {
  if (!text) { showCopyFeedback("⚠️ " + label + " masih kosong."); return; }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback untuk browser/HP lama atau konteks non-HTTPS
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showCopyFeedback("✅ " + label + " disalin ke clipboard.");
  } catch (err) {
    showCopyFeedback("⚠️ Gagal menyalin: " + err.message);
  }
}

$("btnCopyUrl").addEventListener("click", () => copyToClipboard($("appsScriptUrl").value.trim(), "URL"));
$("btnCopyKey").addEventListener("click", () => copyToClipboard($("appsScriptKey").value.trim(), "API Key"));
$("btnToggleKeyVisibility").addEventListener("click", () => {
  const input = $("appsScriptKey");
  input.type = input.type === "password" ? "text" : "password";
});
$("btnCopyFirebaseUrl").addEventListener("click", () => copyToClipboard($("firebaseDbUrl").value.trim(), "Firebase Database URL"));
$("btnCopyLibreUrl").addEventListener("click", () => copyToClipboard($("libreTranslateUrl").value.trim(), "URL LibreTranslate"));

// ---------- Glossary modal ----------
function renderGlossary() {
  const list = $("glossaryList");
  list.innerHTML = "";
  state.glossary.forEach((term, i) => {
    const div = document.createElement("div");
    div.className = "glossary-item";
    div.innerHTML = `<span>${term}</span><button data-i="${i}" style="border:none;background:none;color:#e04b4b;cursor:pointer;">✕</button>`;
    list.appendChild(div);
  });
  list.querySelectorAll("button[data-i]").forEach(b => b.addEventListener("click", () => {
    state.glossary.splice(parseInt(b.dataset.i), 1);
    localStorage.setItem("mapin_glossary", JSON.stringify(state.glossary));
    renderGlossary();
  }));
}
$("btnGlossary").addEventListener("click", () => { renderGlossary(); openModal("glossaryModal"); });
$("btnAddGloss").addEventListener("click", () => {
  const val = $("glossTerm").value.trim();
  if (!val) return;
  state.glossary.push(val);
  localStorage.setItem("mapin_glossary", JSON.stringify(state.glossary));
  $("glossTerm").value = "";
  renderGlossary();
});

// Protect glossary terms before translation, restore after
function protectGlossary(text) {
  const map = [];
  let out = text;
  state.glossary.forEach((term, i) => {
    const token = `__MPTERM${i}__`;
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (re.test(out)) {
      out = out.replace(re, token);
      map.push({ token, term });
    }
  });
  return { text: out, map };
}
function restoreGlossary(text, map) {
  let out = text;
  map.forEach(({ token, term }) => {
    out = out.replace(new RegExp(token, "gi"), term);
  });
  return out;
}

// ---------- Input sanitization (PRD §11) ----------
function sanitize(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .slice(0, MAPIN_CONFIG.maxTextLength);
}

// ---------- Translation (dipakai Mode 1-HP; Mode Grup menerjemahkan di server saat poll) ----------
async function translateText(text, sourceCode, targetCode) {
  const clean = sanitize(text);
  const { text: protectedText, map } = protectGlossary(clean);

  let translated;
  if (state.backend === "appsscript" && state.appsScriptUrl) {
    translated = await translateViaAppsScript(protectedText, sourceCode, targetCode);
  } else if (state.backend === "firebase" && state.libreTranslateUrl) {
    translated = await translateViaLibreTranslateWithFallback(protectedText, sourceCode, targetCode);
  } else {
    translated = await translateViaDemoApi(protectedText, sourceCode, targetCode);
  }
  return restoreGlossary(translated, map);
}

async function translateViaDemoApi(text, sourceCode, targetCode) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceCode}|${targetCode}`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.responseData?.translatedText || text;
}

async function translateViaAppsScript(text, sourceCode, targetCode) {
  const data = await callBackend("translate", { text, source: sourceCode, target: targetCode });
  return data.translatedText;
}

// Mode Firebase: mesin terjemahan LibreTranslate dipanggil LANGSUNG dari
// browser (tanpa server rahasia) — lihat catatan keamanan di config.js.
// Coba ulang sekali ke mirror yang sama kalau gagal sesaat (jaringan/
// mirror publik sedang sibuk), supaya lebih tahan banting seperti mode
// Apps Script.
async function translateViaLibreTranslate(text, sourceCode, targetCode, retriesLeft) {
  if (!state.libreTranslateUrl) throw new Error("URL LibreTranslate belum diatur di ⚙️ Pengaturan.");
  if (retriesLeft === undefined) retriesLeft = 1;
  try {
    const res = await fetch(state.libreTranslateUrl + "/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: sourceCode, target: targetCode, format: "text" })
    });
    if (!res.ok) throw new Error("Server LibreTranslate merespons status " + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.translatedText || text;
  } catch (err) {
    if (retriesLeft > 0) {
      await sleep_(500);
      return translateViaLibreTranslate(text, sourceCode, targetCode, retriesLeft - 1);
    }
    throw err;
  }
}

// Mirror publik LibreTranslate dijalankan komunitas (bukan Google/perusahaan
// besar) — kadang down atau CORS-nya menolak domain di luar frontend resmi
// mereka. Supaya Mode Grup TIDAK ikut mati total hanya karena satu mirror
// sedang bermasalah, kalau LibreTranslate gagal (setelah retry di atas),
// aplikasi jatuh ke MyMemory (mesin yang sama seperti Mode Demo — CORS-nya
// selalu terbuka untuk semua domain, sudah terbukti stabil) sebagai
// cadangan. Akurasi turun sementara ke level Mode Demo, tapi Mode Grup
// tetap berfungsi sampai mirror LibreTranslate pulih atau diganti manual.
async function translateViaLibreTranslateWithFallback(text, sourceCode, targetCode) {
  try {
    return await translateViaLibreTranslate(text, sourceCode, targetCode);
  } catch (err) {
    console.warn("LibreTranslate gagal, jatuh ke MyMemory sebagai cadangan:", err.message);
    try {
      return await translateViaDemoApi(text, sourceCode, targetCode);
    } catch (err2) {
      throw err; // laporkan error LibreTranslate asli kalau cadangan juga gagal
    }
  }
}

// Generic caller untuk semua aksi backend (translate, createSession, joinSession, send, poll)
const sleep_ = (ms) => new Promise(r => setTimeout(r, ms));

// Google Apps Script SELALU membalas HTTP 200 dari kode Code.gs kita
// sendiri (Apps Script tidak mendukung status HTTP kustom) — jadi kalau
// fetch() di sini menerima status non-200 (mis. 404/502) atau gagal total
// (network error), itu artinya infrastruktur Google gagal MERUTEKAN
// permintaan ke script sama sekali (belum sempat dieksekusi), bukan error
// dari logika aplikasi. Ini kelemahan yang cukup dikenal pada Apps Script
// Web App untuk trafik yang datang beruntun. Solusinya: coba ulang
// otomatis beberapa kali sebelum benar-benar dianggap gagal — kegagalan
// semacam ini biasanya hilang sendiri dalam percobaan ke-2/ke-3.
// Error DARI LOGIKA APLIKASI (mis. "PIN salah", "Ruangan penuh") selalu
// datang sebagai HTTP 200 + field `error` di JSON, jadi TIDAK diulang di
// sini (mengulang tidak akan mengubah hasilnya).
async function callBackend(action, payload, retriesLeft) {
  if (!state.appsScriptUrl) throw new Error("URL Apps Script belum diatur di ⚙️ Pengaturan.");
  if (retriesLeft === undefined) retriesLeft = 2; // total 3 percobaan

  let res, networkError = null;
  try {
    res = await fetch(state.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight on Apps Script
      body: JSON.stringify(Object.assign({ apiKey: state.appsScriptKey, action }, payload))
    });
  } catch (err) {
    networkError = err;
  }

  const transientFailure = networkError || !res.ok;
  if (transientFailure) {
    if (retriesLeft > 0) {
      await sleep_(500);
      return callBackend(action, payload, retriesLeft - 1);
    }
    throw new Error(networkError ? networkError.message : ("Backend error " + res.status + " (server Google sesaat tidak merespons — coba lagi)"));
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error); // error logika aplikasi — tidak diulang
  return data;
}

// ============================================================
// Mode Grup Multi-HP — sesi & relay pesan antar 2-5 perangkat
// Konsep: tiap HP hanya bicara & mendengar dalam BAHASANYA SENDIRI.
// Server menerjemahkan tiap pesan sesuai bahasa masing-masing pendengar
// saat poll — supaya layar tidak dipenuhi banyak bahasa sekaligus.
// ============================================================
function requireGroupBackend() {
  const okAppsScript = state.backend === "appsscript" && state.appsScriptUrl;
  const okFirebase = state.backend === "firebase" && state.firebaseDbUrl && state.libreTranslateUrl;
  if (!okAppsScript && !okFirebase) {
    alert("Mode Grup Multi-HP butuh backend aktif.\nBuka ⚙️ Pengaturan, pilih 'Produksi (Apps Script)' atau 'Firebase (gratis)', lengkapi kolomnya, lalu coba lagi.");
    return false;
  }
  return true;
}

// ---------- Firebase Realtime Database — REST API (tanpa SDK, tanpa server) ----------
// Dipanggil langsung via fetch() ke {databaseURL}/{path}.json, sesuai
// dokumentasi REST resmi Firebase. Tidak ada rate limiting/validasi
// tambahan di sini selain yang diatur lewat Rules Database itu sendiri
// — lihat DEPLOY_GUIDE.md "Opsi C" untuk contoh Rules yang disarankan.
function fbUrl(path) { return state.firebaseDbUrl + path + ".json"; }

async function fbGet(path) {
  const res = await fetch(fbUrl(path));
  if (!res.ok) throw new Error("Firebase error (status " + res.status + ")");
  return res.json();
}
async function fbPut(path, value) {
  const res = await fetch(fbUrl(path), { method: "PUT", body: JSON.stringify(value) });
  if (!res.ok) throw new Error("Firebase error (status " + res.status + ")");
  return res.json();
}
async function fbPatch(path, value) {
  const res = await fetch(fbUrl(path), { method: "PATCH", body: JSON.stringify(value) });
  if (!res.ok) throw new Error("Firebase error (status " + res.status + ")");
  return res.json();
}
async function fbPost(path, value) {
  const res = await fetch(fbUrl(path), { method: "POST", body: JSON.stringify(value) });
  if (!res.ok) throw new Error("Firebase error (status " + res.status + ")");
  return res.json(); // { name: "<pushKey>" }
}
async function fbDelete(path) {
  const res = await fetch(fbUrl(path), { method: "DELETE" });
  if (!res.ok) throw new Error("Firebase error (status " + res.status + ")");
}
// Versi "fire-and-forget" pakai fetch keepalive — dipakai khusus saat
// tab/app ditutup (beforeunload/pagehide), supaya permintaan hapus tetap
// sempat terkirim ke Firebase walau halaman sedang dalam proses menutup
// dan tidak sempat menunggu respons.
function fbDeleteBeacon_(path) {
  try { fetch(fbUrl(path), { method: "DELETE", keepalive: true }); } catch {}
}

// Bersihkan ruangan dari Firebase saat sesi berakhir, supaya database tidak
// menumpuk ruangan yang sudah tidak dipakai (Firebase Spark tidak punya
// cron/Cloud Functions bawaan untuk auto-hapus seperti CacheService di
// Apps Script). Host yang mengakhiri sesi akan menghapus SELURUH ruangan
// (termasuk entri daftar publik); peserta biasa hanya menghapus dirinya
// sendiri dari daftar peserta supaya ruangan tetap ada untuk yang lain.
// useBeacon=true dipakai saat tab/app benar-benar ditutup — lihat
// fbDeleteBeacon_ di atas.
function cleanupFirebaseRoomOnExit_(useBeacon) {
  if (state.backend !== "firebase" || !state.sessionConnected || !state.sessionCode) return;
  const del = useBeacon
    ? (path) => fbDeleteBeacon_(path)
    : (path) => fbDelete(path).catch(() => {});
  if (state.isHost) {
    del("/rooms/" + state.sessionCode);
    del("/publicRooms/" + state.sessionCode);
  } else if (state.participantId) {
    del("/rooms/" + state.sessionCode + "/participants/" + state.participantId);
  }
}
window.addEventListener("beforeunload", () => cleanupFirebaseRoomOnExit_(true));
window.addEventListener("pagehide", () => cleanupFirebaseRoomOnExit_(true));

function randomCode_(len) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I biar tidak salah baca
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function randomParticipantId_() {
  return (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(36).slice(2)));
}

function setSessionStatus(text, kind) {
  $("sessionStatusText").textContent = text;
  $("sessionDot").className = "dot " + (kind || "");
}

function renderParticipants() {
  const box = $("participantsList");
  box.innerHTML = "";
  state.participants.forEach(p => {
    const span = document.createElement("span");
    span.className = "status-pill";
    const mine = p.participantId === state.participantId;
    span.textContent = (mine ? "🟠 " : "👤 ") + p.name + " (" + langByCode(p.lang).label + ")" + (mine ? " — saya" : "");
    box.appendChild(span);
  });
}

async function createSession() {
  if (!requireGroupBackend()) return;
  const name = ($("myNameInput").value || "").trim() || "Peserta";
  const roomName = ($("roomNameInput").value || "").trim() || "Ruangan Tanpa Nama";
  const pin = ($("roomPinInput").value || "").trim();
  const isPublic = $("roomPublicCheckbox").checked;
  state.myName = name;
  setSessionStatus("Membuat ruangan...", "connecting");
  try {
    const data = state.backend === "firebase"
      ? await createSessionFirebase_(name, roomName, pin, isPublic)
      : await callBackend("createSession", { name, lang: state.myLang, roomName, pin, isPublic });
    state.sessionCode = data.sessionCode;
    state.participantId = data.participantId;
    state.roomName = data.roomName;
    state.isHost = true;
    state.roomLocked = false;
    state.participants = data.participants || [];
    $("sessionCodeInput").value = data.sessionCode;
    state.sessionConnected = true;
    state.pollSinceIndex = 0;
    state.seenMessageKeys = new Set();
    renderParticipants();
    updateLockButton();
    $("groupPanelTitle").textContent = "💬 " + state.roomName;
    setSessionStatus("Tersambung ke \"" + state.roomName + "\" — bagikan kode: " + data.sessionCode + (pin ? " (+ PIN)" : ""), "online");
    addBubble("transcriptGroup", "Ruangan \"" + state.roomName + "\" dibuat" + (pin ? " dengan PIN" : "") + ". Bagikan kode " + data.sessionCode + " ke rekan lain lewat jalur terpisah (maks. 5 peserta).", null, "Sistem");
    startPolling();
  } catch (err) {
    setSessionStatus("Gagal membuat ruangan: " + err.message, "offline");
  }
}

async function createSessionFirebase_(name, roomName, pin, isPublic) {
  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = randomCode_(5);
    const existing = await fbGet("/rooms/" + code);
    if (!existing) break;
    code = null;
  }
  if (!code) throw new Error("Gagal membuat kode ruangan unik, coba lagi.");
  const participantId = randomParticipantId_();
  const now = Date.now();
  const room = {
    roomName, pin: pin || "", locked: false, isPublic: !!isPublic,
    hostId: participantId, createdAt: now,
    participants: { [participantId]: { name, lang: state.myLang, joinedAt: now } }
  };
  await fbPut("/rooms/" + code, room);
  if (isPublic) {
    await fbPut("/publicRooms/" + code, { roomName, participantCount: 1, createdAt: now });
  }
  return {
    sessionCode: code, participantId, roomName,
    participants: [{ participantId, name, lang: state.myLang }]
  };
}

async function joinSession(codeOverride) {
  if (!requireGroupBackend()) return;
  const code = (codeOverride || $("sessionCodeInput").value.trim()).toUpperCase();
  const name = ($("myNameInput").value || "").trim() || "Peserta";
  const pin = ($("roomPinInput").value || "").trim();
  if (!code) { alert("Masukkan kode ruangan terlebih dahulu."); return; }
  state.myName = name;
  setSessionStatus("Menyambungkan...", "connecting");
  try {
    const data = state.backend === "firebase"
      ? await joinSessionFirebase_(code, name, pin)
      : await callBackend("joinSession", { sessionCode: code, name, lang: state.myLang, pin });
    state.sessionCode = code;
    state.participantId = data.participantId;
    state.roomName = data.roomName || "Ruangan " + code;
    state.isHost = false;
    state.roomLocked = false;
    state.participants = data.participants || [];
    state.sessionConnected = true;
    state.pollSinceIndex = 0;
    state.seenMessageKeys = new Set();
    renderParticipants();
    updateLockButton();
    $("groupPanelTitle").textContent = "💬 " + state.roomName;
    setSessionStatus("Tersambung ke \"" + state.roomName + "\" (" + code + ")", "online");
    addBubble("transcriptGroup", "Bergabung ke ruangan \"" + state.roomName + "\".", null, "Sistem");
    closeModal("roomsModal");
    startPolling();
  } catch (err) {
    setSessionStatus("Gagal gabung: " + err.message, "offline");
  }
}

async function joinSessionFirebase_(code, name, pin) {
  const room = await fbGet("/rooms/" + code);
  if (!room) throw new Error("Ruangan tidak ditemukan. Cek lagi kodenya.");
  if (room.locked) throw new Error("Ruangan sedang dikunci oleh host — tidak menerima peserta baru.");
  if (room.pin && room.pin !== pin) throw new Error("PIN salah.");
  const participants = room.participants || {};
  const count = Object.keys(participants).length;
  if (count >= 5) throw new Error("Ruangan sudah penuh (maksimal 5 peserta).");
  const participantId = randomParticipantId_();
  const now = Date.now();
  await fbPatch("/rooms/" + code + "/participants", { [participantId]: { name, lang: state.myLang, joinedAt: now } });
  if (room.isPublic) {
    await fbPatch("/publicRooms/" + code, { participantCount: count + 1 }).catch(() => {});
  }
  const allParticipants = Object.entries(Object.assign({}, participants, { [participantId]: { name, lang: state.myLang } }))
    .map(([pid, p]) => ({ participantId: pid, name: p.name, lang: p.lang }));
  return { participantId, roomName: room.roomName, participants: allParticipants };
}

function updateLockButton() {
  const btn = $("btnLockRoom");
  if (state.isHost && state.sessionConnected) {
    btn.style.display = "inline-flex";
    btn.textContent = state.roomLocked ? "🔓 Buka Kunci Ruangan" : "🔒 Kunci Ruangan";
  } else {
    btn.style.display = "none";
  }
}

async function toggleLockRoom() {
  try {
    let locked;
    if (state.backend === "firebase") {
      locked = !state.roomLocked;
      await fbPatch("/rooms/" + state.sessionCode, { locked });
      // Sembunyikan dari daftar publik saat dikunci, tampilkan lagi saat dibuka
      if (locked) {
        await fbDelete("/publicRooms/" + state.sessionCode).catch(() => {});
      } else {
        const room = await fbGet("/rooms/" + state.sessionCode);
        if (room && room.isPublic) {
          await fbPut("/publicRooms/" + state.sessionCode, {
            roomName: room.roomName,
            participantCount: Object.keys(room.participants || {}).length,
            createdAt: room.createdAt || Date.now()
          }).catch(() => {});
        }
      }
    } else {
      const data = await callBackend("lockRoom", { sessionCode: state.sessionCode, participantId: state.participantId });
      locked = data.locked;
    }
    state.roomLocked = locked;
    updateLockButton();
    addBubble("transcriptGroup", state.roomLocked ? "🔒 Ruangan dikunci — tidak menerima peserta baru." : "🔓 Ruangan dibuka kembali.", null, "Sistem");
  } catch (err) {
    alert("Gagal mengubah status kunci: " + err.message);
  }
}
$("btnLockRoom").addEventListener("click", toggleLockRoom);

async function listActiveRooms() {
  if (!requireGroupBackend()) return;
  const box = $("roomsList");
  box.innerHTML = "<p class='small-note'>Memuat...</p>";
  openModal("roomsModal");
  try {
    const rooms = state.backend === "firebase" ? await listActiveRoomsFirebase_() : (await callBackend("listRooms", {})).rooms || [];
    $("roomsEmptyNote").style.display = rooms.length === 0 ? "block" : "none";
    box.innerHTML = "";
    rooms.forEach(r => {
      const row = document.createElement("div");
      row.className = "glossary-item";
      row.style.alignItems = "center";
      row.innerHTML = `<span><strong>${r.roomName}</strong> — kode ${r.code} · ${r.participantCount}/${MAPIN_MAX_PARTICIPANTS_DISPLAY} peserta</span>`;
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary";
      btn.textContent = "Gabung";
      btn.style.fontSize = "12px";
      btn.style.padding = "6px 12px";
      btn.addEventListener("click", () => joinSession(r.code));
      row.appendChild(btn);
      box.appendChild(row);
    });
  } catch (err) {
    box.innerHTML = `<p class="small-note">Gagal memuat daftar ruangan: ${err.message}</p>`;
  }
}

// Firebase Spark tidak punya cron/Cloud Functions untuk auto-hapus entri
// kedaluwarsa (beda dengan CacheService di Apps Script yang otomatis
// expire 6 jam). Sebagai gantinya, setiap kali daftar ruangan publik
// dibuka, entri yang lebih tua dari 6 jam dibersihkan langsung dari sini
// (best-effort housekeeping, bukan jaminan mutlak — ruangan lama yang
// tidak pernah dilihat lewat menu ini bisa tetap tersimpan di database).
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
async function listActiveRoomsFirebase_() {
  const data = await fbGet("/publicRooms");
  if (!data) return [];
  const now = Date.now();
  const out = [];
  for (const code of Object.keys(data)) {
    const r = data[code];
    if (now - (r.createdAt || 0) > ROOM_TTL_MS) {
      fbDelete("/publicRooms/" + code).catch(() => {});
      continue;
    }
    out.push({ code, roomName: r.roomName, participantCount: r.participantCount || 0 });
  }
  return out;
}
const MAPIN_MAX_PARTICIPANTS_DISPLAY = 5;

function startPolling() {
  stopPolling();
  state.pollFailCount = 0;
  state.pollTimer = setInterval(pollSessionMessages, 1800);
}
function stopPolling() {
  if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  state.pollFailCount = 0;
}

// Ambang batas kegagalan berturut-turut sebelum ditampilkan sebagai error
// ke pengguna. Google Apps Script kadang membalas error sesaat (404/500)
// saat di-poll sangat sering (tiap 1,5-2 detik) — ini kelemahan bawaan
// infrastruktur Apps Script (cold start/batas eksekusi bersamaan), BUKAN
// berarti koneksi benar-benar putus. Jadi kegagalan tunggal diam-diam
// dicoba lagi di putaran berikutnya tanpa membuat pengguna panik; baru
// ditampilkan sebagai "Koneksi terganggu" kalau gagal berturut-turut.
const POLL_FAIL_THRESHOLD = 3;

async function pollSessionMessages() {
  if (!state.sessionConnected || !state.sessionCode) return;
  try {
    if (state.backend === "firebase") {
      await pollSessionMessagesFirebase_();
    } else {
      const data = await callBackend("poll", {
        sessionCode: state.sessionCode,
        participantId: state.participantId,
        sinceIndex: state.pollSinceIndex,
        myLang: state.myLang
      });
      state.pollSinceIndex = data.nextIndex;
      if (data.participants) { state.participants = data.participants; renderParticipants(); }
      if (typeof data.locked === "boolean" && data.locked !== state.roomLocked) {
        state.roomLocked = data.locked;
        updateLockButton();
      }
      (data.messages || []).forEach(handleIncomingGroupMessage);
    }
    // Pulih dari kegagalan sementara — kembalikan status normal tanpa berisik
    if (state.pollFailCount > 0) {
      state.pollFailCount = 0;
      setSessionStatus("Tersambung ke \"" + state.roomName + "\" (" + state.sessionCode + ")", "online");
    }
  } catch (err) {
    state.pollFailCount = (state.pollFailCount || 0) + 1;
    console.warn("Poll gagal (" + state.pollFailCount + "x):", err.message);
    if (state.pollFailCount >= POLL_FAIL_THRESHOLD) {
      setSessionStatus("Koneksi terganggu: " + err.message + " — mencoba lagi...", "offline");
    }
  }
}

// Mode Firebase: tidak ada nomor urut pesan seperti di Apps Script, jadi
// tiap poll mengambil SELURUH isi ruangan (peserta + pesan) dan membanding-
// kan kunci pesan yang sudah pernah dilihat (state.seenMessageKeys) — cukup
// murah karena ruangan kecil (maks. 5 peserta, riwayat pesan wajar per sesi).
async function pollSessionMessagesFirebase_() {
  const room = await fbGet("/rooms/" + state.sessionCode);
  if (!room) throw new Error("Ruangan tidak ditemukan lagi (mungkin dihapus).");

  const participants = Object.entries(room.participants || {}).map(([pid, p]) => ({ participantId: pid, name: p.name, lang: p.lang }));
  state.participants = participants;
  renderParticipants();

  if (typeof room.locked === "boolean" && room.locked !== state.roomLocked) {
    state.roomLocked = room.locked;
    updateLockButton();
  }

  if (!state.seenMessageKeys) state.seenMessageKeys = new Set();
  const messages = room.messages || {};
  const newKeys = Object.keys(messages).filter(k => !state.seenMessageKeys.has(k)).sort();
  for (const key of newKeys) {
    state.seenMessageKeys.add(key);
    const m = messages[key];
    if (m.participantId === state.participantId) continue; // pesan sendiri sudah tampil lokal
    try {
      const translatedText = await translateViaLibreTranslateWithFallback(m.original, m.sourceLang, state.myLang);
      handleIncomingGroupMessage({ participantId: m.participantId, name: m.name, sourceLang: m.sourceLang, original: m.original, translatedText });
    } catch (err) {
      console.warn("Gagal menerjemahkan pesan masuk:", err.message);
    }
  }
}

function handleIncomingGroupMessage(msg) {
  if (msg.participantId === state.participantId) return; // pesan sendiri sudah ditampilkan lokal
  addBubble("transcriptGroup", msg.original, msg.translatedText,
    msg.name + " · " + langByCode(msg.sourceLang).label + " (masuk)");
  speak(msg.translatedText, state.myLang);
}

async function sendToGroupSession(original) {
  if (state.deviceMode !== "dual" || !state.sessionConnected) return;
  try {
    if (state.backend === "firebase") {
      const key = await fbPost("/rooms/" + state.sessionCode + "/messages", {
        participantId: state.participantId, name: state.myName, sourceLang: state.myLang, original, time: Date.now()
      });
      if (key && key.name && state.seenMessageKeys) state.seenMessageKeys.add(key.name); // jangan proses ulang pesan sendiri saat poll berikutnya
    } else {
      await callBackend("send", { sessionCode: state.sessionCode, participantId: state.participantId, original });
    }
  } catch (err) {
    console.warn("Gagal mengirim ke sesi:", err.message);
    addBubble("transcriptGroup", "⚠️ Gagal mengirim pesan: " + err.message, null, "Sistem");
  }
}

// ---------- Device mode toggle (1 HP vs Grup Multi-HP) ----------
$("deviceModeToggle").addEventListener("click", e => {
  const btn = e.target.closest("button[data-devicemode]");
  if (!btn) return;
  const newMode = btn.dataset.devicemode;
  if (newMode === "dual" && !requireGroupBackend()) return;
  [...$("deviceModeToggle").children].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  state.deviceMode = newMode;
  $("dualSessionCard").style.display = newMode === "dual" ? "flex" : "none";
  $("classicPanels").style.display = newMode === "dual" ? "none" : "grid";
  $("groupPanel").style.display = newMode === "dual" ? "flex" : "none";
  $("langAField").style.display = newMode === "dual" ? "none" : "flex";
  $("langBField").style.display = newMode === "dual" ? "none" : "flex";
  if (newMode === "single") {
    state.sessionConnected = false;
    state.isHost = false;
    stopPolling();
    setSessionStatus("Belum tersambung", "");
    updateLockButton();
  }
});

$("btnCreateSession").addEventListener("click", createSession);
$("btnJoinSession").addEventListener("click", () => joinSession());
$("btnListRooms").addEventListener("click", listActiveRooms);

// ---------- Script-based language auto-detection (heuristik, mode demo) ----------
function detectScript(text) {
  if (/[぀-ヿ一-鿿]/.test(text)) return "ja";
  if (/[฀-๿]/.test(text)) return "th";
  if (/[؀-ۿ]/.test(text)) return "ar";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text)) return "vi";
  return null; // ambiguous latin script (id/en) — needs pair context
}

// ---------- TTS ----------
function speak(text, langCode) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  const lang = langByCode(langCode);
  utter.lang = lang.tts;
  utter.rate = state.speed;
  const voices = speechSynthesis.getVoices();
  const match = voices.find(v => v.lang === lang.tts) || voices.find(v => v.lang.startsWith(langCode));
  if (match) utter.voice = match;
  speechSynthesis.speak(utter);
}

// ---------- Transcript rendering ----------
function addBubble(panelId, original, translated, speakerLabel) {
  const el = $(panelId);
  const div = document.createElement("div");
  div.className = "bubble mine";
  const time = new Date().toLocaleTimeString();
  div.innerHTML = `<div class="orig">${original}</div>` +
    (translated ? `<div class="translated">${translated}</div>` : "") +
    `<div class="meta">${speakerLabel} · ${time}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  state.transcriptLog.push({ time, speaker: speakerLabel, original, translated });
}

// ---------- Mic status ----------
function setMicListening(btnId, listening) {
  $(btnId).classList.toggle("listening", listening);
}

// ---------- Speech recognition wrapper ----------
const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

function createRecognizer(langStt, { continuous = false, onInterim, onFinal, onEnd, onError }) {
  if (!SpeechRecognitionImpl) {
    alert("Browser Anda tidak mendukung Web Speech API. Gunakan Chrome atau Edge terbaru.");
    return null;
  }
  const rec = new SpeechRecognitionImpl();
  rec.lang = langStt;
  rec.continuous = continuous;
  rec.interimResults = true;
  rec.onresult = (evt) => {
    let interim = "", final = "";
    for (let i = evt.resultIndex; i < evt.results.length; i++) {
      const transcript = evt.results[i][0].transcript;
      if (evt.results[i].isFinal) final += transcript;
      else interim += transcript;
    }
    if (interim && onInterim) onInterim(interim);
    if (final && onFinal) onFinal(final.trim());
  };
  rec.onerror = (e) => { if (onError) onError(e); };
  rec.onend = () => { if (onEnd) onEnd(); };
  return rec;
}

// ---------- Panel A / B controllers (Mode 1-HP, 2 headset) ----------
function makeSpeakerController({ micBtnId, liveTextId, transcriptId, otherTranscriptId, getMyLang, getOtherLang, getSpeakerLabel }) {
  let recognizer = null;
  let listening = false;
  // Mode Tekan-untuk-Bicara (PTT): teks yang sudah "final" menurut browser
  // ditampung dulu di sini, TIDAK langsung dikirim — supaya jeda hening
  // sesaat di tengah bicara (mis. mikir sebentar) tidak membuat kalimat
  // terputus dan terkirim sebelum selesai. Baru dikirim saat tombol
  // benar-benar dilepas (lihat stop()).
  //
  // CATATAN DESAIN (setelah beberapa putaran percobaan): sempat dicoba
  // continuous:true + watchdog paksa-sambung-ulang untuk menjaga sesi tetap
  // hidup melewati jeda hening. Di device nyata itu malah bikin mic sering
  // berhenti-sambung sendiri dan terasa kacau — continuous:true memang
  // dikenal kurang stabil di banyak implementasi Chrome/Android. Solusi
  // yang dipakai sekarang JUSTRU sebaliknya: tetap pakai continuous:false
  // (perilaku bawaan browser yang paling stabil — satu sesi berhenti wajar
  // setiap kali browser mendeteksi akhir satu ucapan), TAPI begitu browser
  // menghentikan sesi itu (onEnd) sementara tombol masih ditahan, langsung
  // buka sesi BARU secara mulus untuk menangkap ucapan berikutnya. Hasilnya
  // sama-sama tidak pernah kirim di tengah jeda, tanpa keharusan memaksa
  // mode continuous yang rawan macet.
  let pttBuffer = "";
  // Sebagai jaga-jaga tambahan: kalau ada teks yang masih "interim" (belum
  // sempat ditandai final) tepat saat sesi berhenti/tombol dilepas, teks
  // itu tetap diikutkan — supaya ucapan pendek yang browser-nya lambat
  // memfinalisasi tidak hilang begitu saja.
  let lastInterimText = "";

  function flushInterimToBuffer() {
    const t = lastInterimText.trim();
    if (t) {
      pttBuffer = pttBuffer ? (pttBuffer + " " + t) : t;
      lastInterimText = "";
    }
  }

  async function handleFinalText(text, sourceLangOverride) {
    $(liveTextId).textContent = "";
    const sourceLang = sourceLangOverride || getMyLang();
    const targetLang = getOtherLang();
    const speakerLabel = getSpeakerLabel();
    addBubble(transcriptId, text, null, speakerLabel + " (asli)");
    try {
      const translated = await translateText(text, sourceLang, targetLang);
      const bubbles = $(transcriptId).querySelectorAll(".bubble");
      const last = bubbles[bubbles.length - 1];
      const div = document.createElement("div");
      div.className = "translated";
      div.textContent = "→ " + translated;
      last.appendChild(div);
      addBubble(otherTranscriptId, translated, null, speakerLabel + " (terjemahan)");
      speak(translated, targetLang);
    } catch (err) {
      console.error(err);
      addBubble(transcriptId, "⚠️ Gagal menerjemahkan: " + err.message, null, "Sistem");
    }
  }

  // Memulai (atau menyambung ulang secara mulus) SATU sesi SpeechRecognition.
  // Dipisah dari start() supaya sambung-ulang otomatis di onEnd TIDAK
  // mengosongkan pttBuffer yang sudah terkumpul dari ucapan sebelumnya.
  function beginRecognition() {
    const isPtt = state.mode === "ptt";
    let lang = getMyLang();
    let thisRec = createRecognizer(langByCode(lang).stt, {
      continuous: false,
      onInterim: (t) => {
        if (isPtt) lastInterimText = t;
        $(liveTextId).textContent = isPtt ? (pttBuffer ? pttBuffer + " " + t : t) : t;
      },
      onFinal: (t) => {
        if (isPtt) {
          // PTT: kumpulkan dulu, JANGAN kirim — dikirim nanti saat tombol dilepas
          lastInterimText = "";
          pttBuffer = pttBuffer ? (pttBuffer + " " + t) : t;
          $(liveTextId).textContent = pttBuffer;
        } else {
          let detectedLang = null;
          if (state.mode === "auto" || state.mode === "meeting") detectedLang = detectScript(t);
          handleFinalText(t, detectedLang);
        }
      },
      onEnd: () => {
        if (recognizer !== thisRec) return; // event basi dari instance lama — abaikan
        listening = false;
        setMicListening(micBtnId, false);
        if (isPtt) flushInterimToBuffer(); // jangan sampai teks yang belum "final" hilang sebelum sesi baru dibuka
        // Browser menghentikan sesi ini secara wajar setelah satu ucapan
        // selesai (perilaku bawaan continuous:false). Selama tombol PTT
        // masih ditahan (atau mode hands-free masih aktif), langsung buka
        // sesi baru tanpa jeda — perilaku standar, tanpa timer tambahan.
        if (state.sessionActive && thisRec.__shouldRestart) {
          if (beginRecognition()) {
            listening = true;
            setMicListening(micBtnId, true);
          }
        }
      },
      onError: (e) => {
        console.warn("STT error", e.error);
        if (e.error === "not-allowed") alert("Izin microphone ditolak. Aktifkan izin microphone di browser Anda.");
      }
    });
    if (!thisRec) return false;
    recognizer = thisRec;
    thisRec.__shouldRestart = true;
    try { thisRec.start(); } catch (e) { console.warn(e); return false; }
    return true;
  }

  function start() {
    if (!state.sessionActive) { alert("Tekan 'Mulai Sesi' terlebih dahulu."); return; }
    pttBuffer = "";
    lastInterimText = "";
    if (!beginRecognition()) return;
    listening = true;
    setMicListening(micBtnId, true);
  }

  function stop() {
    listening = false;
    if (recognizer) {
      recognizer.__shouldRestart = false;
      try { recognizer.stop(); } catch {}
    }
    setMicListening(micBtnId, false);
    $(liveTextId).textContent = "";
    // PTT: kirim SEKARANG, tepat saat tombol dilepas — gabungkan semua yang
    // sudah "final" (pttBuffer) DAN sisa teks yang masih "interim" saat
    // tombol dilepas, supaya ucapan pendek yang belum sempat difinalisasi
    // browser tetap ikut terkirim.
    if (state.mode === "ptt") {
      flushInterimToBuffer();
      if (pttBuffer.trim()) {
        const text = pttBuffer.trim();
        pttBuffer = "";
        handleFinalText(text);
      }
    }
  }

  const btn = $(micBtnId);
  btn.addEventListener("mousedown", () => { if (state.mode === "ptt") start(); });
  btn.addEventListener("mouseup", () => { if (state.mode === "ptt") stop(); });
  btn.addEventListener("mouseleave", () => { if (state.mode === "ptt" && listening) stop(); });
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); if (state.mode === "ptt") start(); });
  btn.addEventListener("touchend", (e) => { e.preventDefault(); if (state.mode === "ptt") stop(); });
  btn.addEventListener("click", () => {
    if (state.mode === "ptt") return;
    if (listening) stop(); else start();
  });

  return { stop };
}

let speakerA, speakerB;
function initControllers() {
  speakerA = makeSpeakerController({
    micBtnId: "micA", liveTextId: "liveA", transcriptId: "transcriptA", otherTranscriptId: "transcriptB",
    getMyLang: () => state.langA, getOtherLang: () => state.langB, getSpeakerLabel: labelA
  });
  speakerB = makeSpeakerController({
    micBtnId: "micB", liveTextId: "liveB", transcriptId: "transcriptB", otherTranscriptId: "transcriptA",
    getMyLang: () => state.langB, getOtherLang: () => state.langA, getSpeakerLabel: labelB
  });
}
initControllers();

// ---------- Mic controller Mode Grup (satu bahasa per HP) ----------
let groupMic = null;
function initGroupMic() {
  let recognizer = null;
  let listening = false;
  // Sama seperti mode 1-HP: tampung dulu teks final selama tombol PTT
  // ditahan, baru kirim saat dilepas — supaya jeda hening di tengah bicara
  // tidak membuat kalimat terpotong & terkirim sebelum selesai.
  let pttBuffer = "";
  // Lihat catatan panjang di makeSpeakerController: sebagian browser tidak
  // pernah menandai ucapan pendek sebagai "final" sama sekali di mode
  // continuous — jadi teks interim TERAKHIR juga disimpan supaya tidak
  // hilang begitu saja saat tombol dilepas.
  let lastInterimText = "";

  function flushInterimToBuffer() {
    const t = lastInterimText.trim();
    if (t) {
      pttBuffer = pttBuffer ? (pttBuffer + " " + t) : t;
      lastInterimText = "";
    }
  }

  async function handleFinalText(text) {
    $("liveGroup").textContent = "";
    addBubble("transcriptGroup", text, null, (state.myName || "Saya") + " (saya, asli)");
    sendToGroupSession(text);
  }

  // Lihat catatan desain di makeSpeakerController: continuous:false + buka
  // sesi baru begitu onEnd terjadi (selama tombol masih ditahan) terbukti
  // jauh lebih stabil di device nyata dibanding memaksa continuous:true.
  function beginRecognition() {
    const isPtt = state.mode === "ptt";
    let thisRec = createRecognizer(langByCode(state.myLang).stt, {
      continuous: false,
      onInterim: (t) => {
        if (isPtt) lastInterimText = t;
        $("liveGroup").textContent = isPtt ? (pttBuffer ? pttBuffer + " " + t : t) : t;
      },
      onFinal: (t) => {
        if (isPtt) {
          lastInterimText = "";
          pttBuffer = pttBuffer ? (pttBuffer + " " + t) : t;
          $("liveGroup").textContent = pttBuffer;
        } else {
          handleFinalText(t);
        }
      },
      onEnd: () => {
        if (recognizer !== thisRec) return; // event basi dari instance lama — abaikan
        listening = false;
        setMicListening("micGroup", false);
        if (isPtt) flushInterimToBuffer();
        // Langsung buka sesi baru begitu browser menghentikan sesi ini
        // secara wajar (selama tombol masih ditahan) — tanpa jeda/timer
        // tambahan, sesuai perilaku standar continuous:false.
        if (state.sessionActive && thisRec.__shouldRestart) {
          if (beginRecognition()) {
            listening = true;
            setMicListening("micGroup", true);
          }
        }
      },
      onError: (e) => {
        console.warn("STT error", e.error);
        if (e.error === "not-allowed") alert("Izin microphone ditolak. Aktifkan izin microphone di browser Anda.");
      }
    });
    if (!thisRec) return false;
    recognizer = thisRec;
    thisRec.__shouldRestart = true;
    try { thisRec.start(); } catch (e) { console.warn(e); return false; }
    return true;
  }

  function start() {
    if (!state.sessionActive) { alert("Tekan 'Mulai Sesi' terlebih dahulu."); return; }
    if (!state.sessionConnected) { alert("Gabung/buat sesi grup terlebih dahulu."); return; }
    pttBuffer = "";
    lastInterimText = "";
    if (!beginRecognition()) return;
    listening = true;
    setMicListening("micGroup", true);
  }

  function stop() {
    listening = false;
    if (recognizer) { recognizer.__shouldRestart = false; try { recognizer.stop(); } catch {} }
    setMicListening("micGroup", false);
    $("liveGroup").textContent = "";
    if (state.mode === "ptt") {
      flushInterimToBuffer();
      if (pttBuffer.trim()) {
        const text = pttBuffer.trim();
        pttBuffer = "";
        handleFinalText(text);
      }
    }
  }

  const btn = $("micGroup");
  btn.addEventListener("mousedown", () => { if (state.mode === "ptt") start(); });
  btn.addEventListener("mouseup", () => { if (state.mode === "ptt") stop(); });
  btn.addEventListener("mouseleave", () => { if (state.mode === "ptt" && listening) stop(); });
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); if (state.mode === "ptt") start(); });
  btn.addEventListener("touchend", (e) => { e.preventDefault(); if (state.mode === "ptt") stop(); });
  btn.addEventListener("click", () => {
    if (state.mode === "ptt") return;
    if (listening) stop(); else start();
  });

  return { stop };
}
groupMic = initGroupMic();

// ---------- Session controls ----------
$("btnStart").addEventListener("click", () => {
  state.sessionActive = true;
  $("btnStart").disabled = true;
  $("btnStop").disabled = false;
  if (state.deviceMode === "dual") {
    addBubble("transcriptGroup", "— Sesi dimulai —", null, "Sistem");
  } else {
    addBubble("transcriptA", "— Sesi dimulai —", null, "Sistem");
    addBubble("transcriptB", "— Sesi dimulai —", null, "Sistem");
  }
});
$("btnStop").addEventListener("click", () => {
  state.sessionActive = false;
  speakerA.stop(); speakerB.stop(); groupMic.stop();
  $("btnStart").disabled = false;
  $("btnStop").disabled = true;
  if (state.deviceMode === "dual") {
    addBubble("transcriptGroup", "— Sesi selesai —", null, "Sistem");
    if (state.backend === "firebase" && state.sessionConnected) {
      cleanupFirebaseRoomOnExit_(false); // hapus ruangan (host) / keluar dari ruangan (peserta) di Firebase
      stopPolling();
      state.sessionConnected = false;
      state.isHost = false;
      state.roomLocked = false;
      setSessionStatus("Ruangan dihapus dari database — sesi selesai.", "");
      updateLockButton();
    }
  } else {
    addBubble("transcriptA", "— Sesi selesai —", null, "Sistem");
    addBubble("transcriptB", "— Sesi selesai —", null, "Sistem");
  }
});

$("btnClear").addEventListener("click", () => {
  $("transcriptA").innerHTML = "";
  $("transcriptB").innerHTML = "";
  $("transcriptGroup").innerHTML = "";
  state.transcriptLog = [];
});

function transcriptHeaderLines() {
  const lines = [];
  lines.push("MAP-IN Translator V1.0 — Transkrip Percakapan");
  lines.push("Tanggal: " + new Date().toLocaleString());
  if (state.deviceMode === "dual") {
    lines.push("Mode: Grup Multi-HP — Ruangan \"" + (state.roomName || "-") + "\" (Kode: " + state.sessionCode + ")");
  } else {
    lines.push("Pasangan Bahasa: " + labelA() + " (" + langByCode(state.langA).label + ") <-> " +
      labelB() + " (" + langByCode(state.langB).label + ")");
  }
  return lines;
}

$("btnDownload").addEventListener("click", () => {
  if (state.transcriptLog.length === 0) { alert("Belum ada transkrip untuk diunduh."); return; }
  let out = transcriptHeaderLines().join("\n") + "\n";
  out += "=".repeat(50) + "\n\n";
  state.transcriptLog.forEach(row => {
    out += `[${row.time}] ${row.speaker}: ${row.original}\n`;
    if (row.translated) out += `      → ${row.translated}\n`;
  });
  const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mapin-transkrip-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Unduh transkrip sebagai PDF ----------
// Memakai fitur "cetak" bawaan browser (bukan library PDF pihak ketiga),
// supaya font Jepang/Thai/Arab/Vietnam dirender pakai font sistem yang
// SAMA seperti yang sudah tampil benar di layar aplikasi — menghindari
// masalah "tulisan kacau/kotak-kotak" yang sering terjadi kalau font PDF
// tidak mendukung aksara non-Latin. Di HP (Android/iOS Chrome & Safari),
// dialog cetak punya opsi "Simpan sebagai PDF" / "Save as PDF".
function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

$("btnDownloadPdf").addEventListener("click", () => {
  if (state.transcriptLog.length === 0) { alert("Belum ada transkrip untuk diunduh."); return; }

  const headerLines = transcriptHeaderLines();
  const rowsHtml = state.transcriptLog.map(row => `
    <div class="row">
      <div class="meta">${escapeHtml_(row.time)} — <strong>${escapeHtml_(row.speaker)}</strong></div>
      <div class="orig">${escapeHtml_(row.original)}</div>
      ${row.translated ? `<div class="trans">→ ${escapeHtml_(row.translated)}</div>` : ""}
    </div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8" />
<title>MAP-IN Transkrip</title>
<style>
  body { font-family: "Noto Sans", "Segoe UI", Arial, sans-serif; padding: 24px; color: #222; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .header-line { font-size: 12px; color: #555; margin: 2px 0; }
  hr { margin: 14px 0 18px; border: none; border-top: 1px solid #ccc; }
  .row { margin-bottom: 14px; page-break-inside: avoid; }
  .meta { font-size: 11px; color: #888; margin-bottom: 2px; }
  .orig { font-size: 14px; font-weight: 600; }
  .trans { font-size: 14px; color: #444; font-style: italic; margin-top: 2px; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <h1>MAP-IN Translator V1.0 — Transkrip Percakapan</h1>
  ${headerLines.slice(1).map(l => `<div class="header-line">${escapeHtml_(l)}</div>`).join("")}
  <hr />
  ${rowsHtml}
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 300);
    };
  <\/script>
</body></html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup diblokir browser. Izinkan popup untuk situs ini agar bisa mengunduh PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
});

updateMicHints();
