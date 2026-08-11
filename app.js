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
  speed: 1.0,
  mode: "ptt", // ptt | auto | meeting
  backend: localStorage.getItem("mapin_backend") || MAPIN_CONFIG.backendMode,
  appsScriptUrl: localStorage.getItem("mapin_url") || MAPIN_CONFIG.appsScriptUrl,
  appsScriptKey: localStorage.getItem("mapin_key") || MAPIN_CONFIG.appsScriptApiKey,
  glossary: JSON.parse(localStorage.getItem("mapin_glossary") || "[]"),
  sessionActive: false,
  transcriptLog: []
};

const $ = (id) => document.getElementById(id);

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
updateLangTags();

function langByCode(code) { return LANGUAGES.find(l => l.code === code); }
function updateLangTags() {
  $("langATag").textContent = "Bahasa " + langByCode(state.langA).label;
  $("langBTag").textContent = "Bahasa " + langByCode(state.langB).label;
}

$("langA").addEventListener("change", e => { state.langA = e.target.value; updateLangTags(); });
$("langB").addEventListener("change", e => { state.langB = e.target.value; updateLangTags(); });

// ---------- Speed toggle ----------
$("speedToggle").addEventListener("click", e => {
  const btn = e.target.closest("button[data-speed]");
  if (!btn) return;
  [...$("speedToggle").children].forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  state.speed = parseFloat(btn.dataset.speed);
});

// ---------- Mode toggle ----------
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
    $("panelB").querySelector(".panel-header h2").textContent = "Peserta Meeting";
    $("micB").querySelector ? null : null;
  } else {
    $("panelB").querySelector(".panel-header h2").textContent = "Pembicara B";
  }
  updateMicHints();
});

function updateMicHints() {
  const hints = document.querySelectorAll(".mic-hint");
  let txt = "Tahan tombol untuk bicara (Push-to-Talk)";
  if (state.mode === "auto") txt = "Klik sekali untuk mulai/berhenti mendengarkan otomatis";
  if (state.mode === "meeting") txt = "Klik untuk mulai mendengarkan audio meeting secara terus-menerus";
  hints.forEach(h => h.textContent = txt);
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
  closeModal("settingsModal");
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

// ---------- Translation ----------
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
  const res = await fetch(state.appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // avoids CORS preflight on Apps Script
    body: JSON.stringify({
      apiKey: state.appsScriptKey,
      text, source: sourceCode, target: targetCode
    })
  });
  if (!res.ok) throw new Error("Backend error " + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.translatedText;
}

// ---------- Script-based language auto-detection (heuristic, demo mode) ----------
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

// ---------- Panel A / B controllers ----------
function makeSpeakerController({ micBtnId, liveTextId, transcriptId, otherTranscriptId, getMyLang, getOtherLang, speakerLabel }) {
  let recognizer = null;
  let listening = false;
  let holdMode = true; // push-to-talk

  async function handleFinalText(text, sourceLangOverride) {
    $(liveTextId).textContent = "";
    const sourceLang = sourceLangOverride || getMyLang();
    const targetLang = getOtherLang();
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
        if (continuous && listening !== false && state.sessionActive && recognizer && recognizer.__shouldRestart) {
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
  // Push-to-talk (mousedown/up + touch)
  btn.addEventListener("mousedown", () => { if (state.mode === "ptt") start(false); });
  btn.addEventListener("mouseup", () => { if (state.mode === "ptt") stop(); });
  btn.addEventListener("mouseleave", () => { if (state.mode === "ptt" && listening) stop(); });
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); if (state.mode === "ptt") start(false); });
  btn.addEventListener("touchend", (e) => { e.preventDefault(); if (state.mode === "ptt") stop(); });
  // Click toggle for auto/meeting continuous modes
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
    getMyLang: () => state.langA, getOtherLang: () => state.langB, speakerLabel: "Pembicara A"
  });
  speakerB = makeSpeakerController({
    micBtnId: "micB", liveTextId: "liveB", transcriptId: "transcriptB", otherTranscriptId: "transcriptA",
    getMyLang: () => state.langB, getOtherLang: () => state.langA, speakerLabel: "Pembicara B"
  });
}
initControllers();

// ---------- Session controls ----------
$("btnStart").addEventListener("click", () => {
  state.sessionActive = true;
  $("btnStart").disabled = true;
  $("btnStop").disabled = false;
  addBubble("transcriptA", "— Sesi dimulai —", null, "Sistem");
  addBubble("transcriptB", "— Sesi dimulai —", null, "Sistem");
});
$("btnStop").addEventListener("click", () => {
  state.sessionActive = false;
  speakerA.stop(); speakerB.stop();
  $("btnStart").disabled = false;
  $("btnStop").disabled = true;
  addBubble("transcriptA", "— Sesi selesai —", null, "Sistem");
  addBubble("transcriptB", "— Sesi selesai —", null, "Sistem");
});

$("btnClear").addEventListener("click", () => {
  $("transcriptA").innerHTML = "";
  $("transcriptB").innerHTML = "";
  state.transcriptLog = [];
});

$("btnDownload").addEventListener("click", () => {
  if (state.transcriptLog.length === 0) { alert("Belum ada transkrip untuk diunduh."); return; }
  let out = "MAP-IN Translator V1.0 — Transkrip Percakapan\n";
  out += "Tanggal: " + new Date().toLocaleString() + "\n";
  out += "Pasangan Bahasa: " + langByCode(state.langA).label + " <-> " + langByCode(state.langB).label + "\n";
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

updateMicHints();
