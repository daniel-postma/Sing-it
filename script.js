let player;
let highlightIndex = -1;

let currentSong;
let lyrics = [];

const lyricsContainer = document.getElementById("lyrics");

const showKanji = document.getElementById("showKanji");
const showKana = document.getElementById("showKana");
const showRomaji = document.getElementById("showRomaji");
const showEnglish = document.getElementById("showEnglish");
const showVocab = document.getElementById("showVocab");

function extractVideoId(urlOrId) {
  if (!urlOrId) return "";
  const match = urlOrId.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : urlOrId;
}

function onYouTubeIframeAPIReady() {
  const id = extractVideoId(
    currentSong?.videoUrl || currentSong?.videoId || "uP8CtPMAd5Q"
  );
  player = new YT.Player("player", {
    height: "360",
    width: "640",
    videoId: id,
    playerVars: { autoplay: 0 },
  });
}

// Load default song
fetch("mou_ichido.json")
  .then((response) => response.json())
  .then((json) => {
    currentSong = json;
    lyrics = json.lyrics;
    const id = extractVideoId(json.videoUrl || json.videoId);
    if (player) player.loadVideoById(id);
    renderLyrics();
  })
  .catch((err) => console.error("❌ Failed to load default JSON:", err));

function renderLyrics() {
  lyricsContainer.innerHTML = "";

  lyrics.forEach((line, i) => {
    const div = document.createElement("div");
    div.className = "line";

    let content = [];

    // DISPLAY ORDER
    if (showKanji.checked && line.kanji) {
      content.push(`<div class="kanji-line">${line.kanji}</div>`);
    }
    if (showKana.checked && line.kana) {
      content.push(`<div class="kana-line">${line.kana}</div>`);
    }
    if (showRomaji.checked && line.romaji) {
      content.push(`<div class="romaji-line">${line.romaji}</div>`);
    }
    if (showEnglish.checked && line.english) {
      content.push(`<div class="english-line">${line.english}</div>`);
    }

    // VOCAB (array or string supported)
    if (showVocab.checked && line.vocab) {
      let vocabText = "";

      if (Array.isArray(line.vocab)) {
        vocabText = line.vocab.map((v) => `${v.word}: ${v.meaning}`).join("; ");
      } else {
        vocabText = String(line.vocab);
      }

      content.push(`<div class="vocab-line">${vocabText}</div>`);
    }

    // fallback
    if (content.length === 0) {
      const fallback =
        line.kanji || line.kana || line.romaji || line.english || "";
      content.push(`<div class="kanji-line">${fallback}</div>`);
    }

    div.innerHTML = content.join("");
    div.onclick = () => handleLineClick(i);

    lyricsContainer.appendChild(div);
  });

  document.querySelector(
    "h1"
  ).textContent = `🎵 ${currentSong.title} - ${currentSong.artist}`;
}

function handleLineClick(index) {
  if (!player) return;

  if (typeof lyrics[index].time === "number") {
    player.seekTo(lyrics[index].time, true);
    player.playVideo();
  }
}

// Re-render when toggles change
[showKanji, showKana, showRomaji, showEnglish, showVocab].forEach((cb) => {
  if (cb) cb.addEventListener("change", renderLyrics);
});

// Highlight system
setInterval(() => {
  if (!player?.getCurrentTime) return;

  const time = player.getCurrentTime();
  let idx = -1;

  for (let i = 0; i < lyrics.length; i++) {
    if (typeof lyrics[i].time === "number" && lyrics[i].time <= time) {
      idx = i;
    }
  }

  if (idx !== highlightIndex) {
    highlightIndex = idx;

    const lines = document.querySelectorAll(".line");
    lines.forEach((l, i) => l.classList.toggle("highlight", i === idx));

    if (idx >= 0) {
      const lineEl = lines[idx];
      const offset = Math.max(0, lineEl.offsetTop - 109);
      lyricsContainer.scrollTo({ top: offset, behavior: "smooth" });
    }
  }
}, 200);

renderLyrics();
