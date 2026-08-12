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
$("btnSettings").addEventListener("click", () => {
  $("appsScriptUrl").value = state.appsScriptUrl;
  $("appsScriptKey").value = state.appsScriptKey;
  [...$("backendToggle").children].forEach(b => b.classList.toggle("active", b.dataset.backend === state.backend));
  openModal("settingsModal");
});
$("backendToggle").addEventListener("click", e => {
  const btn = e.target.closest("button[data-backend]");
  if (!btn) return;
  [...$("backendToggle").children].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
});
$("btnSaveSettings").addEventListener("click", () => {
  const backend = $("backendToggle").querySelector(".active").dataset.backend;
  state.backend = backend;
  state.appsScriptUrl = $("appsScriptUrl").value.trim();
  state.appsScriptKey = $("appsScriptKey").value.trim();
  localStorage.setItem("mapin_backend", state.backend);
  localStorage.setItem("mapin_url", state.appsScriptUrl);
  localStorage.setItem("mapin_key", state.appsScriptKey);
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
  } else {
    dot.className = "dot connecting";
    text.textContent = "Backend: Demo";
  }
}
updateBackendStatusPill();

// ---------- Tes Koneksi Backend — diagnosa langkah demi langkah dari HP ----------
async function testBackendConnection() {
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

// Generic caller untuk semua aksi backend (translate, createSession, joinSession, send, poll)
async function callBackend(action, payload) {
  if (!state.appsScriptUrl) throw new Error("URL Apps Script belum diatur di ⚙️ Pengaturan.");
  const res = await fetch(state.appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight on Apps Script
    body: JSON.stringify(Object.assign({ apiKey: state.appsScriptKey, action }, payload))
  });
  if (!res.ok) throw new Error("Backend error " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ============================================================
// Mode Grup Multi-HP — sesi & relay pesan antar 2-5 perangkat
// Konsep: tiap HP hanya bicara & mendengar dalam BAHASANYA SENDIRI.
// Server menerjemahkan tiap pesan sesuai bahasa masing-masing pendengar
// saat poll — supaya layar tidak dipenuhi banyak bahasa sekaligus.
// ============================================================
function requireAppsScriptBackend() {
  if (state.backend !== "appsscript" || !state.appsScriptUrl) {
    alert("Mode Grup Multi-HP butuh backend Produksi (Apps Script) aktif.\nBuka ⚙️ Pengaturan, pilih 'Produksi (Apps Script)', isi URL & API Key, lalu coba lagi.");
    return false;
  }
  return true;
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
  if (!requireAppsScriptBackend()) return;
  const name = ($("myNameInput").value || "").trim() || "Peserta";
  const roomName = ($("roomNameInput").value || "").trim() || "Ruangan Tanpa Nama";
  const pin = ($("roomPinInput").value || "").trim();
  const isPublic = $("roomPublicCheckbox").checked;
  state.myName = name;
  setSessionStatus("Membuat ruangan...", "connecting");
  try {
    const data = await callBackend("createSession", { name, lang: state.myLang, roomName, pin, isPublic });
    state.sessionCode = data.sessionCode;
    state.participantId = data.participantId;
    state.roomName = data.roomName;
    state.isHost = true;
    state.roomLocked = false;
    state.participants = data.participants || [];
    $("sessionCodeInput").value = data.sessionCode;
    state.sessionConnected = true;
    state.pollSinceIndex = 0;
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

async function joinSession(codeOverride) {
  if (!requireAppsScriptBackend()) return;
  const code = (codeOverride || $("sessionCodeInput").value.trim()).toUpperCase();
  const name = ($("myNameInput").value || "").trim() || "Peserta";
  const pin = ($("roomPinInput").value || "").trim();
  if (!code) { alert("Masukkan kode ruangan terlebih dahulu."); return; }
  state.myName = name;
  setSessionStatus("Menyambungkan...", "connecting");
  try {
    const data = await callBackend("joinSession", { sessionCode: code, name, lang: state.myLang, pin });
    state.sessionCode = code;
    state.participantId = data.participantId;
    state.roomName = data.roomName || "Ruangan " + code;
    state.isHost = false;
    state.roomLocked = false;
    state.participants = data.participants || [];
    state.sessionConnected = true;
    state.pollSinceIndex = 0;
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
    const data = await callBackend("lockRoom", { sessionCode: state.sessionCode, participantId: state.participantId });
    state.roomLocked = data.locked;
    updateLockButton();
    addBubble("transcriptGroup", state.roomLocked ? "🔒 Ruangan dikunci — tidak menerima peserta baru." : "🔓 Ruangan dibuka kembali.", null, "Sistem");
  } catch (err) {
    alert("Gagal mengubah status kunci: " + err.message);
  }
}
$("btnLockRoom").addEventListener("click", toggleLockRoom);

async function listActiveRooms() {
  if (!requireAppsScriptBackend()) return;
  const box = $("roomsList");
  box.innerHTML = "<p class='small-note'>Memuat...</p>";
  openModal("roomsModal");
  try {
    const data = await callBackend("listRooms", {});
    const rooms = data.rooms || [];
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

function handleIncomingGroupMessage(msg) {
  if (msg.participantId === state.participantId) return; // pesan sendiri sudah ditampilkan lokal
  addBubble("transcriptGroup", msg.original, msg.translatedText,
    msg.name + " · " + langByCode(msg.sourceLang).label + " (masuk)");
  speak(msg.translatedText, state.myLang);
}

async function sendToGroupSession(original) {
  if (state.deviceMode !== "dual" || !state.sessionConnected) return;
  try {
    await callBackend("send", { sessionCode: state.sessionCode, participantId: state.participantId, original });
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
  if (newMode === "dual" && !requireAppsScriptBackend()) return;
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

  function start(continuous) {
    if (!state.sessionActive) { alert("Tekan 'Mulai Sesi' terlebih dahulu."); return; }
    let lang = getMyLang();
    recognizer = createRecognizer(langByCode(lang).stt, {
      continuous,
      onInterim: (t) => $(liveTextId).textContent = t,
      onFinal: (t) => {
        let detectedLang = null;
        if (state.mode === "auto" || state.mode === "meeting") {
          detectedLang = detectScript(t);
        }
        handleFinalText(t, detectedLang);
        if (!continuous) stop();
      },
      onEnd: () => {
        listening = false;
        setMicListening(micBtnId, false);
        if (continuous && state.sessionActive && recognizer && recognizer.__shouldRestart) {
          try { recognizer.start(); } catch {}
        }
      },
      onError: (e) => {
        console.warn("STT error", e.error);
        if (e.error === "not-allowed") alert("Izin microphone ditolak. Aktifkan izin microphone di browser Anda.");
      }
    });
    if (!recognizer) return;
    recognizer.__shouldRestart = continuous;
    listening = true;
    setMicListening(micBtnId, true);
    try { recognizer.start(); } catch (e) { console.warn(e); }
  }

  function stop() {
    listening = false;
    if (recognizer) {
      recognizer.__shouldRestart = false;
      try { recognizer.stop(); } catch {}
    }
    setMicListening(micBtnId, false);
    $(liveTextId).textContent = "";
  }

  const btn = $(micBtnId);
  btn.addEventListener("mousedown", () => { if (state.mode === "ptt") start(false); });
  btn.addEventListener("mouseup", () => { if (state.mode === "ptt") stop(); });
  btn.addEventListener("mouseleave", () => { if (state.mode === "ptt" && listening) stop(); });
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); if (state.mode === "ptt") start(false); });
  btn.addEventListener("touchend", (e) => { e.preventDefault(); if (state.mode === "ptt") stop(); });
  btn.addEventListener("click", () => {
    if (state.mode === "ptt") return;
    if (listening) stop(); else start(true);
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

  async function handleFinalText(text) {
    $("liveGroup").textContent = "";
    addBubble("transcriptGroup", text, null, (state.myName || "Saya") + " (saya, asli)");
    sendToGroupSession(text);
  }

  function start(continuous) {
    if (!state.sessionActive) { alert("Tekan 'Mulai Sesi' terlebih dahulu."); return; }
    if (!state.sessionConnected) { alert("Gabung/buat sesi grup terlebih dahulu."); return; }
    recognizer = createRecognizer(langByCode(state.myLang).stt, {
      continuous,
      onInterim: (t) => $("liveGroup").textContent = t,
      onFinal: (t) => { handleFinalText(t); if (!continuous) stop(); },
      onEnd: () => {
        listening = false;
        setMicListening("micGroup", false);
        if (continuous && state.sessionActive && recognizer && recognizer.__shouldRestart) {
          try { recognizer.start(); } catch {}
        }
      },
      onError: (e) => {
        console.warn("STT error", e.error);
        if (e.error === "not-allowed") alert("Izin microphone ditolak. Aktifkan izin microphone di browser Anda.");
      }
    });
    if (!recognizer) return;
    recognizer.__shouldRestart = continuous;
    listening = true;
    setMicListening("micGroup", true);
    try { recognizer.start(); } catch (e) { console.warn(e); }
  }

  function stop() {
    listening = false;
    if (recognizer) { recognizer.__shouldRestart = false; try { recognizer.stop(); } catch {} }
    setMicListening("micGroup", false);
    $("liveGroup").textContent = "";
  }

  const btn = $("micGroup");
  btn.addEventListener("mousedown", () => { if (state.mode === "ptt") start(false); });
  btn.addEventListener("mouseup", () => { if (state.mode === "ptt") stop(); });
  btn.addEventListener("mouseleave", () => { if (state.mode === "ptt" && listening) stop(); });
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); if (state.mode === "ptt") start(false); });
  btn.addEventListener("touchend", (e) => { e.preventDefault(); if (state.mode === "ptt") stop(); });
  btn.addEventListener("click", () => {
    if (state.mode === "ptt") return;
    if (listening) stop(); else start(true);
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
