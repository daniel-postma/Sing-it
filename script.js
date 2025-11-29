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

const prevSongBtn = document.getElementById("prevSong");
const nextSongBtn = document.getElementById("nextSong");

const speedSlider = document.getElementById("speedSlider");
const speedDisplay = document.getElementById("speedDisplay");

/* =============================================
   YOUTUBE SETUP
============================================= */

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

/* =============================================
   SONG LOADING
============================================= */

function loadSong(index) {
  if (index < 0 || index >= songList.length) return;

  currentSongIndex = index;
  const songMeta = songList[index];

  fetch(songMeta.file)
    .then((res) => res.json())
    .then((json) => {
      currentSong = json;
      lyrics = json.lyrics || [];

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

/* =============================================
   LYRICS
============================================= */

function renderLyrics() {
  lyricsContainer.innerHTML = "";

  lyrics.forEach((line, i) => {
    const div = document.createElement("div");
    div.className = "line";

    const parts = [];

    if (showKanji.checked && line.kanji) parts.push(`<div>${line.kanji}</div>`);
    if (showKana.checked && line.kana) parts.push(`<div>${line.kana}</div>`);
    if (showRomaji.checked && line.romaji)
      parts.push(`<div>${line.romaji}</div>`);
    if (showEnglish.checked && line.english)
      parts.push(`<div>${line.english}</div>`);

    if (parts.length === 0) parts.push(`<div>&nbsp;</div>`);

    div.innerHTML = parts.join("");
    div.onclick = () => handleLineClick(i);

    lyricsContainer.appendChild(div);
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

/* =============================================
   VOCAB PANEL
============================================= */

function showVocabForLine(line) {
  if (!showVocab.checked || !line?.vocab) {
    vocabPanel.innerHTML = "";
    return;
  }

  const list = line.vocab.split(";").map((x) => x.trim());
  vocabPanel.innerHTML = list
    .map((w) => `<div class="vocab-word">${w}</div>`)
    .join("");
}

/* Toggles re-render lyrics */
[showKanji, showKana, showRomaji, showEnglish, showVocab].forEach((cb) => {
  cb.addEventListener("change", renderLyrics);
});

/* =============================================
   SONG NAVIGATION BUTTONS
============================================= */

prevSongBtn.addEventListener("click", () => {
  if (currentSongIndex > 0) loadSong(currentSongIndex - 1);
});

nextSongBtn.addEventListener("click", () => {
  if (currentSongIndex < songList.length - 1) loadSong(currentSongIndex + 1);
});

/* =============================================
   LYRIC HIGHLIGHT LOOP
============================================= */

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

    const lines = document.querySelectorAll(".line");
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

/* =============================================
   LOAD SONG LIST (index.json)
============================================= */

fetch("index.json")
  .then((res) => res.json())
  .then((list) => {
    songList = list;
    if (songList.length > 0) loadSong(0);
  })
  .catch((err) => console.error("❌ Failed to load index.json:", err));
