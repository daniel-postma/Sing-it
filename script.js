// =========================
// script.js (UPDATED)
// Adds:
// 1) 🎙 Mic per line (record + playback)
// 2) 🙈 Hide/show specific line (memory practice)
// 3) Practice mode toggle + Reveal-all button
// Works on HTTPS or localhost (mic permission required).
// =========================

let player;
let highlightIndex = -1;

let currentSong = null;
let lyrics = [];

let songList = [];
let currentSongIndex = 0;
let pendingVideoId = null;

const lyricsContainer = document.getElementById("lyrics");
const vocabPanel = document.getElementById("vocabPanel");

const showKanji = document.getElementById("showKanji");
const showKana = document.getElementById("showKana");
const showRomaji = document.getElementById("showRomaji");
const showEnglish = document.getElementById("showEnglish");
const showVocab = document.getElementById("showVocab");
const showTeigi = document.getElementById("showTeigi"); // ★ 日本語定義

const prevSongBtn = document.getElementById("prevSong");
const nextSongBtn = document.getElementById("nextSong");

const speedSlider = document.getElementById("speedSlider");
const speedDisplay = document.getElementById("speedDisplay");

// NEW UI (from updated HTML)
const practiceMode = document.getElementById("practiceMode");
const revealAllLinesBtn = document.getElementById("revealAllLines");

// =========================
// Mic + hide-line state
// =========================
let activeRecording = null; // { lineEl, recorder, stream, chunks }
let lineRecordings = new Map(); // lineId -> { url, mimeType }
let hiddenLineIds = new Set(); // lineId strings

function getSongId() {
  // stable key per song file/title; fallback to index
  if (currentSong?.id) return String(currentSong.id);
  if (currentSong?.title && currentSong?.artist)
    return `${currentSong.title}__${currentSong.artist}`;
  return `song_${currentSongIndex}`;
}

function hiddenKey() {
  return `singingflow_hiddenLines_${getSongId()}`;
}

function practiceModeKey() {
  return `singingflow_practiceMode_${getSongId()}`;
}

function loadHiddenSet() {
  try {
    const raw = localStorage.getItem(hiddenKey());
    const arr = raw ? JSON.parse(raw) : [];
    hiddenLineIds = new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    hiddenLineIds = new Set();
  }
}

function saveHiddenSet() {
  localStorage.setItem(hiddenKey(), JSON.stringify([...hiddenLineIds]));
}

function loadPracticeMode() {
  try {
    const raw = localStorage.getItem(practiceModeKey());
    const val = raw === "1";
    if (practiceMode) practiceMode.checked = val;
  } catch {
    // ignore
  }
}

function savePracticeMode() {
  if (!practiceMode) return;
  localStorage.setItem(practiceModeKey(), practiceMode.checked ? "1" : "0");
}

function supportsMic() {
  return (
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

// =========================
// YOUTUBE SETUP
// =========================
function extractVideoId(urlOrId) {
  if (!urlOrId) return "";
  const match = urlOrId.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : urlOrId;
}

function initPlayerWithVideo(videoId) {
  if (!videoId) return;

  if (player && typeof player.loadVideoById === "function") {
    player.loadVideoById(videoId);
    return;
  }

  if (window.YT && window.YT.Player) {
    player = new YT.Player("player", {
      height: "360",
      width: "640",
      videoId,
      playerVars: { autoplay: 0 },
    });
    pendingVideoId = null;
    return;
  }

  pendingVideoId = videoId;
}

function onYouTubeIframeAPIReady() {
  if (pendingVideoId) initPlayerWithVideo(pendingVideoId);
}

// =========================
// SONG LOADING
// =========================
function loadSong(index) {
  if (index < 0 || index >= songList.length) return;

  currentSongIndex = index;
  const songMeta = songList[index];

  fetch(songMeta.file)
    .then((res) => res.json())
    .then((json) => {
      currentSong = json;
      lyrics = json.lyrics || [];

      // reset state per song
      highlightIndex = -1;
      stopRecordingSafely();
      lineRecordings.forEach((r) => {
        try {
          if (r?.url) URL.revokeObjectURL(r.url);
        } catch {}
      });
      lineRecordings = new Map();

      loadHiddenSet();
      loadPracticeMode();

      const videoId = extractVideoId(json.videoUrl || json.videoId);
      initPlayerWithVideo(videoId);

      renderLyrics();
      updateSongNavButtons();
    })
    .catch((e) => console.error("❌ Failed to load song:", e));
}

function updateSongNavButtons() {
  prevSongBtn.disabled = currentSongIndex <= 0;
  nextSongBtn.disabled = currentSongIndex >= songList.length - 1;
}

// =========================
// LYRICS RENDER
// =========================
function renderLyrics() {
  lyricsContainer.innerHTML = "";

  const isPractice = Boolean(practiceMode?.checked);
  lyricsContainer.classList.toggle("practice-on", isPractice);

  lyrics.forEach((line, i) => {
    const lineId = String(i);

    // outer wrapper for a line (new structure)
    const row = document.createElement("div");
    row.className = "lyric-line";
    row.dataset.lineId = lineId;

    // start/end for segment play if available
    if (typeof line.time === "number") row.dataset.start = String(line.time);
    if (typeof line.endTime === "number")
      row.dataset.end = String(line.endTime);

    // hidden state
    if (hiddenLineIds.has(lineId)) row.classList.add("is-hidden");

    // tools (only visible in practice mode via CSS)
    const tools = document.createElement("div");
    tools.className = "line-tools";
    tools.innerHTML = `
      <button class="line-btn play-line" type="button" title="Play this line">🔊</button>
      <button class="line-btn rec-line" type="button" title="Record yourself">🎙</button>
      <button class="line-btn play-rec" type="button" title="Play your recording" disabled>▶</button>
      <button class="line-btn hide-line" type="button" title="Hide/show line from memory">🙈</button>
    `;

    // content area
    const content = document.createElement("div");
    content.className = "line-content";

    const parts = [];

    if (showKanji?.checked && line.kanji)
      parts.push(
        `<div class="line-text line-kanji">${escapeHtml(line.kanji)}</div>`
      );
    if (showKana?.checked && line.kana)
      parts.push(
        `<div class="line-text line-kana">${escapeHtml(line.kana)}</div>`
      );
    if (showRomaji?.checked && line.romaji)
      parts.push(
        `<div class="line-text line-romaji">${escapeHtml(line.romaji)}</div>`
      );
    if (showEnglish?.checked && line.english)
      parts.push(
        `<div class="line-text line-english">${escapeHtml(line.english)}</div>`
      );

    if (parts.length === 0) parts.push(`<div class="line-text">&nbsp;</div>`);
    content.innerHTML = parts.join("");

    // hidden recording audio holder
    const recAudio = document.createElement("audio");
    recAudio.className = "rec-audio";
    recAudio.hidden = true;

    // assemble
    row.appendChild(tools);
    row.appendChild(content);
    row.appendChild(recAudio);

    // click on content seeks line (keeps your current behavior)
    content.addEventListener("click", () => handleLineClick(i));

    // wire tools
    const playBtn = tools.querySelector(".play-line");
    const recBtn = tools.querySelector(".rec-line");
    const playRecBtn = tools.querySelector(".play-rec");
    const hideBtn = tools.querySelector(".hide-line");

    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleLineClick(i);
    });

    hideBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleHideLine(lineId, row);
    });

    playRecBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rec = lineRecordings.get(lineId);
      if (!rec?.url) return;
      recAudio.src = rec.url;
      recAudio.play().catch(() => {});
    });

    recBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (!supportsMic()) {
        alert(
          "Microphone recording isn’t supported in this browser. Try Chrome/Edge on HTTPS or localhost."
        );
        return;
      }

      // toggle: if this line is recording -> stop, else start
      if (row.classList.contains("is-recording")) {
        stopRecordingSafely();
        return;
      }

      try {
        await startRecordingForLine(row, lineId, playRecBtn);
      } catch (err) {
        console.error(err);
        alert("Could not start recording. Please allow microphone access.");
      }
    });

    // enable play-rec if recording exists for this line
    if (lineRecordings.has(lineId)) playRecBtn.disabled = false;

    lyricsContainer.appendChild(row);
  });

  if (currentSong?.title && currentSong?.artist) {
    document.querySelector(
      "h1"
    ).textContent = `🎵 ${currentSong.title} - ${currentSong.artist}`;
  }
}

function handleLineClick(i) {
  const t = lyrics[i]?.time;
  if (player && typeof t === "number") {
    player.seekTo(t, true);
    player.playVideo();
  }
}

// =========================
// VOCAB PANEL
// =========================
function showVocabForLine(line) {
  if (!line) {
    vocabPanel.innerHTML = "";
    return;
  }

  const chunks = [];

  // English-style vocab
  if (showVocab?.checked && line.vocab) {
    const list = line.vocab
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);
    chunks.push(
      ...list.map((w) => `<div class="vocab-word">${escapeHtml(w)}</div>`)
    );
  }

  // 日本語定義
  if (showTeigi?.checked && line.japaneseVocab) {
    const listJ = line.japaneseVocab
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);
    chunks.push(
      ...listJ.map((w) => `<div class="vocab-word jp">${escapeHtml(w)}</div>`)
    );
  }

  vocabPanel.innerHTML = chunks.length ? chunks.join("") : "";
}

// =========================
// PRACTICE: HIDE/REVEAL
// =========================
function toggleHideLine(lineId, lineEl) {
  if (hiddenLineIds.has(lineId)) hiddenLineIds.delete(lineId);
  else hiddenLineIds.add(lineId);

  saveHiddenSet();
  lineEl.classList.toggle("is-hidden", hiddenLineIds.has(lineId));
}

function revealAllLines() {
  hiddenLineIds.clear();
  saveHiddenSet();
  document
    .querySelectorAll(".lyric-line")
    .forEach((el) => el.classList.remove("is-hidden"));
}

// =========================
// PRACTICE: MIC RECORDING
// =========================
async function startRecordingForLine(lineEl, lineId, playRecBtn) {
  // stop any other active recording
  stopRecordingSafely();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];

  activeRecording = { lineEl, recorder, stream, chunks };

  lineEl.classList.add("is-recording");
  const recButton = lineEl.querySelector(".rec-line");
  if (recButton) recButton.textContent = "⏹";

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    try {
      // revoke previous url for this line
      const prev = lineRecordings.get(lineId);
      if (prev?.url) URL.revokeObjectURL(prev.url);

      const blob = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });
      const url = URL.createObjectURL(blob);
      lineRecordings.set(lineId, {
        url,
        mimeType: recorder.mimeType || "audio/webm",
      });

      if (playRecBtn) playRecBtn.disabled = false;
    } catch (err) {
      console.error(err);
    } finally {
      // cleanup mic
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch {}

      lineEl.classList.remove("is-recording");
      const rb = lineEl.querySelector(".rec-line");
      if (rb) rb.textContent = "🎙";

      activeRecording = null;
    }
  };

  recorder.start();
}

function stopRecordingSafely() {
  if (
    activeRecording?.recorder &&
    activeRecording.recorder.state !== "inactive"
  ) {
    try {
      activeRecording.recorder.stop();
    } catch {}
    return;
  }

  // also ensure stream is stopped if recorder is weird
  if (activeRecording?.stream) {
    try {
      activeRecording.stream.getTracks().forEach((t) => t.stop());
    } catch {}
  }

  if (activeRecording?.lineEl) {
    activeRecording.lineEl.classList.remove("is-recording");
    const rb = activeRecording.lineEl.querySelector(".rec-line");
    if (rb) rb.textContent = "🎙";
  }
  activeRecording = null;
}

// =========================
// TOGGLES
// =========================

// Lyric-display toggles
[showKanji, showKana, showRomaji, showEnglish].forEach((cb) => {
  if (cb) cb.addEventListener("change", renderLyrics);
});

// Vocab-panel toggles
[showVocab, showTeigi].forEach((cb) => {
  if (cb)
    cb.addEventListener("change", () => {
      if (highlightIndex >= 0 && lyrics[highlightIndex]) {
        showVocabForLine(lyrics[highlightIndex]);
      } else {
        vocabPanel.innerHTML = "";
      }
    });
});

// Practice mode toggle + reveal all
if (practiceMode) {
  practiceMode.addEventListener("change", () => {
    savePracticeMode();
    renderLyrics();
  });
}

if (revealAllLinesBtn) {
  revealAllLinesBtn.addEventListener("click", () => revealAllLines());
}

// =========================
// SONG NAVIGATION BUTTONS
// =========================
prevSongBtn.addEventListener("click", () => {
  if (currentSongIndex > 0) loadSong(currentSongIndex - 1);
});

nextSongBtn.addEventListener("click", () => {
  if (currentSongIndex < songList.length - 1) loadSong(currentSongIndex + 1);
});

// =========================
// SPEED SLIDER
// =========================
if (speedSlider) {
  speedSlider.addEventListener("input", () => {
    if (!player || !player.setPlaybackRate) return;

    const raw = parseFloat(speedSlider.value);

    // YouTube only allows specific rates
    const allowed =
      typeof player.getAvailablePlaybackRates === "function"
        ? player.getAvailablePlaybackRates()
        : [0.5, 0.75, 1, 1.25, 1.5, 2];

    // snap slider value to the nearest allowed rate
    let best = allowed[0];
    let bestDiff = Math.abs(raw - best);
    for (const r of allowed) {
      const d = Math.abs(raw - r);
      if (d < bestDiff) {
        best = r;
        bestDiff = d;
      }
    }

    player.setPlaybackRate(best);

    if (speedDisplay) {
      speedDisplay.textContent =
        best.toFixed(2).replace(/\.00$/, "").replace(/\.0$/, "") + "x";
    }
  });
}

// =========================
// LYRIC HIGHLIGHT LOOP
// =========================
setInterval(() => {
  if (!player?.getCurrentTime) return;

  const now = player.getCurrentTime();
  let idx = -1;

  for (let i = 0; i < lyrics.length; i++) {
    if (typeof lyrics[i].time === "number" && lyrics[i].time <= now) {
      idx = i;
    }
  }

  if (idx !== highlightIndex) {
    highlightIndex = idx;

    const lines = document.querySelectorAll(".lyric-line");
    lines.forEach((el, i) => el.classList.toggle("highlight", i === idx));

    if (idx >= 0) {
      const el = lines[idx];
      lyricsContainer.scrollTo({
        top: Math.max(0, el.offsetTop - 230),
        behavior: "smooth",
      });
      showVocabForLine(lyrics[idx]);
    } else {
      vocabPanel.innerHTML = "";
    }
  }
}, 200);

// =========================
// LOAD SONG LIST (index.json)
// =========================
fetch("index.json")
  .then((res) => res.json())
  .then((list) => {
    songList = list;
    if (songList.length > 0) loadSong(0);
  })
  .catch((err) => console.error("❌ Failed to load index.json:", err));

// =========================
// Utils
// =========================
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
